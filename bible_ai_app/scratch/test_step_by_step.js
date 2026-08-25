const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

let snippet = "> Mais vous recevrez une puissance... allant au ciel. – Actes ¹.⁸-¹¹";

// 1. Normaliser les exposants scripturaires d'abord
snippet = snippet.replace(/(\b(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,6})\.?)\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[\s.:,/-]+[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)*)/gi, (match, book, sups) => {
  return book + ' ' + normalizeSuperscripts(sups);
});

// 2. 5e
const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+)';
const notBibleRefAhead = `(?!${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹])`;

snippet = snippet.replace(/([:!?…»])\s*([—–\u2013\u2014]\s*)/g, '$1\n\n$2');
snippet = new RegExp(`\\.\\s+([—–\\u2013\\u2014]\\s*${notBibleRefAhead}[A-ZÀ-ÿ])`, 'g')[Symbol.replace](snippet, '.\n\n$1');

console.log('Result:\n', snippet);
