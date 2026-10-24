from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re
p=Path(__file__).resolve().parents[1]
class Parser(HTMLParser):
 def __init__(self): super().__init__();self.ids=set();self.refs=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  for key in ['href','src']:
   if key in a:self.refs.append(a[key])
parsers={}
for f in p.glob('*.html'):
 a=Parser();a.feed(f.read_text());parsers[f.name]=a
errors=[]
for name,a in parsers.items():
 for ref in a.refs:
  u=urlsplit(ref)
  if u.scheme or u.netloc or ref.startswith('/api/'):continue
  target=unquote(u.path) or name
  if target.startswith('/'):target=target[1:]
  if not (p/target).exists():errors.append((name,ref,'missing file'))
  if u.fragment and target in parsers and u.fragment not in parsers[target].ids:errors.append((name,ref,'missing anchor'))
# Old service anchor compatibility is explicitly handled by the shared client script.
assert not errors,errors
s=(p/'services.html').read_text();assert s.count('<details class="premium-service-card"')==5
assert 'Years of Combined' not in (p/'index.html').read_text()
for f in p.glob('*.html'):
 for attrs,body in re.findall(r'<script([^>]*)>(.*?)</script>',f.read_text(),re.S):
  assert 'src=' in attrs or 'application/ld+json' in attrs
csp=next(x['value'] for x in json.loads((p/'vercel.json').read_text())['headers'][0]['headers'] if x['key']=='Content-Security-Policy')
assert "'unsafe-inline'" not in csp.split('script-src ')[1].split(';')[0]
print('HTML links, anchors, five service cards, claim removal and executable-script policy checks passed.')
