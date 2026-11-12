(()=>{
 if(window.__englishCompanion)return;window.__englishCompanion=true;
 const SELECTORS=['shreddit-comment','shreddit-post','article','ytd-comment-thread-renderer','ytd-watch-metadata','[data-testid="tweet"]','[id^="chat-messages-"]','[role="article"]'];
 let last=null,menu,timer,settings={hover:450,enabled:true};
 chrome.storage.local.get(['hover','enabled']).then(s=>{settings={...settings,...s};});
 chrome.storage.onChanged.addListener(changes=>{for(const k of ['hover','enabled'])if(changes[k])settings[k]=changes[k].newValue;});
 function get(){
   const active=document.activeElement;
   if(active?.matches('input[type=password],input[autocomplete*="cc-"],input[type=email]'))throw Error('此输入框不提供取词。');
   const selection=window.getSelection();let text=selection?.toString().trim(),node=selection?.anchorNode?.parentElement;
   let coverage='局部文字 · 未验证完整回复链';
   if(active?.matches('textarea,input[type=text],input:not([type]),input[type=search]')){
     const a=active.selectionStart,b=active.selectionEnd,value=active.value;
     if(a!=null){text=a!==b?value.slice(a,b):value.slice(value.lastIndexOf('\n',a-1)+1,value.indexOf('\n',a)<0?value.length:value.indexOf('\n',a));node=active;coverage=a!==b?'输入框选区 + 附近文字':'输入框逻辑行 + 附近文字';}
   }else if(!text&&active?.isContentEditable&&selection?.rangeCount){
     // A rendered line is selected only in a cloned range; the user's selection is untouched.
     const r=selection.getRangeAt(0).cloneRange();const anchor=r.startContainer;
     if(anchor.nodeType===Node.TEXT_NODE){const value=anchor.textContent,a=r.startOffset;text=value.slice(value.lastIndexOf('\n',a-1)+1,value.indexOf('\n',a)<0?value.length:value.indexOf('\n',a));node=anchor.parentElement;coverage='编辑器当前文本节点 · 可能跨自动折行';}
   }
   if(!text?.trim())throw Error('请先选中文字，或把光标放在有文字的输入框中。');
   const parent=el=>el?.parentElement||el?.getRootNode()?.host;
   const visibleText=el=>(el?.innerText||'').trim();
   let container=null,fallback=null,el=node;
   for(let depth=0;el&&depth<12;depth++,el=parent(el)){
     if(el.matches('body,html'))break;
     const value=visibleText(el);
     if(SELECTORS.some(s=>el.matches(s))){container=el;break;}
     if(!fallback&&value.length>text.trim().length+25&&value.length<12000)fallback=el;
   }
   container ||= fallback||node?.closest('p,li,blockquote,section')||node;
   const pieces=[];
   const value=visibleText(container);
   if(value)pieces.push('[选区所在区域]\n'+value);
   if(container&&!container.matches(SELECTORS.join(','))){
     for(const sibling of [container.previousElementSibling,container.nextElementSibling]){
       const value=visibleText(sibling);if(value&&value.length<5000)pieces.push('[相邻区域]\n'+value);
     }
   }
   // On a dedicated post page, include the loaded original post as a separate source.
   if(/\/comments\/|\/status\/|\/post\/|\/watch\b/.test(location.pathname)){
     const original=document.querySelector('shreddit-post,[data-testid="tweet"],ytd-watch-metadata');
     const value=visibleText(original);if(value&&original!==container)pieces.unshift('[当前帖子正文]\n'+value.slice(0,9000));
   }
   const hasBody=pieces.some(p=>p.replace(/\[[^\]]+\]\n/,'').trim()!==text.trim());
   const title=document.title.trim();
   if(title)pieces.unshift('[页面标题，不等于帖子正文]\n'+title);
   const context=pieces.join('\n\n').slice(0,18000);
   coverage=hasBody?'已获取局部正文 · 回复链可能不完整':title?'仅标题/选区 · 未获取额外正文':'未获取额外上下文';
   return {source:text.trim().slice(0,12000),context,title:document.title,url:location.href,coverage};
 }
 function toast(text){const el=document.createElement('div');el.textContent=text;Object.assign(el.style,{position:'fixed',bottom:'25px',right:'25px',zIndex:2147483647,background:'#253e34',color:'white',padding:'12px 18px',borderRadius:'8px',font:'13px sans-serif',maxWidth:'350px'});document.documentElement.append(el);setTimeout(()=>el.remove(),4500);}
 async function send(mode,data){const r=await chrome.runtime.sendMessage({type:'sendCapture',data:{...data,mode}});if(!r?.ok)throw Error(r?.error||'连接失败');return r;}
 function hide(){clearTimeout(timer);menu?.remove();menu=null;}
 function show(x,y){
   hide();menu=document.createElement('div');Object.assign(menu.style,{position:'fixed',left:Math.min(x,innerWidth-170)+'px',top:Math.min(y+12,innerHeight-55)+'px',zIndex:2147483647});
   const root=menu.attachShadow({mode:'closed'});const style=document.createElement('style');style.textContent='div{display:flex;gap:4px;background:#fffef8;border:1px solid #d5dfd3;padding:5px;border-radius:10px;box-shadow:0 5px 24px #0002}button{position:relative;overflow:hidden;border:0;background:transparent;color:#254637;padding:8px 12px;border-radius:6px;cursor:pointer;font:13px sans-serif}button:hover{background:#e3eddf}button span{position:absolute;bottom:0;left:0;height:3px;width:0;background:#437e55}';root.append(style);const row=document.createElement('div');root.append(row);
   for(const [label,mode] of [['Polish','comment'],['Translate','translate']]){const b=document.createElement('button');b.textContent=label;b.title=mode==='comment'?'三版自然英语表达':'译义与语境解释';const progress=document.createElement('span');b.append(progress);row.append(b);const fire=()=>{const data=last;hide();send(mode,data).catch(e=>toast(e.message));};b.onmouseenter=()=>{progress.style.transition=`width ${settings.hover}ms linear`;requestAnimationFrame(()=>progress.style.width='100%');timer=setTimeout(fire,settings.hover);};b.onmouseleave=()=>{clearTimeout(timer);progress.style.transition='none';progress.style.width='0';};b.onmousedown=e=>e.preventDefault();b.onclick=fire;}
   document.documentElement.append(menu);
 }
 document.addEventListener('mouseup',e=>{if(menu&&e.composedPath().includes(menu))return;setTimeout(()=>{if(!settings.enabled)return;const s=window.getSelection(),a=document.activeElement;const inputSelected=a?.matches('textarea,input')&&a.selectionStart!==a.selectionEnd;if(!s?.toString().trim()&&!inputSelected){hide();return;}try{last=get();show(e.clientX,e.clientY);}catch{hide();}},20);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 document.addEventListener('scroll',hide,{passive:true});
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(m.type==='capture'){try{const data=get();hide();send(m.mode,data).then(()=>reply({ok:true})).catch(e=>{toast(e.message);reply({ok:false,error:e.message});});}catch(e){toast(e.message);reply({ok:false,error:e.message});}return true;}});
})();
