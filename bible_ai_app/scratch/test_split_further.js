const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_a060357a99da.md';
let rawText = fs.readFileSync(path, 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

let text = rawText;

// 1. Nettoyer les emojis résiduels dans les listes
text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');

// 2. Structurer la section "Pour aller plus loin"
text = text.replace(/(?:^|\n|[.!?…»])\s*(Pour\s+aller\s+plus\s+loin\s*:?)\s*(\[|Un\s+article|[A-ZÀ-ÿ])/gi, '\n\n### Pour aller plus loin\n\n- $2');
text = text.replace(/([A-Za-zÀ-ÿ0-9\)\]*])\s+(Un\s+article\s+de\s+[^\n:]+:\s*)/gi, '$1\n- $2');
text = text.replace(/([.!?…»]|\))\s*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?,\s*\*?\[[^\]]+\])/g, '$1\n- $2');

// 3. Isoler les mentions d'attribution éditoriale (Article original :, Traduction..., Merci à...)
text = text.replace(/([.!?…»])\s*(Merci\s+à\s+[^\n]+pour\s+la\s+traduction|Article\s+original\s*:|Publié\s+pour\s+la\s+première\s+fois|Cet\s+article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation))/gi, '$1\n\n$2');
text = text.replace(/(Publié\s+par\s+[^\n.]+[\.\s]*)\s*(Publié\s+pour\s+la\s+première\s+fois[^\n]+)/gi, '$1\n\n$2');

console.log('--- EXTRACT ---\n', text.slice(text.indexOf('### Pour aller plus loin')));
