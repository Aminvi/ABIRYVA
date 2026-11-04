// Dodovard reuses the owner's existing mail service; credentials stay here.
const store = require('../lib/store');
const {createHash} = require('node:crypto');
const fields = new Set(['Name','Phone','Fulfilment','Address','Area','Zone','Date','Order items','Subtotal','Delivery fee','Total','Sender name','Notes','Map location']);
const hash = value => createHash('sha256').update(value).digest('hex');
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({success:false});}
  if(req.headers.origin!=='https://dodovard.vercel.app')return res.status(403).json({success:false,error:'Invalid website origin.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({success:false});
  if(Number(req.headers['content-length']||0)>24000)return res.status(413).json({success:false});
  let body;
  try {body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({success:false});}
  if(!body||Buffer.byteLength(JSON.stringify(body))>24000||!/^DODO-[A-Z0-9]+-[A-F0-9]{8}$/.test(body.reference||'')||!body.order||typeof body.order!=='object'||Array.isArray(body.order))return res.status(400).json({success:false});
  const entries=Object.entries(body.order);
  if(entries.some(([key,value])=>!fields.has(key)||typeof value!=='string'||value.length>10000)||!body.order.Name?.trim()||body.order.Name.length>160||!/\d{7}/.test(body.order.Phone?.replace(/\D/g,'')||'')||!['Pickup','Delivery'].includes(body.order.Fulfilment)||!body.order.Date||!body.order['Order items']||!/plantain/i.test(body.order['Order items']))return res.status(400).json({success:false,error:'Check the order details.'});
  if(!process.env.RESEND_API_KEY||!process.env.ENQUIRY_FROM_EMAIL||!store.ready())return res.status(503).json({success:false});
  const reference=body.reference,content=JSON.stringify(body.order),digest=hash(content),cacheKey='dodovard:sent:'+reference;
  try {
    const cached=await store.command('GET',cacheKey);
    if(cached) {
      const previous=JSON.parse(cached);
      if(previous.digest!==digest)return res.status(409).json({success:false,error:'Order reference already used.'});
      return res.status(200).json({success:true,reference,messageId:previous.messageId});
    }
    const ip=(process.env.VERCEL==='1'?req.headers['x-vercel-forwarded-for']:null)||req.socket?.remoteAddress||'unknown';
    if(!await store.limit('dodovard:ip:'+store.digest(String(ip)),80,3600)||!await store.limit('dodovard:phone:'+store.digest(body.order.Phone.replace(/\D/g,'')),10,3600))return res.status(429).json({success:false,error:'Please try again later or send your request on WhatsApp.'});
    const mailbox=process.env.ENQUIRY_FROM_EMAIL.match(/<([^<>]+)>/)?.[1]||process.env.ENQUIRY_FROM_EMAIL;
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'dodovard-'+reference},
      body:JSON.stringify({from:'Dodovard Orders <'+mailbox+'>',to:['dodovardng@gmail.com'],reply_to:'dodovardng@gmail.com',subject:'Dodovard '+body.order.Fulfilment.toLowerCase()+' request '+reference+(body.order.Name.startsWith('TEST ONLY')?' — TEST ONLY':''),text:'Order reference: '+reference+'\n\n'+entries.map(([k,v])=>k+': '+v).join('\n')}),
      signal:AbortSignal.timeout(12000)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.id) {console.error('Dodovard mail provider rejected request',{reference,status:response.status});return res.status(502).json({success:false});}
    await store.command('SET',cacheKey,JSON.stringify({digest,messageId:result.id}),'EX',86400);
    console.info('Dodovard notification accepted',{reference,messageId:result.id});
    return res.status(200).json({success:true,reference,messageId:result.id});
  }catch{console.error('Dodovard mail service unavailable',{reference});return res.status(502).json({success:false});}
};
