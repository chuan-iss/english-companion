const { AI } = require('../app/ai.cjs');
const path = require('node:path');
(async () => {
 const ai = new AI(path.resolve('.runtime/empty'));
 try {
  console.log('account', await ai.account());
  const models = await ai.models(); console.log('models', models.map(m=>({ id:m.id, model:m.model, isDefault:m.isDefault, efforts:m.supportedReasoningEfforts })));
  const model = models.find(m=>m.isDefault) || models[0];
  console.log('translation', await ai.generate('Translate into natural English: 这个方法真的帮到我了，谢谢你分享。Return only the translation.',model.model || model.id,'low'));
 } catch(e) { console.error(e.message); process.exitCode=1; } finally { ai.close(); }
})();
