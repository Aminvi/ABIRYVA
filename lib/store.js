const { createHmac, createHash } = require('node:crypto');
const ready = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
function namespace() {
  const value = process.env.APP_DATA_NAMESPACE || (process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview-' + createHash('sha256').update(process.env.VERCEL_GIT_COMMIT_REF || 'preview').digest('hex').slice(0,12) : 'development');
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(value)) throw new Error('Invalid data namespace');
  return 'abiryva:' + value + ':';
}
function scoped(args) {
  const result = [...args], prefix = namespace();
  const type = String(result[0]).toUpperCase();
  if (type === 'EVAL') { for(let i=3;i<3+Number(result[2]);i++)result[i]=prefix+result[i]; }
  else if (['MGET','DEL','UNLINK'].includes(type)) { for(let i=1;i<result.length;i++)result[i]=prefix+result[i]; }
  else if (['GET','SET','GETDEL','EXPIRE','TTL','PTTL','LRANGE','LPUSH','LTRIM','SADD','SCARD','SMEMBERS','SREM'].includes(type)) result[1]=prefix+result[1];
  else throw new Error('Unsupported storage operation');
  return result;
}
async function command(...args) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(scoped(args)), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Storage unavailable');
  return data.result;
}
const digest = value => createHmac('sha256', process.env.RATE_LIMIT_SECRET || process.env.RESEND_API_KEY || process.env.CLERK_SECRET_KEY).update(value).digest('hex');
async function limit(key, maximum, seconds) {
  const result = await command('EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, seconds);
  return Number(result) <= maximum;
}
function originAllowed(origin) {
  const origins = ['https://www.abiryva.com', 'https://abiryva.com', 'https://abiryva.vercel.app'];
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) if (host) origins.push('https://' + host);
  if (process.env.NODE_ENV === 'development') { origins.push('http://localhost:3000'); if (/^http:\/\/localhost:\d+$/.test(process.env.LOCAL_APP_ORIGIN || '')) origins.push(process.env.LOCAL_APP_ORIGIN); }
  return origins.includes(origin);
}
module.exports = { ready, command, digest, limit, originAllowed, namespace, scoped };
