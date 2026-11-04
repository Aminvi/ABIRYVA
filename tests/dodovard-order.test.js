const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../api/dodovard-order.js'),'utf8');
function setup({providerOk=true,limited=false}={}) {
  const cache=new Map(),sent=[];
  const store={ready:()=>true,digest:s=>s,limit:async()=>!limited,command:async(c,k,v)=>c==='GET'?cache.get(k):(cache.set(k,v),'OK')};
  const ctx={module:{exports:{}},require:n=>n==='../lib/store'?store:require(n),process:{env:{RESEND_API_KEY:'test-only-key',ENQUIRY_FROM_EMAIL:'Example <mail@example.com>'}},Buffer,AbortSignal,console:{info(){},error(){}},fetch:async(url,options)=>{sent.push({url,...JSON.parse(options.body)});return {ok:providerOk,status:providerOk?200:403,json:async()=>providerOk?{id:'mail-test-id'}:{}};}};
  vm.runInNewContext(source,ctx);
  const body={reference:'DODO-TEST20261104-A1B2C3D4',order:{Name:'TEST ONLY',Phone:'00000000000',Fulfilment:'Pickup',Date:'4 November 2026','Order items':'1 × Smash Plantain Burger',Total:'₦7,500'}};
  async function call(overrides={}){const req={method:'POST',headers:{origin:'https://dodovard.vercel.app','content-type':'application/json'},body,...overrides};const res={code:200,setHeader(){},status(c){this.code=c;return this;},json(data){this.data=data;return this;}};await ctx.module.exports(req,res);return res;}
  return {call,body,sent};
}
test('mail uses a fixed Dodovard recipient and deduplicates a repeated order',async()=>{
  const app=setup();const a=await app.call(),b=await app.call();
  assert.equal(a.code,200);assert.equal(b.data.messageId,'mail-test-id');assert.equal(app.sent.length,1);
  assert.deepEqual(app.sent[0].to,['dodovardng@gmail.com']);assert.match(app.sent[0].from,/^Dodovard Orders </);
  assert.equal(app.sent[0].reply_to,'dodovardng@gmail.com');
});
test('bad origins, arbitrary fields and non-plantain requests cannot send mail',async()=>{
  const app=setup();assert.equal((await app.call({headers:{origin:'https://other.example'}})).code,403);
  app.body.order.to='attacker@example.com';assert.equal((await app.call()).code,400);delete app.body.order.to;
  app.body.order['Order items']='2 × drinks';assert.equal((await app.call()).code,400);assert.equal(app.sent.length,0);
});
test('provider rejection and rate limits return failure without false success',async()=>{
  const app=setup({providerOk:false});const a=await app.call();assert.equal(a.code,502);assert.equal(a.data.success,false);
  const limited=setup({limited:true});assert.equal((await limited.call()).code,429);assert.equal(limited.sent.length,0);
});
test('an order reference cannot be reused for different order details',async()=>{
  const app=setup();await app.call();app.body.order.Total='₦9,000';assert.equal((await app.call()).code,409);assert.equal(app.sent.length,1);
});
