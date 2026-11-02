import {api,node} from './client-session.js';
export async function loadTraffic(){
 const notice=document.querySelector('[data-traffic-status]'),results=document.querySelector('[data-traffic-results]'),button=document.querySelector('[data-traffic-refresh]');button.disabled=true;notice.textContent='Loading traffic…';
 try{
  const data=await api('/api/traffic?days='+document.querySelector('[data-traffic-period]').value);results.replaceChildren();
  const metrics=node('div','','portal-grid portal-traffic-metrics');for(const [label,value]of [['Page views',data.views],['Discovery-call link clicks',data.discoveryClicks],['Enquiries sent',data.enquiries]]){const card=node('article','','portal-card');card.append(node('h3',label),node('p',String(value)));metrics.append(card);}results.append(metrics);
  if(!data.views)results.append(node('p','No recorded page views in this period. Collection begins after publication and requires visitor consent.'));
  const grid=node('div','','portal-grid');
  for(const [title,key]of [['Most viewed pages','pages'],['Traffic sources','sources'],['Countries','countries'],['Devices','devices']]){
   const section=node('section','','portal-card');section.append(node('h3',title));const table=document.createElement('table');table.className='portal-traffic-table';const head=document.createElement('thead'),tr=document.createElement('tr');tr.append(node('th',title),node('th','Page views'));head.append(tr);table.append(head);const body=document.createElement('tbody');
   for(const [name,count]of Object.entries(data[key]).sort((a,b)=>b[1]-a[1]).slice(0,10)){const row=document.createElement('tr');let label=key==='pages'?(data.pageNames[name]||name):name;if(key==='countries'&&name!=='Unknown'){try{label=new Intl.DisplayNames(['en'],{type:'region'}).of(name);}catch{}}row.append(node('td',label),node('td',String(count)));body.append(row);}table.append(body);section.append(table);if(!body.childElementCount)section.append(node('p','No data yet.'));grid.append(section);
  }
  results.append(grid);const details=document.createElement('details');details.append(node('summary','Daily page views (UTC)'));const table=document.createElement('table');table.className='portal-traffic-table';const tbody=document.createElement('tbody');for(const day of data.daily){const row=document.createElement('tr');row.append(node('th',day.date),node('td',String(day.views)));tbody.append(row);}table.append(tbody);details.append(table);results.append(details);notice.textContent='Updated '+new Date().toLocaleTimeString()+'.';
 }catch(error){results.replaceChildren();notice.textContent=error.message;}finally{button.disabled=false;}
}
export function bindTraffic(){document.querySelector('[data-traffic-refresh]').addEventListener('click',loadTraffic);document.querySelector('[data-traffic-period]').addEventListener('change',loadTraffic);}
