const store = require('./store');
const pages = require('./traffic-pages.json');
const DAY = 86400;
function source(value) {
  if (!value) return 'Direct / unknown';
  let host; try { host = new URL(value).hostname.toLowerCase(); } catch { return 'Other websites'; }
  if (['abiryva.com','www.abiryva.com'].includes(host)) return 'Internal';
  if (/(^|\.)google\.[a-z.]{2,12}$/.test(host)) return 'Google';
  for (const [domain,label] of [['linkedin.com','LinkedIn'],['bing.com','Bing'],['facebook.com','Facebook'],['instagram.com','Instagram'],['t.co','X'],['duckduckgo.com','DuckDuckGo']]) if(host===domain||host.endsWith('.'+domain))return label;
  return 'Other websites';
}
function device(ua='') { return /ipad|tablet/i.test(ua)?'Tablet':/mobile|iphone|android/i.test(ua)?'Mobile':ua?'Desktop':'Unknown'; }
const normalize = value => value === '/index.html' ? '/' : value;
const isPage = value => Object.hasOwn(pages, normalize(value));
async function record(req, path, event='view', referrer='') {
  path=normalize(path); if(!isPage(path))return;
  const day=new Date().toISOString().slice(0,10);
  const country=process.env.VERCEL==='1' && /^[A-Z]{2}$/.test(req.headers['x-vercel-ip-country']||'')?req.headers['x-vercel-ip-country']:'Unknown';
  const script="local r=redis.call('GET',KEYS[1]);local d=r and cjson.decode(r) or {views=0,discoveryClicks=0,enquiries=0,pages={},sources={},countries={},devices={}};if d.views+d.discoveryClicks+d.enquiries>=20000 then return 0 end;local e=ARGV[1];d[e]=d[e]+1;if e=='views' then for i,k in ipairs({'pages','sources','countries','devices'}) do local v=ARGV[i+1];d[k][v]=(d[k][v] or 0)+1 end end;redis.call('SET',KEYS[1],cjson.encode(d),'EXAT',ARGV[6]);return 1";
  await store.command('EVAL',script,1,'traffic:day:'+day,({view:'views',discovery_click:'discoveryClicks',enquiry_sent:'enquiries'})[event],path,source(referrer),country,device(req.headers['user-agent']),Date.parse(day)/1000+90*DAY);
}
async function report(days) {
  const dates=Array.from({length:days},(_,i)=>new Date(Date.now()-(days-1-i)*DAY*1000).toISOString().slice(0,10));
  const records=await store.command('MGET',...dates.map(d=>'traffic:day:'+d));
  const result={days,views:0,discoveryClicks:0,enquiries:0,pages:{},sources:{},countries:{},devices:{},daily:[]};
  dates.forEach((date,i)=>{const d=records[i]?JSON.parse(records[i]):{};for(const key of ['views','discoveryClicks','enquiries'])result[key]+=d[key]||0;for(const key of ['pages','sources','countries','devices'])for(const [name,value]of Object.entries(d[key]||{}))result[key][name]=(result[key][name]||0)+value;result.daily.push({date,views:d.views||0});});
  result.pageNames=pages;return result;
}
module.exports={source,device,normalize,isPage,record,report};
