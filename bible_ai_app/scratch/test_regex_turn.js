const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,6})';
const notBibleRefAhead = `(?!(?:\\s*${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))`;

const regexSplit = new RegExp(`\\.\\s+([—–\\u2013\\u2014]${notBibleRefAhead}\\s*[A-ZÀ-ÿ])`, 'g');

console.log('allant au ciel. – Actes 1.8-11 matches split?', regexSplit.test('allant au ciel. – Actes 1.8-11')); // MUST BE FALSE
console.log('allant au ciel. – Bonjour matches split?', regexSplit.test('allant au ciel. – Bonjour')); // MUST BE TRUE
