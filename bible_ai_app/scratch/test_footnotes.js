const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_5daee05991eb.md';
let rawText = fs.readFileSync(path, 'utf8');

function renderArticleWithFootnotes(md) {
  let text = md;

  // 1. Nettoyer les résidus de lecteur audio
  text = text.replace(/Loading\s+the\s*(?:\[[^\]]*Elevenlabs[^\]]*\]\([^)]+\)|Elevenlabs[^\n.]*)/gi, '');
  text = text.replace(/AudioNative\s+Player[\.\u2026]*/gi, '');

  // 2. Nettoyer les retours de note WordPress résiduels [↩︎](#...)
  text = text.replace(/\[(?:↩︎|↩)\]\(#[^)]+\)/g, '');

  // 3. Détecter et formater les lignes de notes de bas de page (ex: "1. Jordan B. Peterson...")
  text = text.replace(/(?:^|\n)(\d+)\.\s+([^\n]+(?:\n(?!\d+\.|\s*#|\s*---|\s*$)[^\n]+)*)/g, (match, num, body) => {
    // Si c'est une note de bas de page (contient Ibid, éditions, pp., ou auteur)
    if (/ibid|éditions|editions|pp\.|p\.|press|university|chapitre|vol\.|19\d\d|20\d\d/i.test(body) || parseInt(num, 10) <= 50) {
      return `\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${body.trim()}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
    }
    return match;
  });

  // 4. Remplacer les chiffres exposants Unicode (ex: ⁹) ou marqueurs [^9] en badges de note interactifs
  const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
  text = text.replace(/\[\^(\d+)\]/g, (match, num) => {
    return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
  });
  text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (match, sups) => {
    const num = sups.split('').map(ch => supToNum[ch] || ch).join('');
    return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
  });

  // 5. Remplacement markdown vers HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?(?:div|table|thead|tbody|tr|th|td|blockquote|p|sup|span|a)(?:\s+[a-zA-Z0-9_\-]+="[^"]*")*)(\s*\/)?&gt;/gi, '<$1$2>')
    .replace(/^#### (.*$)/gim, '<h4 class="article-h4">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="article-h3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="article-h2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="article-h1">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, (match, label, href) => {
      if (href.startsWith('#')) {
        return `<a href="${href}" class="article-internal-link">${label}</a>`;
      }
      return `<a href="${href}" target="_blank" class="article-link">${label}</a>`;
    })
    .replace(/\n\n+/gim, '</p><p>')
    .replace(/\n/gim, '<br>');

  return html;
}

const rendered = renderArticleWithFootnotes(rawText);
console.log('--- EXTRACT WITH FOOTNOTE 9 CALL ---\n');
const idx = rendered.indexOf('article-fnref-9');
console.log(rendered.slice(Math.max(0, idx - 150), idx + 200));

console.log('\n--- EXTRACT WITH FOOTNOTE ITEMS AT BOTTOM ---\n');
const idx2 = rendered.indexOf('article-fn-1');
console.log(rendered.slice(Math.max(0, idx2 - 50), idx2 + 600));
