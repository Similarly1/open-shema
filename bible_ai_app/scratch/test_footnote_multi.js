const sample = `
8.
Stephen J. Wellum, unpublished Systematic Theology 1 Class Lectures [Cours de théologie systématique non publiés, 1er cours], 2006. ↩\r
Grudem, p. 24.
↩
9.
John Frame, Salvation Belongs to the Lord: An Introduction to Systematic Theology [Le salut appartient à l’Éternel: une introduction à la théologie systématique], trad. libre, Philipsburg, N. J., P&R, 2006, p. 79.
↩
`;

let text = sample;

// 1. Normaliser retours chariot
text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// 2. Éliminer les symboles ↩ sans détruire les retours à la ligne
text = text.replace(/[↩︎↩]/g, '');

// 3. Joindre les numéros de notes sur une ligne isolée
text = text.replace(/(?:^|\n)(\d+)\.\s*\n+([^\n]+)/g, '\n$1. $2');

// 4. Détecter chaque note avec ses éventuelles lignes supplémentaires
text = text.replace(/(?:^|\n)(\d+)\.\s+([^\n]+(?:\n(?!\d+\.|\s*#|\s*<|\s*---|\s*$)[^\n]+)*)/g, (match, num, body) => {
  let cleanBody = body.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  return `\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
});

// 5. Envelopper toutes les notes contiguës dans un conteneur unique
text = text.replace(/(?:<div class="article-footnote-item"[\s\S]+?<\/div>(?:\s*|\n*))+/g, (match) => {
  return `\n\n<div class="article-footnotes-section"><div class="article-footnotes-title"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>Notes de bas de page</span></div><div class="article-footnotes-list">${match.trim()}</div></div>\n\n`;
});

console.log("=== RESULT ===");
console.log(text);
