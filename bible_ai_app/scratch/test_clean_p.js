const fs = require('fs');

let html = `
<p><div class="article-footnotes-section"><div class="article-footnotes-title"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>Notes de bas de page</span></div><div class="article-footnotes-list"><div class="article-footnote-item" id="article-fn-1"><span class="article-footnote-num">1.</span><span class="article-footnote-text">Texte note 1</span> <a href="#article-fnref-1" class="article-footnote-backlink" title="Retour au texte">↩</a></div></div></div></p>
`;

html = html
  .replace(/<p>\s*(<div class="article-(?:footnotes-section|footnote-item|editorial-footer-card|speaker-turn|table-wrap|ornamental-divider|info-callout|bullet-item)"[\s\S]*?<\/div>)\s*<\/p>/gi, '$1')
  .replace(/<p>\s*<\/p>/gi, '');

console.log(html);
