const $=s=>document.querySelector(s), api=window.companion;
let mode='comment',models=[],busy=false,meta={},resultMeta=null,raw='',streamPrefix='',started=0,firstAt=0,activeJob=null;
const status=t=>$('#status').textContent=t;
const render=()=>{$('#output').innerHTML=window.renderMarkdown(raw);};
function setMode(m){mode=m==='ask'?'translate':m;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#commentOptions').hidden=mode!=='comment';$('#generate').textContent=mode==='comment'?'生成三版参考':'翻译并解释';}
const selected=id=>$('#'+id+' button[aria-pressed="true"]').dataset.value;
for(const id of ['intent','emotion'])document.querySelectorAll('#'+id+' button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#'+id+' button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
function launch(ask=false){activeJob=generate(ask);return activeJob;}
document.querySelectorAll('nav button').forEach(b=>b.onclick=async()=>{if(b.dataset.mode===mode)return;if(busy){status('正在停止上一模式…');await api.call('cancel').catch(e=>status(e.message));await activeJob;}setMode(b.dataset.mode);clearResult();if($('#source').value.trim())launch();else status('请选择或输入文字。');});
function efforts(){const m=models.find(m=>(m.model||m.id)===$('#model').value);$('#effort').replaceChildren();for(const e of m?.supportedReasoningEfforts||[]){const o=document.createElement('option');o.value=e.reasoningEffort;o.textContent=({none:'不思考',minimal:'极低',low:'低',medium:'中',high:'高',xhigh:'极高'})[o.value]||o.value;$('#effort').append(o);}const values=[...$('#effort').options].map(o=>o.value);const stored=localStorage.getItem('effort:'+$('#model').value);$('#effort').value=values.includes(stored)?stored:(['none','minimal','low'].find(v=>values.includes(v))||values[0]);}
$('#model').onchange=()=>{localStorage.setItem('preferredModel',$('#model').value);efforts();};$('#effort').onchange=()=>localStorage.setItem('effort:'+$('#model').value,$('#effort').value);
async function refresh(){try{const r=await api.call('status');models=r.models;$('#model').replaceChildren();for(const m of models){const o=document.createElement('option');o.value=m.model||m.id;o.textContent=m.displayName||o.value;$('#model').append(o);}const preferred=localStorage.getItem('preferredModel');$('#model').value=models.some(m=>(m.model||m.id)===preferred)?preferred:((models.find(m=>/luna/.test(m.model||m.id))||models.find(m=>m.isDefault)||models[0])?.model||models[0]?.id);efforts();$('#pin').setAttribute('aria-pressed',String(r.pin));$('#connection').textContent=r.account?.type==='chatgpt'?'模型连接正常':'请登录 ChatGPT';$('#connection').textContent+=' · v'+r.version;}catch(e){$('#connection').textContent='连接未就绪';status(e.message);}}
$('#refresh').onclick=refresh;$('#login').onclick=async()=>{try{await api.call('login');status('请在浏览器中完成 ChatGPT 登录，然后点刷新连接。');}catch(e){status(e.message);}};
api.on('loginDone',r=>{status(r.success?'登录成功':r.error||'登录未完成');refresh();});
$('#pair').onclick=async()=>{await api.call('pair');status('配对码已复制。在 Chrome 扩展的设置页粘贴即可。');};
$('#pin').onclick=async()=>{const pin=$('#pin').getAttribute('aria-pressed')!=='true';await api.call('window',{pin});$('#pin').setAttribute('aria-pressed',String(pin));};
$('#theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('dark',document.body.classList.contains('dark'));};if(localStorage.getItem('dark')==='true')document.body.classList.add('dark');
function clearResult(){raw='';resultMeta=null;render();$('#followup').value='';}
$('#paste').onclick=async()=>{if(busy){status('正在生成，请先停止再读取剪贴板。');return;}try{const text=await api.call('clipboard');if(!text.trim()){status('剪贴板没有文字。请先选中文字并按 Ctrl+C。');return;}$('#source').value=text;$('#context').value='';meta={};clearResult();$('#origin').textContent='来源：剪贴板';$('#coverage').textContent='无网页上下文';status(`已读取 ${text.length} 个字符，正在处理…`);launch();}catch(e){status('读取失败：'+e.message);}};
api.on('capture',data=>{if(busy){status('正在生成上一条结果。本次取词未载入，请完成后重新触发。');return;}meta=data;$('#source').value=data.source;const context=data.context?.trim()||(data.title?`[页面标题，不等于帖子正文]\n${data.title}`:'');$('#context').value=context;$('#origin').textContent=data.title?`页面标题：${data.title}`:data.url;$('#coverage').textContent=data.context?.trim()?`${context.length} 字 · ${data.coverage||'局部文字'}`:data.title?'仅页面标题 · 未获取正文':'未获取上下文';$('#contextDetails').title='点击展开，查看实际发送给模型的文字';clearResult();setMode(data.mode);if(data.mode==='ask'){$('#followup').focus();status('已带入选区及上下文，直接在下方提问即可。');}else launch();});
api.on('serviceError',status);api.on('delta',d=>{if(!busy)return;if(!firstAt){firstAt=performance.now();status(`开始显示 · 首字 ${((firstAt-started)/1000).toFixed(1)} 秒`);}raw+=d;render();});
async function generate(ask=false){
 await ready;
 if(busy)return;if(!$('#source').value.trim()){status('请先获取文字。');return;}if(ask&&!$('#followup').value.trim()){status('请在结果下方填写追问。');$('#followup').focus();return;}
 const previous=raw;const data={...meta,source:$('#source').value,context:$('#context').value,mode:ask?'ask':mode,question:ask?$('#followup').value:$('#question').value,previousAnswer:ask?previous:'',emotion:selected('emotion'),intent:selected('intent'),model:$('#model').value,effort:$('#effort').value};
 busy=true;$('#generate').hidden=true;$('#ask').disabled=true;$('#cancel').hidden=false;started=performance.now();firstAt=0;streamPrefix=ask?`${previous}\n\n**追问：${data.question}**\n\n`:'';raw=streamPrefix;render();resultMeta=null;status('正在生成…');
 const clock=setInterval(()=>{if(!firstAt)status(`等待模型首字 · ${((performance.now()-started)/1000).toFixed(0)} 秒`);},1000);
 try{const output=await api.call('generate',data);raw=streamPrefix+output;render();resultMeta=data;status(`已完成 · ${((performance.now()-started)/1000).toFixed(1)} 秒${firstAt?` · 首字 ${((firstAt-started)/1000).toFixed(1)} 秒`:''}`);if(ask)$('#followup').value='';}
 catch(e){status(e.message);if(raw!==streamPrefix){raw+='\n\n[请求未完成，以上为部分结果]';render();}}
 finally{clearInterval(clock);busy=false;$('#generate').hidden=false;$('#ask').disabled=false;$('#cancel').hidden=true;}
}
$('#generate').onclick=()=>launch();$('#ask').onclick=()=>launch(true);$('#followup').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();launch(true);}};
$('#cancel').onclick=()=>api.call('cancel').catch(e=>status(e.message));
$('#copy').onclick=async()=>{if(!resultMeta){status('请先生成完整结果。');return;}await api.call('copy',$('#output').innerText);status('已复制结果。');};
$('#save').onclick=async()=>{if(!resultMeta){status('请先生成完整结果。');return;}const d=resultMeta;const text=`# 英语摘录\n\n来源：${d.url||'手动输入或剪贴板'}\n\n标题：${d.title||''}\n\n## 原文\n\n${d.source}\n\n## 参考上下文\n\n${d.context}\n\n## 解释 / 表达\n\n${raw}\n`;if(await api.call('save',text))status('已保存 Markdown 笔记。');};
const ready=refresh();
