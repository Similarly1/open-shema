const fs = require('fs');
const theologyCode = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/web/js/theology_view.js', 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

let text = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_9950c044564b.md', 'utf8');

// 5g. Détecter et formater les blocs de notes de bas de page avec ancres de retour [↩︎](#...)
const backlinkRegex = /\[(?:↩︎|↩)\]\(#[^)]+\)/;
if (backlinkRegex.test(text)) {
  text = text.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');
  const segments = text.split(/\[(?:↩︎|↩)\]\(#[^)]+\)/);
  let mainBody = segments[0];
  let firstNote = '';
  
  const fnBoundaryMatch = mainBody.match(/^([\s\S]*[a-zA-ZÀ-ÿ]{2,}[.!?…»])\s+((?:[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß]\.?)?\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+|[A-ZÀ-ÿ*«]|Ibid)[^\n]*?(?:ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp?\.\s*\d+|p\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit)[\s\S]*)$/i);
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

// 5j. Remplacer les vrais appels de note
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
text = text.replace(/<\/sup>\s+([.,;:!?])/g, '</sup>$1');

const results = [];
for (let i = 1; i <= 7; i++) {
  const hasRef = text.includes(`id="article-fnref-${i}"`);
  const hasFn = text.includes(`id="article-fn-${i}"`);
  results.push({ note: i, inText: hasRef, atBottom: hasFn });
}
console.log('RESULTS:');
console.table(results);
