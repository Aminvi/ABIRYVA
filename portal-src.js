import { clerk, api, start, node as el } from './client-session.js';
const status = document.querySelector('[data-portal-status]');
const login = document.querySelector('[data-portal-login]');
const panel = document.querySelector('[data-workspace]');


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
  for (const ticket of tickets || []) { const row = el('article', '', 'portal-card'); row.append(el('span', ticket.status, 'portal-tag'), el('h3', ticket.subject), el('p', ticket.message), ...(ticket.reply ? [el('p', 'Abiryva reply: ' + ticket.reply)] : []), el('small', new Date(ticket.createdAt).toLocaleDateString())); list.append(row); }
  if (!list.childElementCount) list.append(el('p', 'Your support requests will appear here.'));
}
async function loadWorkspace() {
  try { render(await api()); status.textContent = ''; } catch (error) { panel.hidden = true; status.textContent = error.message; }
}
document.querySelector('[data-ticket-form]').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  const button = form.querySelector('button'); const notice = form.querySelector('[role=status]'); button.disabled = true;
  try { await api('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); notice.textContent = 'Your support request has been saved.'; await loadWorkspace(); }
  catch (error) { notice.textContent = error.message; } finally { button.disabled = false; }
});
start(async () => {
 const session=await api('/api/portal?action=session');
 document.querySelector('[data-admin-link]').hidden=!session.admin;
 await loadWorkspace();
});
