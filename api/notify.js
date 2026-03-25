const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Read from environment — never hard-code email addresses / secrets
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const FROM = process.env.EMAIL_FROM || 'DigitalChalk EHS <onboarding@resend.dev>';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://localhost:4200/dashboard';

// Allowed origins for CORS — restrict to your actual domain(s)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function getCorsOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.length === 0) return undefined; // deny if unset
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return undefined;
}

function urgencyBadge(u) {
  const colors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
  return `<span style="background:${colors[u]||'#6b7280'};color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase">${u||'medium'}</span>`;
}

function escapeHtml(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildAdminEmail(incident) {
  const { incident_id, incident_type, urgency, incident_date, incident_site, incident_area,
    reporter_first, reporter_last, reporter_dept,
    involved_first, involved_last, description, injury_type, osha_recordable } = incident;

  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#1a2332;color:#fff;padding:24px 32px">
    <div style="font-size:22px;font-weight:700">🛡 DigitalChalk EHS — New Incident Report</div>
    <div style="color:#8899aa;margin-top:4px;font-size:14px">Submitted ${new Date().toLocaleString('en-US',{dateStyle:'full',timeStyle:'short'})}</div>
  </div>
  <div style="padding:28px 32px">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:28px">⚠️</span>
      <div>
        <div style="font-weight:700;font-size:16px;color:#1a2332">${escapeHtml(incident_type?.replace(/_/g,' ').toUpperCase())} — ${escapeHtml(incident_id)}</div>
        <div style="margin-top:4px">${urgencyBadge(urgency)}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr style="background:#f8fafc"><td style="padding:10px 14px;font-weight:600;color:#374151;width:40%;font-size:13px">Date of Incident</td><td style="padding:10px 14px;font-size:13px">${escapeHtml(incident_date)}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#374151;font-size:13px">Site / Area</td><td style="padding:10px 14px;font-size:13px">${escapeHtml(incident_site)} ${incident_area ? `/ ${escapeHtml(incident_area)}` : ''}</td></tr>
      <tr style="background:#f8fafc"><td style="padding:10px 14px;font-weight:600;color:#374151;font-size:13px">Reported By</td><td style="padding:10px 14px;font-size:13px">${escapeHtml(reporter_first)} ${escapeHtml(reporter_last)} (${escapeHtml(reporter_dept)})</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#374151;font-size:13px">Person Involved</td><td style="padding:10px 14px;font-size:13px">${escapeHtml(involved_first)} ${escapeHtml(involved_last)}</td></tr>
      <tr style="background:#f8fafc"><td style="padding:10px 14px;font-weight:600;color:#374151;font-size:13px">Injury Type</td><td style="padding:10px 14px;font-size:13px">${escapeHtml(injury_type)}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#374151;font-size:13px">OSHA Recordable</td><td style="padding:10px 14px;font-size:13px">${osha_recordable ? '✅ Yes' : '❌ No'}</td></tr>
    </table>

    <div style="margin-bottom:24px">
      <div style="font-weight:700;color:#1a2332;margin-bottom:8px;font-size:14px">Description</div>
      <div style="background:#f8fafc;border-radius:8px;padding:14px;font-size:13px;color:#374151;line-height:1.6">${escapeHtml(description)}</div>
    </div>

    <a href="${DASHBOARD_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">View in Dashboard →</a>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8">DigitalChalk EHS Incident Portal · OSHA 29 CFR 1904 Compliant</div>
</div>
</body></html>`;
}

function buildSubmitterEmail(incident) {
  const { incident_id, incident_type, urgency, incident_date, incident_site,
    reporter_first } = incident;
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#1a2332;color:#fff;padding:24px 32px">
    <div style="font-size:20px;font-weight:700">🛡 Incident Report Submitted</div>
    <div style="color:#8899aa;margin-top:4px;font-size:14px">Your report has been received</div>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:15px;color:#1a2332">Hi ${escapeHtml(reporter_first)},</p>
    <p style="font-size:14px;color:#374151;line-height:1.6">Your incident report has been successfully submitted and logged in the EHS system. Our safety team has been notified and will follow up as needed.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0">
      <div style="font-weight:700;color:#15803d;margin-bottom:10px">📋 Report Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600;width:40%">Reference ID</td><td style="padding:6px 0;font-size:13px;color:#15803d;font-weight:700">${escapeHtml(incident_id)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600">Type</td><td style="padding:6px 0;font-size:13px">${escapeHtml(incident_type?.replace(/_/g,' '))}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600">Date</td><td style="padding:6px 0;font-size:13px">${escapeHtml(incident_date)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600">Site</td><td style="padding:6px 0;font-size:13px">${escapeHtml(incident_site)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#374151;font-weight:600">Urgency</td><td style="padding:6px 0;font-size:13px">${escapeHtml(urgency)}</td></tr>
      </table>
    </div>

    <div style="font-size:13px;color:#6b7280;line-height:1.6">Please keep your reference ID (<strong>${escapeHtml(incident_id)}</strong>) for your records. If you have additional information to add, contact your EHS Administrator.</div>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8">DigitalChalk EHS Incident Portal · OSHA 29 CFR 1904 Compliant</div>
</div>
</body></html>`;
}

function buildSupervisorEmail(incident) {
  const { incident_id, incident_type, urgency, incident_date, incident_site,
    supervisor_name, involved_first, involved_last, description, injury_type } = incident;
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#1a2332;color:#fff;padding:24px 32px">
    <div style="font-size:20px;font-weight:700">🛡 Action Required — Employee Incident Report</div>
    <div style="color:#8899aa;margin-top:4px;font-size:14px">One of your employees has been involved in an incident</div>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:15px;color:#1a2332">Hi ${escapeHtml(supervisor_name || 'Supervisor')},</p>
    <p style="font-size:14px;color:#374151;line-height:1.6">An incident report has been filed involving one of your team members. Please review the details below and take any required follow-up action.</p>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:20px 0">
      <div style="font-weight:700;color:#c2410c;margin-bottom:10px">⚠️ Incident Details</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151;width:40%">Reference ID</td><td style="padding:6px 0;font-size:13px;font-weight:700;color:#c2410c">${escapeHtml(incident_id)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151">Employee</td><td style="padding:6px 0;font-size:13px">${escapeHtml(involved_first)} ${escapeHtml(involved_last)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151">Incident Type</td><td style="padding:6px 0;font-size:13px">${escapeHtml(incident_type?.replace(/_/g,' '))}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151">Injury Type</td><td style="padding:6px 0;font-size:13px">${escapeHtml(injury_type)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151">Date / Site</td><td style="padding:6px 0;font-size:13px">${escapeHtml(incident_date)} · ${escapeHtml(incident_site)}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;font-weight:600;color:#374151">Urgency</td><td style="padding:6px 0;font-size:13px">${urgencyBadge(urgency)}</td></tr>
      </table>
      <div style="margin-top:12px;font-size:13px;color:#374151"><strong>Description:</strong> ${escapeHtml(description)}</div>
    </div>

    <a href="${DASHBOARD_URL}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Review in Dashboard →</a>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8">DigitalChalk EHS Incident Portal · OSHA 29 CFR 1904 Compliant</div>
</div>
</body></html>`;
}

module.exports = async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req);
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { incident } = req.body || {};
  if (!incident) return res.status(400).json({ error: 'Missing incident data' });

  const sends = [];

  // 1. Admin notification
  sends.push(resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `🚨 New Incident: ${incident.incident_id} — ${(incident.incident_type||'').replace(/_/g,' ')} [${(incident.urgency||'medium').toUpperCase()}]`,
    html: buildAdminEmail(incident)
  }));

  // 2. Submitter copy
  if (incident.reporter_email) {
    sends.push(resend.emails.send({
      from: FROM,
      to: incident.reporter_email,
      subject: `✅ Incident Report Submitted — ${incident.incident_id}`,
      html: buildSubmitterEmail(incident)
    }));
  }

  // 3. Supervisor notification
  if (incident.supervisor_email) {
    sends.push(resend.emails.send({
      from: FROM,
      to: incident.supervisor_email,
      subject: `⚠️ Action Required — Incident Report ${incident.incident_id}`,
      html: buildSupervisorEmail(incident)
    }));
  }

  try {
    const results = await Promise.allSettled(sends);
    const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
    if (errors.length && errors.length === sends.length) {
      return res.status(500).json({ error: 'All emails failed', details: errors });
    }
    return res.status(200).json({ sent: sends.length, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
