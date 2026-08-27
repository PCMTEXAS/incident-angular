import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(supabaseUrl, serviceKey);

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  // Create user action (admin only — caller must pass service role in Authorization header)
  if (body.action === 'create') {
    const { user_id, password, name, email, role, site } = body;
    if (!user_id || !password) return json({ error: 'user_id and password required' }, 400);
    const hash = await bcrypt.hash(password);
    const { error } = await supa.from('app_users').insert({ user_id, password_hash: hash, name, email, role: role ?? 'reporter', site: site ?? null });
    if (error) return json({ error: error.message }, 409);
    return json({ ok: true });
  }

  // Login action
  const { user_id, password } = body;
  if (!user_id || !password) return json({ error: 'user_id and password required' }, 400);

  const { data: user, error } = await supa.from('app_users').select('*').eq('user_id', user_id).single();
  if (error || !user) return json({ error: 'Invalid credentials' }, 401);

  // Check lockout
  if (user.locked) {
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return json({ error: 'Account locked. Try again later.' }, 403);
    }
    // Lockout expired — reset
    await supa.from('app_users').update({ locked: false, failed_attempts: 0, locked_until: null }).eq('id', user.id);
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    const attempts = (user.failed_attempts ?? 0) + 1;
    const update: any = { failed_attempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
      update.locked = true;
      update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    }
    await supa.from('app_users').update(update).eq('id', user.id);
    const remaining = MAX_ATTEMPTS - attempts;
    return json({ error: attempts >= MAX_ATTEMPTS ? `Account locked for ${LOCKOUT_MINUTES} minutes.` : `Invalid credentials. ${remaining} attempt(s) remaining.` }, 401);
  }

  // Success — reset failed attempts, update last_login
  await supa.from('app_users').update({ failed_attempts: 0, locked: false, locked_until: null, last_login: new Date().toISOString() }).eq('id', user.id);

  const { password_hash, ...safeUser } = user;
  return json({ user: safeUser });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
