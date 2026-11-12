const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{
 call:(name,data)=>{if(!['status','login','pair','clipboard','copy','window','generate','cancel','save'].includes(name))throw Error('Unknown action');return ipcRenderer.invoke(name,data);},
 on:(name,fn)=>{if(['capture','delta','loginDone','serviceError'].includes(name))ipcRenderer.on(name,(_,data)=>fn(data));}
});
