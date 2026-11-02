import { api, start, node } from './client-session.js';
const status=document.querySelector('[data-portal-status]');
const panel=document.querySelector('[data-admin]');
const chooser=document.querySelector('[data-client-picker]');
let selected, current;
async function list(selectId) {
 const data=await api('/api/admin');chooser.replaceChildren(node('option','Choose a client workspace'));
 chooser.firstChild.value='';
 for(const workspace of data.workspaces){const option=node('option',workspace.name);option.value=workspace.id;chooser.append(option);}
 if(selectId)chooser.value=selectId;
 selected=chooser.value;document.querySelector('[data-client-tools]').hidden=!selected;
 if(selected)await load();
}
function projectForm(project={}) {
 const form=document.querySelector('[data-project-form]');form.reset();
 for(const field of ['id','name','summary','nextStep','status','progress'])form.elements[field].value=project[field] ?? ({status:'Planning',progress:0}[field] ?? '');
}
async function load() {
 current=await api('/api/admin?clientId='+encodeURIComponent(selected));
 document.querySelector('[data-workspace-name]').textContent=current.workspace.name;
 const projects=document.querySelector('[data-project-list]');projects.replaceChildren();
 for(const project of current.workspace.projects || []){
  const card=node('article','','portal-card');card.append(node('span',project.status,'portal-tag'),node('h3',project.name),node('p',project.summary || ''),node('p',String(project.progress)+'% complete'));
  const button=node('button','Edit project','site-secondary-button');button.type='button';button.addEventListener('click',()=>{projectForm(project);document.querySelector('[data-project-form]').scrollIntoView({block:'start',behavior:'smooth'});});card.append(button);projects.append(card);
 }
 if(!projects.childElementCount)projects.append(node('p','No projects yet. Add the first project below.'));
 const docs=document.querySelector('[data-admin-documents]');docs.replaceChildren();
 for(const doc of current.workspace.documents || [])docs.append(node('p',doc.name+' · '+(doc.expiresAt?'Available until '+new Date(doc.expiresAt).toLocaleDateString():'Shared document')));
 if(!docs.childElementCount)docs.append(node('p','No documents shared yet.'));
 const requests=document.querySelector('[data-admin-tickets]');requests.replaceChildren();
 for(const ticket of current.tickets || []){
  const form=document.createElement('form');form.className='portal-card portal-form';
  form.append(node('h3',ticket.subject),node('p',ticket.message),node('small',new Date(ticket.createdAt).toLocaleString()));
  const label=node('label','Status'),select=document.createElement('select');select.name='status';
  for(const value of ['Open','In progress','Resolved']){const option=node('option',value);option.value=value;select.append(option);}select.value=ticket.status;label.append(select);form.append(label);
  const replyLabel=node('label','Reply to the client'),reply=document.createElement('textarea');reply.name='reply';reply.maxLength=5000;reply.value=ticket.reply || '';replyLabel.append(reply);form.append(replyLabel);
  const button=node('button','Save reply and status','site-button');button.type='submit';form.append(button);const notice=node('p','');notice.setAttribute('role','status');form.append(notice);
  form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{await save({action:'update-ticket',id:ticket.id,status:select.value,reply:reply.value});notice.textContent='Reply and status saved. The client can see them in their portal.';}catch(error){notice.textContent=error.message;}finally{button.disabled=false;}});requests.append(form);
 }
 if(!requests.childElementCount)requests.append(node('p','No support requests for this workspace.'));
}
async function save(body) {return api('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:selected,...body})});}
function bind(selector,handler) {
 const form=document.querySelector(selector);form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('button[type=submit]');const notice=form.querySelector('[role=status]');button.disabled=true;notice.textContent='Saving…';try{await handler(form);notice.textContent='Saved.';}catch(error){notice.textContent=error.message;}finally{button.disabled=false;}});
}
chooser.addEventListener('change',async()=>{selected=chooser.value;document.querySelector('[data-client-tools]').hidden=!selected;if(selected){try{await load();projectForm();}catch(error){status.textContent=error.message;}}});
bind('[data-workspace-form]',async form=>{const data=await save({action:'create-workspace',name:form.elements.name.value});form.reset();await list(data.clientId);});
bind('[data-project-form]',async form=>{const values=Object.fromEntries(new FormData(form));values.progress=Number(values.progress);if(!values.id)delete values.id;await save({action:'save-project',...values});projectForm();await load();});
document.querySelector('[data-new-project]').addEventListener('click',()=>projectForm());
bind('[data-access-form]',async form=>{await save({action:form.elements.action.value,email:form.elements.email.value});form.reset();});
bind('[data-document-form]',async form=>{
 const file=form.elements.file.files[0];if(!file || file.size>1024*1024)throw new Error('Choose a file smaller than 1 MB.');
 const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('File could not be read.'));reader.readAsDataURL(file);});
 await save({action:'upload-document',filename:file.name,name:form.elements.name.value,base64});form.reset();await load();
});
start(async()=>{await list();panel.hidden=false;status.textContent='';});
