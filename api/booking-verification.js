const { randomInt, randomUUID, createHmac } = require('node:crypto');
const hash = value => createHmac('sha256', process.env.RESEND_API_KEY).update(value).digest('hex');
const calendar = 'https://calendly.com/abiryva-info/30min';
async function redis(...command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Storage unavailable');
  return data.result;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const origins = ['https://abiryva.com', 'https://www.abiryva.com', 'https://abiryva.vercel.app'];
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) if (host) origins.push('https://' + host);
  if (process.env.NODE_ENV === 'development') origins.push('http://localhost:3000');
  if (!origins.includes(req.headers.origin)) return res.status(403).json({ error: 'Please use the Abiryva website.' });
  if (![process.env.RESEND_API_KEY, process.env.ENQUIRY_FROM_EMAIL, process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN].every(Boolean)) return res.status(503).json({ error: 'Email verification is temporarily unavailable. Please email info@abiryva.com for help booking.' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'Invalid request format.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: 'Invalid request.' }); }
  if (!body || JSON.stringify(body).length > 2000) return res.status(400).json({ error: 'Invalid request.' });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  try {
    if (body.action === 'send') {
      // Atomic counters have a fixed expiry even if the function is interrupted.
      const limit = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n";
      const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      if (await redis('EVAL', limit, 1, 'booking:ip:' + hash(String(ip)), 3600) > 20 || await redis('EVAL', limit, 1, 'booking:email:' + hash(email), 3600) > 5) return res.status(429).json({ error: 'Too many codes requested. Please try again in an hour.' });
      if (!await redis('SET', 'booking:cooldown:' + hash(email), '1', 'EX', 60, 'NX')) return res.status(429).json({ error: 'Please wait one minute before requesting another code.' });
      const id = randomUUID(), code = String(randomInt(0, 1000000)).padStart(6, '0');
      await redis('SET', 'booking:code:' + id, JSON.stringify({ email, digest: hash(id + ':' + email + ':' + code), attempts: 0 }), 'EX', 600);
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.ENQUIRY_FROM_EMAIL, to: [email], subject: 'Your Abiryva booking verification code', text: `Your verification code is ${code}. It expires in 10 minutes. Enter it on the Abiryva website to open the booking calendar. If you did not request this code, ignore this email.` }), signal: AbortSignal.timeout(12000)
      });
      if (!sent.ok) { await redis('DEL', 'booking:code:' + id, 'booking:cooldown:' + hash(email)); throw new Error('Delivery failed'); }
      return res.status(200).json({ ok: true, challenge: id });
    }
    if (body.action !== 'verify' || !/^[a-f0-9-]{36}$/.test(body.challenge || '') || !/^\d{6}$/.test(body.code || '')) return res.status(400).json({ error: 'Enter the six-digit code from your email.' });
    const digest = hash(body.challenge + ':' + email + ':' + body.code);
    const script = `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local d=cjson.decode(raw); if d.email~=ARGV[1] then return 0 end; d.attempts=d.attempts+1; if d.digest==ARGV[2] then redis.call('DEL',KEYS[1]); return 1 end; if d.attempts>=5 then redis.call('DEL',KEYS[1]) else redis.call('SET',KEYS[1],cjson.encode(d),'KEEPTTL') end; return 0`;
    if (await redis('EVAL', script, 1, 'booking:code:' + body.challenge, email, digest) !== 1) return res.status(400).json({ error: 'Code incorrect or expired. Each code allows five attempts. Request a new code if needed.' });
    return res.status(200).json({ ok: true, bookingUrl: calendar + '?email=' + encodeURIComponent(email) });
  } catch { console.error('Booking verification service unavailable'); return res.status(502).json({ error: 'We could not complete verification. Please try again shortly.' }); }
};
