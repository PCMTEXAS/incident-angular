function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ehsEmailHtml(inc) {
  const id = escapeHtml(inc.incident_id ?? 'N/A');
  const type = escapeHtml(inc.incident_type ?? '');
  const site = escapeHtml(inc.incident_site ?? '');
  const date = escapeHtml(inc.incident_date ?? '');
  const desc = escapeHtml(inc.description ?? '');
  const reporter = escapeHtml(`${inc.reporter_first ?? ''} ${inc.reporter_last ?? ''}`.trim());
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#0057A8;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0">New EHS Incident Report</h2>
    </div>
    <div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#666;width:140px">Incident ID</td><td style="padding:6px 0;font-weight:600">${id}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Type</td><td style="padding:6px 0">${type}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Site</td><td style="padding:6px 0">${site}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Date</td><td style="padding:6px 0">${date}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Reporter</td><td style="padding:6px 0">${reporter}</td></tr>
        <tr><td style="padding:6px 0;color:#666;vertical-align:top">Description</td><td style="padding:6px 0">${desc}</td></tr>
      </table>
    </div>
  </div>`;
}

function cwEmailHtml(inc) {
  const id = escapeHtml(inc.incident_id ?? 'N/A');
  const site = escapeHtml(inc.cw_site_name ?? inc.cw_site_id ?? '');
  const customer = escapeHtml(`${inc.customer_first_name ?? ''} ${inc.customer_last_name ?? ''}`.trim());
  const vehicle = escapeHtml(`${inc.vehicle_year ?? ''} ${inc.vehicle_make ?? ''} ${inc.vehicle_model ?? ''}`.trim());
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#0057A8;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0">New Car Wash Damage Report</h2>
    </div>
    <div style="border:1px solid #ddd;border-top:none;padding:20px;border-radius:0 0 8px 8px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#666;width:140px">Incident ID</td><td style="padding:6px 0;font-weight:600">${id}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Site</td><td style="padding:6px 0">${site}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Customer</td><td style="padding:6px 0">${customer}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Vehicle</td><td style="padding:6px 0">${vehicle}</td></tr>
      </table>
    </div>
  </div>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    return;
  }

  const ADMIN_EMAIL = process.env.NOTIFY_ADMIN_EMAIL || 'safety@pcmtexas.com';

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const { type, incident } = body;
  if (!incident) { res.status(400).json({ error: 'Missing incident' }); return; }

  const isCw = type === 'cw' || type === 'car_wash';
  const subject = isCw
    ? `Car Wash Damage Report — ${escapeHtml(incident.incident_id ?? '')}`
    : `EHS Incident Report — ${escapeHtml(incident.incident_id ?? '')}`;
  const html = isCw ? cwEmailHtml(incident) : ehsEmailHtml(incident);

  const recipients = [ADMIN_EMAIL];
  if (!isCw && incident.reporter_email) recipients.push(incident.reporter_email);
  if (!isCw && incident.supervisor_email) recipients.push(incident.supervisor_email);

  const errors = [];
  for (const to of recipients) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'PCMHub <noreply@pcmtexas.com>', to, subject, html }),
      });
      if (!r.ok) errors.push(`${to}: ${await r.text()}`);
    } catch (e) { errors.push(`${to}: ${e.message}`); }
  }

  if (errors.length) {
    res.status(207).json({ sent: recipients.length - errors.length, errors });
  } else {
    res.status(200).json({ sent: recipients.length });
  }
};
