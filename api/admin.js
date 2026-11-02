const { randomUUID } = require('node:crypto');
const auth = require('../lib/portal-auth');
const store = require('../lib/store');
const ws = require('../lib/workspaces');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'}); }
  if (!auth.configured()) return res.status(503).json({error:'Staff access is being configured.'});
  if (req.method === 'POST' && !store.originAllowed(req.headers.origin)) return res.status(403).json({error:'Please use the Abiryva website.'});
  try {
    const actor = await auth.authenticate(req); auth.requireAdmin(actor);
    if (!await store.limit('admin:requests:' + store.digest(actor.userId), 60, 60)) return res.status(429).json({error:'Please wait a minute and try again.'});
    const query = new URL(req.url || '/api/admin','https://www.abiryva.com').searchParams;
    if (req.method === 'GET') {
      if (query.get('clientId')) { const clientId = query.get('clientId'); return res.status(200).json({workspace:await ws.get(clientId),tickets:await ws.tickets(clientId)}); }
      const ids = await store.command('SMEMBERS','portal:clients');
      if ((ids || []).length > 200) ws.fail('Workspace limit reached. Contact support.', 409);
      const values = ids?.length ? await store.command('MGET',...ids.map(id=>'portal:workspace:'+id)) : [];
      return res.status(200).json({workspaces:(values || []).filter(Boolean).map(x=>{const w=JSON.parse(x);return {id:w.id,name:w.name};})});
    }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({error:'Invalid request format.'});
    if (Number(req.headers['content-length'] || 0)>1500000) return res.status(413).json({error:'File or request too large.'});
    let body;
    try { if(typeof req.body==='string' && Buffer.byteLength(req.body)>1500000) ws.fail('Request too large.',413);body=typeof req.body==='string'?JSON.parse(req.body):req.body; } catch(error) {return res.status(error.status||400).json({error:'Invalid request.'});}
    if(!body || Array.isArray(body) || typeof body!=='object' || Buffer.byteLength(JSON.stringify(body))>1500000) ws.fail('Request too large or invalid.',413);
    let clientId=body.clientId;
    if(body.action==='create-workspace') {
      const ids=await store.command('SCARD','portal:clients');if(Number(ids)>=200) ws.fail('Workspace limit reached.',409);
      clientId=randomUUID();const workspace={id:clientId,name:ws.text(body.name,160),projects:[],documents:[],updatedAt:new Date().toISOString()};
      await store.command('SET','portal:workspace:'+clientId,JSON.stringify(workspace),'EX',180*ws.DAY,'NX');await store.command('SADD','portal:clients',clientId);
      await ws.audit(actor,body.action,clientId);return res.status(201).json({ok:true,clientId});
    }
    await ws.get(clientId);
    if(body.action==='save-project') {
      const status=body.status;if(!['Planning','In progress','On hold','Completed'].includes(status) || !Number.isInteger(body.progress) || body.progress<0 || body.progress>100) ws.fail('Check the project status and progress.');
      const id=body.id || randomUUID();if(!ws.ID.test(id)) ws.fail('Invalid project.');
      const project={id,name:ws.text(body.name,160),summary:ws.text(body.summary,2000,0),nextStep:ws.text(body.nextStep,500,0),status,progress:body.progress};
      await ws.update(clientId,w=>{const existing=w.projects.findIndex(p=>p.id===id);if(existing>=0)w.projects[existing]=project;else{if(w.projects.length>=50)ws.fail('Project limit reached.',409);w.projects.push(project);}});
    } else if(body.action==='upload-document') {
      const filename=ws.text(body.filename,160).replace(/[^a-zA-Z0-9._-]/g,'_');const name=ws.text(body.name,160);
      if(typeof body.base64!=='string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64) || body.base64.length>1400000)ws.fail('Invalid file.');
      const bytes=Buffer.from(body.base64,'base64');if(!bytes.length || bytes.length>1024*1024)ws.fail('Choose a file smaller than 1 MB.');
      const id=randomUUID();await store.command('SET','portal:document:'+clientId+':'+id,JSON.stringify({filename,base64:bytes.toString('base64')}),'EX',90*ws.DAY);
      try {await ws.update(clientId,w=>{if(w.documents.length>=50)ws.fail('Document limit reached.',409);w.documents.push({id,name,filename,expiresAt:new Date(Date.now()+90*ws.DAY*1000).toISOString()});});}catch(e){await store.command('DEL','portal:document:'+clientId+':'+id);throw e;}
    } else if(body.action==='grant-access' || body.action==='revoke-access') {
      const email=ws.text(body.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))ws.fail('Enter a valid email address.');
      const users=await actor.clerk.users.getUserList({emailAddress:[email],limit:2});
      const matches=users.data.filter(u=>u.emailAddresses.some(e=>e.emailAddress.toLowerCase()===email && e.verification?.status==='verified'));
      if(matches.length!==1)ws.fail('No matching verified account found. Invite this person through your sign-in provider and ask them to finish signing up first.',404);
      const userId=matches[0].id,key='portal:member:'+userId;
      if(body.action==='revoke-access') {await store.command('EVAL',"local r=redis.call('GET',KEYS[1]);if r and cjson.decode(r).clientId==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,key,clientId);}
      else {const result=await store.command('EVAL',"local r=redis.call('GET',KEYS[1]);if r and cjson.decode(r).clientId~=ARGV[1] then return 0 end;redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]);return 1",1,key,clientId,JSON.stringify({clientId,active:true}),180*ws.DAY);if(!result)ws.fail('This person already belongs to another workspace. Revoke that access first.',409);}
    } else if(body.action==='update-ticket') {
      if(!ws.ID.test(body.id || '') || !['Open','In progress','Resolved'].includes(body.status))ws.fail('Invalid support request.');
      const reply=ws.text(body.reply,5000,0),key='portal:ticket:'+clientId+':'+body.id;
      const script="local r=redis.call('GET',KEYS[1]);if not r then return 0 end;local d=cjson.decode(r);d.status=ARGV[1];d.reply=ARGV[2];d.updatedAt=ARGV[3];redis.call('SET',KEYS[1],cjson.encode(d),'KEEPTTL');return 1";
      if(!await store.command('EVAL',script,1,key,body.status,reply,new Date().toISOString()))ws.fail('Request unavailable.',404);
    } else ws.fail('Unknown action.');
    await ws.audit(actor,body.action,clientId);return res.status(200).json({ok:true,clientId});
  } catch(error) {if(error.status)return res.status(error.status).json({error:error.message});console.error('Staff portal service unavailable');return res.status(502).json({error:'The staff service is temporarily unavailable. Please try again later.'});}
};
