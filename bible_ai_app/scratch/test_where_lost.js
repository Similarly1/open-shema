const fs = require('fs');
const raw = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_37db74ac4df2.md', 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

let text = raw;
if (!text.includes('\n\n')) {
  text = text.replace(/(?<!\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art|\d+))\.\s+([A-ZÀ-ÿ—–«])/gi, '.\n\n$1');
  text = text.replace(/([!?…»])\s+([A-ZÀ-ÿ0-9—–«])/g, '$1\n\n$2');
}

console.log('BEFORE 5e:');
console.log('Contains ² ?', text.includes('²'));

const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,6})';
const notBibleRefAhead = `(?!(?:\\s*${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))`;

// Test 1:
const t1 = text.replace(/([:!?…»])\s*([—–\u2013\u2014]\s+[A-ZÀ-ÿ])/g, '$1\n\n$2');
console.log('After T1: ² exists?', t1.includes('²'));

// Test 2:
const t2 = new RegExp(`\\.\\s+([—–\\u2013\\u2014]${notBibleRefAhead}\\s+[A-ZÀ-ÿ])`, 'g')[Symbol.replace](t1, '.\n\n$1');
console.log('After T2: ² exists?', t2.includes('²'));

// Test 3:
const t3 = new RegExp(`(?:^|\\n)\\s*([—–\\u2013\\u2014]${notBibleRefAhead}\\s+[A-ZÀ-ÿ][^\\n]+)`, 'g')[Symbol.replace](t2, (m, g1) => {
  console.log('MATCHED DIALOGUE:\n', g1.slice(0, 100));
  return `\n\n<div class="article-speaker-turn"><p class="article-speaker-speech">${g1}</p></div>\n\n`;
});
console.log('After T3: ² exists?', t3.includes('²'));
