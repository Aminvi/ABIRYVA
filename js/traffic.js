(() => {
  const key='abiryvaAnalyticsChoiceV1';
  const notice=document.getElementById('site-cookie-notice');
  let choice;try{choice=localStorage.getItem(key);}catch{}
  const blocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
  const allowed=()=>choice==='allow'&&!blocked();
  const publicPage=!/\/(?:admin|portal|404)\.html$/.test(location.pathname);
  let sent=false,clicks=0;
  const referrer=(()=>{try{return document.referrer?new URL(document.referrer).origin:'';}catch{return '';}})();
  function track(event){if(!allowed()||!publicPage)return;fetch('/api/traffic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,path:location.pathname,event,referrer}),keepalive:true}).catch(()=>{});}
  function view(){if(allowed()&&!sent){sent=true;track('view');}}
  if(notice){
    const row=document.createElement('div'),label=document.createElement('label'),box=document.createElement('input');row.className='site-privacy-preferences';box.type='checkbox';box.checked=allowed();box.disabled=blocked();label.append(box,document.createTextNode(' Allow aggregate website analytics (up to 90 days)'));row.append(label);
    const save=document.createElement('button');save.type='button';save.className='site-secondary-button';save.textContent='Save analytics choice';row.append(save);notice.querySelector('p').after(row);
    if(blocked()){const note=document.createElement('p');note.textContent='Your browser privacy signal disables analytics.';row.append(note);}
    function persist(value){choice=value;try{localStorage.setItem(key,value);}catch{}view();}
    save.addEventListener('click',()=>{persist(box.checked&&!blocked()?'allow':'essential');if(!localStorageSafe('abiryvaPrivacyChoiceV1')){try{localStorage.setItem('abiryvaPrivacyChoiceV1','essential');}catch{}}notice.hidden=true;});
    notice.querySelectorAll('[data-consent]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.consent==='essential')box.checked=false;persist(box.checked&&!blocked()?'allow':'essential');}));
    if(!choice)notice.hidden=false;
  }
  function localStorageSafe(name){try{return localStorage.getItem(name);}catch{return null;}}
  view();
  document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&clicks<5&&(link.getAttribute('href').includes('#book-call')||/^https:\/\/calendly\.com\//.test(link.href))){clicks++;track('discovery_click');}});
})();
