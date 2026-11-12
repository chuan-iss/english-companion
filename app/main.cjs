const { app, BrowserWindow, ipcMain, clipboard, dialog, shell, screen } = require('electron');
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http'); const crypto = require('node:crypto');
const { AI } = require('./ai.cjs'); const { buildPrompt } = require('./prompt.cjs');
let win, ai, server, state, stateFile;
const PORT=process.env.EN_TOOL_UI_TEST?18744:18743;
const localData=path.resolve(__dirname,process.env.EN_TOOL_UI_TEST?'../.runtime/ui-test-data':'../.runtime/user-data');fs.mkdirSync(localData,{recursive:true});app.setPath('userData',localData);
process.on('uncaughtException',e=>{fs.writeFileSync(path.join(localData,'startup-error.log'),e.stack||String(e));app.quit();});
process.on('unhandledRejection',e=>{fs.writeFileSync(path.join(localData,'startup-error.log'),e.stack||String(e));app.quit();});
if(!app.requestSingleInstanceLock()) app.quit();
else {
 app.on('second-instance',()=>{win?.show();win?.focus();});
 app.whenReady().then(boot);
}
function save(){fs.writeFileSync(stateFile,JSON.stringify(state,null,2));}
function send(name,data){if(win&&!win.isDestroyed())win.webContents.send(name,data);}
async function boot(){
 const trace=s=>{if(process.env.EN_TOOL_UI_TEST)fs.appendFileSync(path.join(localData,'test-startup.log'),s+'\n');};trace('boot');
 stateFile=path.join(app.getPath('userData'),'settings.json');
 try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{state={};}
 state.token ||= crypto.randomBytes(24).toString('hex');
 if(!state.pinDefaultMigrated){state.pin=false;state.lock=false;state.pinDefaultMigrated=true;}
 state.pin ??= false; state.lock ??= false; save();
 const area=screen.getPrimaryDisplay().workArea;
 const bounds=state.bounds||{width:480,height:780,x:area.x+area.width-500,y:area.y+30};
 bounds.width=Math.max(320,Math.min(bounds.width,area.width));bounds.height=Math.max(280,Math.min(bounds.height,area.height));
 bounds.x=Math.max(area.x,Math.min(bounds.x,area.x+area.width-bounds.width));bounds.y=Math.max(area.y,Math.min(bounds.y,area.y+area.height-bounds.height));
 win=new BrowserWindow({...bounds,minWidth:320,minHeight:280,show:false,backgroundColor:'#f6f5f0',title:'English Companion',alwaysOnTop:state.pin,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 state.lock=false;win.setMenuBarVisibility(false);win.setMovable(true);win.setResizable(true);
 let boundsTimer;for(const event of ['move','resize'])win.on(event,()=>{clearTimeout(boundsTimer);boundsTimer=setTimeout(()=>{if(!win.isDestroyed()&&!win.isMaximized()){state.bounds=win.getBounds();save();}},250);});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 win.webContents.on('did-fail-load',(_,code,desc)=>trace('load failed '+code+' '+desc));
 win.webContents.on('render-process-gone',(_,details)=>trace('renderer gone '+JSON.stringify(details)));
 ai=new AI(path.join(app.getPath('userData'),'empty'));
 ai.on('delta',d=>send('delta',d));
 ai.on('notification',m=>{if(m.method==='account/login/completed')send('loginDone',{success:m.params.success,error:m.params.error});});
 server=http.createServer((req,res)=>{
   const origin=req.headers.origin || '';
   if(!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)){res.writeHead(403);return res.end();}
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','POST');res.writeHead(204);return res.end();}
   if(req.headers.authorization!==`Bearer ${state.token}`){res.writeHead(401);return res.end('请重新配对');}
   if(req.method!=='POST'||!['/capture','/ping'].includes(req.url)){res.writeHead(404);return res.end();}
   let body='';req.on('data',c=>{body+=c;if(body.length>150000)req.destroy();});
   req.on('end',()=>{try{const data=JSON.parse(body||'{}');if(req.url==='/capture'){
     if(typeof data.source!=='string'||!data.source.trim())throw Error('没有可用文字');
     const safe={source:data.source.slice(0,12000),context:String(data.context||'').slice(0,18000),title:String(data.title||'').slice(0,500),url:String(data.url||'').slice(0,2000),coverage:String(data.coverage||'局部上下文'),mode:['translate','ask','comment'].includes(data.mode)?data.mode:'comment'};
     send('capture',safe);win.showInactive();
   }res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));}catch(e){res.writeHead(400);res.end(e.message);}});
 });
 server.on('error',e=>send('serviceError',`本地连接未启动：${e.message}`));server.listen(PORT,'127.0.0.1');
 ipcMain.handle('status',async()=>({account:await ai.account(),models:await ai.models(),pin:state.pin,lock:state.lock,version:app.getVersion()}));
 ipcMain.handle('login',async()=>{const r=await ai.login();if(r.authUrl){const u=new URL(r.authUrl);if(u.protocol==='https:'&&u.hostname==='auth.openai.com')await shell.openExternal(r.authUrl);}return {started:true};});
 ipcMain.handle('pair',()=>{clipboard.writeText(state.token);return true;});
 ipcMain.handle('clipboard',()=>clipboard.readText().slice(0,12000));
 ipcMain.handle('copy',(_,text)=>{clipboard.writeText(String(text));return true;});
 ipcMain.handle('window',(_,settings)=>{state.pin=!!settings.pin;state.lock=false;win.setAlwaysOnTop(state.pin);win.setMovable(true);win.setResizable(true);save();});
 ipcMain.handle('generate',async(_,data)=>{
   if(!data.source?.trim())throw Error('请先获取选区或当前行。');
   const models=await ai.models();const selected=models.find(m=>(m.model||m.id)===data.model);if(!selected)throw Error('请选择有效模型');
   const allowed=selected.supportedReasoningEfforts?.map(e=>e.reasoningEffort)||[];
   if(data.effort&&!allowed.includes(data.effort))throw Error('该模型不支持所选思考强度');
   return ai.generate(buildPrompt(data),data.model,data.effort);
 });
 ipcMain.handle('cancel',()=>ai.cancel());
 ipcMain.handle('save',async(_,text)=>{const result=await dialog.showSaveDialog(win,{title:'保存到 Obsidian 或本地文件夹',defaultPath:`English-${new Date().toISOString().slice(0,10)}.md`,filters:[{name:'Markdown',extensions:['md']}]});if(!result.canceled){fs.writeFileSync(result.filePath,String(text),'utf8');return true;}return false;});
 trace('loading UI');await win.loadFile(path.join(__dirname,'index.html'));trace('loaded UI');win.show();
 if(process.env.EN_TOOL_UI_TEST)setTimeout(()=>require('../scripts/ui-checks.cjs')({win,ai,state,app,port:PORT}),2500);
}
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{ai?.close();server?.close();});
