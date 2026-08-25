const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_a060357a99da.md';
let rawText = fs.readFileSync(path, 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

function getEditorialBadgeLabel(text) {
  if (/traduction|article\s+original|source\s+originale|the\s+gospel\s+coalition|desiring\s+god|9marks|crossway/i.test(text)) return "SOURCE ORIGINALE & TRADUCTION";
  if (/extrait\s+du\s+livre|tiré\s+du\s+livre/i.test(text)) return "EXTRAIT D’OUVRAGE";
  if (/série|partie\s+d[’']une\s+série|épisode/i.test(text)) return "SÉRIE THÉMATIQUE";
  if (/recherche|thèse|mémoire|séminaire|sbts/i.test(text)) return "RECHERCHE & SÉMINAIRE";
  return "NOTE ÉDITORIALE";
}

let text = rawText;

// 1. Nettoyer les emojis résiduels dans les listes
text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');

// 2. Structurer la section "Pour aller plus loin"
text = text.replace(/(?:^|\n|[.!?…»])\s*(Pour\s+aller\s+plus\s+loin\s*:?)\s*(\[|Un\s+article|[A-ZÀ-ÿ])/gi, '\n\n### Pour aller plus loin\n\n- $2');
text = text.replace(/([.!?…»]|\))\s*(Un\s+article\s+de\s+[^\n:]+:\s*)/gi, '$1\n- $2');
text = text.replace(/([.!?…»]|\))\s*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?,\s*\*?\[[^\]]+\])/g, '$1\n- $2');

// 3. Isoler les mentions d'attribution éditoriale (Article original :, Traduction..., Merci à...)
text = text.replace(/([.!?…»])\s*(Merci\s+à\s+[^\n]+pour\s+la\s+traduction|Article\s+original\s*:|Publié\s+pour\s+la\s+première\s+fois|Cet\s+article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation))/gi, '$1\n\n$2');
text = text.replace(/(Publié\s+par\s+[^\n.]+[\.\s]*)\s*(Publié\s+pour\s+la\s+première\s+fois[^\n]+)/gi, '$1\n\n$2');

// 4. Cartouche éditorial pour la mention de traduction / source originale
text = text.replace(
  /(?:^|\n\n+)((?:Merci\s+à\s+[^\n]+pour\s+la\s+traduction|Article\s+original\s*:|Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)[\s\S]+?)(?=\n\n###|\n\n<|\s*$)/gi,
  (match, content) => {
    const badge = getEditorialBadgeLabel(content);
    const cleanContent = normalizeSuperscripts(content.trim());
    return `\n\n<div class="article-editorial-footer-card"><div class="article-editorial-footer-header"><span class="article-editorial-badge">${badge}</span></div><div class="article-editorial-footer-content">${cleanContent}</div></div>\n\n`;
  }
);

console.log('--- FORMATTED END ---\n', text.slice(text.indexOf('article-editorial-footer-card')));
