const store = require('../lib/store');
const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

const services = new Set(['general', 'technology-advisory', 'ai-automation', 'cloud-technology', 'cybersecurity', 'digital-transformation', 'digital-government', 'business-resilience', 'managed-advisory', 'security-operations', 'network-security', 'health-check', 'ai-governance', 'cloud-security', 'resilience']);
const configured = () => Boolean(process.env.RESEND_API_KEY && process.env.ENQUIRY_FROM_EMAIL && store.ready());
const sign = value => createHmac('sha256', process.env.RESEND_API_KEY).update(value).digest('hex');
function validToken(token) {
  if (typeof token !== 'string' || token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^[a-f0-9-]{36}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
  const age = Date.now() - Number(parts[0]);
  if (!Number.isFinite(age) || age < 2000 || age > 60 * 60 * 1000) return false;
  return timingSafeEqual(Buffer.from(parts[2]), Buffer.from(sign(parts[0] + '.' + parts[1])));
}
const allowedOrigin = store.originAllowed;
const requestIp = req => (process.env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] : null) || req.socket?.remoteAddress || 'unknown';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET') {
    if (!configured()) return res.status(200).json({ available: false });
    try {
      const ip = requestIp(req);
      if (!await store.limit('enquiry:tokens:' + store.digest(String(ip)), 30, 60)) { res.setHeader('Retry-After', '60'); return res.status(429).json({ error: 'Please wait a minute before trying again.' }); }
    } catch { return res.status(503).json({ available: false }); }
    const value = Date.now() + '.' + randomUUID();
    return res.status(200).json({ available: true, token: value + '.' + sign(value) });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (!allowedOrigin(req.headers.origin)) return res.status(403).json({ error: 'Please send your enquiry from the Abiryva website.' });
  if (!configured()) return res.status(503).json({ error: 'Please book a discovery call or email info@abiryva.com.' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'Unsupported request format.' });
  if (Number(req.headers['content-length'] || 0) > 16000) return res.status(413).json({ error: 'Your enquiry is too long.' });
  if (typeof req.body === 'string' && Buffer.byteLength(req.body) > 16000) return res.status(413).json({ error: 'Your enquiry is too long.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch (_) { return res.status(400).json({ error: 'Invalid enquiry.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Invalid enquiry.' });
  if (Buffer.byteLength(JSON.stringify(body)) > 16000) return res.status(413).json({ error: 'Your enquiry is too long.' });
  if (body.website) return res.status(400).json({ error: 'Please reload the page and try again.' });
  if (!validToken(body.token)) return res.status(400).json({ error: 'Please reload the page before sending your enquiry.' });
  if (['name','email','organisation','service','message'].some(key => typeof body[key] !== 'string') || (body.phone !== undefined && typeof body.phone !== 'string') || (body.website !== undefined && typeof body.website !== 'string')) return res.status(400).json({ error: 'Please check your enquiry details.' });
  const clean = key => typeof body[key] === 'string' ? body[key].trim() : '';
  const name = clean('name'), email = clean('email'), organisation = clean('organisation'), phone = clean('phone'), service = clean('service'), message = clean('message');
  if (!name || name.length > 120 || !organisation || organisation.length > 160 || phone.length > 40 || /[\r\n]/.test(name + organisation + phone) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email) || !services.has(service) || message.length < 20 || message.length > 5000 || body.consent !== true) return res.status(400).json({ error: 'Please check your details, message and privacy consent.' });
  try {
    const ip = requestIp(req);
    if (!await store.limit('enquiry:ip:' + store.digest(String(ip)), 10, 3600) || !await store.limit('enquiry:email:' + store.digest(email.toLowerCase()), 5, 3600)) {
      res.setHeader('Retry-After', '3600');
      return res.status(429).json({ error: 'Too many enquiries. Please try again later or email info@abiryva.com.' });
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'abiryva-' + body.token.split('.')[1] },
      body: JSON.stringify({ from: process.env.ENQUIRY_FROM_EMAIL, to: [process.env.ENQUIRY_TO_EMAIL || 'info@abiryva.com'], reply_to: email, subject: 'Abiryva website enquiry: ' + service, text: `Name: ${name}\nWork email: ${email}\nOrganisation: ${organisation}\nPhone: ${phone || 'Not provided'}\nService: ${service}\nPrivacy consent: Yes\n\n${message}` }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) { console.error('Enquiry provider rejected request', response.status); return res.status(502).json({ error: 'Your enquiry could not be sent. Please retry or email info@abiryva.com.' }); }
    return res.status(200).json({ ok: true });
  } catch (_) { console.error('Enquiry provider unavailable'); return res.status(502).json({ error: 'Your enquiry could not be sent. Please retry or email info@abiryva.com.' }); }
};
