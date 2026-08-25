const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_9950c044564b.md';
let rawText = fs.readFileSync(path, 'utf8');

// Find all entries with [↩︎](#...-link)
const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

let text = rawText;

// Let's test footnote extraction when entries have [↩︎](#...-link) or are numbered
// Split by [↩︎](#...-link)
const fnMatches = [];
let fnCounter = 1;

// If there are [↩︎](#...-link) tokens
if (/\[(?:↩︎|↩)\]\(#[^)]+\)/.test(text)) {
  // Extract footnotes terminated by [↩︎](#...-link)
  text = text.replace(/(?:^|\n)([^\n]+?)\s*\[(?:↩︎|↩)\]\(#[^)]+\)/g, (match, body) => {
    const num = fnCounter++;
    return `\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${normalizeSuperscripts(body.trim())}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
  });
}

console.log('Processed footnotes count:', fnCounter - 1);
const idx = text.indexOf('article-footnote-item');
if (idx !== -1) {
  console.log('Footnotes HTML sample:\n', text.slice(idx, idx + 800));
}
