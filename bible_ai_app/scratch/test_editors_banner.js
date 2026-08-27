const fs = require('fs');

const sample1 = `
Note de l'éditeur :

*Cet article est une traduction de* **10 theology books that changed my life** *, initialement publiée sur wyattgraham.com.*
`;

function formatBanner(text) {
  return text.replace(/(?:^|\n)(?:(?:\*\*)?\s*(Editors[’']\s*note|Note\s+de\s+l[’']éditeur|Editor[’']s\s+note|Note\s+de\s+la\s+rédaction|NDLR)\s*(?:\*\*)?\s*:?\s*\n*)+(?:\*\*)?\s*([^\n]+?)(?=\n|$)/gi, (match, labelRaw, noteContent) => {
    let cleanLabel = labelRaw.trim();
    if (/Note\s+de\s+l/i.test(cleanLabel)) cleanLabel = "Note de l’éditeur :";
    else if (/Note\s+de\s+la/i.test(cleanLabel)) cleanLabel = "Note de la rédaction :";
    else if (/NDLR/i.test(cleanLabel)) cleanLabel = "NDLR :";
    else cleanLabel = "Editors’ note :";

    let cleanContent = noteContent.trim();
    return `\n\n<div class="article-editors-note-banner"><strong class="article-editors-note-label">${cleanLabel}</strong> ${cleanContent}</div>\n\n`;
  });
}

console.log("=== OUTPUT ===");
console.log(formatBanner(sample1));
