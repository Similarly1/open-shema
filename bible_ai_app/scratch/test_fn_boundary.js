const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_9950c044564b.md', 'utf8');

let text = raw.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');
const segments = text.split(/\[(?:↩︎|↩)\]\(#[^)]+\)/);
let mainBody = segments[0];
let firstNote = '';

const fnBoundaryMatch = mainBody.match(/^([\s\S]*[a-zA-ZÀ-ÿ]{2,}[.!?…»])\s+((?:[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß]\.?)?\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+|[A-ZÀ-ÿ*«]|Ibid)[^\n]*?(?:ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp?\.\s*\d+|p\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit)[\s\S]*)$/i);
if (fnBoundaryMatch) {
  mainBody = fnBoundaryMatch[1];
  firstNote = fnBoundaryMatch[2];
}

console.log('MAIN BODY END:\n', mainBody.slice(-160));
console.log('\nFIRST NOTE:\n', firstNote);
