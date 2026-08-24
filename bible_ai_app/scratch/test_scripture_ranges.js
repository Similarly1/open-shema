const bookPatternStr = '1\\s*Corinthiens|1\\s*Co|Romains|Rm|Éphésiens|Luc|Jean';

// Regex améliorée avec support :
// 1. Plage multi-chapitres avec versets : "1Co 3.1-4.2" ou "1Co 3:1 - 4:2"
// 2. Plage intra-chapitre : "1Co 3.1-4" ou "1Co 4.3-21"
// 3. Plage de chapitres entiers : "1 Corinthiens 3-4" ou "Romains 1-3"
// 4. Chapitre + verset unique : "Jean 3.16"
// 5. Chapitre seul : "Éphésiens 2"

const scriptureRegex = new RegExp(
  `(?<=^|[\\s\\(\\[\\{;,>–—«»"\'\\u2013\\u2014\\u00A0-])((?:${bookPatternStr})\\.?)\\s*([0-9]{1,3})(?:\\s*[:.,]\\s*([0-9]{1,3}))?(?:\\s*[-–—\\u2013\\u2014]\\s*([0-9]{1,3})(?:\\s*[:.,]\\s*([0-9]{1,3}))?)?((?:\\s*[,;]\\s*[0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?(?!\\s*[a-zA-ZÀ-ÿ]))*)`,
  'gi'
);

const samples = [
  'Lecture : 1 Corinthiens 3-4.',
  '1. Le message de la croix ( 1Co 3.1-4.2 ).',
  '2. Le chemin de la croix ( 1Co 4.3-21 ).',
  'Étude de Romains 1-3 et Éphésiens 2.',
  'Voir Jean 3.16-18 ainsi que Luc 24.13-35.'
];

samples.forEach((s, idx) => {
  console.log(`\n--- Sample ${idx+1}: "${s}" ---`);
  let res = s.replace(scriptureRegex, (fullMatch, book, ch1, vs1, chOrVs2, vs2, chained) => {
    let cleanBook = book.replace(/\.$/, '').trim();
    let displayRef = fullMatch.trim();
    let dataRef = '';

    if (vs1 && chOrVs2 && vs2) {
      // Cas multi-chapitres: "1Co 3.1-4.2" -> 3:1-4:2
      dataRef = `${cleanBook} ${ch1}:${vs1}-${chOrVs2}:${vs2}`;
    } else if (vs1 && chOrVs2 && !vs2) {
      // Cas versets même chapitre: "1Co 4.3-21" -> 4:3-21
      dataRef = `${cleanBook} ${ch1}:${vs1}-${chOrVs2}`;
    } else if (!vs1 && chOrVs2 && !vs2) {
      // Cas plage chapitres: "1 Corinthiens 3-4" -> 3-4
      dataRef = `${cleanBook} ${ch1}-${chOrVs2}`;
    } else if (vs1 && !chOrVs2) {
      // Cas verset unique: "Jean 3.16" -> 3:16
      dataRef = `${cleanBook} ${ch1}:${vs1}`;
    } else {
      // Cas chapitre seul: "Éphésiens 2" -> 2
      dataRef = `${cleanBook} ${ch1}`;
    }

    return `<span class="theol-inline-scripture-ref" data-ref="${dataRef}">${displayRef}</span>`;
  });
  console.log('Result:', res);
});
