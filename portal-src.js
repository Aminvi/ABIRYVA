import { Clerk } from '@clerk/clerk-js';
const status = document.querySelector('[data-portal-status]');
const login = document.querySelector('[data-portal-login]');
const panel = document.querySelector('[data-workspace]');
let clerk;
const el = (tag, text, className) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
async function request(action = '', options = {}) {
  const token = await clerk.session?.getToken();
  const response = await fetch('/api/portal' + (action ? '?action=' + action : ''), { ...options, headers: { Authorization: 'Bearer ' + token, ...options.headers }, cache: 'no-store' });
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('The portal service is unavailable. Please contact Abiryva.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function render({ workspace, tickets }) {
  panel.hidden = false;
  document.querySelector('[data-client-name]').textContent = workspace.name;
  const projects = document.querySelector('[data-projects]'); projects.replaceChildren();
  for (const project of workspace.projects || []) {
    const article = el('article', '', 'portal-card');
    article.append(el('span', project.status, 'portal-tag'), el('h3', project.name), el('p', project.summary || ''));
    const label = el('label', 'Progress: ' + Math.min(100, Math.max(0, Number(project.progress) || 0)) + '%');
    const bar = document.createElement('progress'); bar.max = 100; bar.value = Math.min(100, Math.max(0, Number(project.progress) || 0)); label.append(bar); article.append(label);
    if (project.nextStep) article.append(el('p', 'Next: ' + project.nextStep));
    projects.append(article);
  }
  if (!projects.childElementCount) projects.append(el('p', 'No projects have been assigned yet.'));
  const docs = document.querySelector('[data-documents]'); docs.replaceChildren();
  for (const doc of workspace.documents || []) {
    const row = el('div', '', 'portal-document'); row.append(el('span', doc.name));
    const button = el('button', 'Download', 'site-secondary-button'); button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const token = await clerk.session.getToken();
        const response = await fetch('/api/portal?action=document&id=' + encodeURIComponent(doc.id), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
        if (!response.ok) throw new Error('Document unavailable. Please contact Abiryva.');
        const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = doc.filename || doc.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
    }); row.append(button); docs.append(row);
  }
  if (!docs.childElementCount) docs.append(el('p', 'No documents have been shared yet.'));
  const list = document.querySelector('[data-tickets]'); list.replaceChildren();
  for (const ticket of tickets || []) { const row = el('article', '', 'portal-card'); row.append(el('span', ticket.status, 'portal-tag'), el('h3', ticket.subject), el('p', ticket.message), el('small', new Date(ticket.createdAt).toLocaleDateString())); list.append(row); }
  if (!list.childElementCount) list.append(el('p', 'Your support requests will appear here.'));
}
async function loadWorkspace() {
  try { render(await request()); status.textContent = ''; } catch (error) { panel.hidden = true; status.textContent = error.message; }
}
async function start() {
  try {
    const response = await fetch('/api/portal?action=config', { cache: 'no-store' }); const config = await response.json();
    if (!response.ok || !config.available) throw new Error('Client portal access is being configured. Please contact info@abiryva.com for assistance.');
    clerk = new Clerk(config.publishableKey); await clerk.load();
    if (!clerk.user) { status.textContent = 'Sign in using your invited client account.'; clerk.mountSignIn(login, { routing: 'hash', forceRedirectUrl: location.origin + '/portal.html' }); return; }
    login.hidden = true; document.querySelector('[data-sign-out]').hidden = false;
    document.querySelector('[data-sign-out]').addEventListener('click', () => clerk.signOut({ redirectUrl: '/portal.html' }));
    await loadWorkspace();
    clerk.addListener(({ session }) => { if (!session) { panel.hidden = true; location.reload(); } });
  } catch (error) { status.textContent = error.message; }
}
document.querySelector('[data-ticket-form]').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  const button = form.querySelector('button'); const notice = form.querySelector('[role=status]'); button.disabled = true;
  try { await request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); notice.textContent = 'Your support request has been saved.'; await loadWorkspace(); }
  catch (error) { notice.textContent = error.message; } finally { button.disabled = false; }
});
start();
