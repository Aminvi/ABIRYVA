const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/booking-verification');
async function request(body, origin = 'https://abiryva.com') {
 const res = { headers: {}, setHeader(k,v){this.headers[k]=v}, status(n){this.code=n;return this}, json(v){this.body=v;return this} };
 await handler({method:'POST',headers:{origin,'content-type':'application/json'},body},res); return res;
}
test('fails closed without configuration and rejects foreign origins', async () => {
 delete process.env.RESEND_API_KEY;
 assert.equal((await request({})).code,503);
 assert.equal((await request({},'https://other.example')).code,403);
});
test('code delivery, rejection, successful verification and single use', async () => {
 Object.assign(process.env,{RESEND_API_KEY:'test-secret',ENQUIRY_FROM_EMAIL:'book@example.com',UPSTASH_REDIS_REST_URL:'https://redis.example',UPSTASH_REDIS_REST_TOKEN:'test'});
 const previous=global.fetch; const store=new Map(); let code;
 global.fetch=async (url, options) => {
  const b=JSON.parse(options.body);
  if(url==='https://api.resend.com/emails') { code=b.text.match(/\d{6}/)[0]; return {ok:true}; }
  let result;
  if(b[0]==='SET') { store.set(b[1],b[2]); result='OK'; }
  if(b[0]==='EVAL' && b[1].includes('INCR')) result=1;
  if(b[0]==='EVAL' && b[1].includes('cjson')) {
   const data=JSON.parse(store.get(b[3]) || 'null'); result=0;
   if(data && data.email===b[4]) { data.attempts++; if(data.digest===b[5]) {result=1;store.delete(b[3]);} else if(data.attempts>=5) store.delete(b[3]); else store.set(b[3],JSON.stringify(data)); }
  }
  return {ok:true,json:async()=>({result})};
 };
 try {
  const sent=await request({action:'send',email:'person@example.com'});
  assert.equal(sent.code,200); assert.match(code,/^\d{6}$/);
  const body={action:'verify',email:'person@example.com',challenge:sent.body.challenge};
  assert.equal((await request({...body,code:code==='000000'?'000001':'000000'})).code,400);
  const verified=await request({...body,code}); assert.equal(verified.code,200);
  assert.equal(new URL(verified.body.bookingUrl).pathname,'/abiryva-info/30min');
  assert.equal((await request({...body,code})).code,400);
  const next=await request({action:'send',email:body.email});
  for(let i=0;i<5;i++) await request({...body,challenge:next.body.challenge,code:code==='000000'?'000001':'000000'});
  assert.equal((await request({...body,challenge:next.body.challenge,code})).code,400);
 } finally {global.fetch=previous;}
});
