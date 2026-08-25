const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_9950c044564b.md';
let text = fs.readFileSync(path, 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

// Nettoyer "Dans la même série"
text = text.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');

if (/\[(?:↩︎|↩)\]\(#[^)]+\)/.test(text)) {
  let fnIndex = 1;
  text = text.replace(/([\s\S]*?)\s*\[(?:↩︎|↩)\]\(#[^)]+\)/g, (match, body) => {
    let prefix = '';
    let fnText = body.trim();
    
    // Si c'est la première note, séparer le texte de l'article de la note
    const splitMatch = fnText.match(/^([\s\S]*?[.!?…»])\s+([A-ZÀ-ÿ*«][\s\S]*)/);
    if (splitMatch && /ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp\.\s*\d+|p\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit/i.test(splitMatch[2])) {
      prefix = splitMatch[1] + '\n\n';
      fnText = splitMatch[2];
    }
    
    const num = fnIndex++;
    const cleanBody = normalizeSuperscripts(fnText.trim());
    return `${prefix}<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
  });
}

console.log('ALL FOOTNOTES:\n', text.slice(text.indexOf('article-footnote-item')));
