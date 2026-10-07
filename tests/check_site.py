from pathlib import Path
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup
root=Path(__file__).resolve().parents[1]
errors=[]
aliases={'sinngle2.html','blog-single.html','gov.html','single3.html','single4.html','single5.html','single7.html','service-single.html'}
pages={p.name:BeautifulSoup(p.read_text(),'html.parser') for p in root.glob('*.html')}
for name,s in pages.items():
 if name not in aliases:
  for selector,count in [('header',1),('footer',1),('main',1),('h1',1)]:
   if len(s.select(selector))!=count: errors.append(f'{name}: expected one {selector}, found {len(s.select(selector))}')
  if s.html.get('lang')!='en': errors.append(f'{name}: missing English language')
  if not s.find('meta',attrs={'name':'description'}).get('content'): errors.append(f'{name}: missing description')
  ids=[t['id'] for t in s.find_all(id=True)]
  if len(ids)!=len(set(ids)): errors.append(f'{name}: duplicate IDs')
 for tag,attr in [('a','href'),('img','src'),('script','src'),('link','href')]:
  for e in s.find_all(tag):
   value=e.get(attr)
   if not value: continue
   url=urlsplit(value)
   if url.scheme or url.netloc: continue
   path=unquote(url.path)
   if path.startswith('/api/'): continue
   if path and not (root/path.lstrip('/')).exists(): errors.append(f'{name}: missing {tag} target {value}')
   if tag=='a' and url.fragment:
    target=pages.get(path or name)
    if target and not target.find(id=unquote(url.fragment)): errors.append(f'{name}: missing anchor {value}')
   if tag=='a' and value=='#': errors.append(f'{name}: placeholder link')
print('\n'.join(errors))
print(f'Checked {len(pages)} HTML pages; {len(errors)} errors')
raise SystemExit(bool(errors))
