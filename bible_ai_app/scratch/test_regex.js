const TheologyView = {
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

    const scriptureRegex = new RegExp(
      `(?<=^|[\\s\\(\\[\\{;,>–—«»"\'\\u2013\\u2014\\u00A0-])((?:${bookPatternStr})\\.?)\\s*([0-9]{1,3})(?:\\s*[:.,]\\s*([0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?))?((?:\\s*[,;]\\s*[0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?(?!\\s*[a-zA-ZÀ-ÿ]))*)`,
      'gi'
    );

    return text.replace(scriptureRegex, (fullMatch, book, ch, vs, chained) => {
      const cleanBook = book.replace(/\\.$/, '').trim();
      let firstRef = '';
      let displayRef = '';
      if (vs) {
        const cleanVs = vs.replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-').replace(/\s+/g, '');
        firstRef = `${cleanBook} ${ch}:${cleanVs}`;
        displayRef = `${book} ${ch}.${cleanVs}`;
      } else {
        firstRef = `${cleanBook} ${ch}`;
        displayRef = `${book} ${ch}`;
      }
      let result = `<span class="theol-inline-scripture-ref" data-ref="${TheologyView.escapeHtml(firstRef)}">${displayRef}</span>`;

      if (chained) {
        const subRegex = /([,;]\\s*)([0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?)/g;
        const formattedChained = chained.replace(subRegex, (m, sep, subCv) => {
          const parts = subCv.split(/[:.,]/);
          const subCh = parts[0].trim();
          const subVs = parts[1] ? parts[1].replace(/[\\u2013\\u2014\\u2212\\u2010\\u2011\\u2012\\u2015]/g, '-').replace(/\\s+/g, '') : '';
          const subRef = subVs ? `${cleanBook} ${subCh}:${subVs}` : `${cleanBook} ${subCh}`;
          return `${sep}<span class="theol-inline-scripture-ref" data-ref="${TheologyView.escapeHtml(subRef)}">${subCv}</span>`;
        });
        result += formattedChained;
      }

      return result;
    });
  }
};

const tests = [
  '<p class="article-speaker-speech">Hébreux 10:24-25 : « N’abandonnez pas vos assemblées... »</p>',
  '<p class="article-speaker-speech">Éphésiens 2 est fort pour ça.</p>',
  '<p class="article-speaker-speech">Éphésiens 1, Éphésiens 2, oui.</p>',
  '<p>« Ce même jour... » – Luc 24.13-16</p>',
  '<p>Lisez Luc 24.13-35 . C\'était un dimanche...</p>'
];

tests.forEach((t, i) => {
  console.log(`\n--- Test ${i+1} ---`);
  console.log(TheologyView.highlightScriptureReferences(t));
});
