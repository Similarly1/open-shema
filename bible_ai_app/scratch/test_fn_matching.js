const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_9950c044564b.md';
let rawText = fs.readFileSync(path, 'utf8');

const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');
const articlesCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/articles_view.js', 'utf8');

const vm = require('vm');
const sandbox = { console, window: {}, document: { addEventListener: () => {} }, API: {}, localStorage: { getItem: () => null } };
vm.createContext(sandbox);
vm.runInContext(theologyCode + '\nwindow.TheologyView = TheologyView;', sandbox);
vm.runInContext(articlesCode, sandbox);

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

let text = rawText;

// 1. Nettoyer "Dans la même série"
text = text.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');

// 2. Détecter et formater les blocs de notes de bas de page avec ancres de retour [↩︎](#...)
const backlinkRegex = /\[(?:↩︎|↩)\]\(#[^)]+\)/;
if (backlinkRegex.test(text)) {
  const segments = text.split(/\[(?:↩︎|↩)\]\(#[^)]+\)/);
  let mainBody = segments[0];
  let firstNote = '';
  
  const fnBoundaryMatch = mainBody.match(/^([\s\S]*?[.!?…»])\s+((?:[A-ZÀ-ÿ*«]|Ibid)[^\n]*?(?:ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp?\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit)[\s\S]*)$/i);
  if (fnBoundaryMatch) {
    mainBody = fnBoundaryMatch[1];
    firstNote = fnBoundaryMatch[2];
  }
  
  const notes = [firstNote, ...segments.slice(1, -1)].map(s => s.trim()).filter(s => s.length > 0);
  const trailing = segments[segments.length - 1] || '';
  
  const formattedNotes = notes.map((noteText, idx) => {
    const num = idx + 1;
    const cleanBody = normalizeSuperscripts(noteText.trim());
    return `<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>`;
  }).join('\n\n');
  
  text = `${mainBody}\n\n${formattedNotes}\n\n${trailing}`;
}

// 3. Remplacer les appels de note
text = text.replace(/\[\^(\d+)\]/g, (match, num) => {
  return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
});
text = text.replace(/([a-zA-ZÀ-ÿ»"'\).,;!?])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2})(?!\w)/g, (match, prevChar, sups) => {
  const num = parseInt(normalizeSuperscripts(sups), 10);
  if (num <= 50) {
    return `${prevChar}<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
  }
  return `${prevChar}${num}`;
});

const idx5 = text.indexOf('id="article-fnref-5"');
console.log('Found footnote 5 badge in text?', idx5 !== -1);
if (idx5 !== -1) {
  console.log('BADGE 5:\n', text.slice(idx5 - 30, idx5 + 100));
}

const idxFn5 = text.indexOf('id="article-fn-5"');
console.log('Found footnote 5 target at bottom?', idxFn5 !== -1);
if (idxFn5 !== -1) {
  console.log('FOOTNOTE 5:\n', text.slice(idxFn5 - 10, idxFn5 + 200));
}
