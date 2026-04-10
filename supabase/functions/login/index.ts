/**
 * Supabase Edge Function: /functions/v1/login
 *
 * Replaces the client-side SHA-256 password check with server-side
 * bcrypt verification. Handles:
 *   - Server-side account lockout (5 attempts → 15-min lockout)
 *   - Seamless SHA-256 → bcrypt migration on first login
 *   - Returns a safe user object (no password_hash)
 *
 * Required secrets (set via Supabase Dashboard → Settings → Edge Functions):
 *   SUPABASE_URL              – your project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service role key (bypasses RLS)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from 'npm:bcryptjs@2.4.3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 minutes
const BCRYPT_COST  = 12;

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, 405);
  }

  let body: { user_id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: 'Invalid request body' }, 400);
  }

  const { user_id, password } = body;
  if (!user_id || !password) {
    return json({ success: false, message: 'user_id and password are required' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const uid = user_id.trim().toUpperCase();

  // ── 1. Check server-side lockout ──────────────────────────────────────────
  const { data: attempt } = await supabase
    .from('login_attempts')
    .select('attempt_count, locked_until')
    .eq('user_id', uid)
    .maybeSingle();

  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60000);
    return json({ success: false, message: `Account locked. Try again in ${mins} minute(s).` });
  }

  // ── 2. Fetch user record ──────────────────────────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from('app_users')
    .select('id, user_id, name, email, role, password_hash, is_temp_password, is_active')
    .eq('user_id', uid)
    .maybeSingle();

  if (userErr || !user || !user.is_active) {
    await recordFailure(supabase, uid, attempt);
    return json(failMessage(attempt));
  }

  // ── 3. Verify password (bcrypt or legacy SHA-256 migration) ───────────────
  const storedHash: string = user.password_hash;
  const isBcrypt = storedHash.startsWith('$2');
  let valid = false;

  if (isBcrypt) {
    valid = await bcrypt.compare(password, storedHash);
  } else {
    // Legacy SHA-256 path — compare, then silently migrate to bcrypt
    const sha256hex = await sha256(password);
    valid = sha256hex === storedHash;
    if (valid) {
      const newHash = await bcrypt.hash(password, BCRYPT_COST);
      await supabase
        .from('app_users')
        .update({ password_hash: newHash })
        .eq('id', user.id);
    }
  }

  if (!valid) {
    await recordFailure(supabase, uid, attempt);
    return json(failMessage(attempt));
  }

  // ── 4. Success — clear lockout, update last_login ─────────────────────────
  await Promise.all([
    supabase.from('login_attempts').delete().eq('user_id', uid),
    supabase.from('app_users').update({ last_login: new Date().toISOString() }).eq('id', user.id),
  ]);

  return json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_temp_password: user.is_temp_password,
    },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function recordFailure(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  existing: { attempt_count: number; locked_until: string | null } | null,
): Promise<void> {
  const count = (existing?.attempt_count ?? 0) + 1;
  const lockedUntil = count >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MS).toISOString()
    : null;

  if (existing) {
    await supabase
      .from('login_attempts')
      .update({ attempt_count: count, last_attempt_at: new Date().toISOString(), locked_until: lockedUntil })
      .eq('user_id', uid);
  } else {
    await supabase
      .from('login_attempts')
      .insert({ user_id: uid, attempt_count: count, last_attempt_at: new Date().toISOString(), locked_until: lockedUntil });
  }
}

function failMessage(existing: { attempt_count: number } | null): { success: false; message: string } {
  const count = (existing?.attempt_count ?? 0) + 1;
  const remaining = Math.max(0, MAX_ATTEMPTS - count);
  const message = remaining === 0
    ? 'Too many failed attempts. Account locked for 15 minutes.'
    : `Invalid credentials. ${remaining} attempt(s) remaining.`;
  return { success: false, message };
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
