const TheologyView = {
  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  highlightScriptureReferences(text) {
    if (!text) return '';
    const bookNames = [
      'Cantique des cantiques', 'Cantique', 'Song of Songs', 'Song of Solomon', 'Song',
      'Actes des apôtres', 'Acts of the Apostles', 'Actes', 'Acts',
      '1\\s*Thessaloniciens', '2\\s*Thessaloniciens', '1\\s*Thessalonians', '2\\s*Thessalonians',
      '1\\s*Chroniques', '2\\s*Chroniques', '1\\s*Chronicles', '2\\s*Chronicles',
      '1\\s*Corinthiens', '2\\s*Corinthiens', '1\\s*Corinthians', '2\\s*Corinthians',
      '1\\s*Timothée', '2\\s*Timothée', '1\\s*Timothee', '2\\s*Timothee', '1\\s*Timothy', '2\\s*Timothy',
      '1\\s*Samuel', '2\\s*Samuel', '1\\s*Rois', '2\\s*Rois', '1\\s*Kings', '2\\s*Kings',
      '1\\s*Pierre', '2\\s*Pierre', '1\\s*Peter', '2\\s*Peter',
      '1\\s*Jean', '2\\s*Jean', '3\\s*Jean', '1\\s*John', '2\\s*John', '3\\s*John',
      'Genèse', 'Genese', 'Genesis', 'Exode', 'Exodus', 'Lévitique', 'Levitique', 'Leviticus', 'Nombres', 'Numbers', 'Deutéronome', 'Deuteronome', 'Deuteronomy',
      'Josué', 'Josue', 'Joshua', 'Juges', 'Judges', 'Ruth', 'Esdras', 'Ezra', 'Néhémie', 'Nehemie', 'Nehemiah', 'Esther', 'Job',
      'Psaumes', 'Psaume', 'Psalms', 'Psalm', 'Proverbes', 'Proverbe', 'Proverbs', 'Ecclésiaste', 'Ecclesiaste', 'Ecclesiastes',
      'Ésaïe', 'Esaïe', 'Esaie', 'Isaiah', 'Jérémie', 'Jeremie', 'Jeremiah', 'Lamentations', 'Ézéchiel', 'Ezechiel', 'Ezekiel',
      'Daniel', 'Osée', 'Osee', 'Hosea', 'Joël', 'Joel', 'Amos', 'Abdias', 'Obadiah', 'Jonas', 'Jonah', 'Michée', 'Michee', 'Micah',
      'Nahum', 'Habacuc', 'Habakkuk', 'Sophonie', 'Zephaniah', 'Aggée', 'Aggee', 'Haggai', 'Zacharie', 'Zechariah', 'Malachie', 'Malachi',
      'Matthieu', 'Matthew', 'Marc', 'Mark', 'Luc', 'Luke', 'Jean', 'John', 'Romains', 'Romans',
      'Galates', 'Galatians', 'Éphésiens', 'Ephesiens', 'Ephesians', 'Philippiens', 'Philippians', 'Colossiens', 'Colossians',
      'Tite', 'Titus', 'Philémon', 'Philemon', 'Hébreux', 'Hebreux', 'Hebrews', 'Jacques', 'James', 'Jude', 'Apocalypse', 'Revelation',
      '1\\s*The?s?s?', '2\\s*The?s?s?', '1\\s*Th', '2\\s*Th',
      '1\\s*Chr?o?n?', '2\\s*Chr?o?n?', '1\\s*Ch', '2\\s*Ch',
      '1\\s*Co?r?', '2\\s*Co?r?', '1\\s*Co', '2\\s*Co',
      '1\\s*Ti?m?', '2\\s*Ti?m?', '1\\s*Ti', '2\\s*Ti', '1\\s*Tm', '2\\s*Tm',
      '1\\s*Sa?m?', '2\\s*Sa?m?', '1\\s*Sa', '2\\s*Sa', '1\\s*S', '2\\s*S',
      '1\\s*Ro?i?s?', '2\\s*Ro?i?s?', '1\\s*Kgs?', '2\\s*Kgs?', '1\\s*Ki', '2\\s*Ki', '1\\s*R', '2\\s*R',
      '1\\s*Pie?r?r?e?', '2\\s*Pie?r?r?e?', '1\\s*Pet?', '2\\s*Pet?', '1\\s*Pe', '2\\s*Pe', '1\\s*Pi', '2\\s*Pi', '1\\s*P', '2\\s*P',
      '1\\s*Jn', '2\\s*Jn', '3\\s*Jn', '1\\s*Joh', '2\\s*Joh', '3\\s*Joh', '1\\s*J', '2\\s*J', '3\\s*J',
      'Gen', 'Gn', 'Ge', 'Exod', 'Exo', 'Ex', 'Lév', 'Lev', 'Lv', 'Nomb', 'Numb', 'Num', 'Nom', 'Nb', 'Deut', 'Dtn', 'Dt',
      'Josh', 'Jos', 'Judg', 'Jug', 'Jdg', 'Jg', 'Rut', 'Rth', 'Rt', 'Ezr', 'Esd', 'Néhem', 'Nehem', 'Néh', 'Neh', 'Né', 'Ne', 'Esth', 'Est',
      'Jb', 'Psa', 'Psm', 'Pss', 'Ps', 'Prov', 'Prv', 'Pr', 'Eccl', 'Ecc', 'Qoh', 'Ec', 'Cant', 'Ct',
      'Ésa', 'Esa', 'Isa', 'És', 'Es', 'Is', 'Jér', 'Jer', 'Jr', 'Lam', 'Lm', 'Ézéch', 'Ezech', 'Ezek', 'Ézé', 'Eze', 'Éz', 'Ez',
      'Dan', 'Da', 'Osé', 'Ose', 'Hos', 'Os', 'Joë', 'Joe', 'Jl', 'Amo', 'Am',
      'Obad', 'Abd', 'Oba', 'Ab', 'Jonah', 'Jon', 'Mich', 'Mic', 'Mi', 'Nah', 'Na', 'Habak', 'Hab', 'Ha',
      'Zeph', 'Soph', 'Zep', 'So', 'Hagg', 'Agg', 'Hag', 'Ag', 'Zech', 'Zach', 'Zec', 'Za', 'Mal', 'Ml',
      'Matt', 'Mat', 'Mt', 'Marc', 'Mark', 'Mar', 'Mc', 'Mk', 'Luk', 'Luc', 'Lc', 'Lk', 'Joh', 'Jn',
      'Acts', 'Act', 'Ac', 'Rom', 'Rm', 'Ro', 'Galat', 'Gal', 'Ga', 'Éphés', 'Ephes', 'Éph', 'Eph', 'Ép', 'Ep',
      'Philip', 'Phil', 'Php', 'Phi', 'Ph', 'Coloss', 'Col', 'Tit', 'Tt', 'Philem', 'Philém', 'Phm', 'Phl',
      'Hébr', 'Hebr', 'Héb', 'Heb', 'He', 'Jacq', 'Jam', 'Jac', 'Jas', 'Jc', 'Jud', 'Jd', 'Apoc', 'Rev', 'Apo', 'Ap'
    ];

    const bookPatternStr = bookNames.sort((a, b) => b.length - a.length).join('|');

    // Détection universelle : multi-chapitres (1Co 3.1-4.2), plages chapitres (1 Corinthiens 3-4), versets (1Co 4.3-21)
    const scriptureRegex = new RegExp(
      `(?<=^|[\\s\\(\\[\\{;,>–—«»"\'\\u2013\\u2014\\u00A0-])((?:${bookPatternStr})\\.?)\\s*([0-9]{1,3})(?:\\s*[:.,]\\s*([0-9]{1,3}))?(?:\\s*[-–—\\u2013\\u2014]\\s*([0-9]{1,3})(?:\\s*[:.,]\\s*([0-9]{1,3}))?)?((?:\\s*[,;]\\s*[0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?(?!\\s*[a-zA-ZÀ-ÿ]))*)`,
      'gi'
    );

    const parts = text.split(/(<[^>]+>)/g);
    return parts.map(part => {
      if (part.startsWith('<') && part.endsWith('>')) {
        return part;
      }

      return part.replace(scriptureRegex, (fullMatch, book, ch1, vs1, chOrVs2, vs2, chained) => {
        const cleanBook = book.replace(/\\.$/, '').trim();
        let displayRef = fullMatch.trim();
        let firstRef = '';

        if (vs1 && chOrVs2 && vs2) {
          const cleanVs1 = vs1.replace(/\\s+/g, '');
          const cleanVs2 = vs2.replace(/\\s+/g, '');
          firstRef = `${cleanBook} ${ch1}:${cleanVs1}-${chOrVs2}:${cleanVs2}`;
          displayRef = `${book} ${ch1}.${cleanVs1}-${chOrVs2}.${cleanVs2}`;
        } else if (vs1 && chOrVs2 && !vs2) {
          const cleanVs1 = vs1.replace(/\\s+/g, '');
          const cleanVs2 = chOrVs2.replace(/\\s+/g, '');
          firstRef = `${cleanBook} ${ch1}:${cleanVs1}-${cleanVs2}`;
          displayRef = `${book} ${ch1}.${cleanVs1}-${cleanVs2}`;
        } else if (!vs1 && chOrVs2 && !vs2) {
          firstRef = `${cleanBook} ${ch1}-${chOrVs2}`;
          displayRef = `${book} ${ch1}-${chOrVs2}`;
        } else if (vs1 && !chOrVs2) {
          const cleanVs1 = vs1.replace(/\\s+/g, '');
          firstRef = `${cleanBook} ${ch1}:${cleanVs1}`;
          displayRef = `${book} ${ch1}.${cleanVs1}`;
        } else {
          firstRef = `${cleanBook} ${ch1}`;
          displayRef = `${book} ${ch1}`;
        }

        let result = `<span class="theol-inline-scripture-ref" data-ref="${TheologyView.escapeHtml(firstRef)}">${displayRef}</span>`;

        if (chained) {
          const subRegex = /([,;]\\s*)([0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?)/g;
          const formattedChained = chained.replace(subRegex, (m, sep, subCv) => {
            const p = subCv.split(/[:.,]/);
            const subCh = p[0].trim();
            const subVs = p[1] ? p[1].replace(/[\\u2013\\u2014\\u2212\\u2010\\u2011\\u2012\\u2015]/g, '-').replace(/\\s+/g, '') : '';
            const subRef = subVs ? `${cleanBook} ${subCh}:${subVs}` : `${cleanBook} ${subCh}`;
            return `${sep}<span class="theol-inline-scripture-ref" data-ref="${TheologyView.escapeHtml(subRef)}">${subCv}</span>`;
          });
          result += formattedChained;
        }

        return result;
      });
    }).join('');
  }
};

const tests = [
  '<p><strong>Lecture : 1 Corinthiens 3-4.</strong></p>',
  '<p>1. Le message de la croix est une folie que nous devons annoncer ( 1Co 3.1-4.2 ).</p>',
  '<p>2. Le chemin de la croix est une faiblesse que nous devons emprunter ( 1Co 4.3-21 ).</p>'
];

tests.forEach((t, i) => {
  console.log(`\n--- Test ${i+1} ---`);
  console.log(TheologyView.highlightScriptureReferences(t));
});
