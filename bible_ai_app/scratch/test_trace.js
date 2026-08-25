const fs = require('fs');
let text = 'allant au ciel. – Actes ¹.⁸-¹¹\n\nTu as remarqué';
const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

console.log('0:', JSON.stringify(text));
text = text.replace(/(\b(?:Actes|Genèse|Exode)\.?)\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[\s.:,/-]+[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)*)/gi, (match, book, sups) => book + ' ' + normalizeSuperscripts(sups));
console.log('1:', JSON.stringify(text));

const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+)';
const notBibleRefAhead = '(?!' + bibleBooksPattern + '\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹])';

console.log('notBibleRefAhead regex:', notBibleRefAhead);

const regexSplit = new RegExp('\\.\\s+([—–\\u2013\\u2014]\\s*' + notBibleRefAhead + '[A-ZÀ-ÿ])', 'g');
console.log('regexSplit matches?', regexSplit.test(text));

const regexTurn = new RegExp('(?:^|\\n)\\s*([—–\\u2013\\u2014]\\s*' + notBibleRefAhead + '[^\\n]+)', 'g');
console.log('regexTurn matches?', regexTurn.test(text));
