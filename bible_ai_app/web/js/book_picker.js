/**
 * Book & Chapter Picker Popover (Style Logos)
 * Gère la sélection visuelle des 66 livres bibliques, de leurs chapitres,
 * ainsi que le filtrage instantané par nom, abréviation (ex: RM, GN, LC, 1CO)
 * et la navigation rapide directe au verset (ex: RM 3.10, Rom 8:28, Gn 1:1 + Entrée).
 */

const BOOK_ALIASES = {
  Gen: ['genese', 'genèse', 'gen', 'gn', 'ge'],
  Exo: ['exode', 'exo', 'ex'],
  Lev: ['levitique', 'lévitique', 'lev', 'lév', 'lv'],
  Num: ['nombres', 'nombre', 'nom', 'nomb', 'num', 'nb'],
  Deu: ['deuteronome', 'deutéronome', 'deut', 'deu', 'dtn', 'dt'],
  Jos: ['josue', 'josué', 'jos'],
  Jdg: ['juges', 'juge', 'jug', 'jg', 'jdg'],
  Rut: ['ruth', 'rut', 'rt'],
  '1Sa': ['1 samuel', '1samuel', '1 sam', '1sam', '1 sa', '1sa', '1s', '1 s'],
  '2Sa': ['2 samuel', '2samuel', '2 sam', '2sam', '2 sa', '2sa', '2s', '2 s'],
  '1Ki': ['1 rois', '1rois', '1 roi', '1roi', '1 r', '1r', '1ki', '1 ki'],
  '2Ki': ['2 rois', '2rois', '2 roi', '2roi', '2 r', '2r', '2ki', '2 ki'],
  '1Ch': ['1 chroniques', '1chroniques', '1 chr', '1chr', '1 ch', '1ch'],
  '2Ch': ['2 chroniques', '2chroniques', '2 chr', '2chr', '2 ch', '2ch'],
  Ezr: ['esdras', 'esd', 'ezr'],
  Neh: ['nehemie', 'néhémie', 'neh', 'néh', 'ne'],
  Est: ['esther', 'esth', 'est'],
  Job: ['job', 'jb'],
  Psa: ['psaumes', 'psaume', 'psa', 'psm', 'ps'],
  Pro: ['proverbes', 'proverbe', 'prov', 'pro', 'pr'],
  Ecc: ['ecclesiaste', 'ecclésiaste', 'eccl', 'ecc', 'ec', 'qoh'],
  Sol: ['cantique des cantiques', 'cantique', 'cant', 'ct', 'sol', 'cdc'],
  Isa: ['esaie', 'ésaïe', 'esa', 'ésa', 'isa', 'es', 'és', 'is'],
  Jer: ['jeremie', 'jérémie', 'jer', 'jér', 'jr'],
  Lam: ['lamentations', 'lamentation', 'lam', 'lm', 'la'],
  Eze: ['ezechiel', 'ézéchiel', 'eze', 'ézé', 'ez', 'éz'],
  Dan: ['daniel', 'dan', 'da'],
  Hos: ['osee', 'osée', 'ose', 'osé', 'os', 'hos'],
  Joe: ['joel', 'joël', 'joe', 'joë', 'jl'],
  Amo: ['amos', 'amo', 'am'],
  Oba: ['abdias', 'abd', 'ab', 'oba'],
  Jon: ['jonas', 'jon'],
  Mic: ['michee', 'michée', 'mic', 'mi'],
  Nah: ['nahum', 'nah', 'na'],
  Hab: ['habacuc', 'hab', 'ha'],
  Zep: ['sophonie', 'soph', 'so', 'zep'],
  Hag: ['aggee', 'aggée', 'agg', 'ag', 'hag'],
  Zec: ['zacharie', 'zach', 'zac', 'za', 'zec'],
  Mal: ['malachie', 'mal', 'ml'],
  Mat: ['matthieu', 'mat', 'mt'],
  Mar: ['marc', 'mar', 'mc', 'mr'],
  Luk: ['luc', 'luk', 'lc'],
  Joh: ['jean', 'joh', 'jn'],
  Act: ['actes', 'act', 'ac'],
  Rom: ['romains', 'romain', 'rom', 'rm', 'ro'],
  '1Co': ['1 corinthiens', '1corinthiens', '1 cor', '1cor', '1 co', '1co'],
  '2Co': ['2 corinthiens', '2corinthiens', '2 cor', '2cor', '2 co', '2co'],
  Gal: ['galates', 'gal', 'ga'],
  Eph: ['ephesiens', 'éphésiens', 'eph', 'éph', 'ep', 'ép'],
  Phi: ['philippiens', 'phil', 'phi', 'php', 'ph'],
  Col: ['colossiens', 'col', 'cl'],
  '1Th': ['1 thessaloniciens', '1thessaloniciens', '1 thess', '1thess', '1 th', '1th'],
  '2Th': ['2 thessaloniciens', '2thessaloniciens', '2 thess', '2thess', '2 th', '2th'],
  '1Ti': ['1 timothee', '1timothée', '1 tim', '1tim', '1 ti', '1ti', '1 tm', '1tm'],
  '2Ti': ['2 timothee', '2timothée', '2 tim', '2tim', '2 ti', '2ti', '2 tm', '2tm'],
  Tit: ['tite', 'tit', 'tt'],
  Phm: ['philemon', 'philémon', 'phm', 'phlm'],
  Heb: ['hebreux', 'hébreux', 'heb', 'héb', 'he'],
  Jam: ['jacques', 'jac', 'jc', 'jam'],
  '1Pe': ['1 pierre', '1pierre', '1 pier', '1pe', '1 pe', '1pi', '1 pi', '1p', '1 p'],
  '2Pe': ['2 pierre', '2pierre', '2 pier', '2pe', '2 pe', '2pi', '2 pi', '2p', '2 p'],
  '1Jo': ['1 jean', '1jean', '1 jn', '1jn', '1 jo', '1jo', '1j', '1 j'],
  '2Jo': ['2 jean', '2jean', '2 jn', '2jn', '2 jo', '2jo', '2j', '2 j'],
  '3Jo': ['3 jean', '3jean', '3 jn', '3jn', '3 jo', '3jo', '3j', '3 j'],
  Jud: ['jude', 'jud', 'jd'],
  Rev: ['apocalypse', 'apoc', 'apo', 'ap', 'rev']
};

const BIBLE_VERSE_COUNTS = {
  "Gen": [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 54, 33, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26],
  "Exo": [22, 25, 22, 31, 23, 30, 29, 28, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 37, 30, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38],
  "Lev": [17, 16, 17, 35, 26, 23, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34],
  "Num": [54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 35, 28, 32, 22, 29, 35, 41, 30, 25, 19, 65, 23, 31, 39, 17, 54, 42, 56, 29, 34, 13],
  "Deu": [46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 31, 19, 29, 23, 22, 20, 22, 21, 20, 23, 29, 26, 22, 19, 19, 26, 69, 28, 20, 30, 52, 29, 12],
  "Jos": [18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16, 33],
  "Jdg": [36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25],
  "Rut": [22, 23, 18, 22],
  "1Sa": [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 42, 16, 23, 28, 23, 44, 25, 12, 25, 11, 31, 13],
  "2Sa": [27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 32, 44, 26, 22, 51, 39, 25],
  "1Ki": [53, 46, 28, 20, 32, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 54],
  "2Ki": [18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 20, 22, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37, 20, 30],
  "1Ch": [54, 55, 24, 43, 41, 66, 40, 40, 44, 14, 47, 41, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30],
  "2Ch": [18, 17, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 23, 14, 19, 14, 19, 34, 11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23],
  "Ezr": [11, 70, 13, 24, 17, 22, 28, 36, 15, 44],
  "Neh": [11, 20, 38, 17, 19, 19, 72, 18, 37, 40, 36, 47, 31],
  "Est": [22, 23, 15, 17, 14, 14, 10, 17, 32, 3],
  "Job": [22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 32, 26, 17],
  "Psa": [6, 12, 9, 9, 13, 11, 18, 10, 21, 18, 7, 9, 6, 7, 5, 11, 15, 51, 15, 10, 14, 32, 6, 10, 22, 12, 14, 9, 11, 13, 25, 11, 22, 23, 28, 13, 40, 23, 14, 18, 14, 12, 5, 27, 18, 12, 10, 15, 21, 23, 21, 11, 7, 9, 24, 14, 12, 12, 18, 14, 9, 13, 12, 11, 14, 20, 8, 36, 37, 6, 24, 20, 28, 23, 11, 13, 21, 72, 13, 20, 17, 8, 19, 13, 14, 17, 7, 19, 53, 17, 16, 16, 5, 23, 11, 13, 12, 9, 9, 5, 8, 29, 22, 35, 45, 48, 43, 14, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 14, 10, 8, 12, 15, 21, 10, 20, 14, 9, 6],
  "Pro": [33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31],
  "Ecc": [18, 26, 22, 17, 19, 12, 29, 17, 18, 20, 10, 14],
  "Sol": [17, 17, 11, 16, 16, 12, 14, 14],
  "Isa": [31, 22, 26, 6, 30, 13, 25, 23, 20, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 11, 25, 24],
  "Jer": [19, 37, 25, 31, 31, 30, 34, 23, 25, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34],
  "Lam": [22, 22, 66, 22, 22],
  "Eze": [28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 44, 37, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35],
  "Dan": [21, 49, 33, 34, 30, 29, 28, 27, 27, 21, 45, 13],
  "Hos": [9, 25, 5, 19, 15, 11, 16, 14, 17, 15, 11, 15, 15, 10],
  "Joe": [20, 27, 5],
  "Amo": [15, 16, 15, 13, 27, 14, 17, 14, 15],
  "Oba": [21],
  "Jon": [16, 11, 10, 11],
  "Mic": [16, 13, 12, 14, 14, 16, 20],
  "Nah": [14, 14, 19],
  "Hab": [17, 20, 19],
  "Zep": [18, 15, 20],
  "Hag": [15, 23],
  "Zec": [17, 17, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21],
  "Mal": [14, 17, 24, 6],
  "Mat": [25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 46, 39, 51, 46, 75, 66, 20],
  "Mar": [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20],
  "Luk": [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53],
  "Joh": [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25],
  "Act": [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35, 27, 27, 32, 44, 31],
  "Rom": [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27],
  "1Co": [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  "2Co": [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 13],
  "Gal": [24, 21, 29, 31, 26, 18],
  "Eph": [23, 22, 21, 32, 33, 24],
  "Phi": [30, 30, 21, 23],
  "Col": [29, 23, 25, 18],
  "1Th": [10, 20, 13, 18, 28],
  "2Th": [12, 17, 18],
  "1Ti": [20, 15, 16, 16, 25, 21],
  "2Ti": [18, 26, 17, 22],
  "Tit": [16, 15, 15],
  "Phm": [25],
  "Heb": [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25],
  "Jam": [27, 26, 18, 17, 20],
  "1Pe": [25, 25, 22, 19, 14],
  "2Pe": [21, 22, 18],
  "1Jo": [10, 29, 24, 21, 21],
  "2Jo": [13],
  "3Jo": [15],
  "Jud": [25],
  "Rev": [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 18, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21]
};

const BookPicker = {
  booksData: [],
  selectedBook: null,
  selectedChapter: 1,
  selectedVerse: null,
  viewMode: 'chapters', // 'chapters' | 'verses'
  pendingTargetChapter: null,
  pendingTargetVerse: null,
  onSelectCallback: null,

  // DOM Elements
  popoverEl: null,
  backdropEl: null,
  searchInput: null,
  otGridEl: null,
  ntGridEl: null,
  chaptersGridEl: null,
  bookTitleEl: null,
  totalChEl: null,
  pickerChaptersHeader: null,
  pickerVersesHeader: null,
  pickerVerseBookTitle: null,
  selectedChTotalVerses: null,
  pickerVersesContainer: null,
  versesGridEl: null,
  btnSelectWholeChapter: null,
  btnSelectWholeChapterText: null,
  btnPickerBack: null,

  async init(onSelect) {
    this.onSelectCallback = onSelect;
    
    this.popoverEl = document.getElementById('book-picker-popover');
    this.backdropEl = document.getElementById('popover-backdrop');
    this.searchInput = document.getElementById('picker-search-input');
    this.otGridEl = document.getElementById('grid-ot-books');
    this.ntGridEl = document.getElementById('grid-nt-books');
    this.chaptersGridEl = document.getElementById('grid-chapters');
    this.bookTitleEl = document.getElementById('selected-book-name-title');
    this.totalChEl = document.getElementById('selected-book-total-ch');

    this.pickerChaptersHeader = document.getElementById('picker-chapters-header');
    this.pickerVersesHeader = document.getElementById('picker-verses-header');
    this.pickerVerseBookTitle = document.getElementById('picker-verse-book-title');
    this.selectedChTotalVerses = document.getElementById('selected-ch-total-verses');
    this.pickerVersesContainer = document.getElementById('picker-verses-container');
    this.versesGridEl = document.getElementById('grid-verses');
    this.btnSelectWholeChapter = document.getElementById('btn-select-whole-chapter');
    this.btnSelectWholeChapterText = document.getElementById('btn-select-whole-chapter-text');
    this.btnPickerBack = document.getElementById('btn-picker-back');

    // Événements
    this.backdropEl?.addEventListener('click', () => this.close());
    document.getElementById('btn-close-book-picker')?.addEventListener('click', () => this.close());
    document.getElementById('btn-clear-picker-ref')?.addEventListener('click', () => {
      this.confirmSelection(null, null, null);
    });
    this.btnPickerBack?.addEventListener('click', () => this.showChaptersView());
    this.btnSelectWholeChapter?.addEventListener('click', () => {
      this.confirmSelection(this.selectedBook?.code, this.selectedChapter, null);
    });
    this.searchInput?.addEventListener('input', (e) => this.filterBooks(e.target.value));
    
    this.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.selectedBook) {
          const ch = this.pendingTargetChapter || this.selectedChapter || 1;
          const v = this.pendingTargetVerse || null;
          this.confirmSelection(this.selectedBook.code, ch, v);
        }
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    // Charger la liste des livres depuis l'API
    API.onReady(async () => {
      try {
        this.booksData = await API.getBooksList();
        this.renderBooks();
      } catch (e) {
        console.error('Erreur chargement livres:', e);
      }
    });
  },

  parseQuickPassage(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return null;

    // Capture: [livre / abréviation] [chapitre optionnel] [séparateur :., ou espace + verset optionnel (ex: 16, 16-18, 16a)]
    const m = q.match(/^([1-3]?\s*[a-zA-ZÀ-ÿ]+)(?:\s*([0-9]{1,3}))?(?:[:.,\s]+([0-9]{1,3}(?:[-–][0-9]{1,3})?[a-z]?))?$/);
    if (!m) return null;

    const bookPart = m[1].replace(/\s+/g, ' ').trim();
    const rawBookNorm = bookPart.replace(/\s+/g, '');
    const chapter = m[2] ? parseInt(m[2], 10) : null;
    const verse = m[3] ? m[3].trim() : null;

    let matchedCode = null;

    for (const [code, aliases] of Object.entries(BOOK_ALIASES)) {
      if (code.toLowerCase() === rawBookNorm) {
        matchedCode = code;
        break;
      }
      if (aliases.includes(bookPart) || aliases.includes(rawBookNorm)) {
        matchedCode = code;
        break;
      }
    }

    if (!matchedCode && !chapter) {
      for (const [code, aliases] of Object.entries(BOOK_ALIASES)) {
        if (aliases.some(a => a.startsWith(bookPart))) {
          matchedCode = code;
          break;
        }
      }
    }

    if (matchedCode) {
      return { bookCode: matchedCode, chapter, verse };
    }
    return null;
  },

  activeCallback: null,
  currentOptions: null,

  open(currentBookCode, currentChapter, customCallback = null, options = {}) {
    this.activeCallback = customCallback;
    this.currentOptions = options || {};

    let targetBook = this.booksData.find(b => b.code.toLowerCase() === (currentBookCode || '').toLowerCase());
    if (!targetBook) {
      const activeBible = (typeof BibleReader !== 'undefined' && BibleReader.currentBible1) ? BibleReader.currentBible1 : null;
      const firstB = (activeBible && typeof BibleReader !== 'undefined' && typeof BibleReader.getFirstBookForBible === 'function') 
        ? BibleReader.getFirstBookForBible(activeBible) 
        : 'Gen';
      targetBook = this.booksData.find(b => b.code.toLowerCase() === (firstB || '').toLowerCase()) || this.booksData[0];
    }
    this.selectedBook = targetBook;
    this.selectedChapter = currentChapter || 1;
    this.pendingTargetChapter = null;
    this.pendingTargetVerse = null;

    // Centrage plein écran pour modal MindMap
    if (this.currentOptions.center && this.popoverEl) {
      this.popoverEl.classList.add('centered');
      this.popoverEl.style.position = 'fixed';
      this.popoverEl.style.top = '50%';
      this.popoverEl.style.left = '50%';
      this.popoverEl.style.transform = 'translate(-50%, -50%)';
      this.popoverEl.style.margin = '0';
      this.popoverEl.style.zIndex = '1001';
      if (this.backdropEl) this.backdropEl.style.zIndex = '1000';
    }

    // Gestion du bouton de suppression de référence
    const clearBtn = document.getElementById('btn-clear-picker-ref');
    if (clearBtn) {
      if (this.currentOptions.allowClear) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    // Gestion de l'indicateur de cible (nom de la branche MindMap)
    const targetInfo = document.getElementById('picker-target-info');
    if (targetInfo) {
      if (this.currentOptions.targetLabel) {
        targetInfo.innerHTML = `<span>Branche cible :</span> <strong style="color: var(--accent-orange, #f59e0b);">${this.currentOptions.targetLabel}</strong>`;
        targetInfo.classList.remove('hidden');
      } else {
        targetInfo.classList.add('hidden');
      }
    }

    const query = this.currentOptions.initialQuery || '';
    if (this.searchInput) this.searchInput.value = query;
    this.showChaptersView();
    this.renderBooks(query);
    this.renderChapters();

    this.popoverEl?.classList.remove('hidden');
    this.backdropEl?.classList.remove('hidden');
    this.searchInput?.focus();
    if (query) this.searchInput?.select();
  },

  close() {
    this.popoverEl?.classList.add('hidden');
    this.backdropEl?.classList.add('hidden');
    this.showChaptersView();
    if (this.popoverEl) {
      this.popoverEl.classList.remove('centered');
      this.popoverEl.style.position = '';
      this.popoverEl.style.top = '';
      this.popoverEl.style.left = '';
      this.popoverEl.style.transform = '';
      this.popoverEl.style.margin = '';
      this.popoverEl.style.zIndex = '';
    }
    if (this.backdropEl) {
      this.backdropEl.style.zIndex = '';
    }
    document.getElementById('btn-clear-picker-ref')?.classList.add('hidden');
    document.getElementById('picker-target-info')?.classList.add('hidden');
    this.activeCallback = null;
    this.currentOptions = null;
  },

  toggle(currentBookCode, currentChapter, customCallback = null) {
    if (!this.popoverEl || this.popoverEl.classList.contains('hidden')) {
      this.open(currentBookCode, currentChapter, customCallback);
    } else {
      this.close();
    }
  },

  renderBooks(filterQuery = '') {
    const q = filterQuery.toLowerCase().trim();
    const parsed = this.parseQuickPassage(q);

    if (parsed) {
      const found = this.booksData.find(b => b.code.toLowerCase() === parsed.bookCode.toLowerCase());
      if (found && found.code !== this.selectedBook?.code) {
        this.selectedBook = found;
      }
      if (parsed.chapter) {
        this.selectedChapter = parsed.chapter;
        this.pendingTargetChapter = parsed.chapter;
      } else {
        this.pendingTargetChapter = null;
      }
      this.pendingTargetVerse = parsed.verse || null;
    } else {
      this.pendingTargetChapter = null;
      this.pendingTargetVerse = null;
    }

    if (this.otGridEl) this.otGridEl.innerHTML = '';
    if (this.ntGridEl) this.ntGridEl.innerHTML = '';

    this.booksData.forEach(book => {
      const bCode = book.code.toLowerCase();
      const bName = book.name.toLowerCase();
      const aliases = BOOK_ALIASES[book.code] || [];

      const isDirectMatch = !q || bName.includes(q) || bCode.includes(q) || aliases.some(a => a.startsWith(q) || a === q);
      const isParsedMatch = parsed && (bCode === parsed.bookCode.toLowerCase());

      if (!isDirectMatch && !isParsedMatch) {
        return;
      }

      const btn = document.createElement('button');
      btn.className = `book-row-btn ${this.selectedBook?.code === book.code ? 'active' : ''}`;
      btn.innerHTML = `
        <span>${book.name}</span>
        <span class="code">${book.code}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectBook(book);
      });

      if (book.testament === 'OT') {
        this.otGridEl?.appendChild(btn);
      } else {
        this.ntGridEl?.appendChild(btn);
      }
    });

    this.renderChapters();
  },

  selectBook(book) {
    this.selectedBook = book;
    this.showChaptersView();
    this.renderBooks(this.searchInput ? this.searchInput.value : '');
    this.renderChapters();
  },

  getChapterVerseCount(bookCode, chNum) {
    const chIdx = parseInt(chNum, 10) - 1;
    if (BIBLE_VERSE_COUNTS[bookCode] && BIBLE_VERSE_COUNTS[bookCode][chIdx] > 0) {
      return BIBLE_VERSE_COUNTS[bookCode][chIdx];
    }
    return 30;
  },

  showChaptersView() {
    this.viewMode = 'chapters';
    this.pickerChaptersHeader?.classList.remove('hidden');
    this.chaptersGridEl?.classList.remove('hidden');
    this.pickerVersesHeader?.classList.add('hidden');
    this.pickerVersesContainer?.classList.add('hidden');
  },

  showVersesView(chNum) {
    if (!this.selectedBook) return;
    const ch = parseInt(chNum, 10);
    this.selectedChapter = ch;
    this.viewMode = 'verses';

    this.pickerChaptersHeader?.classList.add('hidden');
    this.chaptersGridEl?.classList.add('hidden');
    this.pickerVersesHeader?.classList.remove('hidden');
    this.pickerVersesContainer?.classList.remove('hidden');

    if (this.pickerVerseBookTitle) {
      this.pickerVerseBookTitle.textContent = `${this.selectedBook.name} ${ch}`;
    }
    if (this.btnSelectWholeChapterText) {
      this.btnSelectWholeChapterText.textContent = `Tout le chapitre ${ch}`;
    }

    const totalVerses = this.getChapterVerseCount(this.selectedBook.code, ch);
    if (this.selectedChTotalVerses) {
      this.selectedChTotalVerses.textContent = `${totalVerses} versets`;
    }

    if (this.versesGridEl) {
      this.versesGridEl.innerHTML = '';
      const targetV = this.pendingTargetVerse ? parseInt(this.pendingTargetVerse, 10) : null;

      for (let v = 1; v <= totalVerses; v++) {
        const vBtn = document.createElement('button');
        vBtn.className = `ch-btn ${targetV === v ? 'active' : ''}`;
        vBtn.textContent = v;
        vBtn.addEventListener('click', () => {
          this.confirmSelection(this.selectedBook.code, ch, v);
        });
        this.versesGridEl.appendChild(vBtn);
      }
    }
  },

  selectChapter(chNum) {
    this.selectedChapter = chNum;
    this.showVersesView(chNum);
  },

  renderChapters() {
    if (!this.selectedBook || !this.chaptersGridEl) return;

    if (this.bookTitleEl) this.bookTitleEl.textContent = this.selectedBook.name;
    if (this.totalChEl) {
      if (this.pendingTargetVerse) {
        this.totalChEl.textContent = `Ch. ${this.selectedChapter || 1}:${this.pendingTargetVerse} (Entrée ↵)`;
      } else {
        this.totalChEl.textContent = `${this.selectedBook.chapters} chapitres`;
      }
    }

    this.chaptersGridEl.innerHTML = '';

    for (let i = 1; i <= this.selectedBook.chapters; i++) {
      const chBtn = document.createElement('button');
      chBtn.className = `ch-btn ${this.selectedChapter === i ? 'active' : ''}`;
      chBtn.textContent = i;
      chBtn.addEventListener('click', () => {
        if (this.currentOptions?.chapterOnly) {
          const v = (this.selectedChapter === i) ? this.pendingTargetVerse : null;
          this.confirmSelection(this.selectedBook.code, i, v);
        } else {
          this.selectChapter(i);
        }
      });
      this.chaptersGridEl.appendChild(chBtn);
    }
  },

  filterBooks(query) {
    this.renderBooks(query);
  },

  confirmSelection(bookCode, chapterNum, verseNum = null) {
    const cb = this.activeCallback || this.onSelectCallback;
    this.close();
    if (cb) {
      cb(bookCode, chapterNum, verseNum);
    }
  }
};

window.BookPicker = BookPicker;
