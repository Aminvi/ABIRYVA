// Run locally with node --env-file=.env.local scripts/portal-admin.cjs <command> ...
const fs = require('node:fs');
const path = require('node:path');
const store = require('../lib/store');
async function main() {
  const [action, clientId, ...args] = process.argv.slice(2);
  if (!store.ready() || !/^[a-z0-9-]{1,80}$/.test(clientId || '')) throw new Error('Configure Redis and supply a valid client ID.');
  if (action === 'workspace') {
    const value = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    if (typeof value.name !== 'string' || !Array.isArray(value.projects) || !Array.isArray(value.documents) || value.documents.some(d => !/^[a-z0-9-]{1,80}$/.test(d.id))) throw new Error('Workspace must contain a name, projects array and documents array with valid IDs.');
    await store.command('SET', 'portal:workspace:' + clientId, JSON.stringify(value));
  } else if (action === 'grant') {
    if (!/^user_[a-zA-Z0-9]+$/.test(args[0] || '')) throw new Error('Supply the invited Clerk user ID.');
    const key = 'portal:member:' + args[0];
    const existing = await store.command('GET', key);
    if (existing && JSON.parse(existing).clientId !== clientId) throw new Error('User already belongs to another client. Revoke that assignment before changing it.');
    await store.command('SET', key, JSON.stringify({clientId, active: true}));
  } else if (action === 'revoke') {
    const key = 'portal:member:' + args[0]; const existing = await store.command('GET', key);
    if (existing && JSON.parse(existing).clientId === clientId) await store.command('DEL', key);
  } else if (action === 'document') {
    const [id, file] = args;
    if (!/^[a-z0-9-]{1,80}$/.test(id || '')) throw new Error('Supply a valid document ID.');
    const bytes = fs.readFileSync(file); if (bytes.length > 1024 * 1024) throw new Error('Document limit is 1 MB.');
    await store.command('SET', 'portal:document:' + clientId + ':' + id, JSON.stringify({ filename: path.basename(file), base64: bytes.toString('base64') }), 'EX', 90 * 86400);
  } else if (action === 'tickets') {
    const ids = await store.command('LRANGE', 'portal:ticket-index:' + clientId, 0, 499);
    const tickets = ids?.length ? await store.command('MGET', ...ids.map(id => 'portal:ticket:' + clientId + ':' + id)) : [];
    // Deliberate local export for staff use, never application logging.
    fs.writeFileSync(args[0], JSON.stringify(tickets.filter(Boolean).map(x => JSON.parse(x)), null, 2), {mode:0o600});
  } else if (action === 'ticket-status') {
    const [id, status] = args;
    if (!['Open','In progress','Resolved'].includes(status)) throw new Error('Use Open, In progress or Resolved.');
    const key = 'portal:ticket:' + clientId + ':' + id;
    const script = "local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local d=cjson.decode(raw); d.status=ARGV[1]; redis.call('SET',KEYS[1],cjson.encode(d),'KEEPTTL'); return 1";
    if (!await store.command('EVAL', script, 1, key, status)) throw new Error('Ticket unavailable.');
  } else throw new Error('Commands: workspace, grant, revoke, document, tickets, ticket-status.');
  console.log('Portal administration completed.');
}
main().catch(() => { console.error('Portal administration failed. Check the command, inputs and service configuration.'); process.exitCode=1; });
