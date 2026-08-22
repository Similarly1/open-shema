/**
 * Theology View Controller
 * Gère la page dédiée plein écran à la lecture des ouvrages de théologie :
 * - Sélecteur d'ouvrages déroulant Logos-style avec couvertures et recherche
 * - Sommaire / Table des matières (TOC) latérale pliable (Master-Detail)
 * - Navigation fluide de chapitre en chapitre (◀ / ▶)
 * - Options typographiques complètes : Zoom (− / +), Polices (Sérif / Sans-sérif), Fond de lecture (Blanc, Sépia, Nuit, Auto), Pleine largeur
 * - Synthèse théologique IA de chapitre
 * - Traduction française à la volée des ouvrages anglophones (Grudem, NIV, MacArthur)
 * - Références bibliques interactives intégrées au texte
 * - Copie et export vers les notes Markdown (.md)
 */

const TheologyView = {
  books: [],
  currentBook: null,
  currentChapterId: null,
  currentChapterData: null,
  tocList: [],
  
  // État UI
  isTocOpen: true,
  isLoading: false,
  isSynthMode: false,
  latestSynthesisMarkdown: '',

  // Paramètres d'affichage
  zoomPercent: 100,
  fontFamily: 'EB Garamond',
  readingBg: 'auto',
  isFullWidth: false,

  // Cache de traduction française
  translationCache: {},
  showTranslatedVersion: false,
  translatedToc: {},
  showTranslatedToc: true,

  // Résumé de chapitre IA
  summaryCache: {},
  showChapterSummary: false,
  isSummaryLoading: false,

  // Éléments du DOM
  btnToggleToc: null,
  btnTranslateToc: null,
  tocPanel: null,
  tocSearchInput: null,
  tocListContainer: null,
  
  btnActiveSelector: null,
  activeBookCover: null,
  activeBookInitials: null,
  activeBookTitle: null,
  activeBookMeta: null,
  activeChaptersCount: null,
  pickerPopover: null,
  pickerSearchInput: null,
  pickerList: null,

  btnPrevChapter: null,
  btnNextChapter: null,
  chapterPillText: null,

  btnDisplayOptions: null,
  displayPopover: null,
  btnZoomOut: null,
  btnZoomIn: null,
  lblZoomLevel: null,
  optFullWidth: null,

  btnSynthHeader: null,
  btnSummaryHeader: null,
  btnTranslateHeader: null,
  btnExportNote: null,
  btnCopyText: null,
  btnOpenBible: null,

  articleContainer: null,
  articleCard: null,
  articleHero: null,
  articleContent: null,
  articleFooterNav: null,

  // Panneau Synthèse IA
  synthContainer: null,
  synthCard: null,
  synthPassageBadge: null,
  synthLoadingBox: null,
  synthResultContainer: null,
  synthMarkdownContent: null,
  btnCloseSynth: null,
  btnCopySynth: null,
  btnExportSynthNote: null,

  init() {
    // Restaurer les préférences d'affichage
    try {
      const savedZoom = localStorage.getItem('theol_view_zoom') || localStorage.getItem('bible_reader_zoom');
      if (savedZoom) this.zoomPercent = parseInt(savedZoom, 10) || 100;

      const savedFont = localStorage.getItem('theol_view_font');
      if (savedFont) this.fontFamily = savedFont;

      const savedBg = localStorage.getItem('theol_reading_bg');
      if (savedBg) this.readingBg = savedBg;

      const savedWidth = localStorage.getItem('theol_full_width');
      if (savedWidth === 'true') this.isFullWidth = true;

      const savedToc = localStorage.getItem('theol_toc_open');
      if (savedToc !== null) this.isTocOpen = savedToc === 'true';
    } catch (e) {}

    this.cacheDomElements();
    this.bindEvents();
    this.applyDisplayPreferences();
    this.renderInitialLoadingState();
  },

  cacheDomElements() {
    this.btnToggleToc = document.getElementById('btn-theol-toggle-toc');
    this.btnTranslateToc = document.getElementById('btn-theol-translate-toc');
    this.tocPanel = document.getElementById('theol-toc-panel');
    this.tocSearchInput = document.getElementById('theol-toc-search-input');
    this.tocListContainer = document.getElementById('theol-toc-list');

    this.btnActiveSelector = document.getElementById('btn-theol-active-selector');
    this.activeBookCover = document.getElementById('theol-active-book-cover');
    this.activeBookInitials = document.getElementById('theol-active-book-initials');
    this.activeBookTitle = document.getElementById('theol-active-book-title');
    this.activeBookMeta = document.getElementById('theol-active-book-meta');
    this.activeChaptersCount = document.getElementById('theol-active-chapters-count');
    this.pickerPopover = document.getElementById('theol-picker-popover');
    this.pickerSearchInput = document.getElementById('theol-picker-search-input');
    this.pickerList = document.getElementById('theol-picker-list');

    this.btnPrevChapter = document.getElementById('btn-theol-prev');
    this.btnNextChapter = document.getElementById('btn-theol-next');
    this.chapterPillText = document.getElementById('theol-chapter-pill-text');

    this.btnDisplayOptions = document.getElementById('btn-theol-display-options');
    this.displayPopover = document.getElementById('theol-display-popover');
    this.btnZoomOut = document.getElementById('btn-theol-zoom-out');
    this.btnZoomIn = document.getElementById('btn-theol-zoom-in');
    this.lblZoomLevel = document.getElementById('lbl-theol-zoom-level');
    this.optFullWidth = document.getElementById('theol-opt-full-width');

    this.btnSynthHeader = document.getElementById('btn-theol-view-synth');
    this.btnSummaryHeader = document.getElementById('btn-theol-view-summary');
    this.btnTranslateHeader = document.getElementById('btn-theol-view-translate');
    this.btnExportNote = document.getElementById('btn-theol-export-note');
    this.btnCopyText = document.getElementById('btn-theol-copy-text');
    this.btnOpenBible = document.getElementById('btn-theol-open-bible');

    this.articleContainer = document.getElementById('theol-article-container');
    this.articleCard = document.getElementById('theol-article-card');
    this.articleHero = document.getElementById('theol-article-hero');
    this.articleContent = document.getElementById('theol-article-content');
    this.articleFooterNav = document.getElementById('theol-footer-nav');

    // Synthèse IA
    this.synthContainer = document.getElementById('theol-page-synth-container');
    this.synthCard = document.getElementById('theol-page-synth-card');
    this.synthPassageBadge = document.getElementById('theol-page-synth-badge');
    this.synthLoadingBox = document.getElementById('theol-page-synth-loading-box');
    this.synthResultContainer = document.getElementById('theol-page-synth-result-container');
    this.synthMarkdownContent = document.getElementById('theol-page-synth-markdown-content');
    this.btnCloseSynth = document.getElementById('btn-close-theol-page-synth');
    this.btnCopySynth = document.getElementById('btn-theol-page-copy-synth');
    this.btnExportSynthNote = document.getElementById('btn-theol-page-export-synth-note');
  },

  bindEvents() {
    // 1. Bascule du panneau Table des Matières (TOC)
    this.btnToggleToc?.addEventListener('click', () => {
      this.toggleToc();
    });

    // Traduction des titres de la Table des Matières
    this.btnTranslateToc?.addEventListener('click', () => {
      this.toggleTocTranslation();
    });

    // Filtre recherche dans la Table des Matières
    this.tocSearchInput?.addEventListener('input', () => {
      this.renderTocList();
    });

    // 2. Sélecteur principal déroulant d'ouvrages
    this.btnActiveSelector?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePickerPopover();
    });

    this.pickerSearchInput?.addEventListener('input', () => {
      this.renderPickerList();
    });

    // 3. Navigation Précédent / Suivant
    this.btnPrevChapter?.addEventListener('click', () => {
      if (this.currentChapterData?.prev_chapter) {
        this.loadChapter(this.currentBook, this.currentChapterData.prev_chapter.chapter_id);
      }
    });

    this.btnNextChapter?.addEventListener('click', () => {
      if (this.currentChapterData?.next_chapter) {
        this.loadChapter(this.currentBook, this.currentChapterData.next_chapter.chapter_id);
      }
    });

    // 4. Options d'affichage
    this.btnDisplayOptions?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.displayPopover?.classList.toggle('hidden');
    });

    // Choix de la police
    document.querySelectorAll('.theol-font-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const font = btn.dataset.font;
        if (!font) return;
        document.querySelectorAll('.theol-font-choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setFontFamily(font);
      });
    });

    // Choix du fond de lecture
    document.querySelectorAll('.theol-bg-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const bg = btn.dataset.bg;
        if (!bg) return;
        document.querySelectorAll('.theol-bg-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setReadingBg(bg);
      });
    });

    // Pleine largeur
    this.optFullWidth?.addEventListener('change', (e) => {
      this.setFullWidth(e.target.checked);
    });

    // Contrôles de zoom
    this.btnZoomOut?.addEventListener('click', () => {
      this.adjustZoom(-10);
    });
    this.btnZoomIn?.addEventListener('click', () => {
      this.adjustZoom(10);
    });

    // 5. Actions de barre d'outils
    this.btnSynthHeader?.addEventListener('click', () => {
      this.toggleChapterSynthesis();
    });

    this.btnSummaryHeader?.addEventListener('click', () => {
      this.toggleChapterSummary();
    });

    this.btnTranslateHeader?.addEventListener('click', () => {
      this.toggleChapterTranslation();
    });

    this.btnExportNote?.addEventListener('click', () => {
      this.exportChapterToNotes();
    });

    this.btnCopyText?.addEventListener('click', () => {
      this.copyChapterText();
    });

    this.btnOpenBible?.addEventListener('click', () => {
      if (this.currentChapterData?.book_code) {
        this.openScriptureReference(this.currentChapterData.book_code);
      } else {
        App.switchView('bible');
      }
    });

    // Actions du panneau Synthèse IA
    this.btnCloseSynth?.addEventListener('click', () => {
      this.closeSynthesisPanel();
    });

    this.btnCopySynth?.addEventListener('click', () => {
      this.copySynthesis();
    });

    this.btnExportSynthNote?.addEventListener('click', () => {
      this.exportSynthesisToNotes();
    });

    // Fermeture des popovers au clic extérieur
    document.addEventListener('click', (e) => {
      if (this.pickerPopover && !this.pickerPopover.classList.contains('hidden') && !e.target.closest('#btn-theol-active-selector') && !e.target.closest('#theol-picker-popover')) {
        this.pickerPopover.classList.add('hidden');
      }
      if (this.displayPopover && !this.displayPopover.classList.contains('hidden') && !e.target.closest('#btn-theol-display-options') && !e.target.closest('#theol-display-popover')) {
        this.displayPopover.classList.add('hidden');
      }
    });
  },

  async onViewActivated() {
    if (!this.books || this.books.length === 0) {
      await this.loadBooksList();
    } else if (this.currentBook && this.currentChapterId) {
      // Si déjà préchargé et rendu dans le DOM, affichage immédiat sans ré-interrogation
      if (!this.currentChapterData) {
        await this.loadChapter(this.currentBook, this.currentChapterId);
      }
    }
  },

  async preloadInitialData() {
    if (this._isPreloading || this._isPreloaded) return;
    this._isPreloading = true;
    try {
      await this.loadBooksList();
      this._isPreloaded = true;
    } catch (err) {
      console.error('[TheologyView] Erreur preloadInitialData:', err);
    } finally {
      this._isPreloading = false;
    }
  },

  async openBook(bookName, chapterId = null) {
    App.switchView('theology');
    if (!this.books || this.books.length === 0) {
      await this.loadBooksList();
    }
    
    const targetBook = this.books.find(b => b.name === bookName || b.id === bookName || b.title === bookName);
    const resolvedName = targetBook ? targetBook.name : (this.books[0]?.name || bookName);
    
    await this.selectBook(resolvedName, chapterId);
  },

  async loadBooksList() {
    try {
      this.isLoading = true;
      this.books = await API.getTheologyBooks() || [];
      
      const badge = document.getElementById('theol-view-count-badge');
      if (badge) badge.textContent = `${this.books.length} ouvrage${this.books.length > 1 ? 's' : ''}`;

      if (this.books.length > 0) {
        // Sélectionner par défaut Grudem, Paradoxes ou le premier livre
        let defaultBook = this.books.find(b => b.name === 'STGru') || 
                          this.books.find(b => b.name === 'Paradoxes') || 
                          this.books.find(b => b.name === 'Lire/Comprendre') || 
                          this.books[0];
                          
        await this.selectBook(defaultBook.name);
      } else {
        this.renderEmptyState();
      }
    } catch (e) {
      console.error('[TheologyView] Erreur chargement livres:', e);
    } finally {
      this.isLoading = false;
    }
  },

  async selectBook(bookName, targetChapterId = null) {
    this.currentBook = bookName;
    this.showTranslatedVersion = false;
    this.showChapterSummary = false;
    this.btnSummaryHeader?.classList.remove('active');
    this.closeSynthesisPanel();

    const book = this.books.find(b => b.name === bookName) || { name: bookName, title: bookName };

    // Mettre à jour l'en-tête du sélecteur actif
    this.updateActiveBookHeader(book);

    // Charger la table des matières (TOC)
    try {
      const tocData = await API.getTheologyBookToc(bookName);
      this.tocList = tocData?.chapters || [];

      // Restaurer la traduction de la TOC si présente
      try {
        const savedToc = localStorage.getItem('theol_toc_trans_' + bookName);
        if (savedToc) {
          this.translatedToc[bookName] = JSON.parse(savedToc);
        } else {
          const cachedToc = await API.getCachedTranslation('theology_toc', `toc_${bookName}`);
          if (cachedToc && cachedToc.translated_text) {
            this.translatedToc[bookName] = JSON.parse(cachedToc.translated_text);
          }
        }
      } catch (e) {}

      this.renderTocList();

      if (this.tocList.length > 0) {
        let chId = targetChapterId;
        const readable = this.tocList.filter(c => !c.is_section_header);
        if (!chId || !readable.some(c => c.chapter_id === chId)) {
          chId = (readable[0] || this.tocList[0]).chapter_id;
        }
        await this.loadChapter(bookName, chId);
      } else {
        this.renderNoChaptersState(book);
      }
    } catch (e) {
      console.error('[TheologyView] Erreur chargement TOC:', e);
    }
  },

  updateActiveBookHeader(book) {
    const title = book.title || book.name;
    const author = book.author || 'Auteur non spécifié';
    const readable = this.tocList?.filter(c => !c.is_section_header) || [];
    const chapters = book.chapters_count || readable.length || this.tocList?.length || 0;

    if (this.activeBookTitle) this.activeBookTitle.textContent = title;
    if (this.activeBookMeta) this.activeBookMeta.textContent = `${author} ${book.year ? `(${book.year})` : ''}`.trim();
    if (this.activeChaptersCount) this.activeChaptersCount.textContent = `${chapters} ch.`;

    // Couverture mini
    if (this.activeBookCover) {
      const coverColors = ['#0F766E', '#1E3A8A', '#4338CA', '#7C2D12', '#065F46', '#831843', '#312E81'];
      const color = coverColors[Math.abs(this._hashCode(book.name)) % coverColors.length];
      const initials = title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'TH';
      
      const coverUrl = book.cover_data_url || book.cover_url;
      if (coverUrl) {
        this.activeBookCover.style.background = `url("${coverUrl}") center/cover no-repeat`;
        if (this.activeBookInitials) this.activeBookInitials.style.display = 'none';
      } else {
        this.activeBookCover.style.background = color;
        if (this.activeBookInitials) {
          this.activeBookInitials.style.display = 'block';
          this.activeBookInitials.textContent = initials;
        }
      }
    }
  },

  async loadChapter(bookName, chapterId) {
    try {
      this.isLoading = true;
      this.currentChapterId = chapterId;
      this.closeSynthesisPanel();

      this.renderLoadingArticle();

      const data = await API.getTheologyChapterContent(bookName, chapterId);
      this.currentChapterData = data;

      // Vérifier si une traduction en cache existe pour ce chapitre (en mémoire ou SQLite)
      const key = `${bookName}_${chapterId}`;
      if (this.translationCache[key]) {
        this.showTranslatedVersion = true;
      } else {
        try {
          const cached = await API.getCachedTranslation('theology_chapter', key);
          if (cached && cached.translated_text) {
            const lines = cached.translated_text.split('\n\n').map(p => p.trim()).filter(p => p);
            let transTitle = data.chapter_title;
            let transParas = lines;
            if (lines.length > 0 && lines[0].startsWith('#')) {
              transTitle = lines[0].replace(/^#+\s*/, '').trim();
              transParas = lines.slice(1);
            }
            this.translationCache[key] = {
              title: transTitle,
              paragraphs: transParas.length > 0 ? transParas : lines
            };
            this.showTranslatedVersion = true;
          } else {
            this.showTranslatedVersion = false;
          }
        } catch (err) {
          this.showTranslatedVersion = false;
        }
      }

      // Vérifier si un résumé en cache existe pour ce chapitre
      try {
        if (!this.summaryCache[key]) {
          const cachedSum = await API.getCachedTranslation('theology_summary', key);
          if (cachedSum && cachedSum.translated_text) {
            this.summaryCache[key] = cachedSum.translated_text;
          }
        }
      } catch (err) {}

      this.renderChapterArticle(data);
      this.highlightActiveTocItem(chapterId);
      this.updateHeaderNavState(data);
      this.updateTocTranslateButton();

      // Scroll en haut de l'article
      const scrollEl = document.getElementById('theol-main-scroll');
      if (scrollEl) scrollEl.scrollTop = 0;
    } catch (e) {
      console.error('[TheologyView] Erreur chargement chapitre:', e);
      this.renderErrorArticle(e);
    } finally {
      this.isLoading = false;
    }
  },

  renderChapterArticle(data) {
    if (!data || !data.paragraphs || data.paragraphs.length === 0) {
      this.renderEmptyChapterArticle();
      return;
    }

    let title = data.chapter_title || `Chapitre ${data.chapter_id}`;
    const key = `${this.currentBook}_${this.currentChapterId}`;
    const transData = this.translationCache[key];
    if (this.showTranslatedVersion && transData) {
      if (typeof transData === 'object' && !Array.isArray(transData) && transData.title) {
        title = transData.title;
      }
    }

    const bookTitle = data.book_title || data.book_name;
    const author = data.book_author || '';
    const readTime = data.reading_time_min || 5;
    const wordCount = data.word_count || 0;
    const refVerses = data.referenced_verses || [];
    const refBooks = data.referenced_books || [];

    // Application du style d'immersion historique
    const readingContainer = document.querySelector('.theol-reading-container') || document.querySelector('.theol-view-main-scroll');
    if (readingContainer && typeof VintageThemeManager !== 'undefined') {
      VintageThemeManager.applyEpochToElement(readingContainer, author || bookTitle);
    }

    // 1. Rendu du Hero Header
    let versesHtml = '';
    if (refVerses.length > 0) {
      const topVerses = refVerses.slice(0, 10);
      versesHtml = `
        <div class="theol-hero-verses-row">
          <span class="theol-hero-verses-lbl">Passages bibliques cités :</span>
          <div class="theol-hero-verses-chips">
            ${topVerses.map(v => `<button type="button" class="theol-verse-chip" data-ref="${v}">${v}</button>`).join('')}
            ${refVerses.length > 10 ? `<span class="theol-verse-chip-more">+${refVerses.length - 10}</span>` : ''}
          </div>
        </div>
      `;
    }

    this.articleHero.innerHTML = `
      <div class="theol-hero-badge-row">
        <span class="theol-hero-book-badge">${this.escapeHtml(bookTitle)}</span>
        ${data.section_title ? `<span class="theol-hero-section-badge">📁 ${this.escapeHtml(data.section_title)}</span>` : ''}
        ${author ? `<span class="theol-hero-author-badge">✍️ ${this.escapeHtml(author)}</span>` : ''}
        <span class="theol-hero-time-badge">⏱️ ~${readTime} min (${wordCount.toLocaleString()} mots)</span>
        ${data.book_french_name ? `<button type="button" class="theol-hero-bible-jump" id="btn-jump-bible-chapter" data-code="${data.book_code}">📖 ${data.book_french_name}</button>` : ''}
      </div>
      <h1 class="theol-hero-chapter-title">${this.escapeHtml(title)}</h1>
      <div class="theol-hero-divider"></div>
      ${versesHtml}
    `;

    // Attacher les infobulles de survol et clics sur les puces de versets
    const verseChips = this.articleHero.querySelectorAll('.theol-verse-chip');
    verseChips.forEach(btn => {
      btn.addEventListener('click', () => {
        const ref = btn.dataset.ref;
        if (ref) {
          ScriptureTooltip.hide();
          this.openScriptureReference(ref);
        }
      });
    });
    ScriptureTooltip.bindToElements(verseChips);

    const jumpBtn = this.articleHero.querySelector('#btn-jump-bible-chapter');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', () => {
        const code = jumpBtn.dataset.code;
        if (code) {
          ScriptureTooltip.hide();
          this.openScriptureReference(code);
        }
      });
      ScriptureTooltip.bindToElements([jumpBtn]);
    }

    // 2. Rendu des paragraphes du contenu avec typographie soignée
    let paragraphsHtml = '';
    const isEnglish = this.isBookInEnglish(data.raw_text);

    // Bandeau d'aide à la traduction si en anglais ou si traduit
    let translationBannerHtml = '';
    if (this.showTranslatedVersion) {
      translationBannerHtml = `
        <div class="theol-translation-banner theol-translation-banner-active" id="theol-translation-banner">
          <div class="theol-trans-banner-icon">🇫🇷</div>
          <div class="theol-trans-banner-info">
            <div class="theol-trans-banner-title">Chapitre affiché en français (traduit par IA)</div>
            <div class="theol-trans-banner-desc">Texte théologique traduit automatiquement et mémorisé pour ce chapitre.</div>
          </div>
          <button type="button" class="theol-trans-banner-btn" id="btn-banner-translate">
            Afficher le texte original
          </button>
        </div>
      `;
    } else if (isEnglish && (typeof App === 'undefined' || App.isAIEnabled !== false)) {
      translationBannerHtml = `
        <div class="theol-translation-banner" id="theol-translation-banner">
          <div class="theol-trans-banner-icon">🌐</div>
          <div class="theol-trans-banner-info">
            <div class="theol-trans-banner-title">Ouvrage en langue originale anglaise</div>
            <div class="theol-trans-banner-desc">Vous pouvez traduire automatiquement ce chapitre en français soigné grâce à l'IA.</div>
          </div>
          <button type="button" class="theol-trans-banner-btn" id="btn-banner-translate">
            Traduire en français
          </button>
        </div>
      `;
    }

    let textToRender = data.paragraphs;
    if (this.showTranslatedVersion && transData) {
      if (Array.isArray(transData)) {
        textToRender = transData;
      } else if (transData.paragraphs) {
        textToRender = transData.paragraphs;
      }
    }

    const footnotesList = data.footnotes || [];
    const footnoteMap = {};
    footnotesList.forEach(fn => {
      footnoteMap[String(fn.id)] = fn.text;
    });

    paragraphsHtml = textToRender.map((p, idx) => {
      const pTrim = p.trim();

      // Ignorer si c'est la répétition exacte du titre du chapitre au tout début
      const cleanHeaderCompare = pTrim.replace(/^#+\s*/, '').replace(/^\[\d+\]\s*/, '').trim().toLowerCase();
      if (idx === 0 && (cleanHeaderCompare === title.toLowerCase() || cleanHeaderCompare === (data.chapter_title || '').toLowerCase())) {
        return '';
      }

      // 1. Détection des titres Markdown (#, ##, ###, ####)
      if (pTrim.startsWith('#')) {
        if (pTrim.startsWith('####')) {
          const cleanHeading = pTrim.replace(/^####\s*/, '');
          return `<h4 class="theol-subsubsection-heading">${this.escapeHtml(cleanHeading)}</h4>`;
        } else if (pTrim.startsWith('###')) {
          const cleanHeading = pTrim.replace(/^###\s*/, '');
          return `<h3 class="theol-subsection-heading">${this.escapeHtml(cleanHeading)}</h3>`;
        } else if (pTrim.startsWith('##')) {
          const cleanHeading = pTrim.replace(/^##\s*/, '');
          return `<h2 class="theol-section-heading">${this.escapeHtml(cleanHeading)}</h2>`;
        } else {
          const cleanHeading = pTrim.replace(/^#\s*/, '');
          return `<h2 class="theol-section-heading theol-h1-heading">${this.escapeHtml(cleanHeading)}</h2>`;
        }
      }

      // 2. Heuristique pour les titres de sections non préfixés (ouvrages déjà indexés)
      // Ex: "Une tension à maintenir", "Avant de commencer", "Quand les chrétiens prennent parti", "La vérité est vraie, et parfois elle est binaire"
      const isHeadingCandidate = (
        pTrim.length > 2 &&
        pTrim.length < 85 &&
        !/[.\?!,;:\…]$/.test(pTrim) &&
        !pTrim.startsWith('>') &&
        !pTrim.startsWith('«') &&
        !pTrim.startsWith('"') &&
        !pTrim.startsWith('-') &&
        !pTrim.startsWith('*') &&
        !/^\d+\.\s/.test(pTrim) &&
        (pTrim.toUpperCase() === pTrim || (/^[A-ZÀ-Ÿ0-9]/.test(pTrim) && pTrim.split(/\s+/).length <= 12))
      );

      if (isHeadingCandidate) {
        return `<h3 class="theol-section-heading">${this.escapeHtml(pTrim)}</h3>`;
      }

      // 3. Détecter les citations ou versets mis en exergue
      if (pTrim.startsWith('>') || pTrim.startsWith('«') || (pTrim.length < 250 && (pTrim.includes('Rom') || pTrim.includes('Jean') || pTrim.includes('Psa')) && pTrim.includes(':'))) {
        const cleanQuote = pTrim.replace(/^>\s*/, '');
        let formatted = this.highlightScriptureReferences(cleanQuote);
        formatted = this.formatFootnoteReferences(formatted, footnoteMap);
        return `<blockquote class="theol-reading-quote">${formatted}</blockquote>`;
      }

      // 4. Paragraphe standard avec références bibliques et appels de notes
      let formatted = this.highlightScriptureReferences(p);
      formatted = this.formatFootnoteReferences(formatted, footnoteMap);
      return `<p class="theol-reading-p ${idx === 0 ? 'theol-first-p' : ''}">${formatted}</p>`;
    }).filter(Boolean).join('\n');

    // Section dédiée aux notes de bas de page en fin de chapitre
    let footnotesHtml = '';
    if (footnotesList.length > 0) {
      footnotesHtml = `
        <div class="theol-footnotes-section" id="theol-footnotes-section">
          <div class="theol-footnotes-header">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Notes de bas de page (${footnotesList.length})</span>
          </div>
          <ol class="theol-footnotes-list">
            ${footnotesList.map(fn => `
              <li class="theol-fn-item" id="theol-fn-${fn.id}" data-fn-id="${fn.id}">
                <span class="theol-fn-num">${fn.id}.</span>
                <div class="theol-fn-content">
                  <span class="theol-fn-text">${this.linkifyUrls(this.highlightScriptureReferences(fn.text))}</span>
                  <a href="#theol-fnref-${fn.id}" class="theol-fn-backref" data-target-id="theol-fnref-${fn.id}" title="Retour au passage">↩</a>
                </div>
              </li>
            `).join('')}
          </ol>
        </div>
      `;
    }

    let summaryEncartHtml = '';
    if (this.showChapterSummary) {
      summaryEncartHtml = this.renderSummaryEncartHtml();
    }

    this.articleContent.innerHTML = `
      ${translationBannerHtml}
      ${summaryEncartHtml}
      <div class="theol-reading-body font-${this.fontFamily.toLowerCase().replace(/\s+/g, '-')}" id="theol-reading-body">
        ${paragraphsHtml}
        ${footnotesHtml}
      </div>
    `;

    // Configurer et attacher le gestionnaire d'infobulles et de navigation des notes de bas de page
    if (typeof FootnoteTooltip !== 'undefined') {
      FootnoteTooltip.setFootnotes(footnotesList);
      const fnBadges = this.articleContent.querySelectorAll('.theol-fn-badge');
      FootnoteTooltip.bindToElements(fnBadges);
    }

    // Attacher les liens retour (back-links) de la section des notes
    const fnBackRefs = this.articleContent.querySelectorAll('.theol-fn-backref');
    fnBackRefs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.targetId;
        if (targetId) {
          const callEl = document.getElementById(targetId);
          if (callEl) {
            TheologyView.smoothScrollToElement(callEl);
            callEl.classList.remove('theol-highlight-pulse');
            void callEl.offsetWidth;
            callEl.classList.add('theol-highlight-pulse');
          }
        }
      });
    });

    // Attacher le bouton de traduction dans le bandeau
    const bannerTransBtn = document.getElementById('btn-banner-translate');
    if (bannerTransBtn) {
      bannerTransBtn.addEventListener('click', () => {
        this.toggleChapterTranslation();
      });
    }

    // Attacher les boutons de l'encart de résumé
    document.getElementById('btn-theol-close-summary')?.addEventListener('click', () => {
      this.toggleChapterSummary();
    });
    document.getElementById('btn-theol-copy-summary')?.addEventListener('click', () => {
      this.copyChapterSummary();
    });
    document.getElementById('btn-theol-export-summary-note')?.addEventListener('click', () => {
      this.exportSummaryToNotes();
    });

    // Attacher les clics et infobulles sur les références bibliques intégrées
    const inlineRefs = this.articleContent.querySelectorAll('.theol-inline-scripture-ref');
    inlineRefs.forEach(span => {
      span.addEventListener('click', () => {
        const ref = span.dataset.ref || span.textContent.trim();
        if (ref) {
          ScriptureTooltip.hide();
          this.openScriptureReference(ref);
        }
      });
    });
    ScriptureTooltip.bindToElements(inlineRefs);

    // 3. Pied de page de navigation (Cartes Précédent / Suivant)
    this.renderFooterNavigation(data);
  },

  renderFooterNavigation(data) {
    if (!this.articleFooterNav) return;

    const prev = data.prev_chapter;
    const next = data.next_chapter;

    this.articleFooterNav.innerHTML = `
      <div class="theol-footer-nav-grid">
        ${prev ? `
          <button type="button" class="theol-nav-card theol-prev-card" id="btn-footer-prev">
            <div class="theol-nav-card-arrow">‹</div>
            <div class="theol-nav-card-info">
              <span class="theol-nav-card-sub">Chapitre précédent</span>
              <span class="theol-nav-card-title">${this.escapeHtml(prev.title)}</span>
            </div>
          </button>
        ` : `<div class="theol-nav-card-empty"></div>`}

        <button type="button" class="theol-nav-card theol-toc-center-card" id="btn-footer-toc">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>Table des matières (${data.current_index} / ${data.total_chapters})</span>
        </button>

        ${next ? `
          <button type="button" class="theol-nav-card theol-next-card" id="btn-footer-next">
            <div class="theol-nav-card-info" style="text-align: right;">
              <span class="theol-nav-card-sub">Chapitre suivant</span>
              <span class="theol-nav-card-title">${this.escapeHtml(next.title)}</span>
            </div>
            <div class="theol-nav-card-arrow">›</div>
          </button>
        ` : `<div class="theol-nav-card-empty"></div>`}
      </div>
    `;

    document.getElementById('btn-footer-prev')?.addEventListener('click', () => {
      if (prev) this.loadChapter(this.currentBook, prev.chapter_id);
    });

    document.getElementById('btn-footer-next')?.addEventListener('click', () => {
      if (next) this.loadChapter(this.currentBook, next.chapter_id);
    });

    document.getElementById('btn-footer-toc')?.addEventListener('click', () => {
      this.toggleToc(true);
    });
  },

  async openScriptureReference(ref) {
    if (!ref) return;
    App.switchView('bible');
    if (typeof BibleReader !== 'undefined' && typeof BibleReader.searchPassage === 'function') {
      await BibleReader.searchPassage(ref);
    } else if (typeof BibleReader !== 'undefined' && typeof BibleReader.navigateTo === 'function') {
      try {
        const parsed = await API.parseReference(ref);
        if (parsed && parsed.book) {
          await BibleReader.navigateTo(parsed.book, parsed.chapter || 1, parsed.verse || null);
        }
      } catch (e) {
        console.warn('Erreur fallback parsing ref:', e);
      }
    }
  },

  linkifyUrls(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s\)\],;\"'<>]+)/gi;
    return text.replace(urlRegex, (url) => {
      const cleanUrl = url.replace(/[\.\,\;\:\)]+$/, '');
      const trailing = url.slice(cleanUrl.length);
      return `<a href="${TheologyView.escapeHtml(cleanUrl)}" class="theol-ext-web-link" target="_blank" rel="noopener noreferrer" title="Ouvrir dans le navigateur : ${TheologyView.escapeHtml(cleanUrl)}">${TheologyView.escapeHtml(cleanUrl)} <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-left:2px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>${trailing}`;
    });
  },

  highlightScriptureReferences(text) {
    if (!text) return '';

    // Liste exhaustive des livres bibliques et abréviations françaises & anglaises
    const bookNames = [
      // Deutérocanoniques & Apocryphes
      '1\\s*Maccabées', '2\\s*Maccabées', '3\\s*Maccabées', '4\\s*Maccabées',
      '1\\s*Maccabees', '2\\s*Maccabees', '1\\s*Mac', '2\\s*Mac', '1Ma', '2Ma', 'Maccabées', 'Maccabees',
      'Sagesse', 'Siracide', 'Ecclésiastique', 'Tobie', 'Judith', 'Baruch', 'Prière de Manassé',

      // Multi-word / Noms composés
      'Cantique des cantiques', 'Cantique', 'Song of Songs', 'Song of Solomon', 'Song',
      'Actes des apôtres', 'Acts of the Apostles', 'Actes', 'Acts',
      '1\\s*Thessaloniciens', '2\\s*Thessaloniciens', '1\\s*Thessalonians', '2\\s*Thessalonians',
      '1\\s*Chroniques', '2\\s*Chroniques', '1\\s*Chronicles', '2\\s*Chronicles',
      '1\\s*Corinthiens', '2\\s*Corinthiens', '1\\s*Corinthians', '2\\s*Corinthians',
      '1\\s*Timothée', '2\\s*Timothée', '1\\s*Timothee', '2\\s*Timothee', '1\\s*Timothy', '2\\s*Timothy',
      '1\\s*Samuel', '2\\s*Samuel', '1\\s*Rois', '2\\s*Rois', '1\\s*Kings', '2\\s*Kings',
      '1\\s*Pierre', '2\\s*Pierre', '1\\s*Peter', '2\\s*Peter',
      '1\\s*Jean', '2\\s*Jean', '3\\s*Jean', '1\\s*John', '2\\s*John', '3\\s*John',

      // Noms complets canoniques (Français & Anglais)
      'Genèse', 'Genese', 'Genesis', 'Exode', 'Exodus', 'Lévitique', 'Levitique', 'Leviticus', 'Nombres', 'Numbers', 'Deutéronome', 'Deuteronome', 'Deuteronomy',
      'Josué', 'Josue', 'Joshua', 'Juges', 'Judges', 'Ruth', 'Esdras', 'Ezra', 'Néhémie', 'Nehemie', 'Nehemiah', 'Esther', 'Job',
      'Psaumes', 'Psaume', 'Psalms', 'Psalm', 'Proverbes', 'Proverbe', 'Proverbs', 'Ecclésiaste', 'Ecclesiaste', 'Ecclesiastes',
      'Ésaïe', 'Esaïe', 'Esaie', 'Isaiah', 'Jérémie', 'Jeremie', 'Jeremiah', 'Lamentations', 'Ézéchiel', 'Ezechiel', 'Ezekiel',
      'Daniel', 'Osée', 'Osee', 'Hosea', 'Joël', 'Joel', 'Amos', 'Abdias', 'Obadiah', 'Jonas', 'Jonah', 'Michée', 'Michee', 'Micah',
      'Nahum', 'Habacuc', 'Habakkuk', 'Sophonie', 'Zephaniah', 'Aggée', 'Aggee', 'Haggai', 'Zacharie', 'Zechariah', 'Malachie', 'Malachi',
      'Matthieu', 'Matthew', 'Marc', 'Mark', 'Luc', 'Luke', 'Jean', 'John', 'Romains', 'Romans',
      'Galates', 'Galatians', 'Éphésiens', 'Ephesiens', 'Ephesians', 'Philippiens', 'Philippians', 'Colossiens', 'Colossians',
      'Tite', 'Titus', 'Philémon', 'Philemon', 'Hébreux', 'Hebreux', 'Hebrews', 'Jacques', 'James', 'Jude', 'Apocalypse', 'Revelation',

      // Abréviations avec préfixe numérique
      '1\\s*The?s?s?', '2\\s*The?s?s?', '1\\s*Th', '2\\s*Th',
      '1\\s*Chr?o?n?', '2\\s*Chr?o?n?', '1\\s*Ch', '2\\s*Ch',
      '1\\s*Co?r?', '2\\s*Co?r?', '1\\s*Co', '2\\s*Co',
      '1\\s*Ti?m?', '2\\s*Ti?m?', '1\\s*Ti', '2\\s*Ti', '1\\s*Tm', '2\\s*Tm',
      '1\\s*Sa?m?', '2\\s*Sa?m?', '1\\s*Sa', '2\\s*Sa', '1\\s*S', '2\\s*S',
      '1\\s*Ro?i?s?', '2\\s*Ro?i?s?', '1\\s*Kgs?', '2\\s*Kgs?', '1\\s*Ki', '2\\s*Ki', '1\\s*R', '2\\s*R',
      '1\\s*Pie?r?r?e?', '2\\s*Pie?r?r?e?', '1\\s*Pet?', '2\\s*Pet?', '1\\s*Pe', '2\\s*Pe', '1\\s*Pi', '2\\s*Pi', '1\\s*P', '2\\s*P',
      '1\\s*Jn', '2\\s*Jn', '3\\s*Jn', '1\\s*Joh', '2\\s*Joh', '3\\s*Joh', '1\\s*J', '2\\s*J', '3\\s*J',

      // Abréviations simples (AT & NT)
      'Gen', 'Gn', 'Ge', 'Exod', 'Exo', 'Ex', 'Lév', 'Lev', 'Lv', 'Nomb', 'Numb', 'Num', 'Nom', 'Nb', 'Deut', 'Dtn', 'Dt',
      'Josh', 'Jos', 'Judg', 'Jug', 'Jdg', 'Jg', 'Rut', 'Rth', 'Rt', 'Ezr', 'Esd', 'Néhem', 'Nehem', 'Néh', 'Neh', 'Né', 'Ne', 'Esth', 'Est',
      'Jb', 'Psa', 'Psm', 'Pss', 'Ps', 'Prov', 'Prv', 'Pr', 'Eccl', 'Ecc', 'Qoh', 'Ec', 'Cant', 'Ct',
      'Ésa', 'Esa', 'Isa', 'És', 'Es', 'Is', 'Jér', 'Jer', 'Jr', 'Lam', 'Lm', 'Ézéch', 'Ezech', 'Ezek', 'Ézé', 'Eze', 'Éz', 'Ez',
      'Dan', 'Da', 'Osé', 'Ose', 'Hos', 'Os', 'Joë', 'Joe', 'Jl', 'Amo', 'Am',
      'Obad', 'Abd', 'Oba', 'Ab', 'Jonah', 'Jon', 'Mich', 'Mic', 'Mi', 'Nah', 'Na', 'Habak', 'Hab', 'Ha',
      'Zeph', 'Soph', 'Zep', 'So', 'Hagg', 'Agg', 'Hag', 'Ag', 'Zech', 'Zach', 'Zec', 'Za', 'Mal', 'Ml',
      'Matt', 'Mat', 'Mt', 'Marc', 'Mark', 'Mar', 'Mc', 'Mk', 'Luk', 'Luc', 'Lc', 'Lk', 'Joh', 'Jn',
      'Acts', 'Act', 'Ac', 'Rom', 'Rm', 'Ro', 'Galat', 'Gal', 'Ga', 'Éphés', 'Ephes', 'Éph', 'Eph',
      'Philip', 'Phil', 'Php', 'Phi', 'Ph', 'Coloss', 'Col', 'Tit', 'Tt', 'Philem', 'Philém', 'Phm', 'Phl',
      'Hébr', 'Hebr', 'Héb', 'Heb', 'Jacq', 'Jam', 'Jac', 'Jas', 'Jc', 'Jud', 'Jd', 'Apoc', 'Rev', 'Apo', 'Ap'
    ];

    const bookPatternStr = bookNames.sort((a, b) => b.length - a.length).join('|');

    // Détection universelle avec support des tirets cadratins (\u2013, \u2014) et sous-références
    const scriptureRegex = new RegExp(
      `(?<=^|[\\s\\(\\[\\{;,-])((?:${bookPatternStr})\\.?)\\s*([0-9]{1,3})\\s*[:.,]\\s*([0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)((?:\\s*[,;]\\s*[0-9]{1,3}(?:\\s*[:.,]\\s*[0-9]{1,3}(?:\\s*[-–—\\u2013\\u2014]\\s*[0-9]{1,3})?)?(?!\\s*[a-zA-ZÀ-ÿ]))*)`,
      'gi'
    );

    return text.replace(scriptureRegex, (fullMatch, book, ch, vs, chained) => {
      const cleanBook = book.replace(/\.$/, '').trim();
      const cleanVs = vs.replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-').replace(/\s+/g, '');
      const firstRef = `${cleanBook} ${ch}:${cleanVs}`;
      let result = `<span class="theol-inline-scripture-ref" data-ref="${TheologyView.escapeHtml(firstRef)}">${book} ${ch}.${vs}</span>`;

      if (chained) {
        const subRegex = /([,;]\s*)([0-9]{1,3}(?:\s*[:.,]\s*[0-9]{1,3}(?:\s*[-–—\u2013\u2014]\s*[0-9]{1,3})?)?)/g;
        const formattedChained = chained.replace(subRegex, (m, sep, subCv) => {
          const parts = subCv.split(/[:.,]/);
          const subCh = parts[0].trim();
          const subVs = parts[1] ? parts[1].replace(/[\u2013\u2014\u2212\u2010\u2011\u2012\u2015]/g, '-').replace(/\s+/g, '') : '';
          const subRef = subVs ? `${cleanBook} ${subCh}:${subVs}` : `${cleanBook} ${subCh}`;
          return `${sep}<span class="theol-inline-scripture-ref" data-ref="${TheologyView.escapeHtml(subRef)}">${subCv}</span>`;
        });
        result += formattedChained;
      }

      return result;
    });
  },

  formatFootnoteReferences(html, footnoteMap = {}) {
    if (!html) return '';
    // 1. Remplacer les marqueurs explicites [^1] ou [^14]
    let result = html.replace(/\[\^(\d+)\]/g, (match, id) => {
      return `<sup class="theol-fn-badge" data-fn-id="${id}" id="theol-fnref-${id}"><a href="#theol-fn-${id}" title="Note ${id}">${id}</a></sup>`;
    });

    // 2. Remplacer les [1] ou [14] si l'id existe dans footnoteMap
    result = result.replace(/\[(\d+)\]/g, (match, id) => {
      if (footnoteMap && footnoteMap[String(id)]) {
        return `<sup class="theol-fn-badge" data-fn-id="${id}" id="theol-fnref-${id}"><a href="#theol-fn-${id}" title="Note ${id}">${id}</a></sup>`;
      }
      return match;
    });

    // 3. Remplacer les numéros de notes isolés correspondant aux footnotes connues
    if (footnoteMap && Object.keys(footnoteMap).length > 0) {
      const sortedIds = Object.keys(footnoteMap).sort((a, b) => b.length - a.length);
      for (const id of sortedIds) {
        // Remplacer "mot 67." ou "mot 67," ou "» 67" ou "mot 67" par badge si pas déjà dans un tag HTML
        const regex = new RegExp(`(?<!data-fn-id=["']|id=["']theol-fnref-|#theol-fn-)(\\b${id}\\b)(?=[\\s\\.\\,\\!\\?\\:\\;\\»\\)]|$)`, 'g');
        result = result.replace(regex, (match, p1, offset, fullStr) => {
          const preceding = fullStr.slice(0, offset);
          const lastOpen = preceding.lastIndexOf('<');
          const lastClose = preceding.lastIndexOf('>');
          if (lastOpen > lastClose) return match;
          return `<sup class="theol-fn-badge" data-fn-id="${id}" id="theol-fnref-${id}"><a href="#theol-fn-${id}" title="Note ${id}">${id}</a></sup>`;
        });
      }
    }

    return result;
  },

  smoothScrollToElement(el) {
    if (!el) return;
    const scrollContainer = document.getElementById('theol-main-scroll');
    if (scrollContainer) {
      const cRect = scrollContainer.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const targetTop = scrollContainer.scrollTop + (eRect.top - cRect.top) - (cRect.height / 2) + (eRect.height / 2);
      scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  updateTocTranslateButton() {
    if (!this.btnTranslateToc) return;
    const isBookEnglish = this.isBookInEnglish(this.currentChapterData?.raw_text || '');
    const isAI = typeof App === 'undefined' || App.isAIEnabled !== false;

    if (isBookEnglish && isAI) {
      this.btnTranslateToc.classList.remove('hidden');
      const translatedMap = this.translatedToc[this.currentBook];
      const isTranslated = translatedMap && Object.keys(translatedMap).length > 0;
      const textSpan = document.getElementById('theol-toc-translate-text');
      if (textSpan) {
        if (isTranslated && this.showTranslatedToc) {
          textSpan.textContent = '🇫🇷 Traduit';
          this.btnTranslateToc.classList.add('active');
          this.btnTranslateToc.title = 'Afficher les titres originaux';
        } else if (isTranslated && !this.showTranslatedToc) {
          textSpan.textContent = '🌐 Original';
          this.btnTranslateToc.classList.remove('active');
          this.btnTranslateToc.title = 'Afficher les titres traduits en français';
        } else {
          textSpan.textContent = 'Traduire titres';
          this.btnTranslateToc.classList.remove('active');
          this.btnTranslateToc.title = 'Traduire tous les titres de la table des matières en français';
        }
      }
    } else {
      this.btnTranslateToc.classList.add('hidden');
    }
  },

  renderTocList() {
    if (!this.tocListContainer) return;

    // Mettre à jour la visibilité du bouton de traduction de la TOC
    this.updateTocTranslateButton();

    const q = (this.tocSearchInput?.value || '').toLowerCase().trim();
    const translatedMap = (this.showTranslatedToc && this.translatedToc[this.currentBook]) || {};

    const filtered = this.tocList.filter(ch => {
      if (!q) return true;
      const displayTitle = translatedMap[ch.chapter_id] || ch.title || '';
      return displayTitle.toLowerCase().includes(q) || (ch.title || '').toLowerCase().includes(q) || String(ch.chapter_id).includes(q) || (ch.book_name || '').toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      this.tocListContainer.innerHTML = `
        <div class="theol-toc-empty">
          <p>Aucun chapitre trouvé</p>
        </div>
      `;
      return;
    }

    this.tocListContainer.innerHTML = filtered.map((ch, idx) => {
      const displayTitle = translatedMap[ch.chapter_id] || ch.title;
      if (ch.is_section_header) {
        return `
          <div class="theol-toc-section-divider">
            <div class="theol-toc-section-tag">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
              <span>PARTIE / SECTION</span>
            </div>
            <div class="theol-toc-section-title">${this.escapeHtml(displayTitle)}</div>
          </div>
        `;
      }

      const isSub = (ch.depth && ch.depth > 0) || ch.is_subsection;
      const isActive = String(ch.chapter_id) === String(this.currentChapterId);
      return `
        <button type="button" class="theol-toc-item ${isActive ? 'active' : ''} ${isSub ? 'theol-toc-subitem' : ''}" data-chapter-id="${ch.chapter_id}" style="${isSub ? 'padding-left: 28px; font-size: 11.5px; opacity: 0.9;' : ''}">
          <div class="theol-toc-item-num" style="${isSub ? 'color: var(--text-muted); font-size: 11px; font-weight: normal;' : ''}">${isSub ? '↳' : ch.chapter_id}</div>
          <div class="theol-toc-item-details">
            <div class="theol-toc-item-title" style="${isSub ? 'font-weight: 400; color: var(--text-secondary);' : 'font-weight: 600;'}">${this.escapeHtml(displayTitle)}</div>
            ${ch.book_name && !isSub ? `<span class="theol-toc-item-badge">${ch.book_name}</span>` : ''}
          </div>
        </button>
      `;
    }).join('');

    // Attacher les écouteurs
    this.tocListContainer.querySelectorAll('.theol-toc-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = btn.dataset.chapterId;
        if (cid) {
          this.loadChapter(this.currentBook, cid);
        }
      });
    });
  },

  async toggleTocTranslation() {
    const existing = this.translatedToc[this.currentBook];
    if (existing && Object.keys(existing).length > 0) {
      this.showTranslatedToc = !this.showTranslatedToc;
      this.renderTocList();
      App.showToast(this.showTranslatedToc ? 'Table des matières affichée en français' : 'Table des matières affichée en version originale');
      return;
    }

    try {
      const btn = this.btnTranslateToc;
      const textSpan = document.getElementById('theol-toc-translate-text');
      if (textSpan) textSpan.textContent = 'Traduction...';
      if (btn) btn.disabled = true;
      if (this.tocListContainer) this.tocListContainer.classList.add('ai-shining-container');

      App.showToast('Traduction des titres de la table des matières en cours...');
      const titles = this.tocList.map(ch => ({
        chapter_id: ch.chapter_id,
        title: ch.title,
        is_section_header: !!ch.is_section_header
      }));

      const res = await API.call('translate_theology_toc', this.currentBook, titles);
      if (res && res.success && res.translated_titles) {
        this.translatedToc[this.currentBook] = res.translated_titles;
        this.showTranslatedToc = true;
        try {
          localStorage.setItem('theol_toc_trans_' + this.currentBook, JSON.stringify(res.translated_titles));
        } catch (e) {}
        this.renderTocList();
        App.showToast('Titres de la table des matières traduits en français !');
      } else {
        throw new Error(res?.error || 'Erreur traduction TOC');
      }
    } catch (e) {
      console.error('[TheologyView] Erreur traduction TOC:', e);
      App.showToast(`Erreur traduction titres : ${e.message || e}`);
      this.renderTocList();
    } finally {
      if (this.btnTranslateToc) this.btnTranslateToc.disabled = false;
      if (this.tocListContainer) this.tocListContainer.classList.remove('ai-shining-container');
    }
  },

  highlightActiveTocItem(chapterId) {
    if (!this.tocListContainer) return;
    this.tocListContainer.querySelectorAll('.theol-toc-item').forEach(btn => {
      const isAct = String(btn.dataset.chapterId) === String(chapterId);
      btn.classList.toggle('active', isAct);
      if (isAct) {
        btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  },

  updateHeaderNavState(data) {
    if (this.btnPrevChapter) {
      this.btnPrevChapter.disabled = !data?.prev_chapter;
      this.btnPrevChapter.title = data?.prev_chapter ? `Précédent : ${data.prev_chapter.title}` : 'Premier chapitre';
    }
    if (this.btnNextChapter) {
      this.btnNextChapter.disabled = !data?.next_chapter;
      this.btnNextChapter.title = data?.next_chapter ? `Suivant : ${data.next_chapter.title}` : 'Dernier chapitre';
    }
    if (this.chapterPillText) {
      this.chapterPillText.textContent = `Ch. ${data?.current_index || data?.chapter_id || 1} / ${data?.total_chapters || this.tocList?.length || 1}`;
    }
  },

  toggleToc(forceState = null) {
    this.isTocOpen = forceState !== null ? forceState : !this.isTocOpen;
    if (this.tocPanel) {
      this.tocPanel.classList.toggle('collapsed', !this.isTocOpen);
    }
    if (this.btnToggleToc) {
      this.btnToggleToc.classList.toggle('active', this.isTocOpen);
    }
    try {
      localStorage.setItem('theol_toc_open', String(this.isTocOpen));
    } catch (e) {}
  },

  togglePickerPopover() {
    if (!this.pickerPopover) return;
    const isHidden = this.pickerPopover.classList.contains('hidden');
    if (isHidden) {
      this.pickerSearchInput.value = '';
      this.renderPickerList();
      this.pickerPopover.classList.remove('hidden');
      setTimeout(() => this.pickerSearchInput?.focus(), 50);
    } else {
      this.pickerPopover.classList.add('hidden');
    }
  },

  renderPickerList() {
    if (!this.pickerList) return;

    const q = (this.pickerSearchInput?.value || '').toLowerCase().trim();
    const filtered = this.books.filter(b => {
      if (!q) return true;
      const title = (b.title || b.name || '').toLowerCase();
      const author = (b.author || '').toLowerCase();
      return title.includes(q) || author.includes(q);
    });

    if (filtered.length === 0) {
      this.pickerList.innerHTML = `
        <div class="theol-picker-empty">Aucun ouvrage trouvé</div>
      `;
      return;
    }

    const coverColors = ['#0F766E', '#1E3A8A', '#4338CA', '#7C2D12', '#065F46', '#831843', '#312E81'];

    this.pickerList.innerHTML = filtered.map(b => {
      const isActive = b.name === this.currentBook;
      const color = coverColors[Math.abs(this._hashCode(b.name)) % coverColors.length];
      const initials = (b.title || b.name).split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'TH';
      const coverUrl = b.cover_data_url || b.cover_url;

      const coverHtml = coverUrl
        ? `<div class="theol-book-mini-cover" style="background: url('${coverUrl}') center/cover no-repeat;"><div class="theol-book-mini-spine"></div></div>`
        : `<div class="theol-book-mini-cover" style="background: ${color};"><div class="theol-book-mini-spine"></div><span class="theol-book-mini-initials">${initials}</span></div>`;

      return `
        <div class="theol-picker-item ${isActive ? 'active' : ''}" data-book-name="${b.name}">
          ${coverHtml}
          <div class="theol-picker-item-details">
            <div class="theol-picker-item-title-row">
              <span class="theol-picker-item-name">${this.escapeHtml(b.title || b.name)}</span>
              ${b.chapters_count ? `<span class="theol-picker-item-chapters-tag">${b.chapters_count} ch.</span>` : ''}
            </div>
            <div class="theol-picker-item-author">${this.escapeHtml(b.author || 'Auteur non spécifié')}</div>
          </div>
          ${isActive ? '<span class="theol-picker-item-check">✓</span>' : ''}
        </div>
      `;
    }).join('');

    this.pickerList.querySelectorAll('.theol-picker-item').forEach(item => {
      item.addEventListener('click', () => {
        const bName = item.dataset.bookName;
        if (bName) {
          this.selectBook(bName);
          this.pickerPopover?.classList.add('hidden');
        }
      });
    });
  },

  // =========================================================================
  // SYNTHÈSE THÉOLOGIQUE IA
  // =========================================================================

  async toggleChapterSynthesis() {
    if (this.isSynthMode) {
      this.closeSynthesisPanel();
      return;
    }

    if (!this.currentBook || !this.currentChapterId) {
      App.showToast('Veuillez d\'abord ouvrir un chapitre.');
      return;
    }

    this.isSynthMode = true;
    this.articleContainer?.classList.add('hidden');
    this.synthContainer?.classList.remove('hidden');

    if (this.synthPassageBadge) {
      this.synthPassageBadge.textContent = `${this.currentChapterData?.book_title || this.currentBook} — ${this.currentChapterData?.chapter_title || `Ch. ${this.currentChapterId}`}`;
    }

    // Lancer la génération
    await this.generateChapterSynthesis();
  },

  async generateChapterSynthesis() {
    if (this.synthLoadingBox) this.synthLoadingBox.classList.remove('hidden');
    if (this.synthResultContainer) this.synthResultContainer.classList.add('hidden');

    try {
      const res = await API.synthesizeTheologyChapter(this.currentBook, this.currentChapterId);
      
      if (res && res.success && res.synthesis_markdown) {
        this.latestSynthesisMarkdown = res.synthesis_markdown;
        
        if (this.synthMarkdownContent) {
          if (typeof marked !== 'undefined') {
            this.synthMarkdownContent.innerHTML = marked.parse(res.synthesis_markdown);
          } else {
            this.synthMarkdownContent.innerHTML = `<pre style="white-space: pre-wrap;">${this.escapeHtml(res.synthesis_markdown)}</pre>`;
          }
        }
        
        const modelTag = document.getElementById('theol-page-synth-model-tag');
        if (modelTag) modelTag.textContent = res.model_used || 'IA Théologique';

        if (this.synthLoadingBox) this.synthLoadingBox.classList.add('hidden');
        if (this.synthResultContainer) this.synthResultContainer.classList.remove('hidden');
      } else {
        throw new Error(res?.error || 'Échec de la synthèse');
      }
    } catch (e) {
      console.error('[TheologyView] Erreur génération synthèse:', e);
      if (this.synthLoadingBox) this.synthLoadingBox.classList.add('hidden');
      if (this.synthResultContainer) {
        this.synthResultContainer.classList.remove('hidden');
        if (this.synthMarkdownContent) {
          this.synthMarkdownContent.innerHTML = `
            <div class="theol-error-box">
              <p>Impossible de générer la synthèse : ${this.escapeHtml(e.message)}</p>
              <button type="button" class="btn-primary" onclick="TheologyView.generateChapterSynthesis()">Réessayer</button>
            </div>
          `;
        }
      }
    }
  },

  closeSynthesisPanel() {
    this.isSynthMode = false;
    this.synthContainer?.classList.add('hidden');
    this.articleContainer?.classList.remove('hidden');
  },

  copySynthesis() {
    if (!this.latestSynthesisMarkdown) return;
    navigator.clipboard.writeText(this.latestSynthesisMarkdown).then(() => {
      App.showToast('Synthèse copiée dans le presse-papiers !');
    });
  },

  async exportSynthesisToNotes() {
    if (!this.latestSynthesisMarkdown) return;
    const title = `Synthèse — ${this.currentChapterData?.chapter_title || `Chapitre ${this.currentChapterId}`} (${this.currentChapterData?.book_title || this.currentBook})`;
    const content = `# ${title}\n\n${this.latestSynthesisMarkdown}`;
    
    try {
      const payload = {
        title,
        content,
        reference: `${this.currentChapterData?.book_french_name || ''}`,
        tags: ['Théologie', 'Synthèse IA', this.currentBook]
      };
      const res = await API.call('save_note', payload);
      if (res && res.success !== false) {
        App.showToast('Synthèse enregistrée dans vos Notes (.md) !');
        if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
          NotesView.loadNotes();
        }
      } else {
        throw new Error(res?.error || 'Erreur enregistrement');
      }
    } catch (e) {
      console.error('Erreur export note:', e);
      App.showToast('Erreur lors de l\'export vers les notes');
    }
  },

  // =========================================================================
  // TRADUCTION DU CHAPITRE (AVEC BANDEAU DE PROGRESSION ÉLÉGANT)
  // =========================================================================

  async toggleChapterTranslation() {
    const key = `${this.currentBook}_${this.currentChapterId}`;

    if (this.showTranslatedVersion) {
      this.showTranslatedVersion = false;
      this.renderChapterArticle(this.currentChapterData);
      App.showToast('Affichage du texte original.');
      return;
    }

    if (this.translationCache[key]) {
      this.showTranslatedVersion = true;
      this.renderChapterArticle(this.currentChapterData);
      App.showToast('Texte traduit en français.');
      return;
    }

    // Activer l'état de traduction
    try {
      if (this.articleCard) {
        this.articleCard.classList.add('translating-scan-active');
      }

      // Insérer le bandeau de progression au-dessus du texte
      const existingBanner = document.getElementById('theol-translation-banner');
      const scanBannerHtml = `
        <div class="theol-translation-scanner-banner" id="theol-translation-scanner-banner">
          <div class="theol-scanner-icon-box">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div class="theol-scanner-info">
            <div class="theol-scanner-title shine-text">Traduction française haute fidélité en cours...</div>
            <div class="theol-scanner-subtitle">Analyse théologique, traduction du titre & conservation des citations bibliques</div>
          </div>
          <div class="theol-scanner-progress-badge">
            <span class="shine-text">✨ Traduction IA</span>
          </div>
        </div>
      `;

      if (existingBanner) {
        existingBanner.outerHTML = scanBannerHtml;
      } else if (this.articleContent) {
        this.articleContent.insertAdjacentHTML('afterbegin', scanBannerHtml);
      }

      const readingBody = this.articleContent?.querySelector('.theol-reading-body');
      if (readingBody) readingBody.classList.add('ai-shining-container');

      App.showToast('Traduction du chapitre par IA en cours...');
      const rawTitle = this.currentChapterData?.chapter_title || '';
      const paragraphs = this.currentChapterData?.paragraphs || [];
      const fullText = `# ${rawTitle}\n\n` + paragraphs.join('\n\n');
      
      const res = await API.translateText(fullText.slice(0, 12000), 'theology_chapter', key);
      if (res && res.success && res.translated_text) {
        const lines = res.translated_text.split('\n\n').map(p => p.trim()).filter(p => p);
        let transTitle = rawTitle;
        let transParas = lines;
        if (lines.length > 0 && lines[0].startsWith('#')) {
          transTitle = lines[0].replace(/^#+\s*/, '').trim();
          transParas = lines.slice(1);
        }
        this.translationCache[key] = {
          title: transTitle,
          paragraphs: transParas.length > 0 ? transParas : lines
        };
        this.showTranslatedVersion = true;
        
        if (this.articleCard) {
          this.articleCard.classList.remove('translating-scan-active');
        }
        this.renderChapterArticle(this.currentChapterData);
        App.showToast('Traduction française appliquée & mémorisée !');
      } else {
        throw new Error(res?.error || 'Erreur traduction');
      }
    } catch (e) {
      console.error('[TheologyView] Erreur traduction:', e);
      if (this.articleCard) {
        this.articleCard.classList.remove('translating-scan-active');
      }
      this.renderChapterArticle(this.currentChapterData);
      App.showToast('Erreur lors de la traduction du chapitre.');
    }
  },

  // =========================================================================
  // RÉSUMÉ DE CHAPITRE THÉOLOGIQUE PAR IA
  // =========================================================================

  async toggleChapterSummary() {
    const key = `${this.currentBook}_${this.currentChapterId}`;

    if (this.showChapterSummary && !this.isSummaryLoading) {
      this.showChapterSummary = false;
      this.btnSummaryHeader?.classList.remove('active');
      this.renderChapterArticle(this.currentChapterData);
      return;
    }

    this.showChapterSummary = true;
    this.btnSummaryHeader?.classList.add('active');

    if (this.summaryCache[key]) {
      this.renderChapterArticle(this.currentChapterData);
      return;
    }

    try {
      this.isSummaryLoading = true;
      this.renderChapterArticle(this.currentChapterData);
      const readingBody = this.articleContent?.querySelector('.theol-reading-body');
      if (readingBody) readingBody.classList.add('ai-shining-container');

      const chapterTitle = this.currentChapterData?.chapter_title || `Chapitre ${this.currentChapterId}`;
      const paragraphs = this.currentChapterData?.paragraphs || [];
      const text = paragraphs.join('\n\n');

      const res = await API.call('summarize_theology_chapter', this.currentBook, this.currentChapterId, chapterTitle, text);
      if (res && res.success && res.summary_markdown) {
        this.summaryCache[key] = res.summary_markdown;
        this.isSummaryLoading = false;
        this.renderChapterArticle(this.currentChapterData);
        App.showToast('Résumé de chapitre généré avec succès !');
      } else {
        throw new Error(res?.error || 'Erreur lors de la génération du résumé');
      }
    } catch (e) {
      console.error('[TheologyView] Erreur résumé:', e);
      this.isSummaryLoading = false;
      this.showChapterSummary = false;
      this.btnSummaryHeader?.classList.remove('active');
      this.renderChapterArticle(this.currentChapterData);
      App.showToast(`Erreur résumé : ${e.message || e}`);
    }
  },

  renderSummaryEncartHtml() {
    const key = `${this.currentBook}_${this.currentChapterId}`;
    const bookTitle = this.currentChapterData?.book_title || this.currentChapterData?.book_name || this.currentBook;
    const chapterTitle = this.currentChapterData?.chapter_title || `Chapitre ${this.currentChapterId}`;

    if (this.isSummaryLoading) {
      return `
        <div class="theol-summary-encart" id="theol-summary-encart">
          <div class="theol-summary-encart-header">
            <div class="theol-summary-encart-title-box">
              <div class="theol-summary-encart-icon">✨</div>
              <div>
                <div class="theol-summary-encart-title shine-text">Génération du Résumé Théologique par IA...</div>
                <div class="theol-summary-encart-sub">${this.escapeHtml(bookTitle)} • ${this.escapeHtml(chapterTitle)}</div>
              </div>
            </div>
          </div>
          <div class="theol-summary-encart-body ai-shining-container" style="padding: 6px 0;">
            <p class="shine-text" style="margin-bottom: 8px; font-weight: 600;">Extraction de la thèse doctrinale centrale et des axes théologiques majeurs...</p>
            <p class="shine-text" style="margin-bottom: 8px;">Analyse contextuelle et synthèse des arguments scripturaires du chapitre...</p>
            <p class="shine-text">Formulation des applications pastorales et doctrinales...</p>
          </div>
        </div>
      `;
    }

    const summaryMd = this.summaryCache[key] || '';
    if (!summaryMd) return '';

    return `
      <div class="theol-summary-encart" id="theol-summary-encart">
        <div class="theol-summary-encart-header">
          <div class="theol-summary-encart-title-box">
            <div class="theol-summary-encart-icon">✨</div>
            <div>
              <div class="theol-summary-encart-title">Résumé Doctrinal & Exégétique</div>
              <div class="theol-summary-encart-sub">${this.escapeHtml(bookTitle)} • ${this.escapeHtml(chapterTitle)}</div>
            </div>
          </div>
          <div class="theol-summary-encart-actions">
            <button type="button" class="btn-ghost btn-sm" id="btn-theol-copy-summary" title="Copier le résumé">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copier</span>
            </button>
            <button type="button" class="btn-ghost btn-sm" id="btn-theol-export-summary-note" title="Enregistrer dans vos notes">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              <span>Vers note</span>
            </button>
            <button type="button" class="btn-ghost btn-sm" id="btn-theol-close-summary" title="Masquer le résumé">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="theol-summary-encart-body">
          ${this.renderMarkdown(summaryMd)}
        </div>
      </div>
    `;
  },

  async copyChapterSummary() {
    const key = `${this.currentBook}_${this.currentChapterId}`;
    const md = this.summaryCache[key];
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      App.showToast('Résumé copié dans le presse-papiers !');
    } catch (e) {
      App.showToast('Erreur lors de la copie');
    }
  },

  async exportSummaryToNotes() {
    const key = `${this.currentBook}_${this.currentChapterId}`;
    const md = this.summaryCache[key];
    if (!md) return;

    const bookTitle = this.currentChapterData?.book_title || this.currentChapterData?.book_name || this.currentBook;
    const chapterTitle = this.currentChapterData?.chapter_title || `Chapitre ${this.currentChapterId}`;
    const title = `Résumé — ${chapterTitle} (${bookTitle})`;
    const content = `# ${title}\n\n*Résumé généré par IA*\n\n${md}`;

    try {
      const payload = {
        title,
        content,
        reference: `${this.currentChapterData?.book_french_name || ''}`,
        tags: ['Théologie', 'Résumé IA', this.currentBook]
      };
      const res = await API.call('save_note', payload);
      if (res && res.success !== false) {
        App.showToast('Résumé enregistré dans vos Notes (.md) !');
        if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
          NotesView.loadNotes();
        }
      } else {
        throw new Error(res?.error || 'Erreur enregistrement');
      }
    } catch (e) {
      console.error('Erreur export note:', e);
      App.showToast('Erreur lors de l\'export vers les notes');
    }
  },

  renderMarkdown(text) {
    if (!text) return '';
    let md = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Blocs de code
    md = md.replace(/```([\s\S]*?)```/g, (m, p) => `<pre><code>${p.trim()}</code></pre>\n\n`);
    // Titres
    md = md.replace(/^### (.*$)/gim, '<h3>$1</h3>\n');
    md = md.replace(/^## (.*$)/gim, '<h2>$1</h2>\n');
    md = md.replace(/^# (.*$)/gim, '<h1>$1</h1>\n');
    // Citations
    md = md.replace(/^\&gt; (.*$)/gim, '<blockquote>$1</blockquote>\n');
    // Listes
    md = md.replace(/^[\-\*] (.*$)/gim, '<ul><li>$1</li></ul>');
    md = md.replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
    md = md.replace(/<\/ul>\s*<ul>/g, '').replace(/<\/ol>\s*<ol>/g, '');
    // Inlines
    md = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/\*(.*?)\*/g, '<em>$1</em>');
    md = md.replace(/`([^`]+)`/g, '<code>$1</code>');

    const blocks = md.split(/\n\s*\n/);
    const htmlBlocks = blocks.map(block => {
      const b = block.trim();
      if (!b) return '';
      if (b.startsWith('<h1') || b.startsWith('<h2') || b.startsWith('<h3') || 
          b.startsWith('<pre') || b.startsWith('<blockquote') || 
          b.startsWith('<ul') || b.startsWith('<ol')) {
        return this.highlightScriptureReferences(b);
      }
      return `<p>${this.highlightScriptureReferences(b).replace(/\n/g, '<br>')}</p>`;
    });

    return htmlBlocks.filter(Boolean).join('\n');
  },

  // =========================================================================
  // EXPORT & COPIE DU CHAPITRE
  // =========================================================================

  copyChapterText() {
    if (!this.currentChapterData?.raw_text) return;
    navigator.clipboard.writeText(this.currentChapterData.raw_text).then(() => {
      App.showToast('Texte du chapitre copié dans le presse-papiers !');
    });
  },

  async exportChapterToNotes() {
    if (!this.currentChapterData?.raw_text) return;
    const title = `${this.currentChapterData?.chapter_title || `Chapitre ${this.currentChapterId}`} — ${this.currentChapterData?.book_title || this.currentBook}`;
    const content = `# ${title}\n\n${this.currentChapterData.raw_text}`;

    try {
      const payload = {
        title,
        content,
        reference: `${this.currentChapterData?.book_french_name || ''}`,
        tags: ['Théologie', this.currentBook]
      };
      const res = await API.call('save_note', payload);
      if (res && res.success !== false) {
        App.showToast('Chapitre exporté vers vos Notes (.md) !');
        if (typeof NotesView !== 'undefined' && NotesView.loadNotes) {
          NotesView.loadNotes();
        }
      } else {
        throw new Error(res?.error || 'Erreur enregistrement');
      }
    } catch (e) {
      console.error('Erreur export note:', e);
      App.showToast('Erreur lors de l\'export vers les notes');
    }
  },

  // =========================================================================
  // GESTION DU ZOOM, DES POLICES ET DES FONDS
  // =========================================================================

  applyDisplayPreferences() {
    this.setFontFamily(this.fontFamily);
    this.setReadingBg(this.readingBg);
    this.setFullWidth(this.isFullWidth);
    this.adjustZoom(0);
    this.toggleToc(this.isTocOpen);
  },

  setFontFamily(font) {
    this.fontFamily = font;
    const bodyEl = document.getElementById('theol-reading-body');
    if (bodyEl) {
      bodyEl.className = `theol-reading-body font-${font.toLowerCase().replace(/\s+/g, '-')}`;
    }
    document.querySelectorAll('.theol-font-choice-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.font === font);
    });
    try {
      localStorage.setItem('theol_view_font', font);
    } catch (e) {}
  },

  setReadingBg(bg) {
    this.readingBg = bg;
    if (this.articleCard) {
      this.articleCard.classList.remove('bg-white', 'bg-sepia', 'bg-dark', 'bg-auto');
      this.articleCard.classList.add(`bg-${bg}`);
    }
    document.querySelectorAll('.theol-bg-swatch').forEach(b => {
      b.classList.toggle('active', b.dataset.bg === bg);
    });
    try {
      localStorage.setItem('theol_reading_bg', bg);
    } catch (e) {}
  },

  setFullWidth(isFull) {
    this.isFullWidth = isFull;
    if (this.articleContainer) {
      this.articleContainer.classList.toggle('full-width', isFull);
    }
    if (this.optFullWidth) {
      this.optFullWidth.checked = isFull;
    }
    try {
      localStorage.setItem('theol_full_width', String(isFull));
    } catch (e) {}
  },

  adjustZoom(delta) {
    if (delta !== 0) {
      this.zoomPercent = Math.min(180, Math.max(70, this.zoomPercent + delta));
    }
    if (this.lblZoomLevel) {
      this.lblZoomLevel.textContent = `${this.zoomPercent}%`;
    }
    if (this.articleCard) {
      this.articleCard.style.setProperty('--theol-zoom-scale', this.zoomPercent / 100);
      this.articleCard.style.fontSize = `calc(18px * ${this.zoomPercent / 100})`;
    }
    try {
      localStorage.setItem('theol_view_zoom', String(this.zoomPercent));
    } catch (e) {}
  },

  // =========================================================================
  // ÉTATS DE CHARGEMENT & ERREURS (STYLE LOGOS)
  // =========================================================================

  renderInitialLoadingState(customText = "Chargement de vos ouvrages de théologie...") {
    if (this.articleHero) this.articleHero.innerHTML = '';
    if (this.articleFooterNav) this.articleFooterNav.innerHTML = '';
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="theol-view-loader">
          <div class="theol-loader-glow">
            <div class="theol-loader-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg>
            </div>
          </div>
          <div class="theol-loader-title">OUVRAGES DE THÉOLOGIE</div>
          <div class="theol-loader-subtitle">ÉTUDES DOCTRINALES & SYSTEMATIQUES</div>
          <div class="theol-loader-progress-track">
            <div class="theol-loader-progress-bar"></div>
          </div>
          <div class="theol-loader-status">${customText}</div>
        </div>
      `;
    }
    if (this.tocListContainer) {
      this.tocListContainer.innerHTML = `
        <div class="theol-toc-skeleton">
          <div class="theol-skeleton-item shimmer"></div>
          <div class="theol-skeleton-item shimmer"></div>
          <div class="theol-skeleton-item shimmer"></div>
          <div class="theol-skeleton-item shimmer"></div>
          <div class="theol-skeleton-item shimmer"></div>
          <div class="theol-skeleton-item shimmer"></div>
        </div>
      `;
    }
  },

  renderLoadingArticle(customTitle = "Chargement du chapitre...") {
    if (this.articleHero) {
      this.articleHero.innerHTML = `
        <div class="theol-hero-badge-row">
          <span class="theol-hero-book-badge">${this.escapeHtml(this.currentBook || 'Théologie')}</span>
        </div>
        <h1 class="theol-hero-chapter-title">${this.escapeHtml(customTitle)}</h1>
        <div class="theol-hero-divider"></div>
      `;
    }
    if (this.articleFooterNav) this.articleFooterNav.innerHTML = '';
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="theol-chapter-loading-container" style="padding: 10px 0;">
          <div class="theol-loader-progress-track" style="margin: 0 auto 30px auto;">
            <div class="theol-loader-progress-bar"></div>
          </div>
          <div class="theol-paragraph-skeleton shimmer" style="width: 100%; height: 18px; margin-bottom: 14px; border-radius: 4px;"></div>
          <div class="theol-paragraph-skeleton shimmer" style="width: 96%; height: 18px; margin-bottom: 14px; border-radius: 4px;"></div>
          <div class="theol-paragraph-skeleton shimmer" style="width: 88%; height: 18px; margin-bottom: 26px; border-radius: 4px;"></div>
          <div class="theol-paragraph-skeleton shimmer" style="width: 98%; height: 18px; margin-bottom: 14px; border-radius: 4px;"></div>
          <div class="theol-paragraph-skeleton shimmer" style="width: 93%; height: 18px; margin-bottom: 14px; border-radius: 4px;"></div>
          <div class="theol-paragraph-skeleton shimmer" style="width: 65%; height: 18px; margin-bottom: 26px; border-radius: 4px;"></div>
        </div>
      `;
    }
  },

  renderEmptyChapterArticle() {
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="theol-empty-state">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
          <h3>Aucun contenu disponible pour ce chapitre</h3>
          <p>Ce chapitre ne contient aucun texte indexé.</p>
        </div>
      `;
    }
  },

  renderErrorArticle(err) {
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="theol-error-box">
          <p>Erreur lors du chargement : ${this.escapeHtml(err.message || String(err))}</p>
        </div>
      `;
    }
  },

  renderNoChaptersState(book) {
    if (this.articleHero) this.articleHero.innerHTML = `<h1>${this.escapeHtml(book.title || book.name)}</h1>`;
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="theol-empty-state">
          <p>Aucun chapitre n'a été trouvé pour cet ouvrage.</p>
        </div>
      `;
    }
  },

  renderEmptyState() {
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="theol-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
          <h2>Aucun ouvrage de théologie indexé</h2>
          <p>Importez des livres ou manuels d'étude au format EPUB depuis la Bibliothèque pour commencer la lecture.</p>
        </div>
      `;
    }
  },

  isBookInEnglish(text) {
    if (!text || typeof text !== 'string') {
      text = this.currentChapterData?.raw_text || '';
    }

    const sample = (text ? text.slice(0, 3000) : '').toLowerCase();

    // 1. Analyse statistique de fréquence de mots français vs anglais
    if (sample.length > 30) {
      const frenchWords = ['le', 'la', 'les', 'des', 'du', 'dans', 'pour', 'avec', 'une', 'qui', 'que', 'est', 'sont', 'cette', 'nous', 'vous', 'par', 'sur', 'mais', 'pas', 'aux', 'livre', 'chapitre', 'dieu', 'foi', 'bible', 'verset'];
      const englishWords = ['the', 'and', 'that', 'with', 'from', 'this', 'which', 'their', 'about', 'have', 'were', 'been', 'they', 'shall', 'would', 'could', 'should', 'chapter', 'which', 'when', 'into', 'upon'];

      let frCount = 0;
      let enCount = 0;

      for (const w of frenchWords) {
        const regex = new RegExp(`\\b${w}\\b`, 'gi');
        const matches = sample.match(regex);
        if (matches) frCount += matches.length;
      }

      for (const w of englishWords) {
        const regex = new RegExp(`\\b${w}\\b`, 'gi');
        const matches = sample.match(regex);
        if (matches) enCount += matches.length;
      }

      // Si le texte contient clairement des mots grammaticaux français, c'est du français
      if (frCount >= 2 && frCount >= enCount) return false;
      // Si les mots anglais dominent très nettement
      if (enCount >= 4 && enCount > frCount) return true;
    }

    // 2. Vérification des métadonnées du livre actif
    const currentBookObj = this.books?.find(b => b.name === this.currentBook);
    if (currentBookObj?.lang) {
      const langLower = currentBookObj.lang.toLowerCase();
      if (langLower.startsWith('fr')) return false;
      if (langLower.startsWith('en')) return true;
    }

    // 3. Vérification des titres de la table des matières (TOC)
    if (this.tocList && this.tocList.length > 0) {
      const tocTitles = this.tocList.slice(0, 15).map(c => c.title || '').join(' ').toLowerCase();
      const unambiguousFrench = ['chapitre', 'livre', 'sommaire', 'introduction', 'la', 'le', 'les', 'du', 'des', 'dans'];
      const unambiguousEnglish = ['chapter', 'the', 'of', 'and', 'part', 'preface'];

      let frToc = 0;
      let enToc = 0;
      for (const w of unambiguousFrench) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(tocTitles)) frToc++;
      }
      for (const w of unambiguousEnglish) {
        if (new RegExp(`\\b${w}\\b`, 'i').test(tocTitles)) enToc++;
      }

      if (frToc >= enToc && frToc > 0) return false;
      if (enToc >= 2) return true;
    }

    return false;
  },

  _hashCode(str) {
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  refreshVintage() {
    const readingContainer = document.querySelector('.theol-reading-container') || document.querySelector('.theol-view-main-scroll');
    if (readingContainer && typeof VintageThemeManager !== 'undefined') {
      const data = this.currentChapterData;
      const author = data?.book_author || '';
      const bookTitle = data?.book_title || data?.book_name || '';
      VintageThemeManager.applyEpochToElement(readingContainer, author || bookTitle);
    }
  }
};

// =============================================================================
// GESTIONNAIRE D'INFOBULLES DE PRÉVISUALISATION BIBLIQUE (LOGOS SCRIPTURE TOOLTIP)
// =============================================================================

const ScriptureTooltip = {
  tooltipEl: null,
  cache: {},
  hoverTimer: null,
  activeTarget: null,
  activeRef: null,

  init() {
    if (this.tooltipEl) return;
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'theol-scripture-tooltip hidden';
    this.tooltipEl.id = 'theol-scripture-tooltip';
    document.body.appendChild(this.tooltipEl);

    // Clic sur l'infobulle pour ouvrir le passage dans le lecteur biblique
    this.tooltipEl.addEventListener('click', () => {
      if (this.activeRef) {
        TheologyView.openScriptureReference(this.activeRef);
        this.hide();
      }
    });

    this.tooltipEl.addEventListener('mouseenter', () => {
      if (this.hoverTimer) clearTimeout(this.hoverTimer);
    });

    this.tooltipEl.addEventListener('mouseleave', () => {
      this.hide();
    });

    // Cacher lors du défilement
    window.addEventListener('scroll', () => this.hide(), { passive: true });
    document.getElementById('theol-main-scroll')?.addEventListener('scroll', () => this.hide(), { passive: true });
  },

  bindToElements(elements) {
    if (!elements) return;
    this.init();

    elements.forEach(el => {
      // Supprimer systématiquement l'attribut title natif pour empêcher l'infobulle Windows de s'afficher
      if (el.hasAttribute('title')) {
        el.removeAttribute('title');
      }

      const getRef = () => el.dataset.ref || el.dataset.code || el.textContent.trim();

      el.addEventListener('mouseenter', () => {
        if (el.hasAttribute('title')) el.removeAttribute('title');
        const ref = getRef();
        if (!ref) return;
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        this.hoverTimer = setTimeout(() => {
          this.show(el, ref);
        }, 60);
      });

      el.addEventListener('mouseleave', () => {
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        this.hoverTimer = setTimeout(() => {
          this.hide();
        }, 120);
      });
    });
  },

  async show(targetEl, ref) {
    this.activeTarget = targetEl;
    this.activeRef = ref;
    this.init();

    // S'assurer que la cible n'a aucun attribut title
    if (targetEl && targetEl.hasAttribute('title')) {
      targetEl.removeAttribute('title');
    }

    this.positionTooltip(targetEl);

    const activeBible = (typeof BibleReader !== 'undefined' && BibleReader.currentBible1) ? BibleReader.currentBible1 : 'Segond 21';
    const cacheKey = `${ref}_${activeBible}`;

    if (this.cache[cacheKey]) {
      this.renderContent(this.cache[cacheKey]);
      this.tooltipEl.classList.remove('hidden');
      requestAnimationFrame(() => this.tooltipEl.classList.add('visible'));
      this.positionTooltip(targetEl);
      return;
    }

    // État de chargement élégant
    this.tooltipEl.innerHTML = `
      <div class="theol-scripture-tooltip-header">
        <div class="theol-scripture-tooltip-ref">
          <span>📖</span>
          <span>${TheologyView.escapeHtml(ref)}</span>
        </div>
        <div class="theol-scripture-tooltip-version">${TheologyView.escapeHtml(activeBible)}</div>
      </div>
      <div class="theol-scripture-tooltip-loading">
        <div class="theol-scripture-tooltip-spinner"></div>
        <span>Récupération du verset...</span>
      </div>
      <div class="theol-scripture-tooltip-footer">
        <span class="theol-scripture-tooltip-hint">👆 Cliquer pour ouvrir dans la Bible</span>
      </div>
    `;

    this.tooltipEl.classList.remove('hidden');
    requestAnimationFrame(() => this.tooltipEl.classList.add('visible'));

    try {
      const res = await API.getVersePreview(ref, activeBible);
      if (res && res.success && res.text) {
        this.cache[cacheKey] = res;
        if (this.activeRef === ref) {
          this.renderContent(res);
          this.positionTooltip(targetEl);
        }
      } else {
        if (this.activeRef === ref) {
          this.renderFallback(ref);
          this.positionTooltip(targetEl);
        }
      }
    } catch (e) {
      if (this.activeRef === ref) {
        this.renderFallback(ref);
        this.positionTooltip(targetEl);
      }
    }
  },

  renderContent(data) {
    this.tooltipEl.innerHTML = `
      <div class="theol-scripture-tooltip-header">
        <div class="theol-scripture-tooltip-ref">
          <span>📖</span>
          <span>${TheologyView.escapeHtml(data.reference || data.book_french)}</span>
        </div>
        <div class="theol-scripture-tooltip-version">${TheologyView.escapeHtml(data.bible || 'Segond 21')}</div>
      </div>
      <div class="theol-scripture-tooltip-body">
        ${data.text}
      </div>
      <div class="theol-scripture-tooltip-footer">
        <span>${data.book_french} ${data.chapter}${data.verse ? `:${data.verse}` : ''}</span>
        <span class="theol-scripture-tooltip-hint">👆 Cliquer pour ouvrir</span>
      </div>
    `;
  },

  renderFallback(ref) {
    this.tooltipEl.innerHTML = `
      <div class="theol-scripture-tooltip-header">
        <div class="theol-scripture-tooltip-ref">
          <span>📖</span>
          <span>${TheologyView.escapeHtml(ref)}</span>
        </div>
      </div>
      <div class="theol-scripture-tooltip-body" style="font-style: italic; color: var(--text-secondary);">
        Consulter ce passage dans le lecteur biblique pour afficher le texte complet et l'interlinéaire.
      </div>
      <div class="theol-scripture-tooltip-footer">
        <span class="theol-scripture-tooltip-hint">👆 Cliquer pour ouvrir</span>
      </div>
    `;
  },

  positionTooltip(targetEl) {
    if (!this.tooltipEl || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 350;
    const tooltipHeight = 150;

    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    let top = rect.bottom + 8;

    // Empêcher de déborder de l'écran horizontalement
    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }

    // Si on déborde en bas de l'écran, basculer au-dessus
    if (top + tooltipHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - tooltipHeight - 8);
    }

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  },

  hide() {
    if (!this.tooltipEl) return;
    this.activeRef = null;
    this.activeTarget = null;
    this.tooltipEl.classList.remove('visible');
    setTimeout(() => {
      if (!this.activeRef && this.tooltipEl) {
        this.tooltipEl.classList.add('hidden');
      }
    }, 150);
  }
};

// =============================================================================
// GESTIONNAIRE D'INFOBULLES ET DE SAUTS DE NOTES DE BAS DE PAGE (FOOTNOTE TOOLTIP)
// =============================================================================

const FootnoteTooltip = {
  tooltipEl: null,
  activeTarget: null,
  activeFnId: null,
  hoverTimer: null,
  footnotesMap: {},

  init() {
    if (this.tooltipEl) return;
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'theol-fn-popover hidden';
    this.tooltipEl.id = 'theol-fn-popover';
    document.body.appendChild(this.tooltipEl);

    this.tooltipEl.addEventListener('mouseenter', () => {
      if (this.hoverTimer) clearTimeout(this.hoverTimer);
    });

    this.tooltipEl.addEventListener('mouseleave', () => {
      this.hide();
    });

    window.addEventListener('scroll', () => this.hide(), { passive: true });
    document.getElementById('theol-main-scroll')?.addEventListener('scroll', () => this.hide(), { passive: true });
  },

  setFootnotes(footnotesList) {
    this.footnotesMap = {};
    if (Array.isArray(footnotesList)) {
      footnotesList.forEach(fn => {
        this.footnotesMap[String(fn.id)] = fn.text;
      });
    }
  },

  bindToElements(elements) {
    if (!elements) return;
    this.init();

    elements.forEach(el => {
      if (el.hasAttribute('title')) el.removeAttribute('title');
      const fnId = el.dataset.fnId;

      el.addEventListener('mouseenter', () => {
        if (el.hasAttribute('title')) el.removeAttribute('title');
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        this.hoverTimer = setTimeout(() => {
          this.show(el, fnId);
        }, 80);
      });

      el.addEventListener('mouseleave', () => {
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        this.hoverTimer = setTimeout(() => {
          this.hide();
        }, 150);
      });

      // Clic pour défiler directement vers la note avec animation de surbrillance
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.hide();
        const targetFnEl = document.getElementById(`theol-fn-${fnId}`);
        if (targetFnEl) {
          TheologyView.smoothScrollToElement(targetFnEl);
          targetFnEl.classList.remove('theol-highlight-pulse');
          void targetFnEl.offsetWidth; // Déclencher le reflow CSS
          targetFnEl.classList.add('theol-highlight-pulse');
        }
      });
    });
  },

  show(targetEl, fnId) {
    const text = this.footnotesMap[String(fnId)];
    if (!text) return;

    this.init();
    this.activeTarget = targetEl;
    this.activeFnId = fnId;

    const formattedText = TheologyView.linkifyUrls(TheologyView.highlightScriptureReferences(text));

    this.tooltipEl.innerHTML = `
      <div class="theol-fn-popover-header">
        <div class="theol-fn-popover-badge">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:4px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span>Note ${TheologyView.escapeHtml(String(fnId))}</span>
        </div>
        <button type="button" class="theol-fn-popover-jump" data-fn-id="${fnId}">
          Voir en bas ↓
        </button>
      </div>
      <div class="theol-fn-popover-body">${formattedText}</div>
    `;

    // Attacher les clics sur les références bibliques contenues dans la note
    const inlineRefs = this.tooltipEl.querySelectorAll('.theol-inline-scripture-ref');
    inlineRefs.forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = span.dataset.ref || span.textContent.trim();
        if (ref) {
          this.hide();
          TheologyView.openScriptureReference(ref);
        }
      });
    });
    if (typeof ScriptureTooltip !== 'undefined') {
      ScriptureTooltip.bindToElements(inlineRefs);
    }

    // Bouton de saut vers la section des notes
    const jumpBtn = this.tooltipEl.querySelector('.theol-fn-popover-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        const targetFnEl = document.getElementById(`theol-fn-${fnId}`);
        if (targetFnEl) {
          TheologyView.smoothScrollToElement(targetFnEl);
          targetFnEl.classList.remove('theol-highlight-pulse');
          void targetFnEl.offsetWidth;
          targetFnEl.classList.add('theol-highlight-pulse');
        }
      });
    }

    // Retirer 'hidden' pour calculer la dimension réelle dans le DOM
    this.tooltipEl.classList.remove('hidden');
    this.positionTooltip(targetEl);
    requestAnimationFrame(() => this.tooltipEl.classList.add('visible'));
  },

  positionTooltip(targetEl) {
    if (!this.tooltipEl || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const realWidth = this.tooltipEl.offsetWidth || 340;
    const realHeight = this.tooltipEl.offsetHeight || 120;

    let left = rect.left + (rect.width / 2) - (realWidth / 2);
    
    // Par défaut : positionner AU-DESSUS du badge avec 8px d'écart
    let top = rect.top - realHeight - 8;

    // Si pas assez de place au-dessus du haut de la fenêtre, positionner EN-DESSOUS avec 8px d'écart
    if (top < 16) {
      top = rect.bottom + 8;
    }

    // Contraintes horizontales pour ne pas déborder de l'écran
    if (left < 16) left = 16;
    if (left + realWidth > window.innerWidth - 16) {
      left = window.innerWidth - realWidth - 16;
    }

    this.tooltipEl.style.left = `${Math.round(left)}px`;
    this.tooltipEl.style.top = `${Math.round(top)}px`;
  },


  hide() {
    if (!this.tooltipEl) return;
    this.activeTarget = null;
    this.activeFnId = null;
    this.tooltipEl.classList.remove('visible');
    setTimeout(() => {
      if (!this.activeTarget && this.tooltipEl) {
        this.tooltipEl.classList.add('hidden');
      }
    }, 150);
  }
};

window.TheologyView = TheologyView;
window.ScriptureTooltip = ScriptureTooltip;
window.FootnoteTooltip = FootnoteTooltip;

