const fs = require('fs');
const path = 'C:/Users/adrie/Documents/antigravity/peaceful-mendeleev/bible_ai_app/data/articles/content/tpsg/tpsg_3eb78d8e58b0.md';
let rawText = fs.readFileSync(path, 'utf8');

const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

// Tester la normalisation des références scripturaires avec exposants
let text = rawText;

// 1. Normaliser les exposants dans les références bibliques (ex: Actes ¹.⁸-¹¹ -> Actes 1.8-11)
text = text.replace(/(\b(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,6})\.?)\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[\s.:,/-]+[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)*)/gi, (match, book, sups) => {
  return book + ' ' + normalizeSuperscripts(sups);
});

// 2. Vérifier si un tiret est une référence biblique (pour ne pas le transformer en speaker-turn)
function isScriptureLine(str) {
  return /^[—–\u2013\u2014-]\s*(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,4})\b/i.test(str.trim());
}

console.log('Is "– Actes 1.8-11" a scripture line?', isScriptureLine('– Actes 1.8-11')); // true
console.log('Is "— Matthieu : C\'est une bonne question" a scripture line?', isScriptureLine('— Matthieu : C\'est une bonne question')); // false (dialogue)

const idx = text.indexOf('Actes');
console.log('\n--- EXTRACT AROUND ACTES ---\n', text.slice(idx - 100, idx + 400));
