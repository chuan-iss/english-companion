(function(root){
 function renderMarkdown(raw){
  const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const inline=s=>escape(s).replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^\n]+?)\*\*/g,'<strong>$1</strong>').replace(/__([^\n]+?)__/g,'<strong>$1</strong>');
  return String(raw).split(/\r?\n/).map(line=>{const h=line.match(/^#{1,6}\s+(.+)$/);if(h)return `<h3>${inline(h[1])}</h3>`;if(/^\s*[-*]\s+/.test(line))return `<div class="md-list">• ${inline(line.replace(/^\s*[-*]\s+/,''))}</div>`;return line?`<div>${inline(line)}</div>`:'<div class="md-gap"></div>';}).join('');
 }
 if(typeof module!=='undefined')module.exports={renderMarkdown};else root.renderMarkdown=renderMarkdown;
})(typeof window==='undefined'?globalThis:window);
