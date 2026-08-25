const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_9950c044564b.md';
let text = fs.readFileSync(path, 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

// Nettoyer "Dans la même série"
text = text.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');

// Détecter si l'article contient des ancres [↩︎](#...)
const backlinkRegex = /\[(?:↩︎|↩)\]\(#[^)]+\)/g;
if (backlinkRegex.test(text)) {
  // Découper par [↩︎](#...)
  const segments = text.split(/\[(?:↩︎|↩)\]\(#[^)]+\)/);
  // Les segments 0 à N-2 (les N-1 premiers éléments avant chaque [↩︎])
  // Le dernier segment est ce qui suit la dernière note (souvent vide ou recommandé)
  
  // Pour le premier segment, la note commence après le texte principal
  // On cherche où commence la première note dans segments[0]
  let mainBody = segments[0];
  let firstNote = '';
  
  // Chercher la frontière entre le corps de l'article et la 1re note
  // Une note commence généralement par un nom d'auteur, "Ibid", un titre ou un numéro
  const fnBoundaryMatch = mainBody.match(/^([\s\S]*?[.!?…»])\s+((?:[A-ZÀ-ÿ*«]|Ibid)[^\n]*?(?:ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp?\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit)[\s\S]*)$/i);
  if (fnBoundaryMatch) {
    mainBody = fnBoundaryMatch[1];
    firstNote = fnBoundaryMatch[2];
  }
  
  const notes = [firstNote, ...segments.slice(1, -1)].map(s => s.trim()).filter(s => s.length > 0);
  const trailing = segments[segments.length - 1] || '';
  
  let formattedNotes = notes.map((noteText, idx) => {
    const num = idx + 1;
    const cleanBody = normalizeSuperscripts(noteText.trim());
    return `<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>`;
  }).join('\n\n');
  
  text = `${mainBody}\n\n${formattedNotes}\n\n${trailing}`;
}

console.log('ALL 7 FOOTNOTES:\n', text.slice(text.indexOf('article-footnote-item')));
