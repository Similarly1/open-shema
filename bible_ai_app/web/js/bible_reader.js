/**
 * Bible Reader Engine & Logos Experience
 * Gère le défilement continu pour toute la Bible, les options d'affichage,
 * les onglets multi-documents, le lexique Strong au clic et le menu contextuel (clic droit / double-clic).
 */

// 1. LISTE CANONIQUE DES LIVRES & CALCULS DE NAVIGATION
const CANONICAL_BOOKS = [
  // Ancien Testament
  { name: "Genèse", code: "Gen", abbr: "Gn", chapters: 50 },
  { name: "Exode", code: "Exo", abbr: "Ex", chapters: 40 },
  { name: "Lévitique", code: "Lev", abbr: "Lv", chapters: 27 },
  { name: "Nombres", code: "Num", abbr: "Nb", chapters: 36 },
  { name: "Deutéronome", code: "Deu", abbr: "Dt", chapters: 34 },
  { name: "Josué", code: "Jos", abbr: "Jos", chapters: 24 },
  { name: "Juges", code: "Jdg", abbr: "Jg", chapters: 21 },
  { name: "Ruth", code: "Rut", abbr: "Rt", chapters: 4 },
  { name: "1 Samuel", code: "1Sa", abbr: "1S", chapters: 31 },
  { name: "2 Samuel", code: "2Sa", abbr: "2S", chapters: 24 },
  { name: "1 Rois", code: "1Ki", abbr: "1R", chapters: 22 },
  { name: "2 Rois", code: "2Ki", abbr: "2R", chapters: 25 },
  { name: "1 Chroniques", code: "1Ch", abbr: "1Ch", chapters: 29 },
  { name: "2 Chroniques", code: "2Ch", abbr: "2Ch", chapters: 36 },
  { name: "Esdras", code: "Ezr", abbr: "Esd", chapters: 10 },
  { name: "Néhémie", code: "Neh", abbr: "Néh", chapters: 13 },
  { name: "Esther", code: "Est", abbr: "Est", chapters: 10 },
  { name: "Job", code: "Job", abbr: "Jb", chapters: 42 },
  { name: "Psaumes", code: "Psa", abbr: "Ps", chapters: 150 },
  { name: "Proverbes", code: "Pro", abbr: "Pr", chapters: 31 },
  { name: "Ecclésiaste", code: "Ecc", abbr: "Ec", chapters: 12 },
  { name: "Cantique", code: "Sol", abbr: "Ct", chapters: 8 },
  { name: "Ésaïe", code: "Isa", abbr: "És", chapters: 66 },
  { name: "Jérémie", code: "Jer", abbr: "Jr", chapters: 52 },
  { name: "Lamentations", code: "Lam", abbr: "La", chapters: 5 },
  { name: "Ézéchiel", code: "Eze", abbr: "Éz", chapters: 48 },
  { name: "Daniel", code: "Dan", abbr: "Da", chapters: 12 },
  { name: "Osée", code: "Hos", abbr: "Os", chapters: 14 },
  { name: "Joël", code: "Joe", abbr: "Jl", chapters: 3 },
  { name: "Amos", code: "Amo", abbr: "Am", chapters: 9 },
  { name: "Abdias", code: "Oba", abbr: "Ab", chapters: 1 },
  { name: "Jonas", code: "Jon", abbr: "Jon", chapters: 4 },
  { name: "Michée", code: "Mic", abbr: "Mi", chapters: 7 },
  { name: "Nahum", code: "Nah", abbr: "Na", chapters: 3 },
  { name: "Habacuc", code: "Hab", abbr: "Ha", chapters: 3 },
  { name: "Sophonie", code: "Zep", abbr: "So", chapters: 3 },
  { name: "Aggée", code: "Hag", abbr: "Ag", chapters: 2 },
  { name: "Zacharie", code: "Zec", abbr: "Za", chapters: 14 },
  { name: "Malachie", code: "Mal", abbr: "Mal", chapters: 4 },
  // Nouveau Testament
  { name: "Matthieu", code: "Mat", abbr: "Mt", chapters: 28 },
  { name: "Marc", code: "Mar", abbr: "Mc", chapters: 16 },
  { name: "Luc", code: "Luk", abbr: "Lc", chapters: 24 },
  { name: "Jean", code: "Joh", abbr: "Jn", chapters: 21 },
  { name: "Actes", code: "Act", abbr: "Ac", chapters: 28 },
  { name: "Romains", code: "Rom", abbr: "Rm", chapters: 16 },
  { name: "1 Corinthiens", code: "1Co", abbr: "1Co", chapters: 16 },
  { name: "2 Corinthiens", code: "2Co", abbr: "2Co", chapters: 13 },
  { name: "Galates", code: "Gal", abbr: "Ga", chapters: 6 },
  { name: "Éphésiens", code: "Eph", abbr: "Ép", chapters: 6 },
  { name: "Philippiens", code: "Phi", abbr: "Ph", chapters: 4 },
  { name: "Colossiens", code: "Col", abbr: "Col", chapters: 4 },
  { name: "1 Thessaloniciens", code: "1Th", abbr: "1Th", chapters: 5 },
  { name: "2 Thessaloniciens", code: "2Th", abbr: "2Th", chapters: 3 },
  { name: "1 Timothée", code: "1Ti", abbr: "1Tm", chapters: 6 },
  { name: "2 Timothée", code: "2Ti", abbr: "2Tm", chapters: 4 },
  { name: "Tite", code: "Tit", abbr: "Tt", chapters: 3 },
  { name: "Philémon", code: "Phm", abbr: "Phm", chapters: 1 },
  { name: "Hébreux", code: "Heb", abbr: "Héb", chapters: 13 },
  { name: "Jacques", code: "Jam", abbr: "Jc", chapters: 5 },
  { name: "1 Pierre", code: "1Pe", abbr: "1P", chapters: 5 },
  { name: "2 Pierre", code: "2Pe", abbr: "2P", chapters: 3 },
  { name: "1 Jean", code: "1Jo", abbr: "1Jn", chapters: 5 },
  { name: "2 Jean", code: "2Jo", abbr: "2Jn", chapters: 1 },
  { name: "3 Jean", code: "3Jo", abbr: "3Jn", chapters: 1 },
  { name: "Jude", code: "Jud", abbr: "Jd", chapters: 1 },
  { name: "Apocalypse", code: "Rev", abbr: "Ap", chapters: 22 }
];

function getBookInfo(bookCode) {
  const b = CANONICAL_BOOKS.find(item => item.code.toLowerCase() === (bookCode || '').toLowerCase());
  return b || { name: bookCode, code: bookCode, abbr: bookCode, chapters: 50 };
}

function formatPassagePill(bookCode, chapterNum, verseNum = null) {
  const info = getBookInfo(bookCode);
  const vPart = verseNum ? `:${verseNum}` : '';
  const fullName = `${info.name} ${chapterNum}${vPart}`;
  const shortName = `${info.abbr || info.code || info.name} ${chapterNum}${vPart}`;

  const pillRef = document.getElementById('pill-reference-text');
  if (!pillRef) return;

  const drawer = document.getElementById('right-drawer');
  const isDrawerOpen = drawer && !drawer.classList.contains('collapsed');

  // Si le volet droit est ouvert ou si la largeur disponible est réduite, utiliser l'abréviation pour garantir 1 seule ligne
  if (isDrawerOpen || window.innerWidth < 1150) {
    pillRef.textContent = shortName;
  } else {
    pillRef.textContent = fullName;
  }
}

function getNextChapterCoord(bookCode, chNum, bibleName = null) {
  const info = getBookInfo(bookCode);
  if (chNum < info.chapters) {
    return { book: info.code, chapter: chNum + 1 };
  }
  const targetBible = bibleName || (typeof BibleReader !== 'undefined' ? BibleReader.currentBible1 : null);
  const availBooks = (targetBible && typeof BibleReader !== 'undefined' && typeof BibleReader.getAvailableBooksForBible === 'function')
    ? BibleReader.getAvailableBooksForBible(targetBible)
    : null;

  if (availBooks && availBooks.length > 0) {
    const curIdx = availBooks.findIndex(code => code.toLowerCase() === bookCode.toLowerCase());
    if (curIdx !== -1 && curIdx < availBooks.length - 1) {
      return { book: availBooks[curIdx + 1], chapter: 1 };
    }
    return null;
  }

  const idx = CANONICAL_BOOKS.findIndex(item => item.code.toLowerCase() === bookCode.toLowerCase());
  if (idx !== -1 && idx < CANONICAL_BOOKS.length - 1) {
    return { book: CANONICAL_BOOKS[idx + 1].code, chapter: 1 };
  }
  return null;
}

function getPrevChapterCoord(bookCode, chNum, bibleName = null) {
  if (chNum > 1) {
    return { book: bookCode, chapter: chNum - 1 };
  }
  const targetBible = bibleName || (typeof BibleReader !== 'undefined' ? BibleReader.currentBible1 : null);
  const availBooks = (targetBible && typeof BibleReader !== 'undefined' && typeof BibleReader.getAvailableBooksForBible === 'function')
    ? BibleReader.getAvailableBooksForBible(targetBible)
    : null;

  if (availBooks && availBooks.length > 0) {
    const curIdx = availBooks.findIndex(code => code.toLowerCase() === bookCode.toLowerCase());
    if (curIdx > 0) {
      const prevBookCode = availBooks[curIdx - 1];
      const prevInfo = getBookInfo(prevBookCode);
      return { book: prevBookCode, chapter: prevInfo.chapters };
    }
    return null;
  }

  const idx = CANONICAL_BOOKS.findIndex(item => item.code.toLowerCase() === bookCode.toLowerCase());
  if (idx > 0) {
    const prevBook = CANONICAL_BOOKS[idx - 1];
    return { book: prevBook.code, chapter: prevBook.chapters };
  }
  return null;
}

// =============================================================================
// 2. GESTIONNAIRE D'ONGLETS MULTI-DOCUMENTS (Style Logos)
// =============================================================================

const TabsManager = {
  tabs: [],
  activeTabId: null,

  init() {
    document.getElementById('btn-add-tab')?.addEventListener('click', () => {
      this.createNewTab();
    });
  },

  async setupInitialTabs(bibles) {
    if (!bibles || bibles.length === 0) return;
    if (this.tabs && this.tabs.length > 0) {
      return await this.activateTab(this.tabs[0].id);
    }
    this.tabs = [];

    const b1 = bibles[0].name;
    const b2 = bibles.length > 1 ? bibles[1].name : b1;

    const firstBook1 = (typeof BibleReader !== 'undefined' && typeof BibleReader.getFirstBookForBible === 'function') 
      ? BibleReader.getFirstBookForBible(b1) 
      : 'Gen';
    const firstBook2 = (typeof BibleReader !== 'undefined' && typeof BibleReader.getFirstBookForBible === 'function') 
      ? BibleReader.getFirstBookForBible(b2) 
      : 'Gen';

    this.createTab(b1, firstBook1, 1, '#EA580C', false, false, 'LSG');
    if (bibles.length > 1) {
      this.createTab(b2, firstBook2, 1, '#2563EB', false, false, 'LSG');
    }
    if (this.tabs.length > 0) {
      return await this.activateTab(this.tabs[0].id);
    }
  },

  createTab(bibleName, book = 'Gen', chapter = 1, forceColor = null, activateNow = true, isInterlinear = false, interlinearVersion = 'LSG') {
    const id = 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const colorPalette = ['#EA580C', '#2563EB', '#059669', '#7C3AED', '#DB2777', '#D97706', '#0891B2'];
    const badgeColor = forceColor || colorPalette[this.tabs.length % colorPalette.length];

    let targetBook = book;
    let targetChapter = chapter;
    if (typeof BibleReader !== 'undefined' && typeof BibleReader.isBookAvailableInBible === 'function') {
      if (!BibleReader.isBookAvailableInBible(bibleName, targetBook)) {
        targetBook = BibleReader.getFirstBookForBible(bibleName);
        targetChapter = 1;
      }
    }

    const tab = {
      id: id,
      bibleName: bibleName,
      book: targetBook,
      chapter: targetChapter,
      badgeColor: badgeColor,
      isInterlinear: isInterlinear,
      interlinearVersion: interlinearVersion
    };

    this.tabs.push(tab);
    this.renderTabs();

    if (activateNow) {
      this.activateTab(id);
    }
    return tab;
  },

  createNewTab() {
    const openNames = this.tabs.map(t => t.bibleName);
    let chosenBible = BibleReader.installedBibles.find(b => !openNames.includes(b.name))?.name;
    if (!chosenBible) {
      chosenBible = BibleReader.installedBibles[0]?.name || 'Segond 21';
    }

    let b = BibleReader.currentBook || 'Gen';
    let ch = BibleReader.currentChapter || 1;
    if (typeof BibleReader !== 'undefined' && typeof BibleReader.isBookAvailableInBible === 'function') {
      if (!BibleReader.isBookAvailableInBible(chosenBible, b)) {
        b = BibleReader.getFirstBookForBible(chosenBible);
        ch = 1;
      }
    }

    const newTab = this.createTab(chosenBible, b, ch, null, true, false, 'LSG');
    App.showToast(`Nouvel onglet ouvert : ${chosenBible}`);
  },

  async activateTab(tabId) {
    const target = this.tabs.find(t => t.id === tabId);
    if (!target) return;

    let targetBook = target.book || BibleReader.currentBook || 'Gen';
    let targetChapter = target.chapter || BibleReader.currentChapter || 1;
    let targetVerse = BibleReader.selectedVerse || 1;

    const currentBook = BibleReader.currentBook || targetBook;
    const currentChapter = BibleReader.currentChapter || targetChapter;

    // Si le livre actuellement affiché est supporté par la Bible de ce nouvel onglet, on maintient la navigation active
    if (typeof BibleReader !== 'undefined' && typeof BibleReader.isBookAvailableInBible === 'function') {
      if (BibleReader.isBookAvailableInBible(target.bibleName, currentBook)) {
        targetBook = currentBook;
        targetChapter = currentChapter;
      } else if (!BibleReader.isBookAvailableInBible(target.bibleName, targetBook)) {
        // Si le livre en mémoire de l'onglet n'est pas non plus compatible, aller au premier livre disponible
        targetBook = BibleReader.getFirstBookForBible(target.bibleName);
        targetChapter = 1;
        targetVerse = 1;
      }
    }

    target.book = targetBook;
    target.chapter = targetChapter;

    this.activeTabId = tabId;
    BibleReader.currentBible1 = target.bibleName;
    BibleReader.currentBook = targetBook;
    BibleReader.currentChapter = targetChapter;
    BibleReader.pane1IsInterlinear = !!target.isInterlinear;
    BibleReader.pane1InterlinearVersion = target.interlinearVersion || 'LSG';

    // Mettre à jour l'état visuel du bouton et du menu Interlinéaire
    const interBtn = document.getElementById('btn-toggle-interlinear');
    if (interBtn) interBtn.classList.toggle('active', BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear);

    if (typeof InterlinearMenu !== 'undefined') {
      InterlinearMenu.syncPopoverUI();
    }

    BibleReader.updatePaneHeader(1);
    if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);

    this.renderTabs();
    return await BibleReader.navigateTo(targetBook, targetChapter, targetVerse);
  },

  closeTab(tabId, e) {
    if (e) e.stopPropagation();
    if (this.tabs.length <= 1) {
      App.showToast('Impossible de fermer le dernier onglet');
      return;
    }

    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const wasActive = this.activeTabId === tabId;
    this.tabs.splice(idx, 1);

    if (wasActive) {
      const nextTab = this.tabs[Math.max(0, idx - 1)];
      this.activateTab(nextTab.id);
    } else {
      this.renderTabs();
    }
  },

  updateActiveTab(bibleName = null, book = null, chapter = null, isInterlinear = null, interlinearVersion = null) {
    const active = this.tabs.find(t => t.id === this.activeTabId);
    if (active) {
      if (bibleName !== null) active.bibleName = bibleName;
      if (book !== null) active.book = book;
      if (chapter !== null) active.chapter = chapter;
      if (isInterlinear !== null) active.isInterlinear = isInterlinear;
      if (interlinearVersion !== null) active.interlinearVersion = interlinearVersion;
      this.renderTabs();
    }
  },

  renderTabs() {
    const container = document.getElementById('tabs-list');
    if (!container) return;
    container.innerHTML = '';

    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.dataset.tabId = tab.id;

      const titleText = tab.isInterlinear 
        ? `${tab.bibleName} [${tab.interlinearVersion || 'Interl.'}]`
        : tab.bibleName;

      tabEl.innerHTML = `
        <span class="tab-badge-icon" style="background-color: ${tab.badgeColor}; display: inline-flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </span>
        <span class="tab-title">${titleText}</span>
        <button class="tab-close-btn" title="Fermer cet onglet">✕</button>
      `;

      tabEl.addEventListener('click', () => {
        this.activateTab(tab.id);
      });

      tabEl.querySelector('.tab-close-btn').addEventListener('click', (e) => {
        this.closeTab(tab.id, e);
      });

      container.appendChild(tabEl);
    });
  }
};


// 3. OPTIONS D'AFFICHAGE
const DisplayOptions = {
  currentBg: 'auto',

  async init() {
    const btn = document.getElementById('btn-display-options');
    const popover = document.getElementById('display-options-popover');
    const workspace = document.getElementById('reader-workspace');

    if (!btn || !popover) return;

    const updateActiveSwatch = (bgKey) => {
      this.currentBg = bgKey || 'auto';
      document.querySelectorAll('.reading-bg-quick-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.bg === this.currentBg);
      });
    };

    // Synchronisation de l'état actif et options au démarrage
    try {
      const cfg = await API.getSettings() || {};
      updateActiveSwatch(cfg.reading_bg || 'auto');
      
      const showDiv = cfg.show_chapter_dividers !== false;
      const chkDiv = document.getElementById('opt-show-chap-dividers');
      if (chkDiv) chkDiv.checked = showDiv;
      workspace?.classList.toggle('hide-chap-dividers', !showDiv);

      const isFullWidth = cfg.full_width_reading === true;
      const chkFullWidth = document.getElementById('opt-full-width');
      if (chkFullWidth) chkFullWidth.checked = isFullWidth;
      workspace?.classList.toggle('full-width', isFullWidth);

      const showGeo = cfg.show_geo_pins !== false;
      const chkGeo = document.getElementById('opt-show-geo-pins');
      if (chkGeo) chkGeo.checked = showGeo;
      workspace?.classList.toggle('hide-geo-pins', !showGeo);

      const showHl = cfg.show_highlights !== false;
      const chkHl = document.getElementById('opt-show-highlights');
      if (chkHl) chkHl.checked = showHl;
      workspace?.classList.toggle('hide-highlights', !showHl);
      document.body.classList.toggle('hide-highlights', !showHl);

      // Mode d'affichage des mots entre crochets
      const savedBracketsMode = localStorage.getItem('bible_reader_brackets_mode') || 'classic';
      BibleReader.bracketsMode = savedBracketsMode;
      const bracketRadio = document.querySelector(`input[name="opt-brackets-mode"][value="${savedBracketsMode}"]`);
      if (bracketRadio) bracketRadio.checked = true;

      // Mode d'affichage des notes entre parenthèses
      const savedParenMode = localStorage.getItem('bible_reader_parentheses_mode') || 'callout';
      BibleReader.parenthesesMode = savedParenMode;
      const parenRadio = document.querySelector(`input[name="opt-parentheses-mode"][value="${savedParenMode}"]`);
      if (parenRadio) parenRadio.checked = true;

      // Mode d'affichage des séparateurs poétiques / césures
      const savedCaesuraMode = localStorage.getItem('bible_reader_caesura_mode') || 'indent';
      BibleReader.caesuraMode = savedCaesuraMode;
      const caesuraRadio = document.querySelector(`input[name="opt-caesura-mode"][value="${savedCaesuraMode}"]`);
      if (caesuraRadio) caesuraRadio.checked = true;
    } catch (e) {}

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const cfg = await API.getSettings() || {};
        updateActiveSwatch(cfg.reading_bg || 'auto');
        
        const showDiv = cfg.show_chapter_dividers !== false;
        const chkDiv = document.getElementById('opt-show-chap-dividers');
        if (chkDiv) chkDiv.checked = showDiv;
        workspace?.classList.toggle('hide-chap-dividers', !showDiv);

        const isFullWidth = cfg.full_width_reading === true;
        const chkFullWidth = document.getElementById('opt-full-width');
        if (chkFullWidth) chkFullWidth.checked = isFullWidth;
        workspace?.classList.toggle('full-width', isFullWidth);

        const showGeo = cfg.show_geo_pins !== false;
        const chkGeo = document.getElementById('opt-show-geo-pins');
        if (chkGeo) chkGeo.checked = showGeo;
        workspace?.classList.toggle('hide-geo-pins', !showGeo);

        const showHl = cfg.show_highlights !== false;
        const chkHl = document.getElementById('opt-show-highlights');
        if (chkHl) chkHl.checked = showHl;
        workspace?.classList.toggle('hide-highlights', !showHl);
        document.body.classList.toggle('hide-highlights', !showHl);

        const savedBracketsMode = localStorage.getItem('bible_reader_brackets_mode') || 'classic';
        BibleReader.bracketsMode = savedBracketsMode;
        const bracketRadio = document.querySelector(`input[name="opt-brackets-mode"][value="${savedBracketsMode}"]`);
        if (bracketRadio) bracketRadio.checked = true;

        const savedParenMode = localStorage.getItem('bible_reader_parentheses_mode') || 'callout';
        BibleReader.parenthesesMode = savedParenMode;
        const parenRadio = document.querySelector(`input[name="opt-parentheses-mode"][value="${savedParenMode}"]`);
        if (parenRadio) parenRadio.checked = true;

        const savedCaesuraMode = localStorage.getItem('bible_reader_caesura_mode') || 'indent';
        BibleReader.caesuraMode = savedCaesuraMode;
        const caesuraRadio = document.querySelector(`input[name="opt-caesura-mode"][value="${savedCaesuraMode}"]`);
        if (caesuraRadio) caesuraRadio.checked = true;
      } catch (e) {}
      popover.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        popover.classList.add('hidden');
      }
    });

    document.getElementById('opt-show-pericopes')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('hide-pericopes', !e.target.checked);
    });

    document.getElementById('opt-show-chap-num')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('hide-chap-num', !e.target.checked);
    });

    document.getElementById('opt-show-verse-num')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('hide-verse-num', !e.target.checked);
    });

    document.getElementById('opt-show-geo-pins')?.addEventListener('change', async (e) => {
      workspace?.classList.toggle('hide-geo-pins', !e.target.checked);
      const cfg = await API.getSettings() || {};
      cfg.show_geo_pins = e.target.checked;
      API.call('save_settings', cfg);
    });

    document.getElementById('opt-show-highlights')?.addEventListener('change', async (e) => {
      const hide = !e.target.checked;
      workspace?.classList.toggle('hide-highlights', hide);
      document.body.classList.toggle('hide-highlights', hide);
      const cfg = await API.getSettings() || {};
      cfg.show_highlights = e.target.checked;
      API.call('save_settings', cfg);
    });

    document.getElementById('opt-verse-per-line')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('verse-per-line', e.target.checked);
    });

    document.getElementById('opt-show-chap-dividers')?.addEventListener('change', async (e) => {
      workspace?.classList.toggle('hide-chap-dividers', !e.target.checked);
      const cfg = await API.getSettings() || {};
      cfg.show_chapter_dividers = e.target.checked;
      const cfgCheck = document.getElementById('cfg-show-chap-dividers');
      if (cfgCheck) cfgCheck.checked = e.target.checked;
      API.call('save_settings', cfg);
    });

    document.getElementById('opt-full-width')?.addEventListener('change', async (e) => {
      workspace?.classList.toggle('full-width', e.target.checked);
      const cfg = await API.getSettings() || {};
      cfg.full_width_reading = e.target.checked;
      const cfgCheck = document.getElementById('cfg-full-width');
      if (cfgCheck) cfgCheck.checked = e.target.checked;
      API.call('save_settings', cfg);
    });

    document.getElementById('opt-font-serif')?.addEventListener('change', (e) => {
      workspace?.classList.toggle('font-sans', !e.target.checked);
    });

    // Choix du mode d'affichage des crochets
    document.querySelectorAll('input[name="opt-brackets-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          BibleReader.bracketsMode = e.target.value;
          try {
            localStorage.setItem('bible_reader_brackets_mode', BibleReader.bracketsMode);
          } catch (err) {}
          BibleReader.reloadCurrentChapters();
        }
      });
    });

    // Choix du mode d'affichage des notes entre parenthèses
    document.querySelectorAll('input[name="opt-parentheses-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          BibleReader.parenthesesMode = e.target.value;
          try {
            localStorage.setItem('bible_reader_parentheses_mode', BibleReader.parenthesesMode);
          } catch (err) {}
          BibleReader.reloadCurrentChapters();
        }
      });
    });

    // Choix du mode d'affichage des séparateurs poétiques
    document.querySelectorAll('input[name="opt-caesura-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          BibleReader.caesuraMode = e.target.value;
          try {
            localStorage.setItem('bible_reader_caesura_mode', BibleReader.caesuraMode);
          } catch (err) {}
          BibleReader.reloadCurrentChapters();
        }
      });
    });

    // Clic sur les 4 pastilles visuelles de fond de lecture
    document.querySelectorAll('.reading-bg-quick-swatch').forEach(sw => {
      sw.addEventListener('click', async () => {
        const bgKey = sw.dataset.bg || 'auto';
        updateActiveSwatch(bgKey);

        const cfg = await API.getSettings() || {};
        cfg.reading_bg = bgKey;
        const bgHiddenInput = document.getElementById('cfg-reading-bg');
        if (bgHiddenInput) bgHiddenInput.value = bgKey;

        App.applyTheme(cfg.theme, cfg.theme_palette, bgKey);
        await API.call('save_settings', cfg);
        popover.classList.add('hidden');
      });
    });

    // Gestion des 3 onglets du panneau d'affichage (Éléments, Typographie, Ambiance)
    popover.querySelectorAll('.disp-tab-btn').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetTab = tabBtn.dataset.dispTab;
        popover.querySelectorAll('.disp-tab-btn').forEach(b => b.classList.toggle('active', b === tabBtn));
        popover.querySelectorAll('.disp-tab-pane').forEach(pane => {
          pane.classList.toggle('hidden', pane.id !== `disp-tab-pane-${targetTab}`);
        });
      });
    });
  }
};


// 3b. MENU OPTIONS INTERLINÉAIRE INVERSÉ (Style Logos)
const InterlinearMenu = {
  currentTargetPane: '1',

  init() {
    const btn = document.getElementById('btn-toggle-interlinear');
    const popover = document.getElementById('interlinear-options-popover');
    const masterSwitch = document.getElementById('interlinear-master-switch');
    const closeBtn = document.getElementById('btn-close-interlinear-popover');
    const radioLSG = document.getElementById('lbl-inter-lsg');
    const radioDarby = document.getElementById('lbl-inter-darby');

    if (!btn || !popover) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.syncPopoverUI();
      popover.classList.toggle('hidden');
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        popover.classList.add('hidden');
      });
    }

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        popover.classList.add('hidden');
      }
    });

    // Gestion du choix de la fenêtre cible (Gauche / Droite / Les deux)
    document.querySelectorAll('.target-pane-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.target-pane-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentTargetPane = pill.dataset.pane || '1';
        this.syncPopoverUI();
      });
    });

    if (masterSwitch) {
      masterSwitch.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (this.currentTargetPane === '1') {
          BibleReader.pane1IsInterlinear = checked;
        } else if (this.currentTargetPane === '2') {
          BibleReader.pane2IsInterlinear = checked;
        } else if (this.currentTargetPane === 'both') {
          BibleReader.pane1IsInterlinear = checked;
          BibleReader.pane2IsInterlinear = checked;
        }

        btn.classList.toggle('active', BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear);
        TabsManager.updateActiveTab(null, null, null, BibleReader.pane1IsInterlinear, BibleReader.pane1InterlinearVersion);
        BibleReader.updatePaneHeader(1);
        if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);
        BibleReader.reloadCurrentChapters();
      });
    }

    document.querySelectorAll('input[name="interlinear-version-radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const val = e.target.value;
        if (this.currentTargetPane === '1') {
          BibleReader.pane1InterlinearVersion = val;
        } else if (this.currentTargetPane === '2') {
          BibleReader.pane2InterlinearVersion = val;
        } else if (this.currentTargetPane === 'both') {
          BibleReader.pane1InterlinearVersion = val;
          BibleReader.pane2InterlinearVersion = val;
        }

        if (radioLSG) radioLSG.classList.toggle('active', val === 'LSG');
        if (radioDarby) radioDarby.classList.toggle('active', val === 'DARBY');

        TabsManager.updateActiveTab(null, null, null, BibleReader.pane1IsInterlinear, BibleReader.pane1InterlinearVersion);
        BibleReader.updatePaneHeader(1);
        if (BibleReader.isSplitView) BibleReader.updatePaneHeader(2);
        BibleReader.reloadCurrentChapters();
      });
    });

    const layerSurface = document.getElementById('inter-layer-surface');
    const layerOrig = document.getElementById('inter-layer-orig');
    const layerTranslit = document.getElementById('inter-layer-translit');
    const layerStrong = document.getElementById('inter-layer-strong');

    const onLayerChanged = () => {
      BibleReader.interlinearLayers = {
        surface: layerSurface ? layerSurface.checked : true,
        orig: layerOrig ? layerOrig.checked : true,
        translit: layerTranslit ? layerTranslit.checked : true,
        strong: layerStrong ? layerStrong.checked : true
      };
      if (BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear) {
        BibleReader.reloadCurrentChapters();
      }
    };

    if (layerSurface) layerSurface.addEventListener('change', onLayerChanged);
    if (layerOrig) layerOrig.addEventListener('change', onLayerChanged);
    if (layerTranslit) layerTranslit.addEventListener('change', onLayerChanged);
    if (layerStrong) layerStrong.addEventListener('change', onLayerChanged);
  },

  syncPopoverUI() {
    const targetBox = document.getElementById('interlinear-target-container');
    if (targetBox) {
      targetBox.style.display = BibleReader.isSplitView ? 'flex' : 'none';
    }

    const masterSwitch = document.getElementById('interlinear-master-switch');
    const radioLSG = document.getElementById('lbl-inter-lsg');
    const radioDarby = document.getElementById('lbl-inter-darby');

    let isTargetActive = false;
    let targetVersion = 'LSG';

    if (this.currentTargetPane === '1') {
      isTargetActive = BibleReader.pane1IsInterlinear;
      targetVersion = BibleReader.pane1InterlinearVersion || 'LSG';
    } else if (this.currentTargetPane === '2') {
      isTargetActive = BibleReader.pane2IsInterlinear;
      targetVersion = BibleReader.pane2InterlinearVersion || 'DARBY';
    } else {
      isTargetActive = BibleReader.pane1IsInterlinear || BibleReader.pane2IsInterlinear;
      targetVersion = BibleReader.pane1InterlinearVersion || 'LSG';
    }

    if (masterSwitch) masterSwitch.checked = isTargetActive;
    const radioInput = document.querySelector(`input[name="interlinear-version-radio"][value="${targetVersion}"]`);
    if (radioInput) radioInput.checked = true;
    if (radioLSG) radioLSG.classList.toggle('active', targetVersion === 'LSG');
    if (radioDarby) radioDarby.classList.toggle('active', targetVersion === 'DARBY');
  }
};


// 4. GESTIONNAIRE INDIVIDUEL DE COMMENTAIRES (Style Logos)
const CommentaryViewer = {
  currentComments: [],
  activeIndex: 0,
  preferredAuthor: null, // Auteur/ouvrage mémorisé pour rester constant lors de la navigation
  currentVerseRef: '',
  currentBook: 'Gen',
  currentChapter: 1,
  currentVerse: 1,
  isSynchronized: true,
  fontSize: 15,
  translationCache: {},
  showTranslatedVersion: {},

  init() {
    // 0. Restaurer les préférences d'affichage
    try {
      const savedFontSize = localStorage.getItem('bible_comm_font_size');
      if (savedFontSize) this.fontSize = parseInt(savedFontSize, 10) || 15;
      const savedAuthor = localStorage.getItem('bible_comm_preferred_author');
      if (savedAuthor) this.preferredAuthor = savedAuthor;
    } catch (e) {}
    this.applyFontSize();

    // 0b. Boutons de navigation verset précédent / verset suivant
    const btnPrev = document.getElementById('btn-comm-prev-verse');
    const btnNext = document.getElementById('btn-comm-next-verse');
    btnPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateVerse(-1);
    });
    btnNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateVerse(1);
    });

    // 0c. Boutons d'ajustement de taille de texte
    document.getElementById('btn-comm-font-dec')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.adjustFontSize(-1);
    });
    document.getElementById('btn-comm-font-inc')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.adjustFontSize(1);
    });

    // 0d. Bouton d'accès direct à l'Introduction du livre
    document.getElementById('btn-comm-open-intro')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadIntroduction();
    });

    // 1. Bouton de traduction d'article individuel
    const btnTranslate = document.getElementById('btn-translate-comm');
    btnTranslate?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.translateActiveCommentary();
    });

    // 1b. Bouton d'agrandissement plein écran vers la page dédiée aux commentaires
    const btnExpand = document.getElementById('btn-expand-comm-to-view');
    btnExpand?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof CommentariesView !== 'undefined') {
        CommentariesView.openWithCurrentState();
      }
    });

    // 2. Restaurer l'état de synchronisation
    try {
      const savedSync = localStorage.getItem('bible_comm_sync');
      if (savedSync !== null) {
        this.isSynchronized = savedSync !== 'false';
      }
    } catch (e) {}

    // 2b. Bouton de synchronisation / déliage
    const btnSync = document.getElementById('btn-toggle-comm-sync');
    btnSync?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSync();
    });
    this.updateSyncButtonUI();

    // 3. Sélecteur de source de commentaire & filtre
    const btnSource = document.getElementById('btn-select-comm-source');
    const popoverSource = document.getElementById('comm-sources-popover');
    const filterInput = document.getElementById('comm-sources-filter-input');

    btnSource?.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverSource?.classList.toggle('hidden');
      if (popoverSource && !popoverSource.classList.contains('hidden')) {
        if (filterInput) {
          filterInput.value = '';
          this.filterSourcesList('');
          setTimeout(() => filterInput.focus(), 50);
        }
      }
    });

    filterInput?.addEventListener('input', (e) => {
      this.filterSourcesList(e.target.value);
    });

    document.addEventListener('click', (e) => {
      if (popoverSource && !popoverSource.contains(e.target) && e.target !== btnSource) {
        popoverSource.classList.add('hidden');
      }
    });

    // 4. Saisie manuelle de référence pour le commentaire (mode délié ou saut rapide)
    const refBadge = document.getElementById('comm-selected-verse');
    const refPopover = document.getElementById('comm-ref-picker-popover');
    const refInput = document.getElementById('comm-ref-input');
    const btnSubmitRef = document.getElementById('btn-comm-ref-submit');

    refBadge?.addEventListener('click', (e) => {
      e.stopPropagation();
      refPopover?.classList.toggle('hidden');
      if (refPopover && !refPopover.classList.contains('hidden')) {
        if (refInput) {
          refInput.value = this.currentVerseRef || '';
          refInput.focus();
          refInput.select();
        }
      }
    });

    const handleManualRefSubmit = async () => {
      const query = refInput?.value?.trim();
      if (!query) return;
      try {
        const parsed = await API.parseReference(query);
        if (parsed && parsed.book) {
          // Déconnecter la synchronisation pour laisser le commentaire indépendant
          this.toggleSync(false);
          await BibleReader.loadCommentariesForVerse(parsed.verse || 1, parsed.book, parsed.chapter || 1, true /* force */);
          refPopover?.classList.add('hidden');
          if (refInput) refInput.value = '';
        } else {
          App.showToast(`Référence introuvable : « ${query} »`);
        }
      } catch (e) {
        console.error('Erreur saisie référence manuelle commentaire:', e);
      }
    };

    btnSubmitRef?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleManualRefSubmit();
    });

    refInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleManualRefSubmit();
      }
    });

    document.addEventListener('click', (e) => {
      if (refPopover && !refPopover.contains(e.target) && e.target !== refBadge) {
        refPopover.classList.add('hidden');
      }
    });

    // 5. Initialiser le sous-système de Synthèse Exégétique Multi-Commentaires IA
    CommentarySynthesizerUI.init();

    // 6. Charger immédiatement le commentaire du verset actif par défaut
    setTimeout(() => {
      if (typeof BibleReader !== 'undefined' && (!this.currentComments || this.currentComments.length === 0)) {
        const b = BibleReader.currentBook || 'Gen';
        const ch = BibleReader.currentChapter || 1;
        const v = BibleReader.selectedVerse || 1;
        BibleReader.loadCommentariesForVerse(v, b, ch, true);
      }
    }, 250);
  },

  applyFontSize() {
    const root = document.getElementById('drawer-tab-commentaries');
    if (root) {
      root.style.setProperty('--comm-font-size', `${this.fontSize}px`);
    }
  },

  adjustFontSize(delta) {
    this.fontSize = Math.max(12, Math.min(24, this.fontSize + delta));
    this.applyFontSize();
    try {
      localStorage.setItem('bible_comm_font_size', String(this.fontSize));
    } catch (e) {}
    App.showToast(`Taille du texte : ${this.fontSize}px`);
  },

  async loadIntroduction(bookCode = null) {
    const book = bookCode || this.currentBook || (typeof BibleReader !== 'undefined' ? BibleReader.currentBook : 'Gen');
    const bookInfo = typeof getBookInfo === 'function' ? getBookInfo(book) : { name: book };
    const refStr = `Introduction à ${bookInfo.name || book}`;
    this.currentBook = book;
    this.currentChapter = 0;
    this.currentVerse = 0;
    this.updateLiveBadge(refStr);
    
    try {
      const comms = await API.getCommentaries(book, 0, 0);
      this.setComments(comms, refStr, book, 0, 0);
    } catch (e) {
      console.error('Erreur chargement introduction livre:', e);
    }
  },

  async navigateVerse(delta) {
    let currentV = parseInt(this.currentVerse, 10) || 0;
    let currentCh = parseInt(this.currentChapter, 10) || 0;
    let nextBk = (this.isSynchronized && typeof BibleReader !== 'undefined')
      ? (BibleReader.currentBook || 'Gen')
      : (this.currentBook || 'Gen');

    // Cas 1 : On est sur l'introduction (Ch 0) et on clique sur Suivant (delta > 0)
    if (currentCh === 0) {
      if (delta > 0) {
        if (this.isSynchronized && typeof BibleReader !== 'undefined') {
          BibleReader.selectVerse(nextBk, 1, 1, { scroll: true, behavior: 'smooth', block: 'center' });
        } else {
          this.currentBook = nextBk;
          this.currentChapter = 1;
          this.currentVerse = 1;
          const bookInfo = typeof getBookInfo === 'function' ? getBookInfo(nextBk) : { name: nextBk };
          const refStr = `${bookInfo.name || nextBk} 1:1`;
          this.updateLiveBadge(refStr);
          try {
            const comms = await API.getCommentaries(nextBk, 1, 1);
            this.setComments(comms, refStr, nextBk, 1, 1);
          } catch (e) {}
        }
        return;
      } else {
        App.showToast('Début du livre (Introduction)');
        return;
      }
    }

    // Cas 2 : On est au Verset 1 du Chapitre 1 et on clique sur Précédent (delta < 0)
    if (currentCh === 1 && currentV <= 1 && delta < 0) {
      await this.loadIntroduction(nextBk);
      return;
    }

    let nextV = currentV + delta;
    let nextCh = currentCh;

    if (nextV < 1) {
      if (nextCh > 1) {
        nextCh -= 1;
        nextV = 1;
      } else {
        await this.loadIntroduction(nextBk);
        return;
      }
    }

    if (this.isSynchronized) {
      if (typeof BibleReader !== 'undefined') {
        if (nextBk === BibleReader.currentBook && nextCh === BibleReader.currentChapter) {
          BibleReader.selectVerse(nextBk, nextCh, nextV, { scroll: true, behavior: 'smooth', block: 'center' });
        } else {
          await BibleReader.navigateTo(nextBk, nextCh, nextV);
        }
      }
    } else {
      // En mode indépendant, charger directement le commentaire
      this.currentBook = nextBk;
      this.currentChapter = nextCh;
      this.currentVerse = nextV;
      const bookInfo = typeof getBookInfo === 'function' ? getBookInfo(nextBk) : { name: nextBk };
      const refStr = `${bookInfo.name || nextBk} ${nextCh}:${nextV}`;
      this.updateLiveBadge(refStr);
      try {
        const comms = await API.getCommentaries(nextBk, nextCh, nextV);
        this.setComments(comms, refStr, nextBk, nextCh, nextV);
      } catch (e) {
        console.error('Erreur navigation commentaire délié:', e);
      }
    }
  },

  toggleSync(forcedState) {
    if (typeof forcedState === 'boolean') {
      this.isSynchronized = forcedState;
    } else {
      this.isSynchronized = !this.isSynchronized;
    }

    try {
      localStorage.setItem('bible_comm_sync', this.isSynchronized ? 'true' : 'false');
    } catch (e) {}

    this.updateSyncButtonUI();

    if (this.isSynchronized) {
      // Re-synchroniser immédiatement avec le verset visible à l'écran
      const pane1 = document.getElementById('pane-1-content');
      const topV = pane1 ? BibleReader.getTopVisibleVerse(pane1) : null;
      const curBook = (topV && topV.book) || BibleReader.currentBook;
      const curCh = (topV && topV.chapter) ? parseInt(topV.chapter, 10) : BibleReader.currentChapter;
      const curV = (topV && topV.verse) ? parseInt(topV.verse, 10) : (BibleReader.selectedVerse || 1);

      BibleReader.loadCommentariesForVerse(curV, curBook, curCh, true);
      App.showToast('Commentaire synchronisé avec le texte biblique');
    } else {
      App.showToast('Commentaire délié (indépendant du texte biblique)');
    }
  },

  updateLiveBadge(verseRef) {
    const badgeTextEl = document.getElementById('comm-selected-verse-text');
    const badgeEl = document.getElementById('comm-selected-verse');
    if (badgeTextEl && verseRef) {
      badgeTextEl.textContent = verseRef;
      this.currentVerseRef = verseRef;
    } else if (badgeEl && verseRef) {
      badgeEl.textContent = verseRef;
      this.currentVerseRef = verseRef;
    }
    const aiBadgeEl = document.getElementById('lbl-drawer-ai-passage');
    if (aiBadgeEl && verseRef) {
      aiBadgeEl.textContent = verseRef;
    }
  },

  updateSyncButtonUI() {
    const btn = document.getElementById('btn-toggle-comm-sync');
    if (!btn) return;

    if (this.isSynchronized) {
      btn.className = 'comm-sync-btn active';
      btn.title = 'Synchronisation active : le commentaire suit le texte biblique en direct (Cliquer pour délier)';
      btn.innerHTML = `
        <svg class="sync-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span id="comm-sync-label">Lié</span>
      `;
    } else {
      btn.className = 'comm-sync-btn unlinked';
      btn.title = 'Commentaire indépendant (Cliquer pour lier au texte biblique)';
      btn.innerHTML = `
        <svg class="sync-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="m5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          <line x1="2" y1="2" x2="22" y2="22"></line>
        </svg>
        <span id="comm-sync-label">Délié</span>
      `;
    }
  },

  getSourceInfo(name) {
    if (typeof CommentarySynthesizerUI !== 'undefined' && CommentarySynthesizerUI.getSourceInfo) {
      return CommentarySynthesizerUI.getSourceInfo(name);
    }
    if (!name) return { title: 'Commentaire Biblique', author: 'Auteur', period: "Ouvrage d'étude", color: "#1E293B", initials: "BIB" };
    const trimmed = name.trim();
    const initials = trimmed.split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 3).toUpperCase() || 'BIB';
    const title = (trimmed.toLowerCase().startsWith('commentaire') || trimmed.toLowerCase().startsWith('notes') || trimmed.toLowerCase().startsWith('bible'))
      ? trimmed
      : `Commentaire de ${trimmed}`;
    return {
      title: title,
      author: name,
      period: "Ouvrage de référence",
      color: "#2563EB",
      initials: initials
    };
  },

  filterSourcesList(query) {
    const listEl = document.getElementById('comm-sources-list');
    if (!listEl) return;
    const cleanQ = (query || '').toLowerCase().trim();
    listEl.querySelectorAll('.comm-source-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      if (!cleanQ || text.includes(cleanQ)) {
        item.style.setProperty('display', 'flex', 'important');
      } else {
        item.style.setProperty('display', 'none', 'important');
      }
    });
  },

  setComments(comments, verseRef, bookCode = null, chapterNum = null, verseNum = null) {
    this.currentComments = comments || [];
    this.currentVerseRef = verseRef || '';
    if (bookCode) this.currentBook = bookCode;
    if (chapterNum) this.currentChapter = parseInt(chapterNum, 10) || 1;
    if (verseNum) this.currentVerse = parseInt(verseNum, 10) || 1;

    const countEl = document.getElementById('comm-popover-count');
    const badgeCountEl = document.getElementById('lbl-comm-source-count');
    const listEl = document.getElementById('comm-sources-list');

    this.updateLiveBadge(verseRef);

    const countNum = this.currentComments.length;
    if (countEl) countEl.textContent = countNum;
    if (badgeCountEl) badgeCountEl.textContent = countNum;
    if (listEl) listEl.innerHTML = '';

    // Peupler le popover de sélection de source avec métadonnées enrichies
    if (this.currentComments.length > 0) {
      this.currentComments.forEach((c, idx) => {
        const authorName = c.author || c.source || `Commentaire ${idx + 1}`;
        const sourceMeta = this.getSourceInfo(authorName);
        const isMatch = this.preferredAuthor && authorName.toLowerCase().includes(this.preferredAuthor.toLowerCase());
        
        const item = document.createElement('button');
        item.className = `comm-source-item ${isMatch ? 'active' : ''}`;
        item.dataset.index = idx;
        item.dataset.author = authorName;
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
            <span class="comm-single-author-avatar" style="width: 20px; height: 20px; font-size: 9px; border-radius: 4px; background-color: ${sourceMeta.color || '#1E3A8A'};">${sourceMeta.initials || 'C'}</span>
            <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sourceMeta.title || authorName}</span>
          </div>
          <span class="comm-source-item-meta">${sourceMeta.period ? sourceMeta.period.split('(')[0].trim() : ''}</span>
        `;
        item.addEventListener('click', () => {
          this.preferredAuthor = authorName;
          this.selectCommentary(idx);
          document.getElementById('comm-sources-popover')?.classList.add('hidden');
        });
        listEl?.appendChild(item);
      });
    }

    if (this.currentComments.length > 0) {
      // 1. Chercher si l'auteur préféré est présent pour ce verset
      let targetIndex = -1;
      if (this.preferredAuthor) {
        const pName = this.preferredAuthor.toLowerCase();
        targetIndex = this.currentComments.findIndex(c => {
          const aName = (c.author || c.source || '').toLowerCase();
          return aName === pName || aName.includes(pName) || pName.includes(aName);
        });
      }

      if (targetIndex !== -1) {
        // L'auteur préféré commente ce verset -> afficher directement son analyse
        this.selectCommentary(targetIndex);
      } else {
        // Charger le premier commentaire disponible par défaut sans écraser preferredAuthor
        this.selectCommentary(0, false);
      }
    } else {
      // Aucun commentaire pour ce verset
      this.renderAbsentPreferredAuthor();
    }
  },
  isForeignText(text) {
    if (!text || text.length < 15) return false;
    const sample = text.toLowerCase().slice(0, 500);
    const frWords = [' le ', ' la ', ' les ', ' un ', ' une ', ' des ', ' du ', ' dans ', ' pour ', ' avec ', ' est ', ' sont ', ' ce ', ' cette '];
    const enWords = [' the ', ' and ', ' that ', ' with ', ' for ', ' this ', ' from ', ' which ', ' have ', ' are ', ' was ', ' were ', ' his ', ' but '];
    const frMatches = frWords.filter(w => sample.includes(w)).length;
    const enMatches = enWords.filter(w => sample.includes(w)).length;
    return enMatches > frMatches;
  },

  parseCommentaryFootnotes(rawText) {
    if (!rawText) return { mainText: '', footnotesList: [], footnoteMap: {} };

    const footnoteMap = {};
    const footnotesList = [];

    const lines = rawText.split('\n');
    const cleanedLines = [];
    let inDefMode = false;
    let currentFnId = null;
    let currentFnText = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const stripped = line.trim();

      // Rechercher un motif de début de note : [^1] ... ou > [^1] ... ou > **Note...** [^1] ...
      const mDef = stripped.match(/(?:^>*\s*(?:\*\*[^*]+\*\*\s*:?\s*|\*[^*]+\*\s*:?\s*)?|\b)\[\^(\d+)\](?:\s*:\s*|\s+)(.*)/);

      let isDefLine = false;
      if (mDef) {
        const prefix = stripped.slice(0, mDef.index).trim();
        if (prefix === '' || prefix === '>' || prefix.startsWith('> **Note') || prefix.startsWith('> *Note') || prefix.startsWith('**Note') || prefix.startsWith('*Note')) {
          isDefLine = true;
        } else if (prefix.startsWith('>') && (prefix.toLowerCase().includes('note') || prefix.toLowerCase().includes('cts') || prefix.toLowerCase().includes('éditeur') || prefix.toLowerCase().includes('editeur'))) {
          isDefLine = true;
        } else if (stripped.startsWith('[^') || stripped.startsWith('> [^') || stripped.startsWith('> **') || stripped.startsWith('>*')) {
          isDefLine = true;
        }
      }

      if (isDefLine && mDef) {
        if (currentFnId) {
          const fnBody = currentFnText.join(' ').trim();
          if (fnBody && !footnoteMap[currentFnId]) {
            footnoteMap[currentFnId] = fnBody;
            footnotesList.push({ id: currentFnId, text: fnBody });
          }
        }

        currentFnId = mDef[1];
        currentFnText = [mDef[2].trim()];
        inDefMode = true;
      } else if (inDefMode && (stripped.startsWith('>') || stripped.startsWith('*') || !stripped)) {
        const cleanedCont = stripped.replace(/^>\s*/, '').trim();
        if (cleanedCont) {
          currentFnText.push(cleanedCont);
        }
      } else {
        if (currentFnId) {
          const fnBody = currentFnText.join(' ').trim();
          if (fnBody && !footnoteMap[currentFnId]) {
            footnoteMap[currentFnId] = fnBody;
            footnotesList.push({ id: currentFnId, text: fnBody });
          }
          currentFnId = null;
          inDefMode = false;
        }
        cleanedLines.push(line);
      }
    }

    if (currentFnId) {
      const fnBody = currentFnText.join(' ').trim();
      if (fnBody && !footnoteMap[currentFnId]) {
        footnoteMap[currentFnId] = fnBody;
        footnotesList.push({ id: currentFnId, text: fnBody });
      }
    }

    let mainText = cleanedLines.join('\n').trim();
    // Nettoyer les éventuels blockquotes orphelins de titre de note à la fin
    mainText = mainText.replace(/\n+>\s*\*\*(?:Note de l'éditeur|Note éditoriale).*?\*\*\s*:?\s*$/i, '').trim();
    mainText = mainText.replace(/\n+>\s*\*(?:Note de l'éditeur|Note éditoriale).*?\*\s*:?\s*$/i, '').trim();

    return { mainText, footnotesList, footnoteMap };
  },

  formatCommentaryMarkdown(text, footnoteMap = {}) {
    if (!text) return '';

    // Remplacer les marqueurs [^1] ou [^2] par le badge interactif theol-fn-badge
    let html = text
      .replace(/\[\^(\d+)\]/g, (match, id) => {
        return `<sup class="theol-fn-badge" data-fn-id="${id}" id="comm-fnref-${id}"><a href="#comm-fn-${id}" title="Note ${id}">${id}</a></sup>`;
      })
      .replace(/^### (.*$)/gim, '<h3 class="comm-body-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="comm-body-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="comm-body-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="comm-body-lemma">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="comm-body-em">$1</em>')
      .replace(/^\> (.*$)/gim, '<blockquote class="comm-body-quote">$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li class="comm-body-li">$1</li>')
      .replace(/\[([A-Z0-9\u00C0-\u00DCa-z\u00E0-\u00FC\s\.\,\:\;\-]+)\]/g, '<span class="comm-cite-badge">$1</span>')
      .replace(/\n\n/g, '<br><br>');

    // Nettoyage des <br><br> parasites autour des balises de bloc HTML
    html = html
      .replace(/(?:<br>\s*)+<(div|h[1-6]|blockquote|ul|ol|li)/gi, '<$1')
      .replace(/<\/(div|h[1-6]|blockquote|ul|ol|li)>(?:\s*<br>)+/gi, '</$1>');

    return html;
  },

  selectCommentary(index, updatePreferred = true) {
    if (!this.currentComments[index]) return;
    this.activeIndex = index;

    const comm = this.currentComments[index];
    const authorName = comm.author || comm.source || 'Commentaire';
    if (updatePreferred) {
      this.preferredAuthor = authorName;
      try {
        localStorage.setItem('bible_comm_preferred_author', authorName);
      } catch (e) {}
    }

    const sourceMeta = this.getSourceInfo(authorName);
    const lbl = document.getElementById('lbl-active-comm-source');
    if (lbl) lbl.textContent = sourceMeta.title || authorName;

    document.querySelectorAll('.comm-source-item').forEach((item, idx) => {
      item.classList.toggle('active', idx === index);
    });

    const container = document.getElementById('commentary-single-view');
    if (!container) return;

    const itemId = `${comm.source || authorName}_${this.currentBook}_${this.currentChapter}_${comm.verse_start || this.currentVerse}`;
    const isForeign = this.isForeignText(comm.text);
    const btnTranslate = document.getElementById('btn-translate-comm');
    const hasTranslation = this.translationCache[itemId];
    const isShowingTranslated = this.showTranslatedVersion[itemId] !== false && !!hasTranslation;

    if (btnTranslate) {
      if (isForeign && !hasTranslation) {
        btnTranslate.classList.remove('hidden');
        btnTranslate.disabled = false;
        btnTranslate.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg><span>Traduire</span>';
      } else {
        btnTranslate.classList.add('hidden');
      }
    }

    let translationBannerHtml = '';
    let displayedText = comm.text || '';

    if (hasTranslation) {
      if (isShowingTranslated) {
        displayedText = this.translationCache[itemId];
        translationBannerHtml = `
          <div class="comm-translate-badge">
            <span style="display:inline-flex; align-items:center; gap:5px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg><span>Traduit fidèlement en français (IA)</span></span>
            <span class="comm-translate-toggle-link" id="btn-toggle-orig-text">Voir texte original</span>
          </div>
        `;
      } else {
        translationBannerHtml = `
          <div class="comm-translate-badge">
            <span style="display:inline-flex; align-items:center; gap:5px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span>Texte original (${comm.source || 'Source'})</span></span>
            <span class="comm-translate-toggle-link" id="btn-toggle-orig-text">Voir traduction française</span>
          </div>
        `;
      }
    }

    // 0. Extraction des notes de bas de page
    const { mainText, footnotesList, footnoteMap } = this.parseCommentaryFootnotes(displayedText);

    // 1. Markdown propre avec badges de notes interactifs
    const formattedMarkdown = this.formatCommentaryMarkdown(mainText, footnoteMap);

    // 2. Détection universelle des références bibliques (identique à Théologie / Lexique)
    let linkifiedBody = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
      ? TheologyView.highlightScriptureReferences(formattedMarkdown)
      : formattedMarkdown;

    // 3. Liens web externes
    if (typeof TheologyView !== 'undefined' && TheologyView.linkifyUrls) {
      linkifiedBody = TheologyView.linkifyUrls(linkifiedBody);
    }

    // Section dédiée aux notes de bas de page si présentes
    let footnotesHtml = '';
    if (footnotesList.length > 0) {
      footnotesHtml = `
        <div class="theol-footnotes-section" id="comm-footnotes-section" style="margin-top: 24px; padding-top: 14px; border-top: 1px dashed var(--border-color, rgba(255, 255, 255, 0.12));">
          <div class="theol-footnotes-header" style="font-size: 0.95em; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--accent-blue, #3b82f6);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>Notes de bas de page (${footnotesList.length})</span>
          </div>
          <ol class="theol-footnotes-list" style="padding-left: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; list-style: none;">
            ${footnotesList.map(fn => {
              const formattedFnText = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
                ? TheologyView.highlightScriptureReferences(TheologyView.linkifyUrls(fn.text))
                : fn.text;
              return `
              <li class="theol-fn-item" id="comm-fn-${fn.id}" data-fn-id="${fn.id}">
                <span class="theol-fn-num">${fn.id}.</span>
                <div class="theol-fn-content" style="flex: 1;">
                  <span class="theol-fn-text">${formattedFnText}</span>
                  <a href="#comm-fnref-${fn.id}" class="theol-fn-backref" data-target-id="comm-fnref-${fn.id}" title="Retour au passage" style="margin-left: 6px; text-decoration: none; color: var(--accent-blue, #3b82f6); font-weight: 700;">↩</a>
                </div>
              </li>
            `;
            }).join('')}
          </ol>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="comm-single-card">
        <div class="comm-single-author-header">
          <div class="comm-single-author-info">
            <div class="comm-single-author-avatar" style="background-color: ${sourceMeta.color || '#1E3A8A'};">
              ${sourceMeta.initials || 'C'}
            </div>
            <div>
              <div class="comm-single-author-name">${sourceMeta.title || authorName}</div>
              <div class="comm-single-author-period">${sourceMeta.period || 'Ouvrage d\'exégèse'} • ${sourceMeta.author || authorName}</div>
            </div>
          </div>

          <div class="comm-single-top-actions">
            <button class="comm-single-action-pill" id="btn-comm-single-copy" title="Copier ce commentaire">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copier</span>
            </button>
            <button class="comm-single-action-pill" id="btn-comm-single-note" title="Enregistrer dans les notes d'étude">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              <span>Vers note</span>
            </button>
          </div>
        </div>

        ${translationBannerHtml}

        <div class="comm-single-body">
          ${linkifiedBody}
          ${footnotesHtml}
        </div>
      </div>
    `;

    // 4. Lier FootnoteTooltip (infobulles de notes au survol et au clic)
    if (typeof FootnoteTooltip !== 'undefined') {
      FootnoteTooltip.setFootnotes(footnotesList);
      FootnoteTooltip.bindToElements(container.querySelectorAll('.theol-fn-badge'));
    }

    // 4b. Attacher les liens retour (back-links) de la section des notes
    container.querySelectorAll('.theol-fn-backref').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.targetId;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.remove('theol-highlight-pulse');
          void targetEl.offsetWidth;
          targetEl.classList.add('theol-highlight-pulse');
        }
      });
    });

    // 4c. Lier l'infobulle biblique interactive (ScriptureTooltip) & navigation par clic
    if (typeof ScriptureTooltip !== 'undefined') {
      ScriptureTooltip.bindToElements(container.querySelectorAll('.theol-inline-scripture-ref'));
    }
    container.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = span.dataset.ref || span.textContent.trim();
        if (ref) {
          if (typeof ScriptureTooltip !== 'undefined') ScriptureTooltip.hide();
          if (typeof BibleReader !== 'undefined') BibleReader.searchPassage(ref);
        }
      });
    });

    // 5. Écouteur pour la bascule de traduction
    const toggleBtn = container.querySelector('#btn-toggle-orig-text');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.showTranslatedVersion[itemId] = !isShowingTranslated;
        this.selectCommentary(index);
      });
    }

    // 6. Écouteur pour la copie du commentaire
    container.querySelector('#btn-comm-single-copy')?.addEventListener('click', () => {
      const refLabel = this.currentVerseRef || `${this.currentBook} ${this.currentChapter}:${this.currentVerse}`;
      const fullCitation = `[Commentaire de ${authorName} - ${refLabel}]\n\n${displayedText}`;
      navigator.clipboard.writeText(fullCitation).then(() => {
        App.showToast('Commentaire copié dans le presse-papier !');
      }).catch(() => {
        App.showToast('Impossible de copier le texte');
      });
    });

    // 7. Écouteur pour exporter vers les notes
    container.querySelector('#btn-comm-single-note')?.addEventListener('click', () => {
      this.exportToNotes(authorName, displayedText);
    });
  },

  exportToNotes(authorName, text) {
    const bookInfo = typeof getBookInfo === 'function' ? getBookInfo(this.currentBook) : { name: this.currentBook };
    const refStr = `${bookInfo.name || this.currentBook} ${this.currentChapter}:${this.currentVerse}`;
    const noteTitle = `Étude ${refStr} - ${authorName}`;
    const noteContent = `## Commentaire de ${authorName} sur ${refStr}\n\n### Exposition Exégétique :\n\n${text}\n`;

    App.switchView('notes');
    if (typeof NotesView !== 'undefined') {
      NotesView.createNewNote(refStr, noteTitle);
      if (NotesView.contentInput) {
        NotesView.contentInput.innerText = noteContent;
      }
      if (NotesView.currentNote) {
        NotesView.currentNote.content = noteContent;
      }
      App.showToast(`Nouvelle note créée pour ${refStr} !`);
    }
  },

  async translateActiveCommentary() {
    const comm = this.currentComments[this.activeIndex];
    if (!comm || !comm.text) return;

    const btnTranslate = document.getElementById('btn-translate-comm');
    const authorName = comm.author || comm.source || 'Commentaire';
    const itemId = `${comm.source || authorName}_${this.currentBook}_${this.currentChapter}_${comm.verse_start || this.currentVerse}`;

    if (btnTranslate) {
      btnTranslate.disabled = true;
      btnTranslate.innerHTML = '<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span><span class="shine-text">Traduction...</span>';
    }

    const bodyEl = document.querySelector('.comm-single-body');
    if (bodyEl) {
      bodyEl.classList.add('ai-shining-container');
    }

    try {
      const res = await API.translateText(comm.text, 'commentary', itemId);
      if (res && res.success && res.translated_text) {
        this.translationCache[itemId] = res.translated_text;
        this.showTranslatedVersion[itemId] = true;
        this.selectCommentary(this.activeIndex);
        App.showToast('Article traduit en français avec succès !');
      } else {
        App.showError('Erreur de Traduction', res?.error || 'Impossible de traduire l\'article.');
        if (btnTranslate) {
          btnTranslate.disabled = false;
          btnTranslate.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Réessayer</span>';
        }
        if (bodyEl) bodyEl.classList.remove('ai-shining-container');
      }
    } catch (e) {
      App.showError('Erreur de Traduction', String(e));
      if (btnTranslate) {
        btnTranslate.disabled = false;
        btnTranslate.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Réessayer</span>';
      }
      if (bodyEl) bodyEl.classList.remove('ai-shining-container');
    }
  },

  renderAbsentPreferredAuthor() {
    const authorName = this.preferredAuthor || 'Commentaire';
    const sourceMeta = this.getSourceInfo(authorName);
    const lbl = document.getElementById('lbl-active-comm-source');
    if (lbl) lbl.textContent = sourceMeta.title || authorName;

    document.querySelectorAll('.comm-source-item').forEach(item => {
      item.classList.remove('active');
    });

    const container = document.getElementById('commentary-single-view');
    if (!container) return;

    const hasOtherComments = this.currentComments && this.currentComments.length > 0;

    let suggestionsHtml = '';
    if (hasOtherComments) {
      suggestionsHtml = `
        <div class="comm-suggestions-box" style="margin-top: 20px; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; text-align: left;">
          <div style="font-size: 11px; font-weight: 700; color: var(--accent-blue); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
            <span style="display:inline-flex; align-items:center; gap:5px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg><span>Autres commentaires pour ce verset :</span></span>
            <span style="background: rgba(2, 132, 199, 0.15); color: var(--accent-blue); padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 700;">${this.currentComments.length}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${this.currentComments.map((c, idx) => {
              const itemMeta = this.getSourceInfo(c.author || c.source);
              return `
              <button class="comm-suggestion-btn" data-idx="${idx}" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px; font-size: 12px; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s ease;">
                <span style="font-weight: 600; color: var(--text-primary); display:inline-flex; align-items:center; gap:6px;">
                  <span class="comm-single-author-avatar" style="width: 18px; height: 18px; font-size: 8px; border-radius: 3px; background-color: ${itemMeta.color || '#1E3A8A'};">${itemMeta.initials || 'C'}</span>
                  <span>${itemMeta.title || c.author || c.source}</span>
                </span>
                <span style="font-size: 11px; color: var(--accent-blue); font-weight: 600;">Consulter →</span>
              </button>
            `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      suggestionsHtml = `
        <div style="font-size: 12px; color: var(--text-muted); background: var(--bg-subtle); border-radius: 6px; padding: 12px; border: 1px dashed var(--border-color); margin-top: 16px;">
          Aucun autre ouvrage de commentaire n'est disponible pour ce verset.
        </div>
      `;
    }

    container.innerHTML = `
      <div class="comm-absent-view" style="padding: 16px 8px; text-align: center;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; background-color: ${sourceMeta.color || '#1E3A8A'}; color: #fff; font-weight: 800; font-size: 13px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
          ${sourceMeta.initials || 'C'}
        </div>
        <div style="font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
          ${sourceMeta.title || authorName}
        </div>
        <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.5; max-width: 320px; margin: 0 auto;">
          Cet ouvrage ne comporte pas de note directe pour le verset <strong>${this.currentVerseRef || ''}</strong>.
        </div>
        ${suggestionsHtml}
      </div>
    `;

    // Écouteurs sur les suggestions rapides
    container.querySelectorAll('.comm-suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        this.selectCommentary(idx);
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = 'var(--accent-blue)';
        btn.style.transform = 'translateX(2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'var(--border-color)';
        btn.style.transform = 'translateX(0)';
      });
    });
  }
};


// 4ter. CONTRÔLEUR DE SYNTHÈSE MULTI-COMMENTAIRES IA
const CommentarySynthesizerUI = {
  isOpen: false,
  currentBook: 'Gen',
  currentChapter: 1,
  verseStart: 1,
  verseEnd: 1,
  maxVersesLimit: 5,
  latestSynthesisMarkdown: '',

  init() {
    const btnOpen = document.getElementById('btn-open-comm-synth');
    const btnClose = document.getElementById('btn-close-comm-synth');
    const btnLaunch = document.getElementById('btn-launch-synth');
    const startInput = document.getElementById('synth-verse-start');
    const endInput = document.getElementById('synth-verse-end');
    const btnCopy = document.getElementById('btn-copy-synth');
    const btnExportNote = document.getElementById('btn-export-synth-note');
    const btnEditRange = document.getElementById('btn-edit-synth-range');

    btnOpen?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePanel();
    });

    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePanel();
    });

    btnEditRange?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEditRange();
    });

    startInput?.addEventListener('input', () => this.handleRangeChange());
    endInput?.addEventListener('input', () => this.handleRangeChange());

    btnLaunch?.addEventListener('click', () => this.launchSynthesis());

    btnCopy?.addEventListener('click', () => this.copyToClipboard());
    btnExportNote?.addEventListener('click', () => this.exportToNote());
  },

  async togglePanel(forceOpen = null) {
    const panel = document.getElementById('comm-synthesis-panel');
    const btnOpen = document.getElementById('btn-open-comm-synth');
    const singleView = document.getElementById('commentary-single-view');
    if (!panel) return;

    this.isOpen = forceOpen !== null ? forceOpen : panel.classList.contains('hidden');

    if (this.isOpen) {
      panel.classList.remove('hidden');
      btnOpen?.classList.add('active');
      await this.refreshStateFromReader();
    } else {
      panel.classList.add('hidden');
      panel.classList.remove('synthesis-fullview');
      singleView?.classList.remove('hidden');
      btnOpen?.classList.remove('active');
    }
  },

  closePanel() {
    this.togglePanel(false);
  },

  enterFullResultMode() {
    const panel = document.getElementById('comm-synthesis-panel');
    const singleView = document.getElementById('commentary-single-view');
    if (panel) panel.classList.add('synthesis-fullview');
    if (singleView) singleView.classList.add('hidden');
  },

  exitFullResultMode() {
    const panel = document.getElementById('comm-synthesis-panel');
    const singleView = document.getElementById('commentary-single-view');
    if (panel) panel.classList.remove('synthesis-fullview');
    if (singleView) singleView.classList.remove('hidden');
  },

  toggleEditRange() {
    const panel = document.getElementById('comm-synthesis-panel');
    const btnEditRange = document.getElementById('btn-edit-synth-range');
    if (!panel) return;

    const isFull = panel.classList.contains('synthesis-fullview');
    if (isFull) {
      panel.classList.remove('synthesis-fullview');
      if (btnEditRange) btnEditRange.textContent = 'Résultat';
    } else {
      panel.classList.add('synthesis-fullview');
      if (btnEditRange) btnEditRange.textContent = 'Plage';
    }
  },

  async refreshStateFromReader() {
    // 1. Récupérer le réglage du plafond max depuis la config
    try {
      const cfg = await API.getSettings();
      if (cfg && cfg.synthesis_max_verses) {
        this.maxVersesLimit = parseInt(cfg.synthesis_max_verses, 10) || 5;
      }
    } catch (e) {}

    const ceilingLimitNum = document.getElementById('synth-ceiling-limit-num');
    if (ceilingLimitNum) ceilingLimitNum.textContent = this.maxVersesLimit;

    // 2. Déterminer le verset actif
    const pane1 = document.getElementById('pane-1-content');
    const topV = pane1 ? BibleReader.getTopVisibleVerse(pane1) : null;
    this.currentBook = (topV && topV.book) || BibleReader.currentBook || 'Gen';
    this.currentChapter = (topV && topV.chapter) ? parseInt(topV.chapter, 10) : (BibleReader.currentChapter || 1);
    const activeVerse = (topV && topV.verse) ? parseInt(topV.verse, 10) : (BibleReader.selectedVerse || 1);

    this.verseStart = activeVerse;
    this.verseEnd = activeVerse;

    const startInput = document.getElementById('synth-verse-start');
    const endInput = document.getElementById('synth-verse-end');
    if (startInput) startInput.value = this.verseStart;
    if (endInput) endInput.value = this.verseEnd;

    this.updateRangeDisplay();
  },

  handleRangeChange() {
    const startInput = document.getElementById('synth-verse-start');
    const endInput = document.getElementById('synth-verse-end');
    if (!startInput || !endInput) return;

    let vStart = parseInt(startInput.value, 10) || 1;
    let vEnd = parseInt(endInput.value, 10) || vStart;

    if (vStart < 1) vStart = 1;
    if (vEnd < 1) vEnd = 1;

    let vMin = Math.min(vStart, vEnd);
    let vMax = Math.max(vStart, vEnd);

    const span = (vMax - vMin + 1);
    const ceilingWarning = document.getElementById('synth-ceiling-warning');

    if (span > this.maxVersesLimit) {
      vMax = vMin + this.maxVersesLimit - 1;
      endInput.value = vMax;
      ceilingWarning?.classList.remove('hidden');
    } else {
      ceilingWarning?.classList.add('hidden');
    }

    this.verseStart = vMin;
    this.verseEnd = vMax;
    this.updateRangeDisplay();
  },

  updateRangeDisplay() {
    const info = getBookInfo(this.currentBook);
    const bookLbl = document.getElementById('synth-range-book');
    const passageBadge = document.getElementById('synth-passage-badge');
    const rangeInfo = document.getElementById('synth-range-info');

    const span = (this.verseEnd - this.verseStart + 1);
    const refStr = span === 1
      ? `${info.name} ${this.currentChapter}:${this.verseStart}`
      : `${info.name} ${this.currentChapter}:${this.verseStart}-${this.verseEnd}`;

    if (bookLbl) bookLbl.textContent = `${info.name} ${this.currentChapter}:`;
    if (passageBadge) passageBadge.textContent = refStr;
    if (rangeInfo) rangeInfo.textContent = span === 1 ? '1 verset' : `${span} versets (max: ${this.maxVersesLimit})`;

    const hint = document.getElementById('synth-sources-available-hint');
    if (hint) {
      const commsCount = (CommentaryViewer.currentComments && CommentaryViewer.currentComments.length) || 'Plusieurs';
      hint.textContent = `~${commsCount} sources indexées`;
    }
  },

  async launchSynthesis() {
    const btnLaunch = document.getElementById('btn-launch-synth');
    const loadingBox = document.getElementById('synth-loading-box');
    const resultBox = document.getElementById('synth-result-container');
    const statusText = document.getElementById('synth-step-status');

    if (!btnLaunch) return;

    btnLaunch.disabled = true;
    loadingBox?.classList.remove('hidden');
    resultBox?.classList.add('hidden');

    if (statusText) statusText.textContent = 'Extraction de tous les commentaires bibliques...';

    const progressTimer1 = setTimeout(() => {
      if (statusText) statusText.textContent = 'Formatage des sources et analyse théologique...';
    }, 900);

    const progressTimer2 = setTimeout(() => {
      if (statusText) statusText.textContent = 'Génération de la synthèse comparative par IA...';
    }, 2400);

    try {
      const res = await API.synthesizeCommentaries(
        this.currentBook,
        this.currentChapter,
        this.verseStart,
        this.verseEnd
      );

      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);

      if (res && res.success) {
        this.latestSynthesisMarkdown = res.synthesis || '';
        this.renderResult(res);
      } else {
        App.showError('Erreur Synthèse IA', res?.error || 'Impossible de générer la synthèse.');
      }
    } catch (err) {
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      App.showError('Erreur Réseau IA', err.message || String(err));
    } finally {
      btnLaunch.disabled = false;
      loadingBox?.classList.add('hidden');
    }
  },

  commentaryCatalog: {
    "calvin": { title: "Commentaire Biblique de Jean Calvin", author: "Jean Calvin", period: "Réforme Protestante (1550)", color: "#1E3A8A", initials: "JC" },
    "jean calvin": { title: "Commentaire Biblique de Jean Calvin", author: "Jean Calvin", period: "Réforme Protestante (1550)", color: "#1E3A8A", initials: "JC" },
    "henry": { title: "Commentaire Biblique de Matthew Henry", author: "Matthew Henry", period: "Puritain / Dévotionnel (1706)", color: "#065F46", initials: "MH" },
    "matthew henry": { title: "Commentaire Biblique de Matthew Henry", author: "Matthew Henry", period: "Puritain / Dévotionnel (1706)", color: "#065F46", initials: "MH" },
    "barnes": { title: "Commentaire Biblique par Albert Barnes", author: "Albert Barnes", period: "Notes on the Bible (1834)", color: "#7C2D12", initials: "AB" },
    "albert barnes": { title: "Commentaire Biblique par Albert Barnes", author: "Albert Barnes", period: "Notes on the Bible (1834)", color: "#7C2D12", initials: "AB" },
    "trapp": { title: "Commentaire complet de John Trapp", author: "John Trapp", period: "Puritain Classique (1654)", color: "#4C1D95", initials: "JT" },
    "john trapp": { title: "Commentaire complet de John Trapp", author: "John Trapp", period: "Puritain Classique (1654)", color: "#4C1D95", initials: "JT" },
    "gill": { title: "Commentaire Biblique de John Gill", author: "John Gill", period: "Exposition of the Bible (1748)", color: "#134E4A", initials: "JG" },
    "john gill": { title: "Commentaire Biblique de John Gill", author: "John Gill", period: "Exposition of the Bible (1748)", color: "#134E4A", initials: "JG" },
    "clarke": { title: "Commentaire Biblique de Adam Clarke", author: "Adam Clarke", period: "Méthodiste & Historique (1810)", color: "#831843", initials: "AC" },
    "adam clarke": { title: "Commentaire Biblique de Adam Clarke", author: "Adam Clarke", period: "Méthodiste & Historique (1810)", color: "#831843", initials: "AC" },
    "scofield": { title: "Commentaire Biblique de Scofield", author: "C.I. Scofield", period: "Dispensationaliste (1909)", color: "#1F2937", initials: "CIS" },
    "pulpit": { title: "Commentaire Biblique de la chaire (Pulpit)", author: "H.D.M. Spence & J.S. Exell", period: "The Pulpit Commentary (1880)", color: "#312E81", initials: "PC" },
    "jfb": { title: "Commentaire critique et explicatif sur toute la Bible (JFB)", author: "Jamieson, Fausset & Brown", period: "Critical & Explanatory (1871)", color: "#374151", initials: "JFB" },
    "peake": { title: "Commentaire d'Arthur Peake sur la Bible", author: "Arthur S. Peake", period: "Critique & Historique (1919)", color: "#164E63", initials: "AP" },
    "arthur peake": { title: "Commentaire d'Arthur Peake sur la Bible", author: "Arthur S. Peake", period: "Critique & Historique (1919)", color: "#164E63", initials: "AP" },
    "coke": { title: "Commentaire de Coke sur la Sainte Bible", author: "Thomas Coke", period: "Commentary on the Holy Bible (1801)", color: "#701A75", initials: "TC" },
    "dummelow": { title: "Commentaire de Dummelow sur la Bible", author: "John R. Dummelow", period: "One Volume Commentary (1909)", color: "#0F766E", initials: "JD" },
    "meyer": { title: "Commentaire de Frederick Brotherton Meyer", author: "F.B. Meyer", period: "Dévotionnel & Pastoral (1914)", color: "#047857", initials: "FBM" },
    "f.b. meyer": { title: "Commentaire de Frederick Brotherton Meyer", author: "F.B. Meyer", period: "Dévotionnel & Pastoral (1914)", color: "#047857", initials: "FBM" },
    "benson": { title: "Commentaire de Joseph Benson (AT & NT)", author: "Joseph Benson", period: "Notes on the Old & New Testaments (1811)", color: "#854D0E", initials: "JB" },
    "joseph benson": { title: "Commentaire de Joseph Benson (AT & NT)", author: "Joseph Benson", period: "Notes on the Old & New Testaments (1811)", color: "#854D0E", initials: "JB" },
    "nicoll": { title: "Commentaire biblique de l'exposant (Nicoll)", author: "W. Robertson Nicoll", period: "The Expositor's Bible (1887)", color: "#1E40AF", initials: "WRN" },
    "gaebelein": { title: "Bible annotée par A.C. Gaebelein", author: "Arno C. Gaebelein", period: "The Annotated Bible (1913)", color: "#475569", initials: "ACG" },
    "a.c. gaebelein": { title: "Bible annotée par A.C. Gaebelein", author: "Arno C. Gaebelein", period: "The Annotated Bible (1913)", color: "#475569", initials: "ACG" },
    "geneve": { title: "Commentaire de la Bible d'étude de Genève (1560)", author: "Exégètes de Genève", period: "Geneva Bible Notes (1560)", color: "#334155", initials: "BG" },
    "bible du sermon": { title: "Commentaire de la Bible du sermon", author: "The Sermon Bible", period: "Homilétique & Exégèse (1888)", color: "#15803D", initials: "BS" },
    "sermon": { title: "Commentaire de la Bible du sermon", author: "The Sermon Bible", period: "Homilétique & Exégèse (1888)", color: "#15803D", initials: "BS" },
    "spurgeon": { title: "Commentaire Biblique de Charles Spurgeon", author: "Charles H. Spurgeon", period: "Trésor de David & Sermons (1870)", color: "#991B1B", initials: "CHS" },
    "charles spurgeon": { title: "Commentaire Biblique de Charles Spurgeon", author: "Charles H. Spurgeon", period: "Trésor de David & Sermons (1870)", color: "#991B1B", initials: "CHS" },
    "segond 21": { title: "Notes d'étude Segond 21", author: "Société Biblique de Genève", period: "Segond 21 (2007)", color: "#B91C1C", initials: "S21" },
    "notes d'étude segond 21": { title: "Notes d'étude Segond 21", author: "Société Biblique de Genève", period: "Segond 21 (2007)", color: "#B91C1C", initials: "S21" },
    "tsk": { title: "Trésor de la connaissance des Écritures (TSK)", author: "R.A. Torrey / TSK", period: "Treasury of Scripture Knowledge (1836)", color: "#4338CA", initials: "TSK" },
    "macarthur": { title: "The MacArthur Bible Commentary", author: "John MacArthur", period: "Études bibliques contemporaines", color: "#1E293B", initials: "JM" },
    "godet": { title: "Bible annotée (Frédéric Godet & Neuchâtel)", author: "Frédéric Godet et collaborateurs", period: "Bible Annotée de Neuchâtel (1899)", color: "#0D9488", initials: "BAG" },
    "frédéric godet": { title: "Bible annotée (Frédéric Godet & Neuchâtel)", author: "Frédéric Godet et collaborateurs", period: "Bible Annotée de Neuchâtel (1899)", color: "#0D9488", initials: "BAG" },
    "bible annotée (frédéric godet)": { title: "Bible annotée (Frédéric Godet & Neuchâtel)", author: "Frédéric Godet et collaborateurs", period: "Bible Annotée de Neuchâtel (1899)", color: "#0D9488", initials: "BAG" },
    "tgc": { title: "Commentaires The Gospel Coalition (TGC)", author: "The Gospel Coalition (Carson, Schreiner, Köstenberger, etc.)", period: "The Gospel Coalition Commentary (2021-2024)", color: "#9A3412", initials: "TGC" },
    "the gospel coalition": { title: "Commentaires The Gospel Coalition (TGC)", author: "The Gospel Coalition (Carson, Schreiner, Köstenberger, etc.)", period: "The Gospel Coalition Commentary (2021-2024)", color: "#9A3412", initials: "TGC" }
  },

  getSourceInfo(name) {
    if (!name) return { title: 'Commentaire Biblique', author: 'Auteur', period: 'Source d\'étude', color: '#1E293B', initials: 'BIB' };
    const clean = name.trim().toLowerCase().replace(/[\[\]]/g, '');
    if (this.commentaryCatalog[clean]) return this.commentaryCatalog[clean];
    for (const [k, v] of Object.entries(this.commentaryCatalog)) {
      if (clean.includes(k) || k.includes(clean)) return v;
    }
    const initials = name.split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 3).toUpperCase() || 'BIB';
    const trimmed = name.trim();
    const title = (trimmed.toLowerCase().startsWith('commentaire') || trimmed.toLowerCase().startsWith('notes') || trimmed.toLowerCase().startsWith('bible'))
      ? trimmed
      : `Commentaire de ${trimmed}`;
    return {
      title: title,
      author: name,
      period: "Ouvrage de référence",
      color: "#2563EB",
      initials: initials
    };
  },

  renderResult(data) {
    const resultBox = document.getElementById('synth-result-container');
    const modelTag = document.getElementById('synth-model-tag');
    const sourcesTag = document.getElementById('synth-sources-tag');
    const contentEl = document.getElementById('synth-markdown-content');

    if (!resultBox || !contentEl) return;

    if (modelTag) modelTag.textContent = data.model_used || 'IA';
    if (sourcesTag) sourcesTag.textContent = `${data.sources_count || 0} sources`;

    let renderedHtml = this.renderMarkdown(data.synthesis || '');
    if (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences) {
      renderedHtml = TheologyView.highlightScriptureReferences(renderedHtml);
    }
    contentEl.innerHTML = renderedHtml;
    resultBox.classList.remove('hidden');
    this.enterFullResultMode();
    this.attachCitationPopovers(contentEl);

    // Lier l'infobulle biblique interactive (ScriptureTooltip) & navigation
    if (typeof ScriptureTooltip !== 'undefined') {
      ScriptureTooltip.bindToElements(contentEl.querySelectorAll('.theol-inline-scripture-ref'));
    }
    contentEl.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = span.dataset.ref || span.textContent.trim();
        if (ref) {
          if (typeof ScriptureTooltip !== 'undefined') ScriptureTooltip.hide();
          if (typeof BibleReader !== 'undefined') BibleReader.searchPassage(ref);
        }
      });
    });
  },

  renderMarkdown(text) {
    if (!text) return '<p class="empty-hint">Aucun contenu généré.</p>';

    const svgIcon = `<svg class="synth-cite-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path></svg>`;

    let processed = text;

    // 1. Remplacer les balises explicites {sources: A, B}
    processed = processed.replace(/\{sources:\s*([^\}]+)\}/gi, (match, raw) => {
      const sources = raw.split(',').map(s => s.trim().replace(/[\[\]]/g, '')).filter(Boolean);
      const srcAttr = sources.join('|');
      return ` <span class="synth-cite-pill" data-sources="${srcAttr}" title="Consulter les sources">${svgIcon}<span class="synth-cite-count">${sources.length}</span></span>`;
    });

    // 2. Remplacer les groupes de citations entre parenthèses (**[Calvin]**, **[Pulpit]**) par le badge SVG
    processed = processed.replace(/\(\s*((\*{0,2}\[[^\]]+\]\*{0,2}(?:\s*,\s*|\s+et\s+)?)+)\s*\)/g, (match, groupContent) => {
      const matches = groupContent.match(/\[([^\]]+)\]/g);
      if (matches && matches.length > 0) {
        const sources = matches.map(m => m.replace(/[\[\]]/g, '').trim()).filter(Boolean);
        const srcAttr = sources.join('|');
        return ` <span class="synth-cite-pill" data-sources="${srcAttr}" title="Consulter les sources">${svgIcon}<span class="synth-cite-count">${sources.length}</span></span>`;
      }
      return match;
    });

    // 3. Supprimer systématiquement les crochets autour des auteurs isolés : **[Jean Calvin]** ou [Jean Calvin] -> **Jean Calvin**
    processed = processed.replace(/\*{0,2}\[([a-zA-Z0-9\.\'\s\(\)\-éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ]+)\]\*{0,2}/g, '**$1**');

    // 4. Rendu Markdown propre
    let html = processed
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/&lt;span class="synth-cite-pill" data-sources="([^"]+)" title="([^"]+)"&gt;&lt;svg class="synth-cite-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"&gt;&lt;path d="M4 19\.5v-15A2\.5 2\.5 0 0 1 6\.5 2H20v20H6\.5a2\.5 2\.5 0 0 1-2\.5-2\.5Z"&gt;&lt;\/path&gt;&lt;path d="M6 6h10"&gt;&lt;\/path&gt;&lt;path d="M6 10h10"&gt;&lt;\/path&gt;&lt;\/svg&gt;&lt;span class="synth-cite-count"&gt;(\d+)&lt;\/span&gt;&lt;\/span&gt;/g, 
        `<span class="synth-cite-pill" data-sources="$1" title="$2">${svgIcon}<span class="synth-cite-count">$3</span></span>`)
      .replace(/^### (.*$)/gim, '<h3 style="margin: 14px 0 6px 0; color: var(--accent-blue); font-size: 15px; font-weight: 700;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 18px 0 10px 0; color: var(--accent-blue); font-size: 17px; font-weight: 800; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 20px 0 12px 0; color: var(--accent-blue); font-size: 19px; font-weight: 800;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 12px; margin: 10px 0; background: var(--bg-subtle); color: var(--text-secondary); border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>')
      .replace(/^[\*\-] (.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 6px;">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 6px;">$1</li>')
      .replace(/\n\n/g, '<br><br>');

    return `<div class="rendered-synth">${html}</div>`;
  },

  attachCitationPopovers(container) {
    let popover = document.getElementById('synth-source-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'synth-source-popover';
      popover.className = 'synth-source-popover hidden';
      document.body.appendChild(popover);
    }

    let hideTimeout = null;

    const showPopover = (e, pill) => {
      clearTimeout(hideTimeout);
      const rawSources = pill.dataset.sources || '';
      const sourceList = rawSources.split('|').filter(Boolean);
      if (sourceList.length === 0) return;

      const cardsHtml = sourceList.map(s => {
        const info = this.getSourceInfo(s);
        return `
          <div class="synth-popover-source-item">
            <div class="synth-popover-cover" style="background: ${info.color};">
              <div class="synth-popover-cover-spine"></div>
              <div class="synth-popover-cover-title">${info.initials}</div>
              <div class="synth-popover-cover-author">${info.author.split(' ').pop()}</div>
            </div>
            <div class="synth-popover-info">
              <div class="synth-popover-title">${info.title}</div>
              <div class="synth-popover-author" style="display: flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg><span>${info.author} • <span class="synth-popover-period">${info.period}</span></span></div>
            </div>
          </div>
        `;
      }).join('');

      popover.innerHTML = `
        <div class="synth-popover-header">
          <span style="display: flex; align-items: center; gap: 5px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg><span>Ouvrages cités (${sourceList.length})</span></span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${cardsHtml}
        </div>
      `;

      popover.classList.remove('hidden');

      const rect = pill.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();
      let top = rect.bottom + 6;
      let left = Math.max(10, Math.min(window.innerWidth - (popRect.width || 280) - 10, rect.left - 10));

      if (top + (popRect.height || 150) > window.innerHeight - 10) {
        top = Math.max(10, rect.top - (popRect.height || 150) - 6);
      }

      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
    };

    const scheduleHide = () => {
      hideTimeout = setTimeout(() => {
        popover.classList.add('hidden');
      }, 250);
    };

    popover.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    popover.addEventListener('mouseleave', scheduleHide);

    container.querySelectorAll('.synth-cite-pill').forEach(pill => {
      pill.addEventListener('mouseenter', (e) => showPopover(e, pill));
      pill.addEventListener('mouseleave', scheduleHide);
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        showPopover(e, pill);
      });
    });
  },

  copyToClipboard() {
    if (!this.latestSynthesisMarkdown) return;
    navigator.clipboard.writeText(this.latestSynthesisMarkdown).then(() => {
      const btn = document.getElementById('btn-copy-synth');
      if (btn) {
        btn.textContent = 'Copié !';
        setTimeout(() => btn.textContent = 'Copier', 2000);
      }
      App.showToast('Synthèse copiée dans le presse-papier !');
    });
  },

  async exportToNote() {
    if (!this.latestSynthesisMarkdown) return;
    const info = getBookInfo(this.currentBook);
    const span = (this.verseEnd - this.verseStart + 1);
    const refStr = span === 1
      ? `${info.name} ${this.currentChapter}:${this.verseStart}`
      : `${info.name} ${this.currentChapter}:${this.verseStart}-${this.verseEnd}`;

    const title = `Synthèse Exégétique — ${refStr}`;
    const content = `# ${title}\n\n*Date : ${new Date().toLocaleDateString('fr-FR')}*\n\n${this.latestSynthesisMarkdown}`;

    const notePayload = {
      title: title,
      content: content,
      reference: refStr,
      tags: ['exégèse', 'synthèse-ia', info.name.toLowerCase()]
    };

    try {
      const res = await API.call('save_note', notePayload);
      if (res && (res.success || res.id || res.filename)) {
        App.showToast('Synthèse enregistrée dans vos Notes d\'étude !');
        if (typeof NotesView !== 'undefined' && NotesView.renderList) {
          NotesView.renderList();
        }
        if (typeof DrawerNotesViewer !== 'undefined' && DrawerNotesViewer.loadNotesForCurrentContext) {
          DrawerNotesViewer.loadNotesForCurrentContext();
        }
      } else {
        App.showError('Erreur Note', res?.error || 'Impossible d\'enregistrer la note.');
      }
    } catch (e) {
      console.error('Erreur export note:', e);
      App.showError('Erreur Note', String(e));
    }
  }
};


// 4ter. GESTIONNAIRE DES INFOBULLES RICHES DE PASSAGES GÉOGRAPHIQUES
const GeoPassageHoverManager = {
  popoverEl: null,
  hideTimeout: null,
  clustersCache: {},

  init() {
    if (!this.popoverEl) {
      this.popoverEl = document.getElementById('geo-passage-hover-popover');
      if (!this.popoverEl) {
        this.popoverEl = document.createElement('div');
        this.popoverEl.id = 'geo-passage-hover-popover';
        this.popoverEl.className = 'geo-passage-hover-popover hidden';
        document.body.appendChild(this.popoverEl);
      }

      this.popoverEl.addEventListener('mouseenter', () => clearTimeout(this.hideTimeout));
      this.popoverEl.addEventListener('mouseleave', () => this.scheduleHide());
    }
  },

  registerCluster(cluster) {
    this.clustersCache[cluster.id] = cluster;
  },

  scheduleHide() {
    this.hideTimeout = setTimeout(() => {
      if (this.popoverEl) this.popoverEl.classList.add('hidden');
      document.querySelectorAll('.verse-item.geo-passage-highlighted').forEach(el => {
        el.classList.remove('geo-passage-highlighted');
      });
    }, 220);
  },

  showForCluster(btnEl, clusterId) {
    clearTimeout(this.hideTimeout);
    this.init();
    const cluster = this.clustersCache[clusterId];
    if (!cluster || !this.popoverEl) return;

    // 1. Surbrillance de tous les versets de la plage dans le texte
    const workspace = document.getElementById('reader-workspace');
    if (workspace) {
      workspace.querySelectorAll('.verse-item.geo-passage-highlighted').forEach(el => {
        el.classList.remove('geo-passage-highlighted');
      });
      workspace.querySelectorAll(`.verse-item[data-geo-cluster-id="${clusterId}"]`).forEach(el => {
        el.classList.add('geo-passage-highlighted');
      });
    }

    // 2. Préparer le contenu de la popover
    const bInfo = getBookInfo(cluster.book);
    const rangeText = cluster.startVerse === cluster.endVerse 
      ? `${bInfo.name} ${cluster.chapter}:${cluster.startVerse}`
      : `${bInfo.name} ${cluster.chapter}:${cluster.startVerse}–${cluster.endVerse}`;

    const clean = (s) => (s ? String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim() : '');
    const placesHtml = cluster.places.map(p => {
      const typeLabel = (typeof MapsView !== 'undefined' && MapsView.getTypeLabel) ? MapsView.getTypeLabel(p.place_type) : (p.place_type || 'Lieu');
      const badgeClass = `badge-type-${p.place_type || 'city'}`;
      const nameFr = clean(p.name_fr);
      const ancName = clean(p.ancient_name);
      const modName = clean(p.modern_name);
      const comment = clean(p.comment);

      return `
        <div class="geo-pop-place-row" data-place-id="${p.place_id}">
          <div class="geo-pop-place-head">
            <span class="geo-pop-place-name">${nameFr}</span>
            <span class="geo-pop-place-type ${badgeClass}">${typeLabel}</span>
          </div>
          ${ancName || modName ? `<div class="geo-pop-place-sub">${ancName ? `Antique : ${ancName}` : ''}${ancName && modName ? ' • ' : ''}${modName ? `Moderne : ${modName}` : ''}</div>` : ''}
          ${comment ? `<div class="geo-pop-place-desc">${comment}</div>` : ''}
        </div>
      `;
    }).join('');

    this.popoverEl.innerHTML = `
      <div class="geo-pop-header">
        <div class="geo-pop-header-title">
          <svg class="geo-pop-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"></path>
            <path d="M9 3v15"></path>
            <path d="M15 6v15"></path>
          </svg>
          <span>${rangeText}</span>
        </div>
        <span class="geo-pop-count-badge">${cluster.places.length} lieu${cluster.places.length > 1 ? 'x' : ''}</span>
      </div>
      <div class="geo-pop-places-list">
        ${placesHtml}
      </div>
      <div class="geo-pop-footer">
        <button type="button" class="geo-pop-action-btn" id="btn-geo-pop-open-map">
          <span>Explorer sur la carte interactive →</span>
        </button>
      </div>
    `;

    // Événements de clic sur chaque lieu ou sur le bouton footer
    this.popoverEl.querySelectorAll('.geo-pop-place-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = row.dataset.placeId;
        this.navigateToMap(pId, cluster.book, cluster.chapter);
      });
    });

    this.popoverEl.querySelector('#btn-geo-pop-open-map')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const firstId = cluster.places[0]?.place_id;
      this.navigateToMap(firstId, cluster.book, cluster.chapter);
    });

    // 3. Positionnement intelligent à côté du bouton de marge
    this.popoverEl.classList.remove('hidden');
    const rect = btnEl.getBoundingClientRect();
    const popRect = this.popoverEl.getBoundingClientRect();
    const popWidth = popRect.width || 350;
    const popHeight = popRect.height || 220;

    let left = rect.left - popWidth - 12;
    if (left < 10) {
      left = rect.right + 12;
    }
    let top = rect.top - 10;
    if (top + popHeight > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - popHeight - 10);
    }

    this.popoverEl.style.top = `${top}px`;
    this.popoverEl.style.left = `${left}px`;
  },

  navigateToMap(placeId, bookCode, chapter) {
    if (this.popoverEl) this.popoverEl.classList.add('hidden');
    if (typeof MapsView !== 'undefined') {
      App.switchView('maps');
      document.querySelectorAll('.sidebar-menu .nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-maps')?.classList.add('active');
      MapsView.onViewActivated();
      if (placeId) {
        MapsView.showPlaceDetailsById(placeId);
      } else {
        MapsView.showChapterPlaces(bookCode, chapter);
      }
    }
  }
};


// 4. GESTIONNAIRE D'INFOBULLES POUR LES NOTES DE TRADUCTION & VARIANTES
const NOTE_PREFIX_REGEX = /^\(\s*(?:Ou\b|H[ée]b\.|Heb\.|Grec\b|Litt\.|Aram\.|C\.-à-d\.|C'est-à-dire\b|Voy\.|Voir\b|Autre lecture\b|Ms\.|LXX\b|Vulgate\b|Vulg\.|Syriaque\b|Syr\.|Targum\b|Samaritain\b|Chald\.|Selon d'autres\b|En hébreu\b|En grec\b|Trad\. litt\.|Var\.)/i;

const TranslationNoteHoverManager = {
  popoverEl: null,
  hideTimeout: null,

  init() {
    if (!this.popoverEl) {
      this.popoverEl = document.getElementById('translation-note-hover-popover');
      if (!this.popoverEl) {
        this.popoverEl = document.createElement('div');
        this.popoverEl.id = 'translation-note-hover-popover';
        this.popoverEl.className = 'translation-note-hover-popover hidden';
        document.body.appendChild(this.popoverEl);
      }

      this.popoverEl.addEventListener('mouseenter', () => clearTimeout(this.hideTimeout));
      this.popoverEl.addEventListener('mouseleave', () => this.scheduleHide());
    }
  },

  scheduleHide() {
    this.hideTimeout = setTimeout(() => {
      if (this.popoverEl) this.popoverEl.classList.add('hidden');
    }, 180);
  },

  show(targetEl, noteText, verseNum = null) {
    clearTimeout(this.hideTimeout);
    this.init();
    if (!this.popoverEl || !noteText) return;

    let cleanNote = noteText.replace(/^\(|\)$/g, '').trim();
    let badgeType = 'Variante / Traduction';
    if (/^H[ée]b\./i.test(cleanNote)) badgeType = 'Hébreu (Texte Massorétique)';
    else if (/^Grec/i.test(cleanNote)) badgeType = 'Grec (Septante / Receptus)';
    else if (/^Litt\./i.test(cleanNote)) badgeType = 'Traduction littérale';
    else if (/^Ou\b/i.test(cleanNote)) badgeType = 'Traduction alternative';
    else if (/^C\.-à-d\.|^C'est-à-dire/i.test(cleanNote)) badgeType = 'Explication textuelle';

    this.popoverEl.innerHTML = `
      <div class="note-tooltip-header">
        <span class="note-tooltip-badge">${badgeType}</span>
        ${verseNum ? `<span class="note-tooltip-ref">Verset ${verseNum}</span>` : ''}
      </div>
      <div class="note-tooltip-body">
        « ${cleanNote} »
      </div>
    `;

    this.popoverEl.classList.remove('hidden');

    const rect = targetEl.getBoundingClientRect();
    const popRect = this.popoverEl.getBoundingClientRect();
    const popWidth = popRect.width || 280;
    const popHeight = popRect.height || 75;

    let top = rect.top - popHeight - 8;
    let left = rect.left + (rect.width / 2) - (popWidth / 2);

    if (top < 10) {
      top = rect.bottom + 8;
    }
    if (left < 10) left = 10;
    if (left + popWidth > window.innerWidth - 10) {
      left = window.innerWidth - popWidth - 10;
    }

    this.popoverEl.style.top = `${top}px`;
    this.popoverEl.style.left = `${left}px`;
  }
};


// 4bis. GESTIONNAIRE DE NOTES DU VOLET DROIT (Bible à gauche, Notes à droite)
const DrawerNotesViewer = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentVerse: null,
  currentNotes: [],
  editingNoteId: null,

  init() {
    // Bouton + Note en haut de l'onglet
    document.getElementById('btn-drawer-new-note')?.addEventListener('click', () => {
      this.openComposer();
    });

    // Bouton Plein écran
    document.getElementById('btn-drawer-full-notes')?.addEventListener('click', () => {
      App.switchView('notes');
      const bInfo = getBookInfo(this.currentBook);
      const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;
      NotesView.createNewNote(refStr);
    });

    // Enregistrer note rapide
    document.getElementById('btn-drawer-save-note')?.addEventListener('click', () => {
      this.saveQuickNote();
    });
  },

  async load(bookCode, chapterNum, verseNum = null) {
    this.currentBook = bookCode || BibleReader.currentBook || 'Gen';
    this.currentChapter = chapterNum || BibleReader.currentChapter || 1;
    this.currentVerse = verseNum || BibleReader.selectedVerse || null;

    const bInfo = getBookInfo(this.currentBook);
    const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;

    const badgeEl = document.getElementById('notes-drawer-passage-badge');
    const composerRefEl = document.getElementById('drawer-composer-ref');
    if (badgeEl) badgeEl.textContent = refStr;
    if (composerRefEl) composerRefEl.textContent = refStr;

    const listEl = document.getElementById('drawer-notes-list');
    if (listEl) {
      listEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 12px; text-align: center;">Chargement des notes...</div>`;
    }

    try {
      this.currentNotes = await API.call('get_notes_for_passage', this.currentBook, this.currentChapter, this.currentVerse) || [];
      this.renderList();
    } catch (e) {
      console.error('Erreur chargement notes volet droit:', e);
      if (listEl) listEl.innerHTML = `<div style="color: var(--accent-red); font-size: 12px; padding: 10px;">Erreur chargement notes.</div>`;
    }
  },

  renderList() {
    const listEl = document.getElementById('drawer-notes-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.currentNotes.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 16px 12px; text-align: center; color: var(--text-muted); font-size: 12px; background: var(--bg-subtle); border-radius: 6px; border: 1px dashed var(--border-color);">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 6px auto; opacity: 0.6;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          Aucune note pour ce passage.<br>
          <span style="font-size: 11px;">Rédigez une réflexion ci-dessous.</span>
        </div>
      `;
      return;
    }

    const isGlobalAiEnabled = SettingsView?.config?.include_notes_in_ai !== false;

    this.currentNotes.forEach((n) => {
      const card = document.createElement('div');
      card.className = 'drawer-note-card';
      card.style.cssText = 'background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer;';
      
      let aiBadge = '';
      if (isGlobalAiEnabled) {
        aiBadge = n.include_in_ai !== false 
          ? '<span title="Prise en compte par l\'IA" style="display:inline-flex; align-items:center; gap:3px; font-size: 11px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>IA</span>' 
          : '<span title="Non transmise à l\'IA" style="display:inline-flex; align-items:center; gap:3px; font-size: 10px; color: var(--text-muted);"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Privée</span>';
      }
      
      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 13px; color: var(--text-primary);">${n.title || 'Note sans titre'}</strong>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span style="font-size: 10px; font-weight: 600; color: var(--accent-blue); background: var(--bg-hover); padding: 2px 6px; border-radius: 4px;">${n.reference || ''}</span>
            ${aiBadge}
          </div>
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; max-height: 60px; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">
          ${(n.content || '').replace(/#+\s/g, '').slice(0, 140)}...
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted);">
          <span>Modifié : ${n.updated_at || ''}</span>
          <div style="display: flex; gap: 8px;">
            <button class="btn-link btn-open-full" style="color: var(--accent-blue); font-size: 11px; background: none; border: none; cursor: pointer; text-decoration: underline;">Ouvrir ↗</button>
            <button class="btn-link btn-del-drawer" style="color: var(--accent-red); font-size: 11px; background: none; border: none; cursor: pointer; display: flex; align-items: center;" title="Supprimer"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
          </div>
        </div>
      `;

      card.querySelector('.btn-open-full')?.addEventListener('click', (e) => {
        e.stopPropagation();
        App.switchView('notes');
        NotesView.selectNote(n);
      });

      card.querySelector('.btn-del-drawer')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        let confirmed = false;
        if (typeof App !== 'undefined' && App.showConfirmModal) {
          confirmed = await App.showConfirmModal({
            title: "Supprimer la note",
            message: `Voulez-vous supprimer définitivement la note « ${n.title || 'Sans titre'} » ?`,
            confirmText: "Supprimer",
            cancelText: "Annuler",
            danger: true,
            icon: "trash"
          });
        } else {
          confirmed = confirm(`Supprimer la note « ${n.title} » ?`);
        }

        if (confirmed) {
          await API.call('delete_note', n.id);
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Note supprimée');
          }
          this.load(this.currentBook, this.currentChapter, this.currentVerse);
          if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
            NotesView.loadNotes();
          }
        }
      });

      card.addEventListener('click', () => {
        this.populateComposerWithNote(n);
      });

      listEl.appendChild(card);
    });
  },

  openComposer(initialTitle = '', initialContent = '') {
    const titleInp = document.getElementById('drawer-note-title-input');
    const contentInp = document.getElementById('drawer-note-content-input');
    const bInfo = getBookInfo(this.currentBook);
    const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;
    
    this.editingNoteId = null;
    const titleHeader = document.getElementById('drawer-composer-title');
    if (titleHeader) titleHeader.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg><span>Rédiger une note</span>';

    const isGlobalAiEnabled = SettingsView?.config?.include_notes_in_ai !== false;
    const drawerAiLabel = document.getElementById('drawer-note-ai-toggle-label');
    if (drawerAiLabel) {
      drawerAiLabel.style.display = isGlobalAiEnabled ? 'flex' : 'none';
    }

    if (titleInp) {
      titleInp.value = initialTitle || `Note sur ${refStr}`;
      titleInp.focus();
    }
    if (contentInp) contentInp.value = initialContent || '';
  },

  populateComposerWithNote(note) {
    const titleInp = document.getElementById('drawer-note-title-input');
    const contentInp = document.getElementById('drawer-note-content-input');
    const aiToggle = document.getElementById('drawer-note-ai-toggle');
    const titleHeader = document.getElementById('drawer-composer-title');

    const isGlobalAiEnabled = SettingsView?.config?.include_notes_in_ai !== false;
    const drawerAiLabel = document.getElementById('drawer-note-ai-toggle-label');
    if (drawerAiLabel) {
      drawerAiLabel.style.display = isGlobalAiEnabled ? 'flex' : 'none';
    }

    if (titleInp) titleInp.value = note.title || '';
    if (contentInp) contentInp.value = note.content || '';
    if (aiToggle) aiToggle.checked = note.include_in_ai !== false;
    if (titleHeader) titleHeader.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Modifier la note</span>';
    this.editingNoteId = note.id;
  },

  async saveQuickNote() {
    const titleInp = document.getElementById('drawer-note-title-input');
    const contentInp = document.getElementById('drawer-note-content-input');
    const aiToggle = document.getElementById('drawer-note-ai-toggle');

    const bInfo = getBookInfo(this.currentBook);
    const refStr = `${bInfo.name} ${this.currentChapter}${this.currentVerse ? `:${this.currentVerse}` : ''}`;

    const noteToSave = {
      id: this.editingNoteId || null,
      title: titleInp?.value.trim() || `Note sur ${refStr}`,
      reference: refStr,
      tags: '',
      include_in_ai: aiToggle?.checked !== false,
      content: contentInp?.value || ''
    };

    try {
      await API.call('save_note', noteToSave);
      App.showToast('Note enregistrée en Markdown (.md) !');
      this.editingNoteId = null;
      if (titleInp) titleInp.value = '';
      if (contentInp) contentInp.value = '';
      const titleHeader = document.getElementById('drawer-composer-title');
      if (titleHeader) titleHeader.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg><span>Rédiger une note</span>';
      
      this.load(this.currentBook, this.currentChapter, this.currentVerse);
      NotesView.loadNotes();
    } catch (e) {
      alert(`Erreur sauvegarde note : ${e}`);
    }
  }
};


// 5. MENU CONTEXTUEL FLOTTANT (Clic droit & Double-clic)
const ContextMenuManager = {
  menuEl: null,

  init() {
    this.menuEl = document.getElementById('bible-context-menu');
    document.getElementById('btn-close-context-menu').addEventListener('click', () => {
      this.hide();
    });

    document.addEventListener('click', (e) => {
      if (this.menuEl && !this.menuEl.contains(e.target)) {
        this.hide();
      }
    });
  },

  hide() {
    if (this.menuEl) this.menuEl.classList.add('hidden');
  },

  positionMenu(clientX, clientY) {
    this.menuEl.classList.remove('hidden');
    const width = 320;
    const height = this.menuEl.offsetHeight || 250;
    
    let left = clientX;
    let top = clientY;

    if (left + width > window.innerWidth - 20) {
      left = window.innerWidth - width - 20;
    }
    if (top + height > window.innerHeight - 20) {
      top = window.innerHeight - height - 20;
    }

    this.menuEl.style.left = `${Math.max(10, left)}px`;
    this.menuEl.style.top = `${Math.max(10, top)}px`;
  },

  async showForWord(word, strongCode, verseNum, bookCode, chapterNum, clientX, clientY) {
    const cleanWord = (word || '').trim();
    if (!cleanWord) return;

    const headerTitle = document.getElementById('context-header-title');
    const headerBadge = document.getElementById('context-header-badge');
    const previewEl = document.getElementById('context-menu-preview');
    const actionsEl = document.getElementById('context-menu-actions');

    headerTitle.textContent = cleanWord;
    headerBadge.textContent = strongCode || 'Recherche lexicale';
    previewEl.innerHTML = `<em>Chargement de la définition lexicale...</em>`;

    this.positionMenu(clientX, clientY);

    // Charger aperçu lexical
    let dictEntry = null;
    try {
      dictEntry = await API.call('lookup_dictionary', cleanWord, strongCode);
      if (dictEntry) {
        headerBadge.textContent = dictEntry.badge || strongCode || 'Lexique';
        const snippet = dictEntry.full_text ? dictEntry.full_text.slice(0, 180) + '...' : '';
        previewEl.innerHTML = `<strong>${dictEntry.title}</strong><br>${snippet}`;
      } else {
        previewEl.innerHTML = `Terme biblique — Cliquez pour rechercher dans les dictionnaires.`;
      }
    } catch (e) {
      previewEl.innerHTML = ``;
    }

    const bInfo = getBookInfo(bookCode);
    const refStr = `${bInfo.name} ${chapterNum}:${verseNum}`;

    actionsEl.innerHTML = `
      <button class="context-action-btn" id="ctx-act-lexicon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
        <span>Voir la définition complète dans le Lexique</span>
      </button>
      <button class="context-action-btn" id="ctx-act-search">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Rechercher toutes les occurrences de « ${cleanWord} »</span>
      </button>
      <button class="context-action-btn" id="ctx-act-ai">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
        <span>Étudier le mot avec l'Assistant IA</span>
      </button>
      <button class="context-action-btn" id="ctx-act-copy">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span>Copier le mot</span>
      </button>
    `;

    document.getElementById('ctx-act-lexicon').addEventListener('click', () => {
      this.hide();
      BibleReader.lookupWordInLexicon(cleanWord, strongCode);
    });

    document.getElementById('ctx-act-search').addEventListener('click', () => {
      this.hide();
      App.switchView('search');
      const sInput = document.getElementById('search-main-input');
      if (sInput) {
        sInput.value = cleanWord;
        SearchView.executeSearch();
      }
    });

    document.getElementById('ctx-act-ai').addEventListener('click', () => {
      this.hide();
      App.switchView('ai');
      const aiInput = document.getElementById('ai-study-input');
      const passRef = document.getElementById('ai-passage-ref');
      if (passRef) passRef.value = refStr;
      if (aiInput) {
        aiInput.value = `Fais une analyse lexicale, théologique et contextuelle approfondie du terme « ${cleanWord} » dans le passage de ${refStr}.`;
        aiInput.focus();
      }
    });

    document.getElementById('ctx-act-copy').addEventListener('click', () => {
      this.hide();
      navigator.clipboard.writeText(cleanWord);
      App.showToast(`« ${cleanWord} » copié dans le presse-papier !`);
    });
  },

  showForVerse(verseNum, verseText, bookCode, chapterNum, clientX, clientY) {
    const bInfo = getBookInfo(bookCode);
    const refStr = `${bInfo.name} ${chapterNum}:${verseNum}`;

    const headerTitle = document.getElementById('context-header-title');
    const headerBadge = document.getElementById('context-header-badge');
    const previewEl = document.getElementById('context-menu-preview');
    const actionsEl = document.getElementById('context-menu-actions');

    headerTitle.textContent = refStr;
    headerBadge.textContent = BibleReader.getBibleDisplayName(BibleReader.currentBible1);
    previewEl.innerHTML = `« ${verseText} »`;

    this.positionMenu(clientX, clientY);

    actionsEl.innerHTML = `
      <div class="scm-highlight-row" style="padding: 6px 12px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; text-transform: uppercase;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          Surligner :
        </span>
        <div style="display: flex; gap: 5px; align-items: center;">
          <button type="button" class="ctx-hl-btn hl-bg-yellow" data-color="yellow" title="Jaune Solaire" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); cursor: pointer;"></button>
          <button type="button" class="ctx-hl-btn hl-bg-green" data-color="green" title="Vert Sauge" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); cursor: pointer;"></button>
          <button type="button" class="ctx-hl-btn hl-bg-blue" data-color="blue" title="Bleu Céleste" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); cursor: pointer;"></button>
          <button type="button" class="ctx-hl-btn hl-bg-amber" data-color="amber" title="Ambre Doré" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); cursor: pointer;"></button>
          <button type="button" class="ctx-hl-btn hl-bg-purple" data-color="purple" title="Lavande Douce" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); cursor: pointer;"></button>
          <button type="button" class="ctx-hl-btn hl-bg-rose" data-color="rose" title="Rose Corail" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); cursor: pointer;"></button>
          <button type="button" class="ctx-hl-btn ctx-hl-erase" data-color="erase" title="Effacer le surlignage" style="width: 20px; height: 20px; border-radius: 50%; border: 1px dashed var(--border-color); background: none; color: var(--text-muted); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
        </div>
      </div>
      <button class="context-action-btn" id="ctx-act-v-comm">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Ouvrir les commentaires exégétiques</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-ai">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
        <span>Étudier ce verset avec l'Assistant IA</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-note">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        <span>Créer une note sur ce verset</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-split">
        <span style="font-size: 13px;">⇄</span>
        <span>Comparer dans une 2e version</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-copy">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span>Copier le verset avec la référence</span>
      </button>
      <button class="context-action-btn" id="ctx-act-v-erase-hl" style="color: var(--accent-red);">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        <span>Supprimer le surlignage</span>
      </button>
    `;

    document.getElementById('ctx-act-v-erase-hl')?.addEventListener('click', async () => {
      this.hide();
      if (typeof HighlighterManager !== 'undefined') {
        HighlighterManager.currentSelectionRef = {
          book: bookCode,
          chapter: parseInt(chapterNum, 10),
          verseStart: parseInt(verseNum, 10),
          verseEnd: parseInt(verseNum, 10),
          text: verseText
        };
        await HighlighterManager.eraseHighlight();
      }
    });

    actionsEl.querySelectorAll('.ctx-hl-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const color = btn.dataset.color;
        this.hide();
        if (typeof HighlighterManager !== 'undefined') {
          if (color === 'erase') {
            HighlighterManager.currentSelectionRef = {
              book: bookCode,
              chapter: parseInt(chapterNum, 10),
              verseStart: parseInt(verseNum, 10),
              verseEnd: parseInt(verseNum, 10),
              text: verseText
            };
            await HighlighterManager.eraseHighlight();
          } else {
            HighlighterManager.currentSelectionRef = {
              book: bookCode,
              chapter: parseInt(chapterNum, 10),
              verseStart: parseInt(verseNum, 10),
              verseEnd: parseInt(verseNum, 10),
              text: verseText
            };
            await HighlighterManager.applyHighlight(color, HighlighterManager.activeStyle || 'felt');
          }
        }
      });
    });

    document.getElementById('ctx-act-v-comm').addEventListener('click', () => {
      this.hide();
      const drawer = document.getElementById('right-drawer');
      drawer.classList.remove('collapsed');
      document.getElementById('btn-toggle-right-drawer')?.classList.add('active');
      if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
      document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
      BibleReader.loadCommentariesForVerse(verseNum, bookCode, chapterNum);
    });

    document.getElementById('ctx-act-v-ai').addEventListener('click', () => {
      this.hide();
      App.switchView('ai');
      const passRef = document.getElementById('ai-passage-ref');
      const aiInput = document.getElementById('ai-study-input');
      if (passRef) passRef.value = refStr;
      if (aiInput) {
        aiInput.value = `Donne-moi une analyse exégétique et théologique détaillée du verset ${refStr} : « ${verseText} »`;
        aiInput.focus();
      }
    });

    document.getElementById('ctx-act-v-note').addEventListener('click', () => {
      this.hide();
      const drawer = document.getElementById('right-drawer');
      drawer?.classList.remove('collapsed');
      document.getElementById('btn-toggle-right-drawer')?.classList.add('active');
      if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
      document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
      DrawerNotesViewer.load(bookCode, chapterNum, verseNum);
      DrawerNotesViewer.openComposer(`Note sur ${refStr}`, '');
    });

    document.getElementById('ctx-act-v-split').addEventListener('click', () => {
      this.hide();
      BibleReader.toggleSplitView(true);
    });

    document.getElementById('ctx-act-v-copy').addEventListener('click', () => {
      this.hide();
      navigator.clipboard.writeText(`${refStr} (${BibleReader.currentBible1}) — ${verseText}`);
      App.showToast(`Verset ${refStr} copié !`);
    });
  }
};


// 6. GESTIONNAIRE DU LEXIQUE STRONG, DICTIONNAIRES & WIKIPÉDIA (Style Logos)
const LexiconViewer = {
  currentTerm: '',
  currentStrong: null,
  currentMatches: [],
  activeSourceIndex: 0,

  getPassageKeywords(book, chapter) {
    const b = (book || (typeof BibleReader !== 'undefined' && BibleReader.currentBook) || 'GEN').toUpperCase();
    const ch = parseInt(chapter || (typeof BibleReader !== 'undefined' && BibleReader.currentChapter) || 1, 10);

    const KEYWORD_MAP = {
      'GEN_1': [
        { word: 'Créer', root: 'Bara', strong: 'H1254' },
        { word: 'Dieu', root: 'Elohim', strong: 'H0430' },
        { word: 'Lumière', root: '’Or', strong: 'H0216' },
        { word: 'Commencement', root: 'Reshit', strong: 'H7225' }
      ],
      'GEN_2': [
        { word: 'Former', root: 'Yatsar', strong: 'H3335' },
        { word: 'Souffle de vie', root: 'Nishmat khayyim', strong: 'H5397' },
        { word: 'Éden', root: '’Eden', strong: 'H5731' }
      ],
      'GEN_3': [
        { word: 'Serpent', root: 'Nakhash', strong: 'H5175' },
        { word: 'Arbre', root: 'ʿEts', strong: 'H6086' },
        { word: 'Mourir', root: 'Mout', strong: 'H4191' },
        { word: 'Ouvrir les yeux', root: 'Paqakh', strong: 'H6491' }
      ],
      'EXO_3': [
        { word: 'L’Éternel (YHWH)', root: 'Yahweh', strong: 'H3068' },
        { word: 'Buisson ardent', root: 'Seneh', strong: 'H5572' },
        { word: 'Saint', root: 'Qadosh', strong: 'H6918' }
      ],
      'EXO_34': [
        { word: 'Amour loyal', root: 'Ḥessed', strong: 'H2617' },
        { word: 'Compassion', root: 'Raḥoum', strong: 'H7349' },
        { word: 'Fidélité', root: '’Emeth', strong: 'H0571' }
      ],
      'DEU_6': [
        { word: 'Écouter', root: 'Shemaʿ', strong: 'H8085' },
        { word: 'Aimer', root: '’Ahav', strong: 'H0157' },
        { word: 'Cœur', root: 'Lev', strong: 'H3820' },
        { word: 'Force', root: 'Me’od', strong: 'H3966' }
      ],
      'PSA_23': [
        { word: 'Berger', root: 'Roʿeh', strong: 'H7462' },
        { word: 'Âme / Être', root: 'Nephesh', strong: 'H5315' },
        { word: 'Grâce / Bonté', root: 'Ḥessed', strong: 'H2617' }
      ],
      'PSA_51': [
        { word: 'Pitié / Grâce', root: 'Khanam', strong: 'H2603' },
        { word: 'Péché', root: 'Khatta’ah', strong: 'H2403' },
        { word: 'Cœur pur', root: 'Lev tahor', strong: 'H2889' }
      ],
      'ISA_53': [
        { word: 'Serviteur', root: 'ʿEved', strong: 'H5650' },
        { word: 'Transpercé', root: 'Khalal', strong: 'H2490' },
        { word: 'Iniquité', root: 'ʿAvon', strong: 'H5771' },
        { word: 'Paix', root: 'Shalom', strong: 'H7965' }
      ],
      'MAT_5': [
        { word: 'Heureux', root: 'Makarios', strong: 'G3107' },
        { word: 'Royaume', root: 'Basileia', strong: 'G0932' },
        { word: 'Artisans de paix', root: 'Eirēnopoios', strong: 'G1518' }
      ],
      'MAT_6': [
        { word: 'Père céleste', root: 'Patēr', strong: 'G3962' },
        { word: 'Pardonner', root: 'Aphiēmi', strong: 'G0863' },
        { word: 'Trésor', root: 'Thēsauros', strong: 'G2344' }
      ],
      'JHN_1': [
        { word: 'La Parole', root: 'Logos', strong: 'G3056' },
        { word: 'Lumière', root: 'Phōs', strong: 'G5457' },
        { word: 'Grâce et vérité', root: 'Charis kai alētheia', strong: 'G5485' }
      ],
      'JHN_3': [
        { word: 'Naître d’en haut', root: 'Anōthen', strong: 'G0509' },
        { word: 'Amour divin', root: 'Agapē', strong: 'G0026' },
        { word: 'Vie éternelle', root: 'Zōē aiōnios', strong: 'G2222' }
      ],
      'ROM_3': [
        { word: 'Justification', root: 'Dikaiosunē', strong: 'G1343' },
        { word: 'Foi', root: 'Pistis', strong: 'G4102' },
        { word: 'Rédemption', root: 'Apolutrōsis', strong: 'G0629' }
      ],
      'ROM_8': [
        { word: 'Esprit Saint', root: 'Pneuma', strong: 'G4151' },
        { word: 'Espérance', root: 'Elpis', strong: 'G1680' },
        { word: 'Amour inébranlable', root: 'Agapē', strong: 'G0026' }
      ],
      '1CO_13': [
        { word: 'Amour agapé', root: 'Agapē', strong: 'G0026' },
        { word: 'Patience', root: 'Makrothumia', strong: 'G3115' },
        { word: 'Bienveillance', root: 'Chrēstotēs', strong: 'G5544' }
      ],
      '1CO_15': [
        { word: 'Résurrection', root: 'Anastasis', strong: 'G0386' },
        { word: 'Évangile', root: 'Euangelion', strong: 'G2098' },
        { word: 'Victoire', root: 'Nikos', strong: 'G3534' }
      ],
      'GAL_5': [
        { word: 'Fruit de l’Esprit', root: 'Karpos', strong: 'G2590' },
        { word: 'Liberté', root: 'Eleutheria', strong: 'G1657' },
        { word: 'Paix & Joie', root: 'Eirēnē kai Chara', strong: 'G1515' }
      ],
      'EPH_2': [
        { word: 'Grâce offerte', root: 'Charis', strong: 'G5485' },
        { word: 'Rapprochement', root: 'Engus', strong: 'G1451' },
        { word: 'Paix du Christ', root: 'Eirēnē', strong: 'G1515' }
      ],
      'REV_21': [
        { word: 'Toutes choses nouvelles', root: 'Kainos', strong: 'G2537' },
        { word: 'Tabernacle', root: 'Skēnē', strong: 'G4633' },
        { word: 'Plus de mort', root: 'Thanatos', strong: 'G2288' }
      ]
    };

    const key = `${b}_${ch}`;
    if (KEYWORD_MAP[key]) {
      return KEYWORD_MAP[key];
    }

    const isNT = ['MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'].includes(b);

    if (isNT) {
      return [
        { word: 'Grâce', root: 'Charis', strong: 'G5485' },
        { word: 'Foi', root: 'Pistis', strong: 'G4102' },
        { word: 'Amour', root: 'Agapē', strong: 'G0026' }
      ];
    } else {
      return [
        { word: 'Amour loyal', root: 'Ḥessed', strong: 'H2617' },
        { word: 'Paix / Plénitude', root: 'Shalom', strong: 'H7965' },
        { word: 'Fidélité', root: '’Emeth', strong: 'H0571' }
      ];
    }
  },

  renderEmptyState(book, chapter) {
    const container = document.getElementById('lexicon-details');
    if (!container) return;

    this.currentTerm = '';
    this.currentStrong = null;
    this.currentMatches = [];

    const b = book || (typeof BibleReader !== 'undefined' && BibleReader.currentBook) || 'Gen';
    const ch = chapter || (typeof BibleReader !== 'undefined' && BibleReader.currentChapter) || 1;
    const frenchName = (typeof getFrenchBookName === 'function' ? getFrenchBookName(b) : null) || b;
    const keywords = this.getPassageKeywords(b, ch);

    container.innerHTML = `
      <div class="lexicon-empty-state">
        <div class="lexicon-empty-icon-wrap">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
            <path d="M6 6h10"></path>
            <path d="M6 10h10"></path>
          </svg>
        </div>
        <h3 class="lexicon-empty-title">Exploration Lexicale &amp; Strong</h3>
        <p class="lexicon-empty-desc">Cliquez sur un mot dans le texte biblique pour analyser sa racine hébraïque ou grecque, ses définitions et ses études linguistiques.</p>
        
        <div class="lexicon-empty-suggestions-label">Termes clés pour ${frenchName} ${ch} :</div>
        <div class="lexicon-empty-suggestions">
          ${keywords.map(k => `
            <button type="button" class="lexicon-empty-hint-tag" onclick="BibleReader.lookupWordInLexicon('${k.word.replace(/'/g, "\\'")}', '${k.strong}')">
              <span class="lex-sug-word">${k.word}</span>
              <span class="lex-sug-sep">•</span>
              <span class="lex-sug-root">${k.root} (${k.strong})</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  },

  async load(word, strongCode = null) {
    this.currentTerm = (word || '').trim();
    this.currentStrong = strongCode;
    this.activeSourceIndex = 0;

    const drawer = document.getElementById('right-drawer');
    drawer.classList.remove('collapsed');
    document.getElementById('btn-toggle-right-drawer')?.classList.add('active');
    if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
    document.querySelector('.drawer-tab[data-drawer-tab="lexicon"]')?.click();

    const container = document.getElementById('lexicon-details');
    container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">Recherche lexicale pour « ${word} » ${strongCode ? `(${strongCode})` : ''}...</div>`;

    try {
      const entry = await API.call('lookup_dictionary', word, strongCode);
      this.currentMatches = entry?.matches || [];
      this.render();
    } catch (e) {
      console.error('Erreur lookup_dictionary:', e);
      container.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur lors de la consultation lexicale.</div>`;
    }
  },

  render() {
    const container = document.getElementById('lexicon-details');
    container.innerHTML = '';


    // Barre d'onglets de sources (Strong, Calmet, Vigouroux, Bailly, Wikipédia) avec flèches de défilement
    const toolbar = document.createElement('div');
    toolbar.className = 'lexicon-header-toolbar';

    const btnScrollLeft = document.createElement('button');
    btnScrollLeft.type = 'button';
    btnScrollLeft.className = 'lex-tabs-scroll-btn lex-tabs-scroll-left hidden';
    btnScrollLeft.title = 'Faire défiler vers la gauche';
    btnScrollLeft.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

    const btnScrollRight = document.createElement('button');
    btnScrollRight.type = 'button';
    btnScrollRight.className = 'lex-tabs-scroll-btn lex-tabs-scroll-right';
    btnScrollRight.title = 'Faire défiler vers la droite';
    btnScrollRight.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;


    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'lexicon-source-tabs';

    // 1. Boutons pour chaque dictionnaire trouvé
    this.currentMatches.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.className = `lex-source-pill ${this.activeSourceIndex === idx ? 'active' : ''}`;
      btn.innerHTML = `${m.badge || m.dict_name}`;
      btn.addEventListener('click', () => {
        this.activeSourceIndex = idx;
        this.render();
      });
      tabsContainer.appendChild(btn);
    });

    // 2. Bouton BibleProject (si étude de mot disponible)
    let bpStudy = null;
    if (typeof BibleProjectView !== 'undefined' && BibleProjectView.getWordStudyForStrong) {
      bpStudy = BibleProjectView.getWordStudyForStrong(this.currentStrong, this.currentTerm);
    }

    const bpIdx = bpStudy ? this.currentMatches.length : -1;
    if (bpStudy) {
      const bpBtn = document.createElement('button');
      bpBtn.className = `lex-source-pill lex-source-pill-bp ${this.activeSourceIndex === bpIdx ? 'active' : ''}`;
      bpBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; color:#c084fc;"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>BibleProject</span>`;
      bpBtn.addEventListener('click', () => {
        this.activeSourceIndex = bpIdx;
        this.render();
      });
      tabsContainer.appendChild(bpBtn);
    }

    // 3. Bouton Wikipédia
    const wikiIdx = this.currentMatches.length + (bpStudy ? 1 : 0);
    const wikiBtn = document.createElement('button');
    wikiBtn.className = `lex-source-pill ${this.activeSourceIndex === wikiIdx ? 'active' : ''}`;
    wikiBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Wikipédia</span>`;
    wikiBtn.addEventListener('click', () => {
      this.activeSourceIndex = wikiIdx;
      this.render();
    });
    tabsContainer.appendChild(wikiBtn);

    toolbar.appendChild(btnScrollLeft);
    toolbar.appendChild(tabsContainer);
    toolbar.appendChild(btnScrollRight);
    container.appendChild(toolbar);

    const updateScrollArrows = () => {
      if (!tabsContainer || !toolbar) return;
      const scrollLeft = tabsContainer.scrollLeft;
      const maxScroll = tabsContainer.scrollWidth - tabsContainer.clientWidth;

      if (maxScroll > 4) {
        if (scrollLeft > 6) {
          btnScrollLeft.classList.remove('hidden');
          toolbar.classList.add('has-overflow-left');
        } else {
          btnScrollLeft.classList.add('hidden');
          toolbar.classList.remove('has-overflow-left');
        }

        if (scrollLeft < maxScroll - 6) {
          btnScrollRight.classList.remove('hidden');
          toolbar.classList.add('has-overflow-right');
        } else {
          btnScrollRight.classList.add('hidden');
          toolbar.classList.remove('has-overflow-right');
        }
      } else {
        btnScrollLeft.classList.add('hidden');
        btnScrollRight.classList.add('hidden');
        toolbar.classList.remove('has-overflow-left', 'has-overflow-right');
      }
    };

    tabsContainer.addEventListener('scroll', updateScrollArrows, { passive: true });
    
    // Support du défilement horizontal à la molette de la souris
    tabsContainer.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        tabsContainer.scrollLeft += e.deltaY;
        updateScrollArrows();
      }
    }, { passive: false });

    btnScrollLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      tabsContainer.scrollBy({ left: -160, behavior: 'smooth' });
      setTimeout(updateScrollArrows, 350);
    });
    btnScrollRight.addEventListener('click', (e) => {
      e.stopPropagation();
      tabsContainer.scrollBy({ left: 160, behavior: 'smooth' });
      setTimeout(updateScrollArrows, 350);
    });

    // Centrer automatiquement l'onglet actif dans la vue
    const activePill = tabsContainer.querySelector('.lex-source-pill.active');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    setTimeout(updateScrollArrows, 100);
    setTimeout(updateScrollArrows, 350);
    setTimeout(updateScrollArrows, 800);



    // Contenu principal

    const contentBox = document.createElement('div');
    contentBox.className = 'lexicon-active-content';
    container.appendChild(contentBox);

    if (bpStudy && this.activeSourceIndex === bpIdx) {
      this.renderBibleProjectStudy(contentBox, bpStudy);
    } else if (this.activeSourceIndex === wikiIdx) {
      this.renderWikipedia(contentBox);
    } else if (this.currentMatches[this.activeSourceIndex]) {
      this.renderDictionaryMatch(contentBox, this.currentMatches[this.activeSourceIndex]);
    } else {
      contentBox.innerHTML = `
        <div style="padding: 24px; color: var(--text-muted); text-align: center;">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 10px auto; opacity: 0.5;"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Aucune entrée trouvée dans ce dictionnaire pour « <strong>${this.currentTerm}</strong> ».
        </div>
      `;
    }
  },

  renderBibleProjectStudy(container, bpStudy) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="font-size: 20px; font-weight: 800; color: var(--accent-blue); margin-bottom: 4px;">${bpStudy.title}</div>
        <div style="font-size: 11.5px; font-weight: 700; color: #a855f7; margin-bottom: 14px;">Étude de mot BibleProject • ${bpStudy.orig || ''}</div>
        
        <div class="lex-bp-main-card">
          <div class="lex-bp-main-thumb-wrap" onclick="BibleProjectView.openAndPlayWordStudy('${bpStudy.ytId}', '${BibleProjectView.escapeHtml(bpStudy.title)}', '${BibleProjectView.escapeHtml(bpStudy.description)}')">
            <img src="${bpStudy.thumbnail}" alt="${BibleProjectView.escapeHtml(bpStudy.title)}" loading="lazy">
            <div class="lex-bp-main-play-btn">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <span class="lex-bp-main-dur">${bpStudy.dur || '5 min'}</span>
          </div>
          <div class="lex-bp-main-desc">
            <p style="margin-top: 10px; font-size: 13.5px; line-height: 1.6; color: var(--text-secondary);">
              ${BibleProjectView.escapeHtml(bpStudy.description || 'Découvrez la richesse et les nuances théologiques de ce terme dans les textes originaux.')}
            </p>
            <div style="margin-top: 14px; display: flex; gap: 8px;">
              <button type="button" class="btn-primary" style="font-size: 12px; padding: 6px 14px; display: flex; align-items: center; gap: 6px;" onclick="BibleProjectView.openAndPlayWordStudy('${bpStudy.ytId}', '${BibleProjectView.escapeHtml(bpStudy.title)}', '${BibleProjectView.escapeHtml(bpStudy.description)}')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Lancer la vidéo dans Médias</span>
              </button>
              <button type="button" class="btn-secondary" style="font-size: 12px; padding: 6px 12px;" onclick="API.openExternalUrl('https://www.youtube.com/watch?v=${bpStudy.ytId}')">
                <span>YouTube ↗</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },


  currentAudioPlayer: null,

  async playPronunciation(text, lang = 'he', strongCode = '') {
    const btn = document.getElementById('btn-play-strong-audio');
    if (!btn) return;

    // 1. Si déjà en cours de lecture -> bouton Pause / Stop
    if (this.currentAudioPlayer && !this.currentAudioPlayer.paused) {
      this.currentAudioPlayer.pause();
      this.currentAudioPlayer.currentTime = 0;
      this.currentAudioPlayer = null;
      btn.classList.remove('playing');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
        <span class="strong-audio-label">Prononciation</span>
      `;
      return;
    }

    // 2. Animation de téléchargement / chargement
    btn.disabled = true;
    btn.innerHTML = `
      <span class="synth-spinner" style="width:11px; height:11px; border-width:2px; display:inline-block; vertical-align:middle; margin-right:4px;"></span>
      <span class="strong-audio-label">Chargement...</span>
    `;

    const resetBtn = () => {
      btn.disabled = false;
      btn.classList.remove('playing');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
        <span class="strong-audio-label">Prononciation</span>
      `;
      this.currentAudioPlayer = null;
    };

    try {
      // Récupération de l'audio haute qualité MP3
      const res = await API.call('get_word_pronunciation_audio', text, lang, strongCode);

      if (res && res.success && res.audio_base64) {
        btn.disabled = false;
        btn.classList.add('playing');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
          <span class="strong-audio-label">Pause</span>
        `;

        const audio = new Audio(res.audio_base64);
        this.currentAudioPlayer = audio;

        audio.onended = resetBtn;
        audio.onerror = resetBtn;

        await audio.play();
        return;
      }
    } catch (err) {
      console.warn('[LexiconViewer] Erreur téléchargement MP3, bascule TTS local:', err);
    }

    // 3. Fallback synthétique si hors-ligne
    if ('speechSynthesis' in window) {
      btn.disabled = false;
      btn.classList.add('playing');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
        <span class="strong-audio-label">Pause</span>
      `;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'he' ? 'he-IL' : 'el-GR';
      utterance.rate = 0.82;

      utterance.onend = resetBtn;
      utterance.onerror = resetBtn;

      window.speechSynthesis.speak(utterance);
    } else {
      resetBtn();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Audio non disponible sur ce système.', 'warning');
      }
    }
  },


  searchStrongOccurrences(strongCode, term) {
    if (typeof SearchView !== 'undefined') {
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('search');
        setTimeout(() => {
          const input = document.getElementById('search-main-input');
          if (input) {
            input.value = strongCode || term;
            SearchView.executeSearch();
          }
        }, 100);
      }
    }
  },

  copyStrongReference(frenchLemma, originalScript, strongCode) {
    const text = `${frenchLemma} [${originalScript}] (Strong ${strongCode})`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Copié : ${text}`, 'success');
        }
      }).catch(() => {});
    }
  },

  transliterateOriginalScript(script, isHebrew) {
    if (!script) return '';
    if (isHebrew) {
      const map = {
        '\u05D0': '’', '\u05D1': 'b', '\u05D2': 'g', '\u05D3': 'd', '\u05D4': 'h', '\u05D5': 'v',
        '\u05D6': 'z', '\u05D7': 'ḥ', '\u05D8': 'ṭ', '\u05D9': 'y', '\u05DA': 'kh', '\u05DB': 'k',
        '\u05DC': 'l', '\u05DD': 'm', '\u05DE': 'm', '\u05DF': 'n', '\u05E0': 'n', '\u05E1': 's',
        '\u05E2': '‘', '\u05E3': 'f', '\u05E4': 'p', '\u05E5': 'ts', '\u05E6': 'ts', '\u05E7': 'q',
        '\u05E8': 'r', '\u05E9': 'sh', '\u05EA': 't',
        '\u05B7': 'a', '\u05B8': 'ā', '\u05B6': 'e', '\u05B5': 'ē', '\u05B4': 'i', '\u05B9': 'ō',
        '\u05BB': 'u', '\u05B0': 'ə', '\u05B2': 'ă', '\u05B1': 'ĕ', '\u05B3': 'ŏ'
      };
      let res = '';
      for (const ch of script) {
        if (map[ch]) res += map[ch];
        else if (ch === '\u05C2' && res.endsWith('sh')) {
          res = res.slice(0, -2) + 's';
        }
      }
      return res || script;
    } else {
      const parts = script.split(/[\-\–\—]/);
      if (parts.length > 1) return parts[1].trim();
      return script;
    }
  },

  extractHebrewRoot(script) {
    if (!script) return '';
    const consonants = [];
    for (const ch of script) {
      if (ch >= '\u05D0' && ch <= '\u05EA') {
        consonants.push(ch);
      }
    }
    if (consonants.length >= 3) {
      return consonants.slice(0, 3).join(' • ');
    } else if (consonants.length > 0) {
      return consonants.join(' • ');
    }
    return '';
  },

  deduceGrammarClass(frenchLemma, defn, isHebrew) {
    const text = ((frenchLemma || '') + ' ' + (defn || '')).toLowerCase();
    if (/^(aimer|dire|faire|créer|parler|marcher|bénir|donner|prendre|voir|entendre|aller|venir|sauver|prier|juger|garder)/i.test(frenchLemma) || /verbe|action|accompli|inaccompli/i.test(text)) {
      return isHebrew ? 'Racine verbale (Verbe)' : 'Verbe Koinè';
    }
    if (/^(saint|grand|bon|mauvais|juste|pur|fidèle|fort|petit|haut)/i.test(frenchLemma) || /adjectif/i.test(text)) {
      return 'Adjectif qualificatif';
    }
    if (/^(premier|deux|trois|quatre|dix|cent|mille)/i.test(frenchLemma) || /numéral/i.test(text)) {
      return 'Numéral / Ordinal';
    }
    if (/^(dans|avec|pour|sur|sous|vers|contre|entre|devant)/i.test(frenchLemma) || /préposition/i.test(text)) {
      return 'Préposition';
    }
    return isHebrew ? 'Substantif / Nom' : 'Nom (Substantif)';
  },

  renderStrongCard(container, match, bpVideoCardHtml = '') {
    const rawTitle = match.title || this.currentTerm || '';
    let frenchLemma = rawTitle;
    let originalScript = match.lemma || '';

    // Extraction depuis "Arbre [עֵץ]"
    const bracketMatch = rawTitle.match(/^(.*?)\s*\[(.*?)\]/);
    if (bracketMatch) {
      frenchLemma = bracketMatch[1].trim();
      originalScript = bracketMatch[2].trim();
    }

    const badgeText = match.badge || match.dict_name || '';
    const strongCodeMatch = (match.strong || match.code || badgeText || rawTitle).match(/([HG]\d+)/i);
    const strongCode = strongCodeMatch ? strongCodeMatch[1].toUpperCase() : (this.currentStrong || 'STRONG');
    const isHebrew = strongCode.startsWith('H') || /hébreu|hebrew/i.test(badgeText);

    // Extraction et nettoyage des définitions
    const rawText = (match.full_text || match.preview || '').trim();
    const cleanText = rawText.replace(/[;,\.]+\s*$/, '').replace(/\.\.\./g, '');
    
    // Découpage et déduplication intelligente des termes
    const rawTokens = cleanText
      .split(/[,;\n]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && t !== '...' && !/^\s*d[e']\s*$/i.test(t));

    const uniqueTokens = [];
    const seen = new Set();
    for (const tok of rawTokens) {
      const lower = tok.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueTokens.push(tok);
      }
    }

    // Regroupement sémantique par blocs de sens
    const primarySenses = [];
    if (uniqueTokens.length > 0) {
      for (let i = 0; i < uniqueTokens.length && primarySenses.length < 4; i += 2) {
        const chunk = uniqueTokens.slice(i, i + 2).join(', ');
        primarySenses.push(chunk.charAt(0).toUpperCase() + chunk.slice(1));
      }
    } else {
      primarySenses.push(frenchLemma);
    }

    const pillsHtml = uniqueTokens.slice(0, 12).map(tok => `
      <span class="strong-semantic-pill" onclick="LexiconViewer.searchStrongOccurrences('${tok.replace(/'/g, "\\'")}', '${tok.replace(/'/g, "\\'")}')">
        ${typeof BibleProjectView !== 'undefined' && BibleProjectView.escapeHtml ? BibleProjectView.escapeHtml(tok) : tok}
      </span>
    `).join('');

    const wordToPronounce = originalScript || frenchLemma;
    const translit = this.transliterateOriginalScript(originalScript, isHebrew);
    const hebrewRoot = isHebrew ? this.extractHebrewRoot(originalScript) : '';
    const grammarClass = this.deduceGrammarClass(frenchLemma, cleanText, isHebrew);

    container.innerHTML = `
      <div class="strong-exegesis-container" style="padding: 16px;">
        ${bpVideoCardHtml}

        <div class="strong-card ${isHebrew ? 'strong-theme-hebrew' : 'strong-theme-greek'}">
          <!-- En-tête Langue & Strong Code -->
          <div class="strong-card-topbar">
            <div class="strong-lang-badge">
              <span class="strong-lang-dot"></span>
              <span>${isHebrew ? 'Hébreu Biblique (A.T.)' : 'Grec Koinè (N.T.)'}</span>
            </div>
            <div class="strong-code-badge">Strong ${strongCode}</div>
          </div>

          <!-- Affichage Héro du Mot Original & Traduction -->
          <div class="strong-hero-box">
            ${originalScript ? `
              <div class="strong-original-script ${isHebrew ? 'font-hebrew' : 'font-greek'}" dir="${isHebrew ? 'rtl' : 'ltr'}">
                ${originalScript}
              </div>
            ` : ''}
            <div class="strong-french-lemma">« ${frenchLemma} »</div>

            <!-- Bouton Prononciation Audio -->
            <button type="button" class="strong-audio-play-btn" id="btn-play-strong-audio" onclick="LexiconViewer.playPronunciation('${wordToPronounce.replace(/'/g, "\\'")}', '${isHebrew ? 'he' : 'el'}', '${strongCode}')" title="Écouter la prononciation vocale">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
              <span class="strong-audio-label">Prononciation</span>
            </button>
          </div>

          <!-- Section Analyse Linguistique & Morphologie (OpenHebrewBible / OpenGNT) -->
          <div class="strong-card-section strong-linguistic-section">
            <div class="strong-section-label">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>Analyse Linguistique &amp; Morphologie</span>
            </div>
            
            <div class="strong-linguistic-grid">
              ${translit ? `
                <div class="strong-ling-item" data-tooltip="Transcription phonétique : Permet de lire et prononcer le mot hébreu/grec en alphabet latin avec ses accents et sa métrique d'origine.">
                  <div class="strong-ling-label">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                    <span>Translittération</span>
                    <svg class="strong-info-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </div>
                  <div class="strong-ling-val strong-translit-val">${translit}</div>
                </div>
              ` : ''}

              ${isHebrew && hebrewRoot ? `
                <div class="strong-ling-item" data-tooltip="Racine sémitique à 3 consonnes : En hébreu, presque chaque mot dérive d'une racine mère qui relie toute sa famille de sens théologique.">
                  <div class="strong-ling-label">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>Racine Trilitère</span>
                    <svg class="strong-info-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </div>
                  <div class="strong-ling-val strong-root-val font-hebrew" dir="rtl">${hebrewRoot}</div>
                </div>
              ` : ''}

              <div class="strong-ling-item" data-tooltip="Catégorie morphologique : Indique la fonction grammaticale exacte (Nom, Verbe, Adjectif, Préposition) pour analyser précisément la phrase.">
                <div class="strong-ling-label">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  <span>Nature grammaticale</span>
                  <svg class="strong-info-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </div>
                <div class="strong-ling-val">${grammarClass}</div>
              </div>

              <div class="strong-ling-item" data-tooltip="Manuscrit source &amp; Référence : Manuscrit académique original servant à l'alignement interlinéaire (Codex de Léningrad BHS pour l'A.T., NA28 pour le N.T.).">
                <div class="strong-ling-label">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  <span>Corpus &amp; Alignement</span>
                  <svg class="strong-info-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </div>
                <div class="strong-ling-val">${isHebrew ? 'Codex de Léningrad (WLC / BHS)' : 'Nouveau Testament (NA28 / SBLGNT)'}</div>
              </div>
            </div>
          </div>


          <!-- Section Sens Principaux -->
          <div class="strong-card-section">
            <div class="strong-section-label">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
              <span>Sens Principaux &amp; Définitions</span>
            </div>
            <ul class="strong-meanings-list">
              ${primarySenses.map(s => `<li><span class="strong-bullet">•</span><span class="strong-meaning-text">${s}</span></li>`).join('')}
            </ul>
          </div>

          <!-- Section Nuances & Puces Sémantiques -->
          ${uniqueTokens.length > 0 ? `
            <div class="strong-card-section">
              <div class="strong-section-label">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>Champs Sémantiques &amp; Nuances</span>
              </div>
              <div class="strong-semantic-pills-wrap">
                ${pillsHtml}
              </div>
            </div>
          ` : ''}


          <!-- Barre d'Actions Rapides -->
          <div class="strong-actions-footer">
            <button type="button" class="btn-primary strong-btn-occurrences" onclick="LexiconViewer.searchStrongOccurrences('${strongCode}', '${frenchLemma.replace(/'/g, "\\'")}')">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>Occurrences de ${strongCode} dans la Bible</span>
            </button>
            <button type="button" class="btn-secondary strong-btn-copy" onclick="LexiconViewer.copyStrongReference('${frenchLemma.replace(/'/g, "\\'")}', '${originalScript}', '${strongCode}')" title="Copier la référence dans le presse-papier">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copier</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderDictionaryMatch(container, match) {
    const isStrongDict = match.dict_id === 'strong' || match.is_strong || (match.dict_name && match.dict_name.toLowerCase().includes('strong'));

    // Vérification d'une étude de mot BibleProject associée
    let bpVideoCardHtml = '';
    if (typeof BibleProjectView !== 'undefined' && BibleProjectView.getWordStudyForStrong) {
      const strongCode = match.strong || match.slug || this.currentStrong || '';
      const bpStudy = BibleProjectView.getWordStudyForStrong(strongCode, this.currentTerm);
      if (bpStudy) {
        bpVideoCardHtml = `
          <div class="lex-bp-video-card" onclick="BibleProjectView.openAndPlayWordStudy('${bpStudy.ytId}', '${BibleProjectView.escapeHtml(bpStudy.title)}', '${BibleProjectView.escapeHtml(bpStudy.description)}')" title="Regarder l'analyse vidéo BibleProject dans l'onglet Médias">
            <div class="lex-bp-video-thumb">
              <img src="${bpStudy.thumbnail}" alt="${BibleProjectView.escapeHtml(bpStudy.title)}" loading="lazy">
              <div class="lex-bp-play-badge">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
            <div class="lex-bp-video-info">
              <div class="lex-bp-badge-row">
                <span class="lex-bp-tag">Étude de mot BibleProject</span>
                <span class="lex-bp-dur">${bpStudy.dur || '5 min'}</span>
              </div>
              <div class="lex-bp-title">${BibleProjectView.escapeHtml(bpStudy.title)}</div>
              <div class="lex-bp-hint">Regarder l'analyse vidéo (${bpStudy.orig || ''}) ↗</div>
            </div>
          </div>
        `;
      }
    }

    if (isStrongDict) {
      this.renderStrongCard(container, match, bpVideoCardHtml);
      return;
    }

    const isPolished = match.is_polished;
    const modelName = match.polished_model || 'Mistral 14B';
    const itemId = `dict_${match.dict_id}_${match.id || this.currentTerm}`;
    const isForeign = CommentaryViewer.isForeignText(match.full_text || match.preview || '');
    const cachedTrans = CommentaryViewer.translationCache[itemId];
    const isShowingTranslated = CommentaryViewer.showTranslatedVersion[itemId] !== false && !!cachedTrans;

    let polishBarHtml = '';
    if (match.dict_id !== 'strong') {
      polishBarHtml = `
        <div class="ai-polish-bar" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div>
            ${isPolished 
              ? `<span class="ai-polished-badge" style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>Notice restaurée par IA (${modelName})</span>` 
              : `<span style="font-size: 11px; color: #4338CA; font-weight: 600;">Améliorer la lisibilité avec l'IA</span>`
            }
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${isForeign && !cachedTrans ? `
              <button class="comm-translate-btn" id="btn-translate-dict" style="font-size: 11px; padding: 4px 8px; display: flex; align-items: center; gap: 4px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>Traduire</span>
              </button>
            ` : ''}
            <button class="ai-polish-btn" id="btn-polish-entry" style="display: flex; align-items: center; gap: 4px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
              <span>${isPolished ? 'Re-générer' : "Améliorer avec l'IA"}</span>
            </button>
          </div>
        </div>
      `;
    }
 else if (isForeign && !cachedTrans) {
      polishBarHtml = `
        <div style="margin-bottom: 10px; display: flex; justify-content: flex-end;">
          <button class="comm-translate-btn" id="btn-translate-dict" style="font-size: 11px; padding: 4px 8px; display: flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span>Traduire en français</span>
          </button>
        </div>
      `;
    }

    let translationBannerHtml = '';
    let rawText = match.full_text || match.preview || '';

    if (cachedTrans) {
      if (isShowingTranslated) {
        rawText = cachedTrans;
        translationBannerHtml = `
          <div class="comm-translate-badge" style="margin-top: 8px;">
            <span style="display:inline-flex; align-items:center; gap:5px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span>Notice traduite fidèlement en français (IA)</span></span>
            <span class="comm-translate-toggle-link" id="btn-toggle-dict-orig">Voir texte original</span>
          </div>
        `;
      } else {
        translationBannerHtml = `
          <div class="comm-translate-badge" style="margin-top: 8px;">
            <span style="display:inline-flex; align-items:center; gap:5px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span>Texte original (${match.dict_name || 'Dictionnaire'})</span></span>
            <span class="comm-translate-toggle-link" id="btn-toggle-dict-orig">Voir traduction française</span>
          </div>
        `;
      }
    }

    const formatted = (rawText || '')
      .replace(/^### (.*$)/gim, '<h3 style="margin: 12px 0 6px 0; font-size: 16px; font-weight: 700;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 14px 0 8px 0; font-size: 18px; font-weight: 700;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 16px 0 10px 0; font-size: 20px; font-weight: 800;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 12px; margin: 10px 0; background: var(--bg-subtle); border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>');

    const textToRender = formatted
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => (p.startsWith('<h') || p.startsWith('<blockquote') || p.startsWith('<li')) ? p : `<p style="margin: 8px 0; line-height: 1.75;">${p}</p>`)
      .join('');

    const linkifiedDictText = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
      ? TheologyView.highlightScriptureReferences(textToRender)
      : textToRender;

    container.innerHTML = `
      <div style="padding: 16px;">
        ${bpVideoCardHtml}

        <div style="font-size: 20px; font-weight: 800; color: var(--accent-blue); margin-bottom: 4px;">${match.title || this.currentTerm}</div>
        <div style="font-size: 11px; font-weight: 700; color: var(--accent-orange); margin-bottom: 12px;">${match.badge || match.dict_name}</div>
        ${polishBarHtml}
        ${translationBannerHtml}
        <div style="font-family: var(--font-bible); font-size: 15px; line-height: 1.75;" id="match-body-text" class="dict-entry-body">${linkifiedDictText}</div>
      </div>
    `;


    // Attacher les infobulles et navigation sur les références bibliques
    if (typeof ScriptureTooltip !== 'undefined') {
      ScriptureTooltip.bindToElements(container.querySelectorAll('.theol-inline-scripture-ref'));
    }
    container.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = span.dataset.ref || span.textContent.trim();
        if (ref) {
          if (typeof ScriptureTooltip !== 'undefined') ScriptureTooltip.hide();
          if (typeof BibleReader !== 'undefined') BibleReader.searchPassage(ref);
        }
      });
    });

    const toggleBtn = container.querySelector('#btn-toggle-dict-orig');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        CommentaryViewer.showTranslatedVersion[itemId] = !isShowingTranslated;
        this.renderDictionaryMatch(container, match);
      });
    }

    const btnTranslateDict = container.querySelector('#btn-translate-dict');
    if (btnTranslateDict) {
      btnTranslateDict.addEventListener('click', async () => {
        btnTranslateDict.disabled = true;
        btnTranslateDict.innerHTML = '<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span><span class="shine-text">Traduction...</span>';
        const bodyEl = container.querySelector('#match-body-text');
        if (bodyEl) bodyEl.classList.add('ai-shining-container');
        try {
          const res = await API.translateText(match.full_text || match.preview || '', 'dictionary', itemId);
          if (res && res.success && res.translated_text) {
            CommentaryViewer.translationCache[itemId] = res.translated_text;
            CommentaryViewer.showTranslatedVersion[itemId] = true;
            this.renderDictionaryMatch(container, match);
            App.showToast('Notice traduite en français !');
          } else {
            App.showError('Erreur de Traduction', res?.error || 'Impossible de traduire.');
            btnTranslateDict.disabled = false;
            btnTranslateDict.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Réessayer</span>';
            if (bodyEl) bodyEl.classList.remove('ai-shining-container', 'shine-text');
          }
        } catch (e) {
          App.showError('Erreur de Traduction', String(e));
          btnTranslateDict.disabled = false;
          btnTranslateDict.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Réessayer</span>';
          if (bodyEl) bodyEl.classList.remove('ai-shining-container', 'shine-text');
        }
      });
    }

    const btnPolish = container.querySelector('#btn-polish-entry');
    if (btnPolish) {
      btnPolish.addEventListener('click', async () => {
        btnPolish.disabled = true;
        btnPolish.innerHTML = `<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span><span class="shine-text">Restauration IA...</span>`;
        const bodyEl = container.querySelector('#match-body-text');
        if (bodyEl) {
          bodyEl.classList.add('ai-shining-container', 'shine-text');
          const bannerEl = document.createElement('div');
          bannerEl.className = 'ai-processing-floating-banner';
          bannerEl.style.padding = '8px 12px';
          bannerEl.style.marginBottom = '12px';
          bannerEl.innerHTML = `
            <div class="banner-icon" style="width: 24px; height: 24px; font-size: 12px;">✨</div>
            <div class="banner-text shine-text" style="font-size: 12px;">Restauration philologique IA en cours...</div>
          `;
          bodyEl.parentElement?.insertBefore(bannerEl, bodyEl);
        }

        try {
          const res = await API.call('polish_dictionary_article', match.dict_id, match.title, match.raw_text || match.full_text, null, match.slug);
          if (res && res.success) {
            match.is_polished = true;
            match.full_text = res.text;
            match.polished_model = res.model;
            App.showToast('Notice restaurée par IA avec succès !');
            this.render();
          } else {
            alert(`Erreur d'amélioration IA : ${res?.error || 'Erreur inconnue'}`);
            this.render();
          }
        } catch (e) {
          alert(`Erreur d'appel IA : ${e}`);
          this.render();
        }
      });
    }
  },

  async renderWikipedia(container, exactTitle = null) {
    container.innerHTML = `<div style="padding: 24px; color: var(--text-muted); text-align: center;">Chargement de l'article Wikipédia pour « ${exactTitle || this.currentTerm} »...</div>`;

    try {
      const data = await API.call('get_wikipedia_summary', this.currentTerm, exactTitle);
      if (!data || (!data.found && (!data.candidates || data.candidates.length === 0))) {
        container.innerHTML = `
          <div style="padding: 24px; color: var(--text-muted); text-align: center;">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 10px auto; opacity: 0.5;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Aucun article Wikipédia pertinent trouvé pour « <strong>${this.currentTerm}</strong> ».
            <div style="margin-top: 14px; display: flex; gap: 6px; justify-content: center;">
              <input type="text" id="wiki-fallback-input" class="wiki-search-input" style="max-width: 200px;" placeholder="Autre recherche..." value="${this.currentTerm}">
              <button id="wiki-fallback-submit" class="wiki-search-submit-btn">Chercher</button>
            </div>
          </div>
        `;
        const fbIn = container.querySelector('#wiki-fallback-input');
        const fbBtn = container.querySelector('#wiki-fallback-submit');
        const doSearch = () => {
          const val = fbIn?.value?.trim();
          if (val) {
            this.currentTerm = val;
            this.renderWikipedia(container);
          }
        };
        fbBtn?.addEventListener('click', doSearch);
        fbIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
        return;
      }

      // Candidates Navigation (Nuage de mots)
      const candidates = data.candidates || [];
      const currentTitle = data.title || exactTitle || this.currentTerm;

      let navHtml = `
        <div class="wiki-top-nav">
          <div class="wiki-search-row">
            <input type="text" class="wiki-search-input" id="wiki-query-input" placeholder="Rechercher un autre sujet..." value="${data.search_query || this.currentTerm}">
            <button class="wiki-search-submit-btn" id="wiki-query-submit">Chercher</button>
          </div>
          ${candidates.length > 1 ? `
            <div class="wiki-cloud-box">
              <div class="wiki-cloud-label">Articles connexes :</div>
              <div class="wiki-pills-bar">
                ${candidates.map(c => `
                  <button class="wiki-pill tier-${c.tier || 'md'} ${c.title.toLowerCase() === currentTitle.toLowerCase() ? 'active' : ''}" data-title="${c.title}" title="${c.snippet || c.title}">
                    ${c.title}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      const cleanExtract = (data.extract || '').replace(/\n\n/g, '<br><br>');
      const linkifiedExtract = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
        ? TheologyView.highlightScriptureReferences(cleanExtract)
        : cleanExtract;

      container.innerHTML = `
        <div class="wiki-container">
          ${navHtml}

          <div class="wiki-header-box">
            <div>
              <div class="wiki-title">${data.title}</div>
              ${data.description ? `<div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">${data.description}</div>` : ''}
            </div>
            <a href="${data.url}" target="_blank" class="wiki-link-btn" title="Ouvrir sur le web">Ouvrir ↗</a>
          </div>

          ${data.thumbnail ? `<img src="${data.thumbnail}" class="wiki-thumbnail" alt="${data.title}">` : ''}

          <div class="wiki-extract">${linkifiedExtract}</div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="wiki-more-btn" id="btn-wiki-more" data-expanded="false" style="display: flex; align-items: center; gap: 5px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span id="wiki-more-label">Voir plus ▾</span>
            </button>
          </div>

          <div class="wiki-extended-box hidden" id="wiki-extended-container"></div>
        </div>
      `;

      // Attacher les infobulles sur le résumé Wikipédia initial
      if (typeof ScriptureTooltip !== 'undefined') {
        ScriptureTooltip.bindToElements(container.querySelectorAll('.theol-inline-scripture-ref'));
      }
      container.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          const ref = span.dataset.ref || span.textContent.trim();
          if (ref) {
            if (typeof ScriptureTooltip !== 'undefined') ScriptureTooltip.hide();
            if (typeof BibleReader !== 'undefined') BibleReader.searchPassage(ref);
          }
        });
      });

      // Event handlers
      const qInput = container.querySelector('#wiki-query-input');
      const qSubmit = container.querySelector('#wiki-query-submit');
      const doNavSearch = () => {
        const val = qInput?.value?.trim();
        if (val) {
          this.currentTerm = val;
          this.renderWikipedia(container);
        }
      };
      qSubmit?.addEventListener('click', doNavSearch);
      qInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doNavSearch(); });

      container.querySelectorAll('.wiki-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          this.renderWikipedia(container, pill.dataset.title);
        });
      });

      const btnMore = container.querySelector('#btn-wiki-more');
      const extContainer = container.querySelector('#wiki-extended-container');
      const moreLabel = container.querySelector('#wiki-more-label');

      if (btnMore && extContainer) {
        btnMore.addEventListener('click', async () => {
          const isExp = btnMore.dataset.expanded === 'true';
          if (isExp) {
            extContainer.classList.add('hidden');
            btnMore.dataset.expanded = 'false';
            moreLabel.textContent = 'Voir plus ▾';
          } else {
            if (!extContainer.innerHTML.trim()) {
              moreLabel.textContent = 'Chargement de la suite...';
              btnMore.disabled = true;
              try {
                const extData = await API.call('get_wikipedia_extended', data.title);
                if (extData && extData.found && extData.html) {
                  const linkifiedExt = (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences)
                    ? TheologyView.highlightScriptureReferences(extData.html)
                    : extData.html;
                  extContainer.innerHTML = linkifiedExt;

                  if (typeof ScriptureTooltip !== 'undefined') {
                    ScriptureTooltip.bindToElements(extContainer.querySelectorAll('.theol-inline-scripture-ref'));
                  }
                  extContainer.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
                    span.addEventListener('click', (e) => {
                      e.stopPropagation();
                      const ref = span.dataset.ref || span.textContent.trim();
                      if (ref) {
                        if (typeof ScriptureTooltip !== 'undefined') ScriptureTooltip.hide();
                        if (typeof BibleReader !== 'undefined') BibleReader.searchPassage(ref);
                      }
                    });
                  });

                  extContainer.classList.remove('hidden');
                  btnMore.dataset.expanded = 'true';
                  moreLabel.textContent = 'Voir moins ▴';
                } else {
                  extContainer.innerHTML = `<div style="color: var(--text-muted); font-style: italic;">Pas de sections supplémentaires disponibles.</div>`;
                  extContainer.classList.remove('hidden');
                  btnMore.dataset.expanded = 'true';
                  moreLabel.textContent = 'Voir moins ▴';
                }
              } catch (e) {
                alert(`Erreur : ${e}`);
                moreLabel.textContent = 'Voir plus ▾';
              } finally {
                btnMore.disabled = false;
              }
            } else {
              extContainer.classList.remove('hidden');
              btnMore.dataset.expanded = 'true';
              moreLabel.textContent = 'Voir moins ▴';
            }
          }
        });
      }

    } catch (e) {
      console.error('Erreur Wikipédia:', e);
      container.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur de connexion à Wikipédia.</div>`;
    }
  }
};


// 7. MOTEUR PRINCIPAL DU LECTEUR BIBLIQUE
const BibleReader = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentBible1: 'Segond 21',
  currentBible2: 'BDS',
  
  isSplitView: false,
  isScrollSynced: true,
  isSyncingScroll: false,

  pane1IsInterlinear: false,
  pane1InterlinearVersion: 'LSG',
  pane2IsInterlinear: false,
  pane2InterlinearVersion: 'DARBY',

  get isInterlinear() {
    return this.pane1IsInterlinear || this.pane2IsInterlinear;
  },
  set isInterlinear(val) {
    this.pane1IsInterlinear = !!val;
  },

  get interlinearVersion() {
    return this.pane1InterlinearVersion || 'LSG';
  },
  set interlinearVersion(val) {
    this.pane1InterlinearVersion = val;
  },

  get currentVersion() {
    return this.currentBible1 || this.pane1InterlinearVersion || 'LSG';
  },

  interlinearLayers: { surface: true, orig: true, translit: true, strong: true },
  zoomPercent: 100,
  bracketsMode: 'classic',
  parenthesesMode: 'callout',
  caesuraMode: 'indent',

  installedBibles: [],
  targetPaneForPicker: 1,
  activePickerFamily: 'all',

  loadedChapters: [],
  isLoadingMore: false,

  updatePassagePillDisplay() {
    if (this.currentBook && this.currentChapter) {
      formatPassagePill(this.currentBook, this.currentChapter, this.selectedVerse);
    }
  },

  async init() {
    this.bracketsMode = localStorage.getItem('bible_reader_brackets_mode') || 'classic';
    this.parenthesesMode = localStorage.getItem('bible_reader_parentheses_mode') || 'callout';
    this.caesuraMode = localStorage.getItem('bible_reader_caesura_mode') || 'indent';
    this.bindEvents();
    TabsManager.init();
    DisplayOptions.init();
    InterlinearMenu.init();
    CommentaryViewer.init();
    DrawerNotesViewer.init();
    if (typeof PassageOverviewDrawer !== 'undefined') {
      PassageOverviewDrawer.init();
    }
    ContextMenuManager.init();
    
    try {
      const savedZoom = localStorage.getItem('bible_reader_zoom');
      if (savedZoom) {
        this.setZoom(parseInt(savedZoom, 10));
      } else {
        this.setZoom(100);
      }
    } catch (e) {
      this.setZoom(100);
    }
    
    BookPicker.init((bookCode, chNum, verseNum = null) => {
      this.navigateTo(bookCode, chNum, verseNum);
    });

    this.setupInfiniteScroll();

    // Surlignage synchronisé au survol des versets en double vue
    const workspace = document.getElementById('reader-workspace');
    if (workspace) {
      workspace.addEventListener('mouseover', (e) => {
        if (!this.isSplitView) return;
        const vItem = e.target.closest('.verse-item');
        if (!vItem) return;
        
        const bCode = vItem.dataset.bookCode;
        const ch = vItem.dataset.chapter;
        const vNum = vItem.dataset.verseNum;
        if (!bCode || !ch || !vNum) return;

        workspace.querySelectorAll(`.verse-item[data-book-code="${bCode}"][data-chapter="${ch}"][data-verse-num="${vNum}"]`).forEach(el => {
          el.classList.add('synced-hover');
        });
      });

      workspace.addEventListener('mouseout', (e) => {
        if (!this.isSplitView) return;
        const vItem = e.target.closest('.verse-item');
        if (!vItem) return;
        
        workspace.querySelectorAll('.verse-item.synced-hover').forEach(el => {
          el.classList.remove('synced-hover');
        });
      });
    }
  },

  async preloadInitialData() {
    if (this._isPreloading || this._isPreloaded) return;
    this._isPreloading = true;
    try {
      this.installedBibles = await API.getInstalledBibles() || [];
      if (this.installedBibles.length > 0) {
        this.currentBible1 = this.installedBibles[0].name;
        if (this.installedBibles.length > 1) {
          this.currentBible2 = this.installedBibles[1].name;
        }
        await TabsManager.setupInitialTabs(this.installedBibles);
      } else {
        await this.navigateTo(this.currentBook || 'Gen', this.currentChapter || 1);
      }
      this._isPreloaded = true;
    } catch (err) {
      console.error('[BibleReader] Erreur preloadInitialData:', err);
    } finally {
      this._isPreloading = false;
    }
  },

  async reloadInstalledBibles() {
    try {
      this.installedBibles = await API.getInstalledBibles() || [];
      this.updatePaneHeader(1);
      this.updatePaneHeader(2);

      // Mettre à jour immédiatement l'indicateur de catalogue dans le sélecteur
      const footerEl = document.getElementById('version-picker-store-footer');
      if (footerEl && typeof OpenShemaStore !== 'undefined') {
        const missing = await OpenShemaStore.getMissingBiblesCount();
        footerEl.style.display = missing > 0 ? 'block' : 'none';
        const footerText = document.getElementById('version-picker-store-btn-text');
        if (footerText && missing > 0) {
          footerText.textContent = `Catalogue Open Shema (${missing} version${missing > 1 ? 's' : ''} disponible${missing > 1 ? 's' : ''})`;
        }
      }
    } catch (err) {
      console.error('[BibleReader] Erreur reloadInstalledBibles:', err);
    }
  },

  bindEvents() {
    document.getElementById('book-picker-pill')?.addEventListener('click', () => {
      BookPicker.toggle(this.currentBook, this.currentChapter);
    });

    document.getElementById('btn-history-back')?.addEventListener('click', () => {
      const prev = getPrevChapterCoord(this.currentBook, this.currentChapter);
      if (prev) this.navigateTo(prev.book, prev.chapter);
    });
    
    document.getElementById('btn-history-forward')?.addEventListener('click', () => {
      const next = getNextChapterCoord(this.currentBook, this.currentChapter);
      if (next) this.navigateTo(next.book, next.chapter);
    });

    // Liens rapides de la barre d'outils du lecteur
    document.getElementById('mode-notes-inline')?.addEventListener('click', () => {
      const drawer = document.getElementById('right-drawer');
      const notesTab = document.querySelector('.drawer-tab[data-drawer-tab="notes"]');
      const isNotesOpen = !drawer?.classList.contains('collapsed') && notesTab?.classList.contains('active');
      if (isNotesOpen) {
        drawer?.classList.add('collapsed');
        document.getElementById('btn-toggle-right-drawer')?.classList.remove('active');
        if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
      } else {
        drawer?.classList.remove('collapsed');
        document.getElementById('btn-toggle-right-drawer')?.classList.add('active');
        if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
        notesTab?.click();
        DrawerNotesViewer.load(this.currentBook, this.currentChapter, this.selectedVerse || 1);
      }
    });

    document.getElementById('mode-search-inline')?.addEventListener('click', () => {
      App.switchView('search');
    });

    document.getElementById('btn-chapter-places')?.addEventListener('click', () => {
      if (typeof MapsView !== 'undefined') {
        MapsView.showChapterPlaces(this.currentBook, this.currentChapter);
      }
    });

    document.getElementById('btn-toggle-split')?.addEventListener('click', () => {
      this.toggleSplitView();
    });

    document.getElementById('btn-toggle-sync-scroll')?.addEventListener('click', () => {
      if (!this.isSplitView) {
        this.toggleSplitView(true);
        this.toggleSyncScroll(true);
      } else {
        this.toggleSyncScroll();
      }
    });

    document.getElementById('btn-close-pane-2')?.addEventListener('click', () => {
      this.toggleSplitView(false);
    });

    document.getElementById('pane-1-select-bible')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openBiblePicker(1);
    });

    document.getElementById('pane-2-select-bible')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openBiblePicker(2);
    });

    document.getElementById('btn-close-bible-picker')?.addEventListener('click', () => {
      this.closeBiblePicker();
    });

    document.addEventListener('click', (e) => {
      const picker = document.getElementById('bible-version-picker-popover');
      if (picker && !picker.classList.contains('hidden') && !picker.contains(e.target)) {
        this.closeBiblePicker();
      }
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.setZoom(this.zoomPercent + 10);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.setZoom(this.zoomPercent - 10);
    });

    document.getElementById('btn-open-commentary-window')?.addEventListener('click', async () => {
      try {
        // Masquer automatiquement le volet droit s'il est ouvert
        const drawer = document.getElementById('right-drawer');
        if (drawer && !drawer.classList.contains('collapsed')) {
          drawer.classList.add('collapsed');
          document.getElementById('btn-toggle-right-drawer')?.classList.remove('active');
          if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
        }

        const res = await API.openCommentaryWindow(this.currentBook, this.currentChapter, this.selectedVerse || 1);
        if (res && res.success) {
          if (res.on_second_screen) {
            App.showToast("Commentaires ouverts sur le second écran");
          } else {
            App.showToast("Fenêtre de commentaires ouverte");
          }
          if (typeof MultiwindowSync !== 'undefined') {
            MultiwindowSync.updateToolbarButtonState(true);
            MultiwindowSync.broadcastCurrentState();
          }
        }
      } catch (err) {
        console.error("Erreur ouverture fenêtre commentaires:", err);
      }
    });

    document.getElementById('btn-toggle-right-drawer')?.addEventListener('click', () => {
      const drawer = document.getElementById('right-drawer');
      if (drawer) {
        drawer.classList.toggle('collapsed');
        document.getElementById('btn-toggle-right-drawer')?.classList.toggle('active', !drawer.classList.contains('collapsed'));
        if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
      }
    });

    document.getElementById('btn-collapse-drawer')?.addEventListener('click', () => {
      const drawer = document.getElementById('right-drawer');
      drawer?.classList.add('collapsed');
      document.getElementById('btn-toggle-right-drawer')?.classList.remove('active');
      if (typeof App !== 'undefined' && App.checkAutoSidebarCollapse) App.checkAutoSidebarCollapse();
    });

    // Filtre de recherche et filtres de familles dans le sélecteur de Bible
    document.getElementById('bible-picker-search')?.addEventListener('input', () => {
      this.filterBiblePickerList();
    });

    document.querySelectorAll('#version-picker-families-bar .fam-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#version-picker-families-bar .fam-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activePickerFamily = btn.dataset.fam || 'all';
        this.filterBiblePickerList();
      });
    });

    // Bouton de suggestion rapide de comparaison en Colonne 2
    document.getElementById('pane-2-quick-suggest')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const suggested = this.getSuggestedComparativeBible(this.currentBible1);
      if (suggested && suggested.name) {
        this.currentBible2 = suggested.name;
        this.pane2IsInterlinear = false;
        this.updatePaneHeader(2);
        this.reloadPane2();
        App.showToast(`Colonne 2 synchronisée sur : ${suggested.title || suggested.name}`);
      }
    });

    const quickPassage = document.getElementById('quick-passage-input');
    if (quickPassage) {
      quickPassage.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value.trim();
          if (query) {
            try {
              const parsed = await API.parseReference(query);
              if (parsed && parsed.book) {
                App.switchView('bible');
                await this.navigateTo(parsed.book, parsed.chapter || 1, parsed.verse || null);
                e.target.value = '';
              }
            } catch (err) {
              console.error('Erreur navigation passage rapide:', err);
            }
          }
        }
      });
    }

    window.addEventListener('resize', () => {
      this.updatePassagePillDisplay();
    });
  },

  getSuggestedComparativeBible(baseBibleName) {
    if (!this.installedBibles || this.installedBibles.length < 2) return null;
    const base = this.installedBibles.find(b => b.name === baseBibleName) || this.installedBibles[0];
    if (!base) return null;

    const baseFam = base.famille || 'Famille Segond';
    const suggestions = base.comparaisons_suggerees || [];

    // 1. Chercher si l'un des codes suggérés est installé
    for (const code of suggestions) {
      const match = this.installedBibles.find(b => (b.version_code || '').toUpperCase() === code.toUpperCase() && b.name !== base.name);
      if (match) return match;
    }

    // 2. Sinon, chercher la première Bible installée d'une famille différente
    const diffFam = this.installedBibles.find(b => b.name !== base.name && b.famille && b.famille !== baseFam);
    if (diffFam) return diffFam;

    // 3. Fallback sur une autre Bible quelconque
    return this.installedBibles.find(b => b.name !== base.name) || null;
  },

  getBibleInfo(bibleName) {
    if (!bibleName) return null;
    const str = String(bibleName).trim();
    const strUpper = str.toUpperCase();
    const strLower = str.toLowerCase();
    
    // 1. Correspondance exacte sur nom, id, dossier ou code
    const exact = (this.installedBibles || []).find(b => 
      b.name === str || 
      b.id === str || 
      (b.folder_name && b.folder_name === str) ||
      (b.version_code && b.version_code.toUpperCase() === strUpper)
    );
    if (exact) return exact;

    // 2. Correspondance exacte sur titre complet
    const exactTitle = (this.installedBibles || []).find(b =>
      b.title && b.title.toLowerCase() === strLower
    );
    if (exactTitle) return exactTitle;

    // 3. Correspondance partielle sur titre
    return (this.installedBibles || []).find(b => 
      b.title && b.title.toLowerCase().includes(strLower)
    ) || null;
  },

  getAvailableBooksForBible(bibleName) {
    const item = this.getBibleInfo(bibleName);
    if (item && Array.isArray(item.available_books) && item.available_books.length > 0) {
      return item.available_books;
    }
    // Fallback dynamique si non spécifié
    const s = String(bibleName || '').toLowerCase();
    const canon = String(item?.canon || '').toUpperCase();
    if (canon === 'NT' || item?.total_books === 27 || s.includes('nouveau testament') || s.includes('parole vivante') || s === 'pv' || s === 'stapfer') {
      return [
        'Mat', 'Mar', 'Luk', 'Joh', 'Act', 'Rom', '1Co', '2Co', 'Gal', 'Eph',
        'Phi', 'Col', '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jam',
        '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jud', 'Rev'
      ];
    }
    if (s.includes('sagesse vivante') || s === 'sv' || item?.total_books === 4) {
      return ['Job', 'Pro', 'Ecc', 'Sol'];
    }
    if (canon === 'AT' || s.includes('cahen') || s.includes('ancien testament') || s === 'gig') {
      return CANONICAL_BOOKS.slice(0, 39).map(b => b.code);
    }
    return CANONICAL_BOOKS.map(b => b.code);
  },

  getFirstBookForBible(bibleName) {
    const item = this.getBibleInfo(bibleName);
    if (item?.first_book) return item.first_book;
    const avail = this.getAvailableBooksForBible(bibleName);
    return (avail && avail.length > 0) ? avail[0] : 'Gen';
  },

  isBookAvailableInBible(bibleName, bookCode) {
    if (!bookCode || !bibleName) return true;
    const avail = this.getAvailableBooksForBible(bibleName);
    if (!avail || avail.length === 0) return true;
    return avail.some(b => b.toLowerCase() === String(bookCode).toLowerCase());
  },

  findBibleContainingBook(bookCode, preferredBible = 'Segond 21') {
    if (!bookCode) return preferredBible || 'Segond 21';
    // 1. Essayer la Bible préférée si elle contient le livre
    if (preferredBible && this.isBookAvailableInBible(preferredBible, bookCode)) {
      return preferredBible;
    }
    // 2. Essayer les Bibles complètes populaires
    for (const fav of ['Segond 21', 'LSG', 'NBS', 'BDS', 'TOB']) {
      const match = (this.installedBibles || []).find(b => b.name === fav || (b.version_code && b.version_code.toUpperCase() === fav));
      if (match && this.isBookAvailableInBible(match.name, bookCode)) {
        return match.name;
      }
    }
    // 3. Trouver la première Bible installée qui contient le livre
    const found = (this.installedBibles || []).find(b => this.isBookAvailableInBible(b.name, bookCode));
    if (found) return found.name;
    return this.currentBible1 || 'Segond 21';
  },

  getBibleDisplayName(bibleName) {
    if (!bibleName) return '';
    const item = this.getBibleInfo(bibleName);
    if (item && item.title) return item.title;
    return bibleName;
  },

  updatePaneHeader(paneNum) {
    if (paneNum === 1) {
      const el = document.getElementById('pane-1-bible-name');
      if (!el) return;
      if (this.pane1IsInterlinear) {
        const interLabel = this.pane1InterlinearVersion === 'DARBY' ? 'Darby (Interlinéaire)' : 'LSG 1910 (Interlinéaire)';
        el.textContent = interLabel;
      } else {
        el.textContent = this.getBibleDisplayName(this.currentBible1);
      }
    } else if (paneNum === 2) {
      const el = document.getElementById('pane-2-bible-name');
      if (!el) return;
      if (this.pane2IsInterlinear) {
        const interLabel = this.pane2InterlinearVersion === 'DARBY' ? 'Darby (Interlinéaire)' : 'LSG 1910 (Interlinéaire)';
        el.textContent = interLabel;
      } else {
        el.textContent = this.getBibleDisplayName(this.currentBible2);
      }

      // Mise à jour de la suggestion rapide pour la Colonne 2
      const suggestBtn = document.getElementById('pane-2-quick-suggest');
      const suggestLabel = document.getElementById('pane-2-suggest-label');
      if (suggestBtn && suggestLabel) {
        const suggested = this.getSuggestedComparativeBible(this.currentBible1);
        if (suggested && suggested.name && suggested.name !== this.currentBible2) {
          suggestLabel.textContent = `Comparer : ${suggested.version_code || suggested.title}`;
          suggestBtn.classList.remove('hidden');
          suggestBtn.title = `Suggéré (${suggested.famille || 'Autre famille'}) : ${suggested.title}\nCliquer pour comparer en direct.`;
        } else {
          suggestBtn.classList.add('hidden');
        }
      }
    }
    this.applyVintageToPanes();
  },

  refreshVintagePanes() {
    this.applyVintageToPanes();
  },

  applyVintageToPanes() {
    if (typeof VintageThemeManager === 'undefined') return;

    // Volet Gauche (Pane 1)
    const p1 = document.getElementById('pane-left');
    if (p1) {
      const b1 = (this.installedBibles || []).find(b => 
        b.name === this.currentBible1 || 
        b.id === this.currentBible1 || 
        (b.version_code && b.version_code.toUpperCase() === (this.currentBible1 || '').toUpperCase())
      );
      const year1 = b1?.annee || b1?.year || b1?.title || this.currentBible1;
      VintageThemeManager.applyEpochToElement(p1, year1);

      const content1 = document.getElementById('pane-1-content');
      if (content1) VintageThemeManager.applyEpochToElement(content1, year1);
      const chapter1 = document.getElementById('pane-1-chapter');
      if (chapter1) VintageThemeManager.applyEpochToElement(chapter1, year1);
      const verses1 = document.getElementById('pane-1-verses');
      if (verses1) VintageThemeManager.applyEpochToElement(verses1, year1);
      p1.querySelectorAll('.chapter-block').forEach(cb => VintageThemeManager.applyEpochToElement(cb, year1));

      this.updatePaneVintageBadge(1, year1);
    }

    // Volet Droit (Pane 2)
    const p2 = document.getElementById('pane-right');
    if (p2) {
      const b2 = (this.installedBibles || []).find(b => 
        b.name === this.currentBible2 || 
        b.id === this.currentBible2 || 
        (b.version_code && b.version_code.toUpperCase() === (this.currentBible2 || '').toUpperCase())
      );
      const year2 = b2?.annee || b2?.year || b2?.title || this.currentBible2;
      VintageThemeManager.applyEpochToElement(p2, year2);

      const content2 = document.getElementById('pane-2-content');
      if (content2) VintageThemeManager.applyEpochToElement(content2, year2);
      const chapter2 = document.getElementById('pane-2-chapter');
      if (chapter2) VintageThemeManager.applyEpochToElement(chapter2, year2);
      const verses2 = document.getElementById('pane-2-verses');
      if (verses2) VintageThemeManager.applyEpochToElement(verses2, year2);
      p2.querySelectorAll('.chapter-block').forEach(cb => VintageThemeManager.applyEpochToElement(cb, year2));

      this.updatePaneVintageBadge(2, year2);
    }
  },

  updatePaneVintageBadge(paneNum, yearOrName) {
    if (typeof VintageThemeManager === 'undefined') return;
    const badgeEl = document.getElementById(`pane-${paneNum}-vintage-badge`);
    if (!badgeEl) return;

    if (!VintageThemeManager.enabled) {
      badgeEl.classList.add('hidden');
      badgeEl.innerHTML = '';
      return;
    }

    const currentBible = paneNum === 1 ? this.currentBible1 : this.currentBible2;
    const bInfo = (this.installedBibles || []).find(b => 
      b.name === currentBible ||
      b.id === currentBible ||
      (b.version_code && b.version_code.toUpperCase() === (currentBible || '').toUpperCase())
    );
    const resolvedYear = bInfo?.annee || bInfo?.year || (yearOrName && !isNaN(parseInt(yearOrName, 10)) ? yearOrName : null);
    const epoch = VintageThemeManager.getEpoch(resolvedYear || yearOrName || currentBible);

    if (epoch === 'modern') {
      badgeEl.classList.add('hidden');
      badgeEl.innerHTML = '';
      return;
    }

    const label = VintageThemeManager.getEpochLabel(epoch, resolvedYear);

    badgeEl.innerHTML = `<svg class="vintage-badge-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1.5a2.5 2.5 0 0 0-5 0V19"/><path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11"/></svg><span>${label}</span>`;
    badgeEl.className = `vintage-epoch-pill ${epoch}`;
    badgeEl.title = `Mode Immersion Historique : ${label}\nPatine, encre bistre et typographie d'époque actives.`;
    badgeEl.classList.remove('hidden');
  },

  setZoom(percent) {
    this.zoomPercent = Math.min(Math.max(60, percent), 250);
    const lbl = document.getElementById('lbl-zoom-level');
    if (lbl) lbl.textContent = `${this.zoomPercent}%`;
    const scale = this.zoomPercent / 100;
    try {
      localStorage.setItem('bible_reader_zoom', this.zoomPercent);
    } catch (e) {}

    // Appliquer dynamiquement la variable d'échelle de zoom
    document.documentElement.style.setProperty('--bible-zoom-scale', scale);
    const workspace = document.getElementById('reader-workspace');
    if (workspace) workspace.style.setProperty('--bible-zoom-scale', scale);

    const pane1 = document.getElementById('pane-1-content');
    if (pane1) pane1.style.setProperty('--bible-zoom-scale', scale);
    const pane2 = document.getElementById('pane-2-content');
    if (pane2) pane2.style.setProperty('--bible-zoom-scale', scale);
  },

  toggleSplitView(forceState) {
    this.isSplitView = forceState !== undefined ? forceState : !this.isSplitView;
    const workspace = document.getElementById('reader-workspace');
    const paneRight = document.getElementById('pane-right');
    const btnSplit = document.getElementById('btn-toggle-split');
    const btnSync = document.getElementById('btn-toggle-sync-scroll');

    if (workspace) workspace.classList.toggle('split-view', this.isSplitView);
    if (paneRight) paneRight.classList.toggle('hidden', !this.isSplitView);
    if (btnSplit) btnSplit.classList.toggle('active', this.isSplitView);

    if (this.isSplitView) {
      if (btnSync) {
        btnSync.classList.remove('hidden');
        btnSync.classList.toggle('active', this.isScrollSynced);
      }
      // Sélection intelligente de la version complémentaire (famille différente) si non définie
      if (!this.currentBible2 || this.currentBible2 === this.currentBible1) {
        const suggested = this.getSuggestedComparativeBible(this.currentBible1);
        if (suggested) {
          this.currentBible2 = suggested.name;
        } else {
          const other = (this.installedBibles || []).find(b => b.name !== this.currentBible1);
          if (other) this.currentBible2 = other.name;
        }
      }
      this.updatePaneHeader(2);
      this.reloadPane2();
    } else {
      if (btnSync) btnSync.classList.add('hidden');
    }
  },

  toggleSyncScroll(forceState = null) {
    this.isScrollSynced = forceState !== null ? forceState : !this.isScrollSynced;
    const btnSync = document.getElementById('btn-toggle-sync-scroll');
    if (btnSync) {
      btnSync.classList.toggle('active', this.isScrollSynced);
    }
    
    if (this.isScrollSynced && this.isSplitView) {
      const pane1 = document.getElementById('pane-1-content');
      const pane2 = document.getElementById('pane-2-content');
      if (pane1 && pane2) {
        this.syncScrollToMatch(pane1, pane2);
      }
      App.showToast('Défilement synchronisé activé (alignement verset)');
    } else if (!this.isScrollSynced && this.isSplitView) {
      App.showToast('Défilement synchronisé désactivé');
    }
  },

  getTopVisibleVerse(container) {
    if (!container) return null;
    const verses = container.querySelectorAll('.verse-item');
    if (!verses || verses.length === 0) return null;
    const containerTop = container.getBoundingClientRect().top;

    for (const v of verses) {
      const rect = v.getBoundingClientRect();
      if (rect.bottom >= containerTop + 5) {
        return {
          book: v.dataset.bookCode,
          chapter: v.dataset.chapter,
          verse: v.dataset.verseNum,
          element: v,
          rect: rect
        };
      }
    }
    return null;
  },

  syncScrollToMatch(sourceContainer, targetContainer) {
    if (!this.isSplitView || !this.isScrollSynced || this.isSyncingScroll) return;
    if (!sourceContainer || !targetContainer) return;

    const topVerse = this.getTopVisibleVerse(sourceContainer);
    if (!topVerse || !topVerse.book || !topVerse.chapter || !topVerse.verse || !topVerse.element) return;

    const targetVerse = targetContainer.querySelector(
      `.verse-item[data-book-code="${topVerse.book}"][data-chapter="${topVerse.chapter}"][data-verse-num="${topVerse.verse}"]`
    );

    if (targetVerse) {
      this.isSyncingScroll = true;

      const sourceContainerTop = sourceContainer.getBoundingClientRect().top;
      const targetContainerTop = targetContainer.getBoundingClientRect().top;
      const sourceVerseTop = topVerse.element.getBoundingClientRect().top;
      const targetVerseTop = targetVerse.getBoundingClientRect().top;

      // Calcul ultra-précis du décalage relatif par rapport au haut du conteneur respectif
      const sourceOffsetFromTop = sourceVerseTop - sourceContainerTop;
      const targetOffsetFromTop = targetVerseTop - targetContainerTop;
      const scrollDelta = targetOffsetFromTop - sourceOffsetFromTop;

      if (Math.abs(scrollDelta) > 1) {
        targetContainer.scrollTop += scrollDelta;
      }

      setTimeout(() => {
        this.isSyncingScroll = false;
      }, 50);
    }
  },

  async reloadPane2() {
    if (!this.isSplitView) return;
    const pane2Container = document.getElementById('pane-2-verses');
    if (!pane2Container) return;
    pane2Container.innerHTML = '';
    
    const chaptersToLoad = this.loadedChapters.length > 0 ? this.loadedChapters : [{ book: this.currentBook, chapter: this.currentChapter }];

    for (let i = 0; i < chaptersToLoad.length; i++) {
      const c = chaptersToLoad[i];
      const data2 = await API.getChapterData(this.currentBible2, c.book, c.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
      
      if (i > 0) {
        const divider2 = document.createElement('div');
        divider2.className = 'chapter-badge-divider';
        divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;
        pane2Container.appendChild(divider2);
      }
      pane2Container.appendChild(block2);
    }

    if (this.isScrollSynced) {
      const pane1 = document.getElementById('pane-1-content');
      const pane2 = document.getElementById('pane-2-content');
      setTimeout(() => {
        this.syncScrollToMatch(pane1, pane2);
      }, 50);
    }
  },

  setupInfiniteScroll() {
    const pane1 = document.getElementById('pane-1-content');
    const pane2 = document.getElementById('pane-2-content');

    const handleScroll = (sourcePane, targetPane) => {
      if (this.isLoadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = sourcePane;

      // Défilement vers le bas -> charger le chapitre suivant
      if (scrollTop + clientHeight >= scrollHeight - 250) {
        this.loadNextChapterContinuous();
      }

      // Défilement vers le haut -> charger le chapitre précédent
      if (scrollTop <= 50) {
        this.loadPrevChapterContinuous(sourcePane);
      }

      // Mettre à jour l'en-tête du livre / chapitres
      this.updateCurrentlyVisibleHeader(sourcePane);

      // Synchronisation du défilement
      if (this.isSplitView && this.isScrollSynced && targetPane && !this.isSyncingScroll) {
        this.syncScrollToMatch(sourcePane, targetPane);
      }
    };

    if (pane1) {
      pane1.addEventListener('scroll', () => {
        handleScroll(pane1, pane2);
      });
    }

    if (pane2) {
      pane2.addEventListener('scroll', () => {
        handleScroll(pane2, pane1);
      });
    }
  },

  _commDebounceTimer: null,
  _lastScrolledVerseRef: null,
  _isProgrammaticScroll: false,
  _progScrollTimer: null,

  debouncedLoadCommentaries(verseNum, bookCode, chapterNum) {
    if (this._isProgrammaticScroll) return;

    const info = getBookInfo(bookCode);
    const refStr = `${info.name} ${chapterNum}:${verseNum}`;

    // 1. Mettre à jour visuellement le badge du commentaire instantanément
    if (typeof CommentaryViewer !== 'undefined' && CommentaryViewer.isSynchronized) {
      CommentaryViewer.updateLiveBadge(refStr);
    }

    // 2. Différer l'appel API exégétique de 120ms pour un défilement ultra-fluide
    if (this._commDebounceTimer) {
      clearTimeout(this._commDebounceTimer);
    }

    this._commDebounceTimer = setTimeout(() => {
      if (this._isProgrammaticScroll) return;
      this.loadCommentariesForVerse(verseNum, bookCode, chapterNum, false);
    }, 120);
  },

  updateCurrentlyVisibleHeader(container) {
    if (!container || this._isProgrammaticScroll) return;

    // Détecter le verset visible en tête de lecture
    const topVerse = this.getTopVisibleVerse(container);
    if (topVerse && topVerse.book && topVerse.chapter && topVerse.verse) {
      const bCode = topVerse.book;
      const ch = parseInt(topVerse.chapter, 10);
      const vNum = parseInt(topVerse.verse, 10);
      const info = getBookInfo(bCode);

      // Si le chapitre a changé lors du défilement continu
      if (this.currentBook !== bCode || this.currentChapter !== ch) {
        this.currentBook = bCode;
        this.currentChapter = ch;
        document.getElementById('pane-1-breadcrumb').textContent = `${info.name.toUpperCase()} > Chapitre ${ch}`;
        const breadcrumb2 = document.getElementById('pane-2-breadcrumb');
        if (breadcrumb2) breadcrumb2.textContent = `${info.name.toUpperCase()} > Chapitre ${ch}`;
        TabsManager.updateActiveTab(null, bCode, ch);
      }

      // Mettre à jour l'étiquette de référence en haut du lecteur
      formatPassagePill(bCode, ch, vNum);

      // Suivi en direct du commentaire dans le volet droit
      const newRef = `${bCode}_${ch}_${vNum}`;
      if (this._lastScrolledVerseRef !== newRef) {
        this._lastScrolledVerseRef = newRef;
        if (typeof CommentaryViewer !== 'undefined' && CommentaryViewer.isSynchronized) {
          this.debouncedLoadCommentaries(vNum, bCode, ch);
        }
        if (typeof MultiwindowSync !== 'undefined' && MultiwindowSync.broadcastVerseChanged) {
          MultiwindowSync.broadcastVerseChanged(bCode, ch, vNum);
        }
      }
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  getBibleLoaderHtml(bookName, chapterNum, bibleName) {
    const title = bookName ? `${bookName} ${chapterNum}` : 'SAINTE BIBLE';
    const sub = bibleName ? this.escapeHtml(bibleName.toUpperCase()) : 'TEXTE SACRÉ & CANON BIBLIQUE';
    return `
      <div class="bible-view-loader">
        <div class="bible-loader-glow">
          <div class="bible-loader-icon">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
            </svg>
          </div>
        </div>
        <div class="bible-loader-title">${title}</div>
        <div class="bible-loader-subtitle">${sub}</div>
        <div class="bible-loader-progress-track">
          <div class="bible-loader-progress-bar"></div>
        </div>
        <div class="bible-loader-status">Chargement du texte biblique...</div>
      </div>
    `;
  },

  async navigateTo(bookCode, chapterNum, verseNum = null) {
    let finalBookCode = bookCode;
    let finalChapterNum = chapterNum;
    let finalVerseNum = verseNum;

    // Si le livre demandé n'existe pas dans la Bible active de la Colonne 1
    if (!this.isBookAvailableInBible(this.currentBible1, finalBookCode)) {
      const altBible = this.findBibleContainingBook(finalBookCode, 'Segond 21');
      if (altBible && altBible !== this.currentBible1) {
        const prevBible = this.currentBible1;
        this.currentBible1 = altBible;
        const bInfo = getBookInfo(finalBookCode);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Passage sur ${altBible} (${bInfo.name} non inclus dans ${prevBible})`);
        }
        TabsManager.updateActiveTab(altBible, finalBookCode, finalChapterNum);
        this.updatePaneHeader(1);
      }
    }

    this.currentBook = finalBookCode;
    this.currentChapter = finalChapterNum;
    this.loadedChapters = [{ book: finalBookCode, chapter: finalChapterNum }];

    const info = getBookInfo(finalBookCode);
    const targetVerse = finalVerseNum ? parseInt(finalVerseNum, 10) : null;
    formatPassagePill(finalBookCode, finalChapterNum, targetVerse);
    document.getElementById('pane-1-breadcrumb').textContent = `${info.name.toUpperCase()} > Chapitre ${finalChapterNum}`;
    const breadcrumb2 = document.getElementById('pane-2-breadcrumb');
    if (breadcrumb2) breadcrumb2.textContent = `${info.name.toUpperCase()} > Chapitre ${finalChapterNum}`;
    this.updatePaneHeader(1);

    const pane1Container = document.getElementById('pane-1-verses');
    if (pane1Container) {
      pane1Container.innerHTML = this.getBibleLoaderHtml(info.name.toUpperCase(), chapterNum, this.currentBible1);
    }

    if (this.isSplitView) {
      const pane2Container = document.getElementById('pane-2-verses');
      if (pane2Container) {
        pane2Container.innerHTML = this.getBibleLoaderHtml(info.name.toUpperCase(), chapterNum, this.currentBible2);
      }
      this.updatePaneHeader(2);
    }

    const data1 = await API.getChapterData(this.currentBible1, bookCode, chapterNum, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
    const block1 = this.createChapterBlockElement(1, data1, this.currentBible1);
    if (pane1Container) {
      pane1Container.innerHTML = '';
      pane1Container.appendChild(block1);
    }

    if (this.isSplitView) {
      const pane2Container = document.getElementById('pane-2-verses');
      const data2 = await API.getChapterData(this.currentBible2, bookCode, chapterNum, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
      if (pane2Container) {
        pane2Container.innerHTML = '';
        pane2Container.appendChild(block2);
      }
      
      const pane2 = document.getElementById('pane-2-content');
      if (pane2) pane2.scrollTop = 0;

      if (this.isScrollSynced) {
        const pane1 = document.getElementById('pane-1-content');
        setTimeout(() => {
          this.syncScrollToMatch(pane1, pane2);
        }, 60);
      }
    }

    const pane1 = document.getElementById('pane-1-content');
    if (pane1 && !targetVerse) pane1.scrollTop = 0;

    TabsManager.updateActiveTab(null, bookCode, chapterNum);
    this.applyVintageToPanes();

    if (targetVerse) {
      this.selectAndScrollToVerse(targetVerse, bookCode, chapterNum);
    } else {
      this.loadCommentariesForVerse(1);
    }

    if (typeof MultiwindowSync !== 'undefined' && MultiwindowSync.broadcastPassageNavigated) {
      MultiwindowSync.broadcastPassageNavigated(bookCode, info.name, chapterNum, targetVerse || 1);
    }
  },

  async searchPassage(refQuery) {
    if (!refQuery || typeof refQuery !== 'string') return false;
    try {
      const parsed = await API.parseReference(refQuery.trim());
      if (parsed && parsed.book) {
        App.switchView('bible');
        await this.navigateTo(parsed.book, parsed.chapter || 1, parsed.verse || null);
        return true;
      }
    } catch (e) {
      console.warn('[BibleReader] Erreur parsing passage:', e);
    }
    return false;
  },

  async loadPassage(bookCodeOrRef, chapterNum = 1, verseNum = null) {
    if (!bookCodeOrRef) return;
    App.switchView('bible');
    if (typeof chapterNum === 'number' && bookCodeOrRef.length <= 4) {
      await this.navigateTo(bookCodeOrRef, chapterNum, verseNum);
    } else {
      await this.searchPassage(bookCodeOrRef);
    }
  },

  selectVerse(bookCode, chapterNum, verseNum, options = {}) {
    const { scroll = true, behavior = 'smooth', block = 'center' } = options;
    const vStr = String(verseNum);
    const chStr = String(chapterNum || this.currentChapter);
    const bStr = String(bookCode || this.currentBook);

    this.selectedVerse = parseInt(vStr, 10) || 1;
    this._lastScrolledVerseRef = `${bStr}_${chStr}_${vStr}`;

    // Verrouiller le suivi de défilement automatique pendant l'animation de défilement
    this._isProgrammaticScroll = true;
    if (this._progScrollTimer) clearTimeout(this._progScrollTimer);
    this._progScrollTimer = setTimeout(() => {
      this._isProgrammaticScroll = false;
    }, 650);

    // Retirer 'selected' de tous les versets de l'espace de travail (volets 1 et 2)
    const workspace = document.getElementById('reader-workspace') || document;
    workspace.querySelectorAll('.verse-item.selected').forEach(el => el.classList.remove('selected'));

    // Surligner le verset dans le Volet 1
    const pane1 = document.getElementById('pane-1-content');
    const v1 = pane1?.querySelector(`.verse-item[data-book-code="${bStr}"][data-chapter="${chStr}"][data-verse-num="${vStr}"]`)
      || pane1?.querySelector(`.verse-item[data-verse-num="${vStr}"]`);
    if (v1) {
      v1.classList.add('selected');
      if (scroll) {
        v1.scrollIntoView({ block, behavior });
      }
    }

    // Surligner le verset dans le Volet 2 si la double vue est active
    if (this.isSplitView) {
      const pane2 = document.getElementById('pane-2-content');
      const v2 = pane2?.querySelector(`.verse-item[data-book-code="${bStr}"][data-chapter="${chStr}"][data-verse-num="${vStr}"]`)
        || pane2?.querySelector(`.verse-item[data-verse-num="${vStr}"]`);
      if (v2) {
        v2.classList.add('selected');
        // Si le défilement n'est pas synchronisé, faire défiler le volet 2 aussi
        if (scroll && !this.isScrollSynced) {
          v2.scrollIntoView({ block, behavior });
        }
      }
    }

    // Mettre à jour l'étiquette de référence en haut du lecteur
    formatPassagePill(bStr, chStr, vStr);

    // Charger les commentaires exégétiques pour ce verset
    this.loadCommentariesForVerse(vStr, bStr, chStr, true);

    // Synchroniser avec la fenêtre secondaire de commentaires
    if (typeof MultiwindowSync !== 'undefined' && MultiwindowSync.broadcastVerseChanged) {
      MultiwindowSync.broadcastVerseChanged(bStr, chStr, vStr);
    }
  },

  selectAndScrollToVerse(verseNum, bookCode = null, chapterNum = null) {
    const vNum = parseInt(verseNum, 10);
    if (!vNum) return;
    const bCode = bookCode || this.currentBook;
    const ch = chapterNum || this.currentChapter;

    setTimeout(() => {
      this.selectVerse(bCode, ch, vNum, { scroll: true, behavior: 'smooth', block: 'center' });
    }, 120);
  },

  async reloadCurrentChapters() {
    const chaptersToReload = [...this.loadedChapters];
    const pane1Container = document.getElementById('pane-1-verses');
    if (pane1Container) pane1Container.innerHTML = '';

    for (let i = 0; i < chaptersToReload.length; i++) {
      const c = chaptersToReload[i];
      const data = await API.getChapterData(this.currentBible1, c.book, c.chapter, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
      const block = this.createChapterBlockElement(1, data, this.currentBible1);
      if (i > 0) {
        const divider = document.createElement('div');
        divider.className = 'chapter-badge-divider';
        divider.innerHTML = `<span>${data.book_french} — Chapitre ${data.chapter}</span>`;
        pane1Container.appendChild(divider);
      }
      pane1Container.appendChild(block);
    }

    if (this.isSplitView) {
      const pane2Container = document.getElementById('pane-2-verses');
      if (pane2Container) pane2Container.innerHTML = '';
      for (let i = 0; i < chaptersToReload.length; i++) {
        const c = chaptersToReload[i];
        const data2 = await API.getChapterData(this.currentBible2, c.book, c.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
        const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);
        if (i > 0) {
          const divider2 = document.createElement('div');
          divider2.className = 'chapter-badge-divider';
          divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;
          pane2Container.appendChild(divider2);
        }
        pane2Container.appendChild(block2);
      }
    }
  },

  async loadNextChapterContinuous() {
    if (this.isLoadingMore || this.loadedChapters.length === 0) return;
    const last = this.loadedChapters[this.loadedChapters.length - 1];
    const next = getNextChapterCoord(last.book, last.chapter);
    if (!next) return;

    this.isLoadingMore = true;
    this.loadedChapters.push(next);

    // Colonne 1
    const data1 = await API.getChapterData(this.currentBible1, next.book, next.chapter, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
    const block1 = this.createChapterBlockElement(1, data1, this.currentBible1);

    const divider1 = document.createElement('div');
    divider1.className = 'chapter-badge-divider';
    divider1.innerHTML = `<span>${data1.book_french} — Chapitre ${data1.chapter}</span>`;

    const pane1Container = document.getElementById('pane-1-verses');
    if (pane1Container) {
      pane1Container.appendChild(divider1);
      pane1Container.appendChild(block1);
    }

    // Colonne 2 (si double vue)
    if (this.isSplitView) {
      const data2 = await API.getChapterData(this.currentBible2, next.book, next.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);

      const divider2 = document.createElement('div');
      divider2.className = 'chapter-badge-divider';
      divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;

      const pane2Container = document.getElementById('pane-2-verses');
      if (pane2Container) {
        pane2Container.appendChild(divider2);
        pane2Container.appendChild(block2);
      }
    }

    this.isLoadingMore = false;
  },

  async loadPrevChapterContinuous(scrollEl) {
    if (this.isLoadingMore || this.loadedChapters.length === 0) return;
    const first = this.loadedChapters[0];
    const prev = getPrevChapterCoord(first.book, first.chapter);
    if (!prev) return;

    this.isLoadingMore = true;
    this.loadedChapters.unshift(prev);

    // Colonne 1
    const data1 = await API.getChapterData(this.currentBible1, prev.book, prev.chapter, this.pane1IsInterlinear ? this.pane1InterlinearVersion : null);
    const block1 = this.createChapterBlockElement(1, data1, this.currentBible1);

    const divider1 = document.createElement('div');
    divider1.className = 'chapter-badge-divider';
    divider1.innerHTML = `<span>${data1.book_french} — Chapitre ${data1.chapter}</span>`;

    const pane1 = document.getElementById('pane-1-content');
    const pane1Container = document.getElementById('pane-1-verses');
    const oldScrollHeight1 = pane1 ? pane1.scrollHeight : 0;

    if (pane1Container) {
      pane1Container.prepend(divider1);
      pane1Container.prepend(block1);
    }

    if (pane1) {
      const diff1 = pane1.scrollHeight - oldScrollHeight1;
      pane1.scrollTop += diff1;
    }

    // Colonne 2 (si double vue)
    if (this.isSplitView) {
      const data2 = await API.getChapterData(this.currentBible2, prev.book, prev.chapter, this.pane2IsInterlinear ? this.pane2InterlinearVersion : null);
      const block2 = this.createChapterBlockElement(2, data2, this.currentBible2);

      const divider2 = document.createElement('div');
      divider2.className = 'chapter-badge-divider';
      divider2.innerHTML = `<span>${data2.book_french} — Chapitre ${data2.chapter}</span>`;

      const pane2 = document.getElementById('pane-2-content');
      const pane2Container = document.getElementById('pane-2-verses');
      const oldScrollHeight2 = pane2 ? pane2.scrollHeight : 0;

      if (pane2Container) {
        pane2Container.prepend(divider2);
        pane2Container.prepend(block2);
      }

      if (pane2) {
        const diff2 = pane2.scrollHeight - oldScrollHeight2;
        pane2.scrollTop += diff2;
      }
    }

    this.isLoadingMore = false;
  },

  createChapterBlockElement(paneNum, data, bibleName) {
    if (!data) return document.createElement('div');
    const block = document.createElement('div');
    block.className = 'chapter-block';
    block.dataset.book = data.book || this.currentBook;
    block.dataset.chapter = data.chapter || this.currentChapter;

    if (typeof VintageThemeManager !== 'undefined') {
      const bInfo = (this.installedBibles || []).find(b => 
        b.name === bibleName || 
        b.id === bibleName || 
        (b.version_code && b.version_code.toUpperCase() === (bibleName || '').toUpperCase())
      );
      const year = bInfo?.annee || bInfo?.year || bInfo?.title || bibleName;
      const epoch = VintageThemeManager.getEpoch(year);
      if (VintageThemeManager.enabled && epoch !== 'modern') {
        block.classList.add(`vintage-epoch-${epoch}`);
        block.classList.add(`vintage-intensity-${VintageThemeManager.intensity}`);
      }
    }

    if (parseInt(data.chapter, 10) === 1) {
      const bookCode = data.book || this.currentBook;
      const bInfo = typeof getBookInfo === 'function' ? getBookInfo(bookCode) : { name: bookCode };
      const introBanner = document.createElement('div');
      introBanner.className = 'bible-book-intro-badge';
      introBanner.dataset.action = 'open-book-intro';
      introBanner.dataset.book = bookCode;
      introBanner.innerHTML = `
        <div class="intro-badge-content">
          <span class="intro-badge-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
          </span>
          <span class="intro-badge-title">Introduction au livre de ${bInfo.name || bookCode}</span>
          <span class="intro-badge-desc">But, verset clé, contexte et plan d'ensemble</span>
        </div>
        <span class="intro-badge-arrow">
          <span>Ouvrir l'exégèse</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      `;
      introBanner.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.drawer-tab[data-drawer-tab="commentaries"]')?.click();
        if (typeof CommentaryViewer !== 'undefined') {
          CommentaryViewer.loadIntroduction(bookCode);
        }
      });
      block.appendChild(introBanner);
    }

    if (data.pericope) {
      const pericope = document.createElement('h1');
      pericope.className = 'pericope-title';
      pericope.textContent = data.pericope;
      block.appendChild(pericope);
    }

    const isPaneInterlinear = paneNum === 1 ? this.pane1IsInterlinear : this.pane2IsInterlinear;
    const paneInterVersion = paneNum === 1 ? this.pane1InterlinearVersion : this.pane2InterlinearVersion;

    const flow = document.createElement('div');
    flow.className = 'verses-flow';
    if (isPaneInterlinear) {
      flow.classList.add('interlinear-mode');
    }

    if (data.verses && Array.isArray(data.verses) && data.verses.length > 0) {
      // 1. Regroupement intelligent des versets contenant des lieux en passages contigus
      const clusters = [];
      let curCluster = null;

      data.verses.forEach(v => {
        const places = v.geo_places || [];
        if (places.length > 0) {
          if (curCluster && v.verse <= curCluster.endVerse + 2) {
            curCluster.endVerse = v.verse;
            curCluster.versesList.push(v.verse);
            places.forEach(p => {
              if (!curCluster.places.some(cp => cp.place_id === p.place_id)) {
                curCluster.places.push(p);
              }
            });
          } else {
            if (curCluster) clusters.push(curCluster);
            curCluster = {
              id: `geoc_${data.book}_${data.chapter}_${v.verse}`,
              book: data.book || this.currentBook,
              chapter: data.chapter || this.currentChapter,
              startVerse: v.verse,
              endVerse: v.verse,
              versesList: [v.verse],
              places: [...places]
            };
          }
        } else {
          if (curCluster && v.verse > curCluster.endVerse + 2) {
            clusters.push(curCluster);
            curCluster = null;
          }
        }
      });
      if (curCluster) clusters.push(curCluster);

      // Tables d'accès rapide
      const clusterByVerse = {};
      const clusterStartMap = {};
      clusters.forEach(c => {
        clusterStartMap[c.startVerse] = c;
        c.versesList.forEach(vNum => {
          clusterByVerse[vNum] = c;
        });
        GeoPassageHoverManager.registerCluster(c);
      });

      // 2. Rendu des versets
      data.verses.forEach((v, index) => {
        const vSpan = document.createElement('span');
        vSpan.className = 'verse-item';
        vSpan.dataset.verseNum = v.verse;
        vSpan.dataset.bookCode = data.book || this.currentBook;
        vSpan.dataset.chapter = data.chapter || this.currentChapter;

        if (clusterByVerse[v.verse]) {
          vSpan.dataset.geoClusterId = clusterByVerse[v.verse].id;
        }

        // Indicateur de passage géographique en marge droite sur le 1er verset de la plage
        let marginBadgeHtml = '';
        if (clusterStartMap[v.verse]) {
          const cl = clusterStartMap[v.verse];
          const rangeLabel = cl.startVerse === cl.endVerse 
            ? `v. ${cl.startVerse}` 
            : `v. ${cl.startVerse}–${cl.endVerse}`;
          const firstPlaceId = cl.places[0]?.place_id || '';

          marginBadgeHtml = `
            <span class="geo-passage-anchor-marker" data-cluster-id="${cl.id}">
              <span class="geo-passage-margin-badge">
                <button type="button" class="geo-passage-bracket-btn" data-cluster-id="${cl.id}" data-place-id="${firstPlaceId}" data-book="${data.book}" data-chap="${data.chapter}" data-start="${cl.startVerse}" data-end="${cl.endVerse}">
                  <span class="geo-bracket-rail-top"></span>
                  <span class="geo-bracket-pill">
                    <svg class="geo-bracket-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"></path>
                      <path d="M9 3v15"></path>
                      <path d="M15 6v15"></path>
                    </svg>
                    <span class="geo-bracket-range">${rangeLabel}</span>
                  </span>
                  <span class="geo-bracket-rail-bottom"></span>
                </button>
              </span>
            </span>
          `;
        }

        if (isPaneInterlinear && v.words && v.words.length > 0) {
          vSpan.className = 'verse-item interlinear-mode';
          let wordsHtml = '';
          v.words.forEach(w => {
            let surf = (w.surface || '').trim();
            if (!surf) return;

            // Ignorer les puces ou tirets isolés résiduels du balisage XML
            if (/^[•—–]$/.test(surf)) return;

            // Ponctuation pure : intégration sans créer de colonne vide
            const isPunct = /^[.,;:!?«»"()\[\]]+$/.test(surf);
            if (isPunct) {
              wordsHtml += `<span class="interlinear-punct">${surf}</span>`;
              return;
            }

            const showSurf = this.interlinearLayers.surface;
            const hasStrong = !!w.strong;
            const showOrig = this.interlinearLayers.orig && w.orig && w.orig !== w.surface;
            const showTrans = this.interlinearLayers.translit && w.translit;
            const showStrong = this.interlinearLayers.strong && w.strong;

            let displaySurf = surf;
            let isItalic = false;
            if (this.bracketsMode === 'italic') {
              if (displaySurf.includes('[') || displaySurf.includes(']')) {
                displaySurf = `<em>${displaySurf.replace(/[\[\]]/g, '')}</em>`;
                isItalic = true;
              }
            } else if (this.bracketsMode === 'plain') {
              displaySurf = displaySurf.replace(/[\[\]]/g, '');
            }

            const blockClass = hasStrong ? 'interlinear-block has-strong' : 'interlinear-block plain-word';
            const italicClass = isItalic ? ' bracket-interpolated-italic' : '';

            wordsHtml += `
              <div class="${blockClass}${italicClass}" data-strong="${w.strong || ''}" data-word="${w.orig || w.surface}" data-surface="${w.surface}" title="${w.morph || (w.strong ? `Strong: ${w.strong}` : '')}">
                ${showSurf ? `<span class="interlinear-surface">${displaySurf}</span>` : ''}
                ${showOrig ? `<span class="interlinear-lemma">${w.orig}</span>` : ''}
                ${showTrans ? `<span class="interlinear-translit">${w.translit}</span>` : ''}
                ${showStrong ? `<span class="interlinear-strong">${w.strong}</span>` : ''}
              </div>
            `;
          });
          const badgeText = paneInterVersion === 'DARBY' ? 'Bible Darby (Interlinéaire Inversé)' : 'Louis Segond 1910 (Interlinéaire Inversé)';
          vSpan.innerHTML = `
            <div class="verse-interlinear-header">
              <sup class="verse-num">${v.verse}</sup>
              <span class="verse-interlinear-badge">${badgeText}</span>
              ${marginBadgeHtml}
            </div>
            <div class="verse-interlinear-grid">${wordsHtml}</div>
          `;

          vSpan.querySelectorAll('.interlinear-block').forEach(b => {
            b.addEventListener('click', (e) => {
              e.stopPropagation();
              this.selectVerse(data.book || this.currentBook, data.chapter || this.currentChapter, v.verse, { scroll: false });
              if (b.dataset.strong) {
                this.lookupWordInLexicon(b.dataset.word, b.dataset.strong);
              }
            });
            b.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              ContextMenuManager.showForWord(b.dataset.surface || b.dataset.word, b.dataset.strong, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });
            b.addEventListener('contextmenu', (e) => {
              const sel = window.getSelection();
              if (sel && sel.toString().trim().length > 0) return;
              e.preventDefault();
              e.stopPropagation();
              ContextMenuManager.showForWord(b.dataset.surface || b.dataset.word, b.dataset.strong, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });
          });

        } else {
          // Lecture continue avec mots cliquables
          const isFirst = index === 0;
          const numHtml = isFirst 
            ? `<span class="chapter-number-dropcap">${data.chapter}</span><sup class="verse-num">${v.verse}</sup>`
            : `<sup class="verse-num">${v.verse}</sup>`;

          // Traitement combiné : notes entre parenthèses + mots entre crochets
          const rawText = v.text || '';
          const parts = rawText.split(/(\([^)]+\))/g);
          let formattedHtml = marginBadgeHtml + numHtml;
          let inBracket = false;

          parts.forEach(part => {
            if (!part) return;

            // Détection intelligente : note philologique / variante entre parenthèses
            if (part.startsWith('(') && part.endsWith(')') && NOTE_PREFIX_REGEX.test(part)) {
              const cleanNote = part.slice(1, -1).trim();
              if (this.parenthesesMode === 'callout') {
                formattedHtml += `<sup class="note-callout-marker" data-note-text="${cleanNote.replace(/"/g, '&quot;')}" data-verse="${v.verse}" title="Note : ${cleanNote.replace(/"/g, '&quot;')}">ⁿ</sup>`;
                return;
              } else if (this.parenthesesMode === 'hidden') {
                return;
              }
              // Si mode classic, continuer vers le découpage en tokens normal
            }

            // Découpage en tokens des mots avec gestion des séparateurs poétiques
            let cleanChunk = (part || '').replace(/<[^>]+>/g, '');
            if (this.caesuraMode === 'indent') {
              cleanChunk = cleanChunk.replace(/[\u2575\u2577\u2502|¦]\s*/g, ' ___POETIC_CAESURA_BREAK___ ');
            } else if (this.caesuraMode === 'hidden') {
              cleanChunk = cleanChunk.replace(/[\u2575\u2577\u2502|¦]\s*/g, ' ');
            }

            const tokens = cleanChunk.split(/(\s+)/);

            tokens.forEach(tok => {
              if (!tok || /^\s+$/.test(tok)) {
                formattedHtml += tok;
              } else if (tok === '___POETIC_CAESURA_BREAK___') {
                formattedHtml += '<span class="poetic-caesura-break"><br><span class="poetic-tab"></span></span>';
              } else {
                const hasOpeningBracket = tok.includes('[');
                const hasClosingBracket = tok.includes(']');
                const isCurrentlyBracketed = inBracket || hasOpeningBracket;

                if (hasOpeningBracket) inBracket = true;

                let displayTok = tok;
                let isItalic = false;

                if (this.bracketsMode === 'italic') {
                  displayTok = tok.replace(/[\[\]]/g, '');
                  if (isCurrentlyBracketed) {
                    displayTok = `<em>${displayTok}</em>`;
                    isItalic = true;
                  }
                } else if (this.bracketsMode === 'plain') {
                  displayTok = displayTok.replace(/[\[\]]/g, '');
                }

                if (hasClosingBracket) inBracket = false;

                const cleanWord = tok.replace(/^[«"'(]+|[»"') ,;:!?.…]+$/g, '').replace(/[\[\]\u2575\u2577\u2502|¦]/g, '');
                formattedHtml += `<span class="word-token ${isItalic ? 'bracket-interpolated-italic' : ''}" data-word="${cleanWord}" data-verse="${v.verse}">${displayTok}</span>`;
              }
            });
          });

          vSpan.innerHTML = formattedHtml;

          // Écouteurs sur chaque mot
          vSpan.querySelectorAll('.word-token').forEach(wEl => {
            const w = wEl.dataset.word;
            wEl.addEventListener('click', (e) => {
              e.stopPropagation();
              this.selectVerse(data.book || this.currentBook, data.chapter || this.currentChapter, v.verse, { scroll: false });
              this.lookupWordInLexicon(w);
            });

            wEl.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              ContextMenuManager.showForWord(w, null, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });

            wEl.addEventListener('contextmenu', (e) => {
              const sel = window.getSelection();
              if (sel && sel.toString().trim().length > 0) return;
              e.preventDefault();
              e.stopPropagation();
              ContextMenuManager.showForWord(w, null, v.verse, data.book, data.chapter, e.clientX, e.clientY);
            });
          });
        }

        // Clic sur le verset (hors mot spécifique ou pour sélectionner) -> charger commentaires
        vSpan.addEventListener('click', () => {
          this.selectVerse(data.book || this.currentBook, data.chapter || this.currentChapter, v.verse, { scroll: false });
        });

        // Double clic sur le verset -> menu contextuel verset
        vSpan.addEventListener('dblclick', (e) => {
          if (!e.target.classList.contains('word-token')) {
            ContextMenuManager.showForVerse(v.verse, v.text, data.book, data.chapter, e.clientX, e.clientY);
          }
        });

        // Clic droit sur le verset -> menu contextuel verset
        vSpan.addEventListener('contextmenu', (e) => {
          const sel = window.getSelection();
          if (sel && sel.toString().trim().length > 0) return;
          if (!e.target.classList.contains('word-token')) {
            e.preventDefault();
            ContextMenuManager.showForVerse(v.verse, v.text, data.book, data.chapter, e.clientX, e.clientY);
          }
        });

        flow.appendChild(vSpan);
      });

      // 2b. Écouteurs sur les appels de notes de traduction (Survol -> Infobulle)
      flow.querySelectorAll('.note-callout-marker').forEach(marker => {
        marker.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          TranslationNoteHoverManager.show(marker, marker.dataset.noteText, marker.dataset.verse);
        });
        marker.addEventListener('mouseleave', (e) => {
          e.stopPropagation();
          TranslationNoteHoverManager.scheduleHide();
        });
        marker.addEventListener('click', (e) => {
          e.stopPropagation();
          TranslationNoteHoverManager.show(marker, marker.dataset.noteText, marker.dataset.verse);
        });
      });

      // 3. Écouteurs sur les boutons de passage de marge (Survol -> Infobulle riche & Surbrillance plage)
      flow.querySelectorAll('.geo-passage-bracket-btn').forEach(btn => {
        const clusterId = btn.dataset.clusterId;
        btn.addEventListener('mouseenter', (e) => {
          e.stopPropagation();
          GeoPassageHoverManager.showForCluster(btn, clusterId);
        });
        btn.addEventListener('mouseleave', (e) => {
          e.stopPropagation();
          GeoPassageHoverManager.scheduleHide();
        });
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const pId = btn.dataset.placeId;
          const b = btn.dataset.book;
          const ch = parseInt(btn.dataset.chap, 10);
          GeoPassageHoverManager.navigateToMap(pId, b, ch);
        });
      });
    } else {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'chapter-unavailable-notice';
      const bDisp = this.getBibleDisplayName(bibleName) || bibleName;
      const bFr = data.book_french || (typeof getFrenchBookName === 'function' ? getFrenchBookName(data.book) : data.book);
      emptyNotice.innerHTML = `
        <div class="empty-notice-box">
          <div class="empty-notice-icon">📖</div>
          <div class="empty-notice-title">Livre non disponible dans cette version</div>
          <div class="empty-notice-desc">
            Le livre de <strong>${this.escapeHtml(bFr)}</strong> n'est pas inclus dans <em>${this.escapeHtml(bDisp)}</em>.
          </div>
        </div>
      `;
      flow.appendChild(emptyNotice);
    }

    block.appendChild(flow);

    // Rendre les surlignages asynchronement pour ce bloc
    if (typeof HighlighterManager !== 'undefined') {
      setTimeout(() => HighlighterManager.renderChapterHighlights(data.book || this.currentBook, data.chapter || this.currentChapter, data.bible_name || this.currentVersion), 50);
    }

    return block;
  },

  async loadCommentariesForVerse(verseNum, bookCode = null, chapterNum = null, force = false) {
    const vInt = parseInt(verseNum, 10) || 1;
    const chInt = parseInt(chapterNum || this.currentChapter, 10) || 1;
    const book = bookCode || this.currentBook;
    this.selectedVerse = vInt;
    const bookInfo = getBookInfo(book);
    const refStr = `${bookInfo.name} ${chInt}:${vInt}`;

    // Si la synchronisation est active ou si l'action est forcée
    if (force || (typeof CommentaryViewer !== 'undefined' && CommentaryViewer.isSynchronized)) {
      try {
        const comms = await API.getCommentaries(book, chInt, vInt);
        CommentaryViewer.setComments(comms, refStr, book, chInt, vInt);
      } catch (e) {
        console.error('Erreur commentaires:', e);
      }

      if (typeof MultiwindowSync !== 'undefined' && MultiwindowSync.broadcastVerseChanged) {
        MultiwindowSync.broadcastVerseChanged(book, chInt, vInt);
      }
    }

    // Synchronisation automatique des notes dans le volet latéral
    try {
      DrawerNotesViewer.load(book, chInt, vInt);
    } catch (e) {
      console.error('Erreur sync DrawerNotesViewer:', e);
    }

    // Synchronisation automatique du volet Aperçu 360° du passage
    try {
      if (typeof PassageOverviewDrawer !== 'undefined') {
        PassageOverviewDrawer.load(book, chInt, vInt, this.currentBible1 || 'LSG', force);
      }
    } catch (e) {
      console.error('Erreur sync PassageOverviewDrawer:', e);
    }

    // Synchronisation automatique de BibleProject (Médias & Posters)
    try {
      if (typeof BibleProjectView !== 'undefined') {
        const mediaTab = document.querySelector('.drawer-tab[data-drawer-tab="media"]');
        if (mediaTab && mediaTab.classList.contains('active')) {
          BibleProjectView.load(book, ch, force);
        }
      }
    } catch (e) {
      console.error('Erreur sync BibleProjectView:', e);
    }

    // Synchronisation automatique des Articles contemporains
    try {
      if (typeof ArticlesView !== 'undefined' && ArticlesView.loadDrawerArticles) {
        const articlesTab = document.querySelector('.drawer-tab[data-drawer-tab="articles"]');
        if (articlesTab && articlesTab.classList.contains('active')) {
          ArticlesView.loadDrawerArticles(book, ch);
        } else {
          const badgeEl = document.getElementById('lbl-drawer-articles-passage');
          if (badgeEl) {
            const frenchName = (typeof getFrenchBookName === 'function' ? getFrenchBookName(book) : null) || book;
            badgeEl.textContent = `${frenchName} ${ch}`;
          }
        }
      }
    } catch (e) {
      console.error('Erreur sync ArticlesView:', e);
    }
  },



  async lookupWordInLexicon(word, strongCode = null) {
    LexiconViewer.load(word, strongCode);
  },

  openBiblePicker(paneNum) {
    this.targetPaneForPicker = paneNum;
    const popover = document.getElementById('bible-version-picker-popover');
    const listEl = document.getElementById('version-list-items');
    const indicator = document.getElementById('version-picker-pane-indicator');
    const searchInput = document.getElementById('bible-picker-search');
    
    if (indicator) {
      indicator.textContent = paneNum === 1 ? 'Colonne 1 (Principale)' : 'Colonne 2 (Parallèle)';
    }

    if (searchInput) searchInput.value = '';
    this.activePickerFamily = 'all';
    document.querySelectorAll('#version-picker-families-bar .fam-filter-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.fam === 'all');
    });

    listEl.innerHTML = '';

    const currentSelected = paneNum === 1 ? this.currentBible1 : this.currentBible2;
    const otherPaneSelected = paneNum === 1 ? this.currentBible2 : this.currentBible1;
    const suggestedForComp = this.getSuggestedComparativeBible(otherPaneSelected);

    this.installedBibles.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `version-row-btn ${b.name === currentSelected ? 'active' : ''}`;
      btn.dataset.name = (b.name || '').toLowerCase();
      btn.dataset.title = (b.title || '').toLowerCase();
      btn.dataset.code = (b.version_code || '').toLowerCase();
      btn.dataset.famille = b.famille || 'Famille Segond';

      const isSuggested = suggestedForComp && b.name === suggestedForComp.name && b.name !== currentSelected;
      const displayTitle = b.title || b.name;
      const displayCode = b.version_code || b.name;
      const displayFam = b.famille || 'Famille Segond';
      const famColor = b.famille_badge_color || '#2563EB';
      const phil = b.philosophie || b.editeur || '';

      btn.innerHTML = `
        <div class="version-row-top">
          <span class="version-name-full" title="${displayTitle}">${displayTitle}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="version-family-badge" style="background-color: ${famColor};">${displayFam}</span>
            <span class="version-badge-code">${displayCode}</span>
          </div>
        </div>
        <div class="version-row-sub">
          <span class="version-philosophy-tag" title="${phil}">${phil || (b.annee ? `Édition ${b.annee}` : '')}</span>
          ${isSuggested ? '<span class="version-suggested-tag"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Suggérée pour comparaison</span>' : ''}
        </div>
      `;
      btn.addEventListener('click', () => {
        this.selectBibleVersion(b.name);
      });
      listEl.appendChild(btn);
    });

    // Affichage conditionnel : UNIQUEMENT si au moins une version n'est pas encore téléchargée/active dans le lecteur
    const footerEl = document.getElementById('version-picker-store-footer');
    const footerBtn = document.getElementById('btn-picker-open-store');
    const footerText = document.getElementById('version-picker-store-btn-text');

    if (footerEl && footerBtn && typeof OpenShemaStore !== 'undefined') {
      OpenShemaStore.getMissingBiblesCount().then(missingCount => {
        if (missingCount > 0) {
          footerEl.style.display = 'block';
          if (footerText) {
            footerText.textContent = `Catalogue Open Shema (${missingCount} version${missingCount > 1 ? 's' : ''} disponible${missingCount > 1 ? 's' : ''})`;
          }
          footerBtn.onclick = () => {
            this.closeBiblePicker();
            OpenShemaStore.open('bibles');
          };
        } else {
          footerEl.style.display = 'none';
        }
      }).catch(err => {
        console.warn('Erreur vérification Bibles manquantes:', err);
        footerEl.style.display = 'none';
      });
    }

    popover.classList.remove('hidden');
    searchInput?.focus();
  },

  filterBiblePickerList() {
    const searchVal = (document.getElementById('bible-picker-search')?.value || '').toLowerCase().trim();
    const famVal = this.activePickerFamily || 'all';

    document.querySelectorAll('#version-list-items .version-row-btn').forEach(btn => {
      const btnName = btn.dataset.name || '';
      const btnTitle = btn.dataset.title || '';
      const btnCode = btn.dataset.code || '';
      const btnFam = btn.dataset.famille || '';

      const matchSearch = !searchVal || btnName.includes(searchVal) || btnTitle.includes(searchVal) || btnCode.includes(searchVal) || btnFam.toLowerCase().includes(searchVal);
      const matchFam = famVal === 'all' || btnFam === famVal;

      btn.style.display = (matchSearch && matchFam) ? 'flex' : 'none';
    });
  },

  closeBiblePicker() {
    document.getElementById('bible-version-picker-popover').classList.add('hidden');
  },

  selectBibleVersion(versionName) {
    this.closeBiblePicker();
    const item = this.getBibleInfo(versionName);
    const targetVersionName = item ? item.name : versionName;
    const curV = this.selectedVerse || 1;

    if (this.targetPaneForPicker === 1) {
      this.currentBible1 = targetVersionName;
      if (targetVersionName === 'DARBY') {
        this.pane1IsInterlinear = true;
        this.pane1InterlinearVersion = 'DARBY';
      } else if (targetVersionName === 'LSG') {
        this.pane1IsInterlinear = true;
        this.pane1InterlinearVersion = 'LSG';
      } else {
        this.pane1IsInterlinear = false;
      }
      const interBtn = document.getElementById('btn-toggle-interlinear');
      if (interBtn) interBtn.classList.toggle('active', this.pane1IsInterlinear || this.pane2IsInterlinear);

      // Si le livre actuellement affiché n'est pas présent dans la nouvelle version (ex: Genèse dans une version NT uniquement comme Stapfer)
      let targetBook = this.currentBook;
      let targetChapter = this.currentChapter;
      let targetVerse = curV;

      if (!this.isBookAvailableInBible(targetVersionName, targetBook)) {
        targetBook = this.getFirstBookForBible(targetVersionName);
        targetChapter = 1;
        targetVerse = 1;
        this.currentBook = targetBook;
        this.currentChapter = targetChapter;
        this.selectedVerse = targetVerse;
      }

      TabsManager.updateActiveTab(targetVersionName, targetBook, targetChapter, this.pane1IsInterlinear, this.pane1InterlinearVersion);
      this.updatePaneHeader(1);
      this.navigateTo(targetBook, targetChapter, targetVerse);
    } else {
      this.currentBible2 = targetVersionName;
      if (targetVersionName === 'DARBY') {
        this.pane2IsInterlinear = true;
        this.pane2InterlinearVersion = 'DARBY';
      } else if (targetVersionName === 'LSG') {
        this.pane2IsInterlinear = true;
        this.pane2InterlinearVersion = 'LSG';
      } else {
        this.pane2IsInterlinear = false;
      }
      const interBtn = document.getElementById('btn-toggle-interlinear');
      if (interBtn) interBtn.classList.toggle('active', this.pane1IsInterlinear || this.pane2IsInterlinear);
      this.updatePaneHeader(2);
      this.reloadPane2();
    }
  },

  switchVersion(versionName) {
    if (!versionName) return;
    this.targetPaneForPicker = 1;
    this.selectBibleVersion(versionName);
  },

  goToNextChapter() {
    const next = getNextChapterCoord(this.currentBook, this.currentChapter);
    if (next) {
      this.navigateTo(next.book, next.chapter);
    }
  },

  goToPrevChapter() {
    const prev = getPrevChapterCoord(this.currentBook, this.currentChapter);
    if (prev) {
      this.navigateTo(prev.book, prev.chapter);
    }
  },

  selectNextVerse() {
    const pane1 = document.getElementById('pane-1-content');
    if (!pane1) return;
    const allVerses = Array.from(pane1.querySelectorAll('.verse-item'));
    if (allVerses.length === 0) return;

    let curSelected = pane1.querySelector('.verse-item.selected');
    let curIdx = -1;
    if (curSelected) {
      curIdx = allVerses.indexOf(curSelected);
    } else if (this.selectedVerse) {
      curIdx = allVerses.findIndex(el => parseInt(el.dataset.verseNum, 10) === this.selectedVerse);
    }

    let nextIdx = 0;
    if (curIdx >= 0 && curIdx < allVerses.length - 1) {
      nextIdx = curIdx + 1;
    } else if (curIdx >= allVerses.length - 1) {
      nextIdx = allVerses.length - 1;
    } else {
      const topV = this.getTopVisibleVerse(pane1);
      if (topV && topV.element) {
        const topIdx = allVerses.indexOf(topV.element);
        nextIdx = Math.min(allVerses.length - 1, topIdx + 1);
      }
    }

    const target = allVerses[nextIdx];
    if (target) {
      const vNum = target.dataset.verseNum;
      const bCode = target.dataset.bookCode || this.currentBook;
      const ch = target.dataset.chapter || this.currentChapter;
      this.selectVerse(bCode, ch, vNum, { scroll: true, behavior: 'smooth', block: 'center' });
    }
  },

  selectPrevVerse() {
    const pane1 = document.getElementById('pane-1-content');
    if (!pane1) return;
    const allVerses = Array.from(pane1.querySelectorAll('.verse-item'));
    if (allVerses.length === 0) return;

    let curSelected = pane1.querySelector('.verse-item.selected');
    let curIdx = -1;
    if (curSelected) {
      curIdx = allVerses.indexOf(curSelected);
    } else if (this.selectedVerse) {
      curIdx = allVerses.findIndex(el => parseInt(el.dataset.verseNum, 10) === this.selectedVerse);
    }

    let prevIdx = 0;
    if (curIdx > 0) {
      prevIdx = curIdx - 1;
    } else if (curIdx === 0) {
      prevIdx = 0;
    } else {
      const topV = this.getTopVisibleVerse(pane1);
      if (topV && topV.element) {
        const topIdx = allVerses.indexOf(topV.element);
        prevIdx = Math.max(0, topIdx - 1);
      }
    }

    const target = allVerses[prevIdx];
    if (target) {
      const vNum = target.dataset.verseNum;
      const bCode = target.dataset.bookCode || this.currentBook;
      const ch = target.dataset.chapter || this.currentChapter;
      this.selectVerse(bCode, ch, vNum, { scroll: true, behavior: 'smooth', block: 'center' });
    }
  }
};

window.BibleReader = BibleReader;
