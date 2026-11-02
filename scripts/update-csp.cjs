const fs = require('node:fs');
const path = require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'), hashes=new Set();
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.html'))){
 let html=fs.readFileSync(path.join(root,name),'utf8');
 html=html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi,(whole,attrs,body)=>{
  if(/\bsrc=/.test(attrs))return whole;
  if(attrs.includes('application/ld+json')){hashes.add("'sha256-"+createHash('sha256').update(body).digest('base64')+"'");return whole;}
  if(!body.trim())return '';
  const file='inline-'+createHash('sha256').update(body).digest('hex').slice(0,12)+'.js';fs.writeFileSync(path.join(root,'js',file),body);
  return '<script defer src="js/'+file+'"></script>';
 });fs.writeFileSync(path.join(root,name),html);
}
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const policy="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://*.clerk.accounts.dev https://clerk.abiryva.com https://challenges.cloudflare.com https://*.protect.clerk.com "+[...hashes].sort().join(' ')+"; connect-src 'self' https://calendly.com https://*.calendly.com https://*.clerk.accounts.dev https://clerk.abiryva.com https://*.protect.clerk.com:*; frame-src 'self' https://calendly.com https://*.calendly.com https://*.clerk.accounts.dev https://clerk.abiryva.com https://challenges.cloudflare.com https://*.protect.clerk.com; worker-src 'self' blob:; upgrade-insecure-requests;";
config.headers[0].headers.find(x=>x.key==='Content-Security-Policy').value=policy;
config.headers=config.headers.filter(x=>x.source!=='/((?!api/).*)');
config.headers.push({source:'/((?!api/).*)',headers:[{key:'Access-Control-Allow-Origin',value:'https://www.abiryva.com'}]});
config.buildCommand='npm run build';config.outputDirectory='public';
fs.writeFileSync(path.join(root,'vercel.json'),JSON.stringify(config,null,2)+'\n');
console.log('Script policy updated; executable inline scripts externalized.');
