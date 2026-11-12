async function post(data){
 const {token}=await chrome.storage.local.get('token');
 if(!token)throw Error('请先在扩展设置中粘贴助手的配对码。');
 const r=await fetch('http://127.0.0.1:18743/capture',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(data),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error(r.status===401?'配对码不正确，请重新配对。':'本地助手拒绝了请求。');
}
chrome.runtime.onInstalled.addListener(()=>{chrome.contextMenus.removeAll(()=>{chrome.contextMenus.create({id:'comment',title:'Polish · 三版自然表达',contexts:['selection','editable']});chrome.contextMenus.create({id:'translate',title:'Translate · 译义与语境',contexts:['selection']});});});
async function capture(tab,mode='comment'){
 try{if(!tab?.id)return;const r=await chrome.tabs.sendMessage(tab.id,{type:'capture',mode});if(!r?.ok)throw Error(r?.error||'没有可获取的文字');chrome.action.setBadgeText({text:''});}
 catch(e){chrome.action.setBadgeText({text:'!'});chrome.action.setBadgeBackgroundColor({color:'#ad553e'});chrome.action.setTitle({title:e.message+'；新安装后请刷新网页'});}
}
chrome.action.onClicked.addListener(tab=>capture(tab));
chrome.commands.onCommand.addListener(async name=>{if(name==='capture'){const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});await capture(tab);}});
chrome.contextMenus.onClicked.addListener((info,tab)=>capture(tab,info.menuItemId));
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(m.type==='sendCapture'&&sender.tab){post(m.data).then(()=>reply({ok:true})).catch(e=>reply({ok:false,error:e.message.includes('fetch')?'请先启动 English Companion 本地助手。':e.message}));return true;}
});
