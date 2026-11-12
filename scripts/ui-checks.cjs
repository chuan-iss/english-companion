const {BrowserWindow,ipcMain}=require('electron');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,ai,state,app,port=18744})=>{
 const results=[];const check=(name,condition)=>{assert.ok(condition,name);results.push(name);fs.writeFileSync(path.resolve('.runtime/ui-progress.json'),JSON.stringify(results));};
 let fixture;
 const generated=[];
 if(!process.env.EN_TOOL_LIVE_TEST){ipcMain.removeHandler('generate');ipcMain.handle('generate',async(_,data)=>{generated.push(data);return data.mode==='comment'?'**自然口语**\nThis really helped. Thanks for sharing!\n\n**社交轻松**\nThis was so helpful. Thanks!\n\n**礼貌稳重**\nThank you for sharing this helpful approach.':'**翻译**\n质疑错误的前提\n\n**语境解释**\n先检查论证所依赖的假设是否成立。';});}
 try{
  const account=await ai.account();check('ChatGPT Plus account',account.type==='chatgpt'&&account.planType==='plus');
  const base=`http://127.0.0.1:${port}`;const origin='chrome-extension://'+'a'.repeat(32);
  let r=await fetch(base+'/ping',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});check('Reject unauthenticated capture',r.status===401);
  r=await fetch(base+'/ping',{method:'POST',headers:{Origin:'https://example.com',Authorization:`Bearer ${state.token}`},body:'{}'});check('Reject web origins',r.status===403);
  r=await fetch(base+'/capture',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${state.token}`,'Content-Type':'application/json'},body:JSON.stringify({source:'这个方法真的帮到我了，谢谢你分享。',context:'A community member shared a practical study tip.',title:'Test study discussion',url:'https://example.com/discussion',coverage:'测试数据 · 已加载局部文字',mode:'comment'})});check('Authenticated capture',r.ok);
  await sleep(500);check('Renderer receives selection',await win.webContents.executeJavaScript(`document.querySelector('#source').value.includes('帮到我')`));
  if(!process.env.EN_TOOL_LIVE_TEST){for(let i=0;i<50&&!generated.length;i++)await sleep(100);if(!generated.length)throw Error('No auto generation: '+await win.webContents.executeJavaScript(`document.querySelector('#status').textContent`));check('Polish capture automatically generates',generated[0]?.mode==='comment');}
  if(win.isAlwaysOnTop()){await win.webContents.executeJavaScript(`document.querySelector('#pin').click()`);await sleep(100);}
  check('Window can be unpinned',!win.isAlwaysOnTop());
  await win.webContents.executeJavaScript(`document.querySelector('#pin').click()`);await sleep(100);check('Pinned window remains movable and resizable',win.isMovable()&&win.isResizable());
  check('Pin enables always on top',win.isAlwaysOnTop());
  await win.webContents.executeJavaScript(`document.querySelector('#pin').click()`);await sleep(100);check('Unpin restores movement',win.isMovable()&&!win.isAlwaysOnTop());
  const models=await ai.models();check('Models discovered',models.length>0);
  check('Only comment and translate tabs',await win.webContents.executeJavaScript(`document.querySelectorAll('nav button').length===2`));
  check('Model effort and action share a row',await win.webContents.executeJavaScript(`['model','effort','generate'].every(id=>document.querySelector('#'+id).parentElement.className==='run-row')`));
  const oldBounds=win.getBounds();win.setSize(360,620);await sleep(100);check('Window resizes below previous minimum',win.getBounds().width===360);
  check('Controls stay on one line at narrow width',await win.webContents.executeJavaScript(`(()=>{const rs=['model','effort','generate'].map(id=>document.querySelector('#'+id).getBoundingClientRect());return Math.max(...rs.map(r=>r.top))-Math.min(...rs.map(r=>r.top))<2;})()`));win.setBounds(oldBounds);
  if(process.env.EN_TOOL_LIVE_TEST){
  await win.webContents.executeJavaScript(`document.querySelector('#generate').click();void 0;`);
  let completed=false;for(let i=0;i<120;i++){await sleep(1000);const s=await win.webContents.executeJavaScript(`document.querySelector('#status').textContent`);if(s.startsWith('已完成')){completed=true;break;}if(!(await win.webContents.executeJavaScript(`document.querySelector('#generate').hidden`)))throw Error(s);}
  check('Real three-variant generation completes',completed);
  const output=await win.webContents.executeJavaScript(`document.querySelector('#output').textContent`);check('Generated nonempty response',output.length>80);
  }else{
   await win.webContents.executeJavaScript(`document.querySelector('[data-mode="translate"]').click();void 0;`);await sleep(150);
   check('Switching modes generates translation and replaces polish result',generated.at(-1).mode==='translate'&&await win.webContents.executeJavaScript(`!document.querySelector('#output').textContent.includes('This really helped')`));
   check('Bold markdown renders',await win.webContents.executeJavaScript(`document.querySelector('#output strong').textContent==='翻译'&&!document.querySelector('#output').textContent.includes('**')`));
   check('Compact header contains tabs and icon controls',await win.webContents.executeJavaScript(`document.querySelector('header nav')&&document.querySelector('header #theme')&&document.querySelector('header #pin')&&!document.querySelector('h1')`));
   check('One-line resizable source',await win.webContents.executeJavaScript(`document.querySelector('#source').rows===1&&getComputedStyle(document.querySelector('#source')).resize==='both'`));
   check('Five intent and three emotion symbols',await win.webContents.executeJavaScript(`document.querySelectorAll('#intent button').length===5&&document.querySelectorAll('#emotion button').length===3`));
   ipcMain.removeHandler('clipboard');ipcMain.handle('clipboard',()=> '');
   await win.webContents.executeJavaScript(`document.querySelector('#paste').click();void 0;`);await sleep(100);check('Empty clipboard has visible feedback',await win.webContents.executeJavaScript(`document.querySelector('#status').textContent.includes('剪贴板没有文字')`));
   ipcMain.removeHandler('clipboard');ipcMain.handle('clipboard',()=> 'A copied sentence.');
   await win.webContents.executeJavaScript(`document.querySelector('#paste').click();void 0;`);await sleep(100);check('Clipboard imports and generates',generated.at(-1).source==='A copied sentence.');
  }
  fs.mkdirSync(path.resolve('.runtime'),{recursive:true});fs.writeFileSync(path.resolve('.runtime/ui.png'),(await win.webContents.capturePage()).toPNG());
  fixture=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await fixture.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<article><p id="p">This tip saved me so much time.</p><textarea id="t">first line\nthanks for sharing\nlast line</textarea></article>'));
  check('Fixture loaded',true);
  await fixture.webContents.executeJavaScript(`window.__sent=[];window.chrome={storage:{local:{get:async()=>({})},onChanged:{addListener:()=>{}}},runtime:{onMessage:{addListener:fn=>window.__listener=fn},sendMessage:async m=>{window.__sent.push(m);return {ok:true};}}};void 0;`);
  check('Fixture chrome mock installed',true);
  await fixture.webContents.executeJavaScript(fs.readFileSync(path.resolve('extension/capture.js'),'utf8'));
  check('Capture script loaded',true);
  await fixture.webContents.executeJavaScript(`const t=document.querySelector('#t');t.focus();t.setSelectionRange(15,15);window.__listener({type:'capture',mode:'comment'},{},()=>{});`);
  await sleep(100);check('Caret captures current logical line',await fixture.webContents.executeJavaScript(`window.__sent[0].data.source==='thanks for sharing'`));
  check('Capture leaves original text intact',await fixture.webContents.executeJavaScript(`document.querySelector('#t').value==='first line\\nthanks for sharing\\nlast line'`));
  await fixture.webContents.executeJavaScript(`document.querySelector('#t').blur();const range=document.createRange();range.selectNodeContents(document.querySelector('#p'));window.getSelection().removeAllRanges();window.getSelection().addRange(range);window.__listener({type:'capture',mode:'translate'},{},()=>{});`);
  await sleep(100);check('Web selection and context captured',await fixture.webContents.executeJavaScript(`window.__sent[1].data.source==='This tip saved me so much time.'&&window.__sent[1].data.context.includes('This tip')`));
  await fixture.webContents.executeJavaScript(`document.title='Life is hard';document.body.innerHTML='<textarea id="alone">My draft</textarea>';const alone=document.querySelector('#alone');alone.focus();alone.setSelectionRange(2,2);window.__listener({type:'capture',mode:'comment'},{},()=>{});void 0;`);await sleep(100);
  check('Title-only context is explicit and not empty',await fixture.webContents.executeJavaScript(`window.__sent[2].data.context.includes('Life is hard')&&window.__sent[2].data.coverage.includes('仅标题')`));
  await fixture.webContents.executeJavaScript(`document.querySelector('#alone').blur();document.body.innerHTML='<p id="p">Selected words.</p>';const r2=document.createRange();r2.selectNodeContents(document.querySelector('#p'));window.getSelection().removeAllRanges();window.getSelection().addRange(r2);void 0;`);
  await fixture.webContents.executeJavaScript(`document.dispatchEvent(new MouseEvent('mouseup',{clientX:40,clientY:40,bubbles:true}));`);await sleep(100);check('Selection opens hover menu',await fixture.webContents.executeJavaScript(`!![...document.documentElement.children].find(e=>e.style.zIndex==='2147483647')`));
  fs.mkdirSync(path.resolve('.runtime'),{recursive:true});fs.writeFileSync(path.resolve('.runtime/ui.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('#theme').click()`);fs.writeFileSync(path.resolve('.runtime/ui-dark.png'),(await win.webContents.capturePage()).toPNG());await win.webContents.executeJavaScript(`document.querySelector('#theme').click()`);
  fs.writeFileSync(path.resolve('.runtime/ui-checks.json'),JSON.stringify({passed:results,liveGeneration:!!process.env.EN_TOOL_LIVE_TEST},null,2));
 }catch(e){fs.mkdirSync(path.resolve('.runtime'),{recursive:true});fs.writeFileSync(path.resolve('.runtime/ui-checks.json'),JSON.stringify({passed:results,error:e.stack},null,2));}
 finally{fixture?.destroy();app.quit();}
};
