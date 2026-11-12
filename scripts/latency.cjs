const {AI}=require('../app/ai.cjs');const {buildPrompt}=require('../app/prompt.cjs');const path=require('node:path');const fs=require('node:fs');
(async()=>{const ai=new AI(path.resolve('.runtime/empty'));const results=[];try{const models=await ai.models();console.log(JSON.stringify(models.map(m=>({model:m.model,efforts:m.supportedReasoningEfforts})),null,2));
ai.on('phase',p=>console.log('phase',p));ai.on('notification',m=>{if(/error|warning/i.test(m.method))console.log('event',m.method,JSON.stringify(m.params).slice(0,600));});
for(const m of (process.env.EN_TOOL_ONE_MODEL?[models.find(m=>/luna/.test(m.model))]:[models.find(m=>m.isDefault),models.find(m=>/luna/.test(m.model))]).filter(Boolean)){
 const allowed=m.supportedReasoningEfforts.map(e=>e.reasoningEffort);const effort=/luna/.test(m.model)?['none','minimal','low'].find(e=>allowed.includes(e)):'low';
 const start=performance.now();let first=null;const onDelta=()=>{first??=performance.now()-start;};ai.on('delta',onDelta);
 try{const answer=await ai.generate(buildPrompt({mode:'translate',source:'Challenge the flawed premise.',context:'A reply about checking assumptions before accepting a conclusion.'}),m.model,effort);const row={model:m.model,effort,firstMs:Math.round(first||0),totalMs:Math.round(performance.now()-start),answer};results.push(row);console.log(JSON.stringify(row));}catch(e){console.log(e.message);results.push({model:m.model,error:e.message});}finally{ai.off('delta',onDelta);}
}fs.writeFileSync(path.resolve('.runtime/latency.json'),JSON.stringify(results,null,2));}finally{ai.close();}})();
