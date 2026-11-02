import { Clerk } from '@clerk/clerk-js';
export let clerk;
export const node = (tag,text,className) => {const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
export async function api(path='/api/portal',options={}) {
 const token=await clerk?.session?.getToken();if(!token)throw new Error('Please sign in again.');
 const response=await fetch(path,{...options,headers:{Authorization:'Bearer '+token,...options.headers},cache:'no-store'});
 if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('This service is unavailable. Please contact Abiryva.');
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;
}
export async function start(onSignedIn) {
 const status=document.querySelector('[data-portal-status]');
 try {
  const response=await fetch('/api/portal?action=config',{cache:'no-store'});
  if(!response.ok || !(response.headers.get('content-type')||'').includes('application/json'))throw new Error('Client access is not available yet. Please contact info@abiryva.com.');
  const config=await response.json();if(!config.available)throw new Error('Client access is being configured. Please contact info@abiryva.com.');
  const clerkDomain=atob(config.publishableKey.split('_')[2]).slice(0,-1);
  if(!/^(?:[a-z0-9-]+\.clerk\.accounts\.dev|clerk\.abiryva\.com)$/.test(clerkDomain))throw new Error('Sign-in configuration is unavailable.');
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://'+clerkDomain+'/npm/@clerk/ui@1/dist/ui.browser.js';script.async=true;script.crossOrigin='anonymous';script.onload=resolve;script.onerror=()=>reject(new Error('Sign-in could not load. Please try again.'));document.head.append(script);});
  clerk=new Clerk(config.publishableKey);await clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
  if(!clerk.user){status.textContent='Sign in using your invited account.';clerk.mountSignIn(document.querySelector('[data-portal-login]'),{routing:'hash',forceRedirectUrl:location.origin+location.pathname});return;}
  document.querySelector('[data-portal-login]').hidden=true;
  const account=document.querySelector('[data-account-settings]');account.hidden=false;account.addEventListener('click',()=>clerk.openUserProfile());
  const out=document.querySelector('[data-sign-out]');out.hidden=false;out.addEventListener('click',()=>clerk.signOut({redirectUrl:location.pathname}));
  clerk.addListener(({session})=>{if(!session){document.querySelectorAll('[data-private]').forEach(n=>{n.hidden=true;n.replaceChildren();});status.textContent='Your session ended. Refresh this page to sign in again.';}});
  await onSignedIn();
 }catch(error){status.textContent=error.message;}
}
