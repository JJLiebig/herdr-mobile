"""Optional offline DOM validation harness. Requires Python Playwright plus Chromium.

Run from the repository: python scripts/validation/browser-smoke.py
Browser storage/history are mocked and fetch is bridged to the local Node server.
This is NOT real-origin browser E2E, Android, microphone or live Herdr validation.
Evidence is written into ignored artifacts/browser-smoke/.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import subprocess,time,json,urllib.request,urllib.error,re,os,shutil
root=Path(__file__).resolve().parents[2]
out=root/'artifacts/browser-smoke'
out.mkdir(parents=True,exist_ok=True)
log=open(out/'server.log','w',encoding='utf-8')
server=subprocess.Popen(['node','server/index.mjs'],cwd=root,stdout=log,stderr=log)
results=[]
try:
 for _ in range(40):
  try: urllib.request.urlopen('http://127.0.0.1:8787/',timeout=1);break
  except Exception:time.sleep(.1)
 def request(binding,path,init):
  if not path.startswith('/api/'):raise ValueError('Only local generated app API routes are allowed')
  init=init or {};headers=(init.get('headers') or {})|{'Origin':'http://127.0.0.1:8787'}
  data=init.get('body');data=data.encode() if isinstance(data,str) else None
  req=urllib.request.Request('http://127.0.0.1:8787'+path,data=data,headers=headers,method=init.get('method') or 'GET')
  try:
   with urllib.request.urlopen(req,timeout=3) as r:return {'status':r.status,'text':r.read().decode()}
  except urllib.error.HTTPError as e:return {'status':e.code,'text':e.read().decode()}
 html=root.joinpath('public/index.html').read_text()
 html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
 html=re.sub(r'<link[^>]*>','',html)
 source=[]
 for name in ['shared/model.mjs','public/drafts.mjs','public/voice.mjs','public/terminal.mjs','public/app.mjs']:
  text=root.joinpath(name).read_text();text=re.sub(r'^import .*?;\s*$', '',text,flags=re.M);text=re.sub(r'\bexport (?=(?:async )?(?:function|const|class|let))','',text);source.append(text)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':393,'height':852},is_mobile=True,has_touch=True,device_scale_factor=1)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.expose_binding('localAppRequest',request)
  page.set_content(html);page.add_style_tag(content=root.joinpath('public/style.css').read_text())
  page.evaluate('''() => {
   const data=new Map();Object.defineProperty(window,'localStorage',{value:{get length(){return data.size},key:i=>[...data.keys()][i]||null,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}});
   history.pushState=()=>{};history.replaceState=()=>{};
   window.fetch=async(path,init={})=>{const r=await window.localAppRequest(path,{method:init.method,headers:init.headers,body:init.body});return new Response(r.text,{status:r.status,headers:{'Content-Type':'application/json'}})};
   if(!crypto.randomUUID)crypto.randomUUID=()=> 'test-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  }''')
  page.add_script_tag(content='(()=>{\n'+'\n'.join(source)+'\n})();')
  page.get_by_role('button',name='Open Fix scheduler pacing').wait_for(timeout=5000)
  page.screenshot(path=str(out/'overview.png'),full_page=True)
  results.append({'case':'Overview displays grouped agent cards','passed':True})
  page.get_by_role('button',name='Open Fix scheduler pacing').click();page.locator('#terminal pre').wait_for(timeout=5000)
  page.locator('#draft').fill('Run the wider integration tests.\nThen show me the failures — bitte 🐑.');page.locator('#draft').press('Enter')
  value=page.locator('#draft').input_value();assert value.endswith('\n')
  page.screenshot(path=str(out/'focus.png'),full_page=True)
  results.append({'case':'Focused output and multiline Unicode composer; Enter does not submit','passed':True})
  page.locator('#back').click();page.get_by_role('button',name='Open Make ingestion resilient').click();assert page.locator('#draft').input_value()==''
  page.locator('#draft').fill('This belongs to Kraken.');page.locator('#back').click();page.get_by_role('button',name='Open Fix scheduler pacing').click();assert page.locator('#draft').input_value()==value
  results.append({'case':'Switching panes isolates and restores drafts','passed':True})
  page.locator('#send').click();page.wait_for_function("document.querySelector('#draft').value === ''",timeout=5000)
  assert 'Nothing was sent to Herdr' in page.locator('#message').inner_text()
  results.append({'case':'Demo acknowledgment clears only the submitted draft','passed':True})
  page.locator('#restore-sent').click();assert page.locator('#draft').input_value()==value
  page.locator('#settings-button').click();assert page.locator('#settings').is_visible();page.locator('#close-settings').click()
  results.append({'case':'Last-sent recovery and settings sheet','passed':True})
  page.locator('#back').click();page.get_by_role('button',name='Needs input',exact=True).click();assert page.locator('.card').count()==1
  results.append({'case':'Attention filter shows only blocked agents','passed':True})
  assert not errors,errors;assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
  results.append({'case':'393px layout without horizontal page overflow or JS errors','passed':True})
  browser.close()
finally:
 server.terminate();server.wait(timeout=5);log.close()
report={'mode':'Offline Chromium DOM harness; fetch is bridged to the local Node server, storage/history mocked. Not Android or real-origin end-to-end testing.','results':results}
(out/'browser-smoke.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
