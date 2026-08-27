const fs = require('fs');

let md = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/e21/e21_0ecdb60028ad.md', 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => String(str).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

// 1. Normaliser tous les \r+ en \n
let text = md.replace(/\r\n/g, '\n').replace(/\r+/g, '\n');

// 2. Nettoyer les symboles ↩
text = text.replace(/[↩︎↩]/g, '');

// 3. Joindre les numéros de notes isolés: "8.\nStephen..." -> "8. Stephen..."
text = text.replace(/(?:^|\n)(\d+)\.\s*\n+([^\n]+)/g, '\n$1. $2');

// 4. Joindre les lignes orphelines de citation secondaire à l'intérieur des notes (ex: "8. Stephen...\n\nGrudem, p. 24.\n\n9. John...")
text = text.replace(/(?:^|\n)(\d+\.\s+[^\n]+(?:\n\n(?!\d+\.|\s*#|\s*<|\s*---|\s*\*\*)[^\n]+)+)/g, (match) => {
  return match.replace(/\n\n+/g, ' ');
});

// 5. Détecter et formater les listes de notes de bas de page numérotées
text = text.replace(/(?:^|\n)(\d+)\.\s+([^\n]+(?:\n(?!\d+\.|\s*#|\s*<|\s*---|\s*$)[^\n]+)*)/g, (match, num, body) => {
  let cleanBody = normalizeSuperscripts(body.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim());
  return `\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
});

// 6. Envelopper la suite de <div class="article-footnote-item"> dans une section unique
text = text.replace(/(?:<div class="article-footnote-item"[\s\S]+?<\/div>(?:\s*|\n*))+/g, (match) => {
  return `\n\n<div class="article-footnotes-section"><div class="article-footnotes-title"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>Notes de bas de page</span></div><div class="article-footnotes-list">${match.trim()}</div></div>\n\n`;
});

const sectionMatches = text.match(/<div class="article-footnotes-section">/g) || [];
console.log(`Total sections count: ${sectionMatches.length}`);

const note8Match = text.match(/<div class="article-footnote-item" id="article-fn-8">[\s\S]*?<\/div>/);
if (note8Match) {
  console.log("\nNote 8 full HTML:");
  console.log(note8Match[0]);
}
