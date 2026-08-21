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

const BookPicker = {
  booksData: [],
  selectedBook: null,
  selectedChapter: 1,
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

    // Événements
    this.backdropEl?.addEventListener('click', () => this.close());
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

    // Capture: [livre / abréviation] [chapitre optionnel] [séparateur :., ou espace + verset optionnel]
    const m = q.match(/^([1-3]?\s*[a-zA-ZÀ-ÿ]+)(?:\s*([0-9]{1,3}))?(?:[:.,\s]+([0-9]{1,3}))?$/);
    if (!m) return null;

    const bookPart = m[1].replace(/\s+/g, ' ').trim();
    const rawBookNorm = bookPart.replace(/\s+/g, '');
    const chapter = m[2] ? parseInt(m[2], 10) : null;
    const verse = m[3] ? parseInt(m[3], 10) : null;

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

  open(currentBookCode, currentChapter, customCallback = null) {
    this.activeCallback = customCallback;
    this.selectedBook = this.booksData.find(b => b.code.toLowerCase() === (currentBookCode || '').toLowerCase()) || this.booksData[0];
    this.selectedChapter = currentChapter || 1;
    this.pendingTargetChapter = null;
    this.pendingTargetVerse = null;

    if (this.searchInput) this.searchInput.value = '';
    this.renderBooks();
    this.renderChapters();

    this.popoverEl?.classList.remove('hidden');
    this.backdropEl?.classList.remove('hidden');
    this.searchInput?.focus();
  },

  close() {
    this.popoverEl?.classList.add('hidden');
    this.backdropEl?.classList.add('hidden');
    this.activeCallback = null;
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
    this.renderBooks(this.searchInput ? this.searchInput.value : '');
    this.renderChapters();
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
        const v = (this.selectedChapter === i) ? this.pendingTargetVerse : null;
        this.confirmSelection(this.selectedBook.code, i, v);
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
