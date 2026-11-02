const store=require('../lib/store'),auth=require('../lib/portal-auth'),traffic=require('../lib/traffic');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  if(req.method==='GET'){
   if(!auth.configured())return res.status(503).json({error:'Traffic reporting is being configured.'});
   const actor=await auth.authenticate(req);auth.requireAdmin(actor);
   if(!await store.limit('traffic:read:'+store.digest(actor.userId),30,60))return res.status(429).json({error:'Please wait a minute.'});
   const days=Number(new URL(req.url,'https://www.abiryva.com').searchParams.get('days')||30);
   if(![7,30,90].includes(days))return res.status(400).json({error:'Choose 7, 30 or 90 days.'});
   return res.status(200).json(await traffic.report(days));
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  if(!store.originAllowed(req.headers.origin))return res.status(403).json({error:'Use the Abiryva website.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Invalid format.'});
  if(Number(req.headers['content-length']||0)>2048||typeof req.body==='string'&&Buffer.byteLength(req.body)>2048)return res.status(413).json({error:'Request too large.'});
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid event.'});}
  if(!b||Array.isArray(b)||Buffer.byteLength(JSON.stringify(b))>2048||b.consent!==true||typeof b.path!=='string'||!traffic.isPage(b.path)||!['view','discovery_click'].includes(b.event)||typeof b.referrer!=='string'||b.referrer.length>1024)return res.status(400).json({error:'Invalid event.'});
  if(req.headers.dnt==='1'||req.headers['sec-gpc']==='1'||/bot|spider|crawler|headless/i.test(req.headers['user-agent']||''))return res.status(204).end();
  if(!store.ready())return res.status(503).json({error:'Traffic collection unavailable.'});
  const ip=(process.env.VERCEL==='1'?req.headers['x-vercel-forwarded-for']:null)||req.socket?.remoteAddress||'unknown';
  if(!await store.limit('traffic:write:'+store.digest(String(ip)),120,3600))return res.status(429).json({error:'Event limit reached.'});
  await traffic.record(req,b.path,b.event,b.referrer);return res.status(204).end();
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});return res.status(503).json({error:'Traffic statistics are temporarily unavailable.'});}
};
