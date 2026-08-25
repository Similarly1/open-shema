const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

let text = raw;

// Let's trace where ² ³ ⁴ ⁵ ⁶ ⁷ are in text step by step:
console.log('1. Raw contains ² ?', text.includes('²'));
console.log('1. Raw contains ⁷ ?', text.includes('⁷'));

// Step 5f: blockquotes (« ... » – Réf)
text = text.replace(/(?:^|\n)«\s*([^»]+?)\s*»\s*([–—\u2013\u2014-]\s*[A-ZÀ-ÿ0-9.:\s-]+)/g, '\n\n<blockquote class="article-bible-quote"><p>« $1 » $2</p></blockquote>\n\n');

console.log('After 5f: text contains ² ?', text.includes('²'));

// Step 5g: backlinkRegex
const backlinkRegex = /\[(?:↩︎|↩)\]\(#[^)]+\)/;
console.log('5g. Has backlinkRegex?', backlinkRegex.test(text));

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
  
  console.log('5g notes count:', notes.length);
  notes.forEach((n, idx) => console.log(`Note ${idx + 1}:`, n.slice(0, 50)));

  const formattedNotes = notes.map((noteText, idx) => {
    const num = idx + 1;
    const cleanBody = normalizeSuperscripts(noteText.trim());
    return `<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>`;
  }).join('\n\n');
  
  text = `${mainBody}\n\n${formattedNotes}\n\n${trailing}`;
}

console.log('After 5g: main text contains ² ?', text.includes('²'));
console.log('After 5g: main text contains ⁷ ?', text.includes('⁷'));

// Step 5j:
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

for (let i = 1; i <= 7; i++) {
  console.log(`id="article-fnref-${i}" exists:`, text.includes(`id="article-fnref-${i}"`));
}
