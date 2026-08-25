const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_66d7e7d60d98.md';
let rawText = fs.readFileSync(path, 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

function getEditorialBadgeLabel(text) {
  if (/extrait\s+du\s+livre|tiré\s+du\s+livre/i.test(text)) return "EXTRAIT D’OUVRAGE";
  if (/série|partie\s+d[’']une\s+série|épisode/i.test(text)) return "SÉRIE THÉMATIQUE";
  if (/recherche|thèse|mémoire|séminaire|sbts/i.test(text)) return "RECHERCHE & SÉMINAIRE";
  return "NOTE ÉDITORIALE";
}

let text = rawText;

// 1. Nettoyer "Tous droits réservés"
text = text.replace(/(?:Tous\s+droits\s+réservés[\.\s]*|All\s+rights\s+reserved[\.\s]*)/gi, '');

// 2. Séparer l'attribution éditoriale si elle est collée à la phrase précédente
text = text.replace(/([.!?…»])\s*(Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)/gi, '$1\n\n$2');

// 3. Convertir en cartouche éditorial
text = text.replace(
  /(?:^|\n\n+)((?:Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)[\s\S]+?)(?=\s*$)/gi,
  (match, content) => {
    const badge = getEditorialBadgeLabel(content);
    const cleanContent = normalizeSuperscripts(content.trim());
    return `\n\n<div class="article-editorial-footer-card"><div class="article-editorial-footer-header"><span class="article-editorial-badge">${badge}</span></div><div class="article-editorial-footer-content">${cleanContent}</div></div>\n\n`;
  }
);

const idx = text.indexOf('article-editorial-footer-card');
console.log('Found card?', idx !== -1);
if (idx !== -1) {
  console.log('CARD EXTRACT:\n', text.slice(idx));
}
