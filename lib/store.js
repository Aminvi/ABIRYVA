const { createHash } = require('node:crypto');
const ready = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
async function command(...args) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Storage unavailable');
  return data.result;
}
const digest = value => createHash('sha256').update(value).digest('hex');
async function limit(key, maximum, seconds) {
  const result = await command('EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, seconds);
  return Number(result) <= maximum;
}
function originAllowed(origin) {
  const origins = ['https://www.abiryva.com', 'https://abiryva.com', 'https://abiryva.vercel.app'];
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) if (host) origins.push('https://' + host);
  if (process.env.NODE_ENV === 'development') origins.push('http://localhost:3000');
  return origins.includes(origin);
}
module.exports = { ready, command, digest, limit, originAllowed };
