const fs = require('fs');

const fullMd = fs.readFileSync('C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/e21/e21_8ca9889054b3.md', 'utf8');

// Let's trace where 2 Sam gets split
let text = fullMd;

function check(label) {
  const m = text.match(/2 Sam[^\n]*\n+[^\n]*7/);
  const m2 = text.match(/2 Sam\.\s*7/);
  console.log(`[${label}] matched split:`, !!m, "matched direct:", !!m2);
  if (m) {
    console.log("  SPLIT TEXT:", JSON.stringify(m[0]));
  }
}

check("0. Initial");

// 1.
text = text.replace(/<div class="article-author-bio-card"[\s\S]*?<\/div>\s*<\/div>/gi, (m) => m);
check("1. Bio cards");

// 2. Dialogues / speaker turns
const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|Gen|Ex|Lv|Nb|Dt|Jos|Jg|Rt|1S|2S|1R|2R|1Ch|2Ch|Esd|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|Mt|Mc|Lc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Jc|1P|2P|1Jn|2Jn|3Jn|Jd|Ap)';
const notBibleRefAhead = `(?!(?:\\s*${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))`;

text = text.replace(/([:!?…»])\s*([—–\u2013\u2014]\s+[A-ZÀ-ÿ])/g, '$1\n\n$2');
check("2a. Dash after punctuation");

text = new RegExp(`\\.\\s+([—–\\u2013\\u2014]${notBibleRefAhead}\\s+[A-ZÀ-ÿ])`, 'g')[Symbol.replace](text, '.\n\n$1');
check("2b. Dash after period");

// 5d. Structurer les sous-titres et directives bibliques
text = text.replace(/(?:^|\n)([A-ZÀ-ÿ][^\n*]+?)\s+(\*\*Lisez\s+[^*]+\*\*)/gim, '\n\n### $1\n\n$2\n\n');
text = text.replace(/(\*\*[^*]+\*\*)\s+([A-ZÀ-ÿ])/g, '$1\n\n$2');
check("5d. Subtitles");

// 5j. Détecter et formater les listes de notes de bas de page numérotées
text = text.replace(/(?:^|\n)(\d+)\.\s+([^\n]+(?:\n(?!\d+\.|\s*#|\s*---|\s*$)[^\n]+)*)/g, (match, num, body) => {
  return match;
});
check("5j. Footnotes list");

// 5h. Joindre les numéros de notes séparés
text = text.replace(/(?:^|\n)(\d+)\.\s*\n+([^\n]+)/g, '\n$1. $2');
check("5h. Footnote join");

// Number list item splitting?
text = text.replace(/\n\n+/g, '</p><p>');
check("End. Paragraphs");
