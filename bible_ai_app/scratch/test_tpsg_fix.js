const fs = require('fs');

const md = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_5dff503fa7df.md', 'utf8');

// Let's test the editorial footer match
let text = md;

// 1. Protection de Ndlr / NDLR pour ne pas être découpé en prise de parole de dialogue
text = text.replace(/([—–\u2013\u2014-]\s*Ndlr\.?)/gi, '($1)');

// 2. Nettoyage des backlinks de notes [↩︎](#...) ou [↩](#...)
text = text.replace(/\[\s*[↩︎↩]?\s*\]\(#[^)]*\)/gi, '');
text = text.replace(/[↩︎↩]/g, '');

console.log("=== STEP 1 CLEANUP ===");
console.log(text.substring(text.indexOf('Cet article est extrait')));
