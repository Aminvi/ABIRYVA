const store = require('./store');
const { randomUUID } = require('node:crypto');
const ID = /^[a-z0-9-]{1,80}$/;
const DAY = 86400;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function text(value, maximum, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail('Please check the submitted details.');
  return value.trim();
}
async function get(clientId) {
  if (!ID.test(clientId || '')) fail('Invalid workspace.');
  const raw = await store.command('GET', 'portal:workspace:' + clientId);
  if (!raw) fail('Workspace unavailable.', 404);
  return JSON.parse(raw);
}
async function update(clientId, mutate) {
  if (!ID.test(clientId || '')) fail('Invalid workspace.');
  const key = 'portal:workspace:' + clientId;
  const raw = await store.command('GET', key);
  if (!raw) fail('Workspace unavailable.', 404);
  const workspace = JSON.parse(raw);
  mutate(workspace); workspace.updatedAt = new Date().toISOString();
  const script = "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1";
  if (!await store.command('EVAL', script, 1, key, raw, JSON.stringify(workspace), 180 * DAY)) fail('This workspace changed. Refresh and try again.', 409);
  return workspace;
}
async function tickets(clientId) {
  const ids = await store.command('LRANGE', 'portal:ticket-index:' + clientId, 0, 49);
  const values = ids?.length ? await store.command('MGET', ...ids.map(id => 'portal:ticket:' + clientId + ':' + id)) : [];
  return (values || []).filter(Boolean).map(x => JSON.parse(x));
}
async function audit(actor, action, clientId) {
  // Fixed TTL per event. Store identities needed for accountability, never content or secrets.
  const id = Date.now() + '-' + randomUUID();
  await store.command('SET', 'portal:audit:' + id, JSON.stringify({ actor: actor.userId, action, clientId, at: new Date().toISOString() }), 'EX', 90 * DAY);
}
module.exports = { ID, DAY, fail, text, get, update, tickets, audit };
