const { randomUUID } = require('node:crypto');
const store = require('../lib/store');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const action = new URL(req.url || '/api/portal', 'https://www.abiryva.com').searchParams.get('action');
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  if (req.method === 'GET' && action === 'config') return res.status(200).json({ available: Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY && store.ready()), publishableKey: process.env.CLERK_PUBLISHABLE_KEY || null });
  if (!process.env.CLERK_SECRET_KEY || !store.ready()) return res.status(503).json({ error: 'Client access is being configured. Please contact info@abiryva.com.' });
  if (req.method === 'POST' && !store.originAllowed(req.headers.origin)) return res.status(403).json({ error: 'Please use the Abiryva portal.' });
  const bearer = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
  if (!bearer) return res.status(401).json({ error: 'Please sign in.' });
  let claims;
  try {
    const { verifyToken } = require('@clerk/backend');
    const parties = ['https://www.abiryva.com', 'https://abiryva.com', 'https://abiryva.vercel.app'];
    if (process.env.NODE_ENV === 'development') parties.push('http://localhost:3000');
    if (process.env.VERCEL_URL) parties.push('https://' + process.env.VERCEL_URL);
    claims = await verifyToken(bearer[1], { secretKey: process.env.CLERK_SECRET_KEY, authorizedParties: parties });
    if (!claims.sub || !claims.sid) throw new Error('Not a session');
  } catch { return res.status(401).json({ error: 'Your session expired. Please sign in again.' }); }
  try {
    // Membership is provisioned by Abiryva; never accept a tenant ID from the browser.
    const rawMembership = await store.command('GET', 'portal:member:' + claims.sub);
    if (!rawMembership) return res.status(403).json({ error: 'Your account has not been assigned to a client workspace. Please contact Abiryva.' });
    const membership = JSON.parse(rawMembership);
    if (!membership.active || !/^[a-z0-9-]{1,80}$/.test(membership.clientId)) return res.status(403).json({ error: 'Workspace access is unavailable. Please contact Abiryva.' });
    const clientId = membership.clientId;
    if (!await store.limit('portal:requests:' + store.digest(claims.sub), 120, 60)) return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    if (req.method === 'GET' && action === 'document') {
      const id = new URL(req.url, 'https://www.abiryva.com').searchParams.get('id');
      if (!/^[a-z0-9-]{1,80}$/.test(id || '')) return res.status(400).json({ error: 'Invalid document.' });
      const raw = await store.command('GET', 'portal:document:' + clientId + ':' + id);
      if (!raw) return res.status(404).json({ error: 'Document unavailable.' });
      const doc = JSON.parse(raw);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="' + String(doc.filename || 'document').replace(/[^a-zA-Z0-9._-]/g, '_') + '"');
      return res.status(200).end(Buffer.from(doc.base64, 'base64'));
    }
    if (req.method === 'GET') {
      const workspace = JSON.parse(await store.command('GET', 'portal:workspace:' + clientId) || 'null');
      if (!workspace) return res.status(404).json({ error: 'Your workspace is not ready yet. Please contact Abiryva.' });
      const ids = await store.command('LRANGE', 'portal:ticket-index:' + clientId, 0, 49);
      const tickets = ids?.length ? await store.command('MGET', ...ids.map(id => 'portal:ticket:' + clientId + ':' + id)) : [];
      return res.status(200).json({ workspace, tickets: (tickets || []).filter(Boolean).map(value => JSON.parse(value)) });
    }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'Invalid request format.' });
    if (Number(req.headers['content-length'] || 0) > 10000) return res.status(413).json({ error: 'Request too large.' });
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: 'Invalid request.' }); }
    if (!body || JSON.stringify(body).length > 10000 || typeof body.subject !== 'string' || typeof body.message !== 'string' || body.subject.trim().length < 3 || body.subject.length > 160 || body.message.trim().length < 10 || body.message.length > 5000) return res.status(400).json({ error: 'Enter a subject (3–160 characters) and message (10–5000 characters).' });
    if (!await store.limit('portal:tickets:limit:' + store.digest(claims.sub), 10, 3600)) return res.status(429).json({ error: 'Support request limit reached. Please try again later.' });
    const ticket = { id: randomUUID(), subject: body.subject.trim(), message: body.message.trim(), status: 'Open', createdAt: new Date().toISOString() };
    // Fixed retention for every request, independent of later activity.
    await store.command('SET', 'portal:ticket:' + clientId + ':' + ticket.id, JSON.stringify(ticket), 'EX', 90 * 86400);
    // Index contains IDs only; messages are removed by the individual TTL.
    await store.command('LPUSH', 'portal:ticket-index:' + clientId, ticket.id);
    await store.command('LTRIM', 'portal:ticket-index:' + clientId, 0, 499);
    return res.status(201).json({ ok: true, ticket });
  } catch { console.error('Portal service unavailable'); return res.status(502).json({ error: 'The portal is temporarily unavailable. Please try again later.' }); }
};
