const fs = require('fs');
let text = `
### Pour aller plus loin

- [« C’est quoi une Église en bonne santé ?»](/article/livre-eglise-bilan-sante/) – Réfléxion tirée du livre *[L’Église : un bilan de santé](https://blfstore.com/products/l-eglise-un-bilan-de-sante?bg_ref=f5HKGMgR9Q)* , de Mark Dever
- Un article de la Rébellution : [« L’[horrible] épouse de mon meilleur ami »](https://www.larebellution.com/articles/lepouse-de-mon-meilleur-ami)
- Jonathan Meyer, *[Aimer l’Église](https://blfstore.com/products/aimer-leglise?bg_ref=f5HKGMgR9Q)* , BLF Éditions 2026, 168 pages.
`;

text = text.replace(/\[([^\]]*?)\[([^\]]*?)\]([^\]]*?)\]\((https?:\/\/[^\)]+)\)/g, '[$1$2$3]($4)');
text = text.replace(/^-\s+(.*$)/gim, '<div class="article-bullet-item"><span class="article-bullet-dot">•</span><div class="article-bullet-text">$1</div></div>');
text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');
text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, (match, label, href) => `<a href="${href}" target="_blank" class="article-link">${label}</a>`);

console.log('RESULT:\n', text);
