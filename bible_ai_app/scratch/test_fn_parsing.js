const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_9950c044564b.md';
let text = fs.readFileSync(path, 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

// 1. Nettoyer "Dans la même série"
text = text.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');

// 2. Détecter et formater les blocs de notes avec [↩︎](#...-link)
if (/\[(?:↩︎|↩)\]\(#[^)]+\)/.test(text)) {
  // Trouver le début du premier bloc de note
  // Chaque note se termine par [↩︎](#...-link)
  // Remplacer chaque séquence de note
  let fnCounter = 1;
  
  // Séparer les notes à chaque [↩︎](#...-link)
  // On remplace "CORPS_DE_NOTE [↩︎](#...-link)" par le bloc HTML stylisé
  // En s'assurant de séparer de la phrase précédente
  text = text.replace(/([.!?…»]|\b)\s*([A-ZÀ-ÿ*«][^\[\n]+?)\s*\[(?:↩︎|↩)\]\(#[^)]+\)/g, (match, prefix, body) => {
    const num = fnCounter++;
    const cleanBody = normalizeSuperscripts(body.trim());
    return `${prefix}\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
  });
  console.log('Detected footnotes count:', fnCounter - 1);
}

const idx = text.indexOf('article-footnote-item');
if (idx !== -1) {
  console.log('ALL FOOTNOTES:\n', text.slice(idx));
}
