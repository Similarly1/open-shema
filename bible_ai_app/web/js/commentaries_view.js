/**
 * Commentaries View Controller
 * Gère la page dédiée plein écran aux commentaires exégétiques :
 * navigation fluide par verset (◀ ▶ ou saisie), sélection typographique par auteur,
 * traduction IA en français avec cache, synthèse IA multi-auteurs intégrée sur la page, copie et export vers les notes.
 */

const CommentariesView = {
  currentBook: 'Gen',
  currentBookFrench: 'Genèse',
  currentChapter: 1,
  currentVerse: 1,
  currentComments: [],
  activeIndex: 0,
  preferredAuthor: null,
  translationCache: {},
  showTranslatedVersion: {},
  isLoading: false,

  // Mode Synthèse IA sur la page
  isSynthMode: false,
  synthVerseStart: 1,
  synthVerseEnd: 1,
  synthMaxVersesLimit: 5,
  latestSynthesisMarkdown: '',

  // Éléments du DOM
  searchInput: null,
  btnSearch: null,
  btnPrev: null,
  btnNext: null,
  btnBackBible: null,
  btnSynthHeader: null,
  verseBannerRef: null,
  verseBannerBible: null,
  verseBannerText: null,
  authorsTabsContainer: null,
  articleContainer: null,
  articleContent: null,
  countBadge: null,

  // Éléments Synthèse IA
  synthPanel: null,
  synthPassageBadge: null,
  synthRangeBook: null,
  synthStartInput: null,
  synthEndInput: null,
  synthRangeInfo: null,
  synthCeilingWarning: null,
  synthCeilingLimitNum: null,
  synthSourcesHint: null,
  btnLaunchSynth: null,
  synthLoadingBox: null,
  synthStepStatus: null,
  synthResultContainer: null,
  synthModelTag: null,
  synthSourcesTag: null,
  synthMarkdownContent: null,
  btnCloseSynth: null,
  btnEditSynthRange: null,
  lblEditSynthRange: null,
  btnCopySynth: null,
  btnExportSynthNote: null,
  synthRangeControls: null,
  synthQuickOptions: null,

  init() {
    this.searchInput = document.getElementById('comm-view-search-input');
    this.btnSearch = document.getElementById('btn-comm-view-search');
    this.btnPrev = document.getElementById('btn-comm-view-prev');
    this.btnNext = document.getElementById('btn-comm-view-next');
    this.btnBackBible = document.getElementById('btn-comm-view-back-bible');
    this.btnSynthHeader = document.getElementById('btn-comm-view-synth');
    this.verseBannerRef = document.getElementById('comm-view-verse-ref');
    this.verseBannerBible = document.getElementById('comm-view-verse-bible-name');
    this.verseBannerText = document.getElementById('comm-view-verse-text');
    this.authorsTabsContainer = document.getElementById('comm-view-author-tabs');
    this.articleContainer = document.getElementById('comm-view-article-container');
    this.articleContent = document.getElementById('comm-view-article-content');
    this.countBadge = document.getElementById('comm-view-count-badge');

    // Synthèse IA DOM
    this.synthPanel = document.getElementById('comm-page-synth-container');
    this.synthPassageBadge = document.getElementById('comm-page-synth-passage-badge');
    this.synthRangeBook = document.getElementById('comm-page-synth-range-book');
    this.synthStartInput = document.getElementById('comm-page-synth-verse-start');
    this.synthEndInput = document.getElementById('comm-page-synth-verse-end');
    this.synthRangeInfo = document.getElementById('comm-page-synth-range-info');
    this.synthCeilingWarning = document.getElementById('comm-page-synth-ceiling-warning');
    this.synthCeilingLimitNum = document.getElementById('comm-page-synth-ceiling-limit-num');
    this.synthSourcesHint = document.getElementById('comm-page-synth-sources-hint');
    this.btnLaunchSynth = document.getElementById('btn-comm-page-launch-synth');
    this.synthLoadingBox = document.getElementById('comm-page-synth-loading-box');
    this.synthStepStatus = document.getElementById('comm-page-synth-step-status');
    this.synthResultContainer = document.getElementById('comm-page-synth-result-container');
    this.synthModelTag = document.getElementById('comm-page-synth-model-tag');
    this.synthSourcesTag = document.getElementById('comm-page-synth-sources-tag');
    this.synthMarkdownContent = document.getElementById('comm-page-synth-markdown-content');
    this.btnCloseSynth = document.getElementById('btn-close-comm-page-synth');
    this.btnEditSynthRange = document.getElementById('btn-comm-page-edit-synth-range');
    this.lblEditSynthRange = document.getElementById('lbl-comm-page-edit-range');
    this.btnCopySynth = document.getElementById('btn-comm-page-copy-synth');
    this.btnExportSynthNote = document.getElementById('btn-comm-page-export-synth-note');
    this.synthRangeControls = document.getElementById('comm-page-synth-range-controls');
    this.synthQuickOptions = document.getElementById('comm-page-synth-quick-options');

    // 1. Événements de recherche et navigation
    this.btnSearch?.addEventListener('click', () => this.handleSearch());
    this.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSearch();
      }
    });

    this.btnPrev?.addEventListener('click', () => this.navigateVerse(-1));
    this.btnNext?.addEventListener('click', () => this.navigateVerse(1));

    // 2. Bouton retour au lecteur biblique
    this.btnBackBible?.addEventListener('click', () => {
      this.openInBibleReader();
    });

    // 3. Synthèse IA
    this.btnSynthHeader?.addEventListener('click', () => {
      if (this.isSynthMode) {
        this.closeAISynthesis();
      } else {
        this.openAISynthesis();
      }
    });

    this.btnCloseSynth?.addEventListener('click', () => {
      this.closeAISynthesis();
    });

    this.btnLaunchSynth?.addEventListener('click', () => {
      this.launchAISynthesis();
    });

    this.synthStartInput?.addEventListener('input', () => this.handleSynthRangeChange());
    this.synthEndInput?.addEventListener('input', () => this.handleSynthRangeChange());

    this.btnEditSynthRange?.addEventListener('click', () => {
      this.toggleSynthRangeEdit();
    });

    this.btnCopySynth?.addEventListener('click', () => {
      this.copySynthesis();
    });

    this.btnExportSynthNote?.addEventListener('click', () => {
      this.exportSynthesisToNote();
    });

    // 4. Raccourcis clavier (flèches gauche/droite pour versets)
    window.addEventListener('keydown', (e) => {
      if (App.activeView !== 'commentaries') return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigateVerse(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateVerse(1);
      }
    });
  },

  async handleSearch() {
    const raw = this.searchInput?.value?.trim();
    if (!raw) return;

    try {
      const parsed = await API.parseReference(raw);
      if (parsed && parsed.book) {
        const bookCode = parsed.book;
        const chapter = parsed.chapter || 1;
        const verse = parsed.verse || 1;
        await this.loadPassage(bookCode, chapter, verse, this.preferredAuthor);
      } else {
        App.showToast(`Passage introuvable : « ${raw} »`);
      }
    } catch (e) {
      console.error('Erreur recherche commentaire:', e);
      App.showToast('Erreur lors de la recherche du passage');
    }
  },

  async navigateVerse(delta) {
    let nextV = this.currentVerse + delta;
    let nextCh = this.currentChapter;
    let nextBk = this.currentBook;

    if (nextV < 1) {
      if (nextCh > 1) {
        nextCh -= 1;
        nextV = 1; // Début du chapitre précédent
      } else {
        App.showToast('Début du livre');
        return;
      }
    }

    await this.loadPassage(nextBk, nextCh, nextV, this.preferredAuthor);
  },

  /**
   * Appelé automatiquement lors du basculement sur la vue des commentaires.
   */
  onViewActivated() {
    let book = 'Gen';
    let chapter = 1;
    let verse = 1;
    let author = null;

    if (typeof CommentaryViewer !== 'undefined') {
      book = CommentaryViewer.currentBook || BibleReader?.currentBook || 'Gen';
      chapter = CommentaryViewer.currentChapter || BibleReader?.currentChapter || 1;
      verse = CommentaryViewer.currentVerse || BibleReader?.currentVerse || 1;
      author = CommentaryViewer.preferredAuthor;

      // Partager le cache de traduction
      this.translationCache = { ...CommentaryViewer.translationCache, ...this.translationCache };
      this.showTranslatedVersion = { ...CommentaryViewer.showTranslatedVersion, ...this.showTranslatedVersion };
    } else if (typeof BibleReader !== 'undefined') {
      book = BibleReader.currentBook || 'Gen';
      chapter = BibleReader.currentChapter || 1;
      verse = BibleReader.currentVerse || 1;
    }

    this.loadPassage(book, chapter, verse, author);
  },

  /**
   * Ouvre la page dédiée en important l'état exact du lecteur biblique / volet latéral.
   */
  openWithCurrentState() {
    document.querySelectorAll('.sidebar-menu .nav-item, .sidebar-footer .nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-commentaries')?.classList.add('active');
    App.switchView('commentaries');
  },

  /**
   * Charge et affiche tous les commentaires pour un verset donné ainsi que le texte biblique.
   */
  async loadPassage(bookCode, chapter, verse, preferredAuthor = null) {
    this.currentBook = bookCode;
    this.currentChapter = parseInt(chapter) || 1;
    this.currentVerse = parseInt(verse) || 1;
    if (preferredAuthor) this.preferredAuthor = preferredAuthor;

    // Déterminer le nom français du livre
    const bookInfo = (typeof BookPicker !== 'undefined' && BookPicker.booksData)
      ? BookPicker.booksData.find(b => b.code === bookCode)
      : null;
    this.currentBookFrench = bookInfo?.name || bookCode;

    const refString = `${this.currentBookFrench} ${this.currentChapter}:${this.currentVerse}`;
    if (this.searchInput) {
      this.searchInput.value = refString;
    }
    if (this.verseBannerRef) {
      this.verseBannerRef.textContent = refString;
    }

    // Afficher l'état de chargement
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="comm-view-loading">
          <div class="synth-spinner" style="width: 28px; height: 28px; border-width: 3px; margin: 0 auto 12px auto;"></div>
          <div style="font-size: 13px; color: var(--text-muted);">Chargement des commentaires pour <strong>${refString}</strong>...</div>
        </div>
      `;
    }

    // 1. Récupérer le texte du verset biblique dans la version courante (ex: TOB)
    const bibleName = BibleReader?.currentBible1 || 'TOB';
    if (this.verseBannerBible) {
      this.verseBannerBible.textContent = bibleName;
    }

    try {
      API.getChapterData(bibleName, bookCode, this.currentChapter).then(chapterData => {
        if (chapterData && chapterData.verses) {
          const vObj = chapterData.verses.find(v => parseInt(v.verse) === this.currentVerse);
          if (vObj && this.verseBannerText) {
            const plainText = (vObj.text || '').replace(/<[^>]*>/g, '').trim();
            this.verseBannerText.textContent = `« ${plainText} »`;
          }
        }
      }).catch(err => console.warn('Impossible de charger le texte du verset:', err));
    } catch (e) {}

    // 2. Récupérer tous les commentaires exégétiques
    try {
      const comments = await API.getCommentaries(bookCode, this.currentChapter, this.currentVerse);
      this.currentComments = comments || [];

      // Mettre à jour le badge du nombre de sources
      if (this.countBadge) {
        this.countBadge.textContent = `${this.currentComments.length} source${this.currentComments.length > 1 ? 's' : ''}`;
      }

      // Synchroniser avec CommentaryViewer si présent
      if (typeof CommentaryViewer !== 'undefined') {
        CommentaryViewer.currentBook = this.currentBook;
        CommentaryViewer.currentChapter = this.currentChapter;
        CommentaryViewer.currentVerse = this.currentVerse;
        CommentaryViewer.currentVerseRef = refString;
        CommentaryViewer.currentComments = this.currentComments;
      }

      // Si le mode synthèse était actif, synchroniser la plage avec le nouveau verset
      if (this.isSynthMode) {
        this.synthVerseStart = this.currentVerse;
        this.synthVerseEnd = this.currentVerse;
        this.updateSynthRangeDisplay();
      }

      this.render();
    } catch (e) {
      console.error('Erreur chargement commentaires:', e);
      if (this.articleContent) {
        this.articleContent.innerHTML = `
          <div style="color: var(--accent-red); padding: 40px; text-align: center;">
            <p style="font-weight: 700;">Erreur lors de la récupération des commentaires.</p>
            <p style="font-size: 12px; color: var(--text-muted);">${e}</p>
          </div>
        `;
      }
    }
  },

  /**
   * Rendu complet des pilules d'auteurs et du commentaire actif
   */
  render() {
    if (!this.authorsTabsContainer) return;
    this.authorsTabsContainer.innerHTML = '';

    if (!this.currentComments || this.currentComments.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Pilule spéciale "Synthèse IA"
    const synthPill = document.createElement('button');
    synthPill.className = `comm-author-pill comm-synth-pill ${this.isSynthMode ? 'active' : ''}`;
    synthPill.innerHTML = `
      <span class="comm-pill-avatar" style="background: linear-gradient(135deg, #6366F1, #8B5CF6); font-size: 11px;">✨</span>
      <span class="comm-pill-name">Synthèse IA</span>
      <span class="comm-pill-period">Tous commentateurs</span>
    `;
    synthPill.addEventListener('click', () => {
      this.openAISynthesis();
    });
    this.authorsTabsContainer.appendChild(synthPill);

    // Trouver l'index du commentaire correspondant à preferredAuthor
    let targetIndex = 0;
    if (this.preferredAuthor) {
      const pIdx = this.currentComments.findIndex(c => 
        (c.author && c.author.toLowerCase() === this.preferredAuthor.toLowerCase()) ||
        (c.source && c.source.toLowerCase() === this.preferredAuthor.toLowerCase())
      );
      if (pIdx !== -1) {
        targetIndex = pIdx;
      }
    }
    this.activeIndex = targetIndex;

    // Construire les pilules de sélection d'auteurs
    this.currentComments.forEach((comm, idx) => {
      const authorName = comm.author || comm.source || 'Commentaire';
      const sourceMeta = this.getSourceMeta(authorName);

      const pill = document.createElement('button');
      pill.className = `comm-author-pill ${(!this.isSynthMode && idx === this.activeIndex) ? 'active' : ''}`;
      pill.setAttribute('data-author-idx', idx);

      pill.innerHTML = `
        <span class="comm-pill-avatar" style="background-color: ${sourceMeta.color || '#3B82F6'};">${sourceMeta.initials || 'C'}</span>
        <span class="comm-pill-name">${authorName}</span>
        <span class="comm-pill-period">${sourceMeta.period ? sourceMeta.period.split('(')[0].trim() : ''}</span>
      `;

      pill.addEventListener('click', () => {
        if (this.isSynthMode) {
          this.closeAISynthesis();
        }
        this.selectCommentary(idx);
      });

      this.authorsTabsContainer.appendChild(pill);
    });

    if (!this.isSynthMode) {
      this.selectCommentary(this.activeIndex);
    }
  },

  selectCommentary(index) {
    if (!this.currentComments || !this.currentComments[index]) return;
    this.activeIndex = index;

    const comm = this.currentComments[index];
    const authorName = comm.author || comm.source || 'Commentaire';
    this.preferredAuthor = authorName;

    // S'assurer que le panneau d'article est affiché et le panneau synthèse masqué
    this.articleContainer?.classList.remove('hidden');
    this.synthPanel?.classList.add('hidden');
    this.btnSynthHeader?.classList.remove('active');

    // Mettre à jour l'état actif des pilules
    if (this.authorsTabsContainer) {
      this.authorsTabsContainer.querySelectorAll('.comm-author-pill').forEach((pill) => {
        const pIdx = pill.getAttribute('data-author-idx');
        if (pIdx !== null) {
          pill.classList.toggle('active', parseInt(pIdx) === index);
        } else {
          pill.classList.remove('active');
        }
      });
    }

    if (!this.articleContent) return;

    const sourceMeta = this.getSourceMeta(authorName);
    const itemId = `${comm.source || authorName}_${this.currentBook}_${this.currentChapter}_${comm.verse_start || this.currentVerse}`;
    const isForeign = this.isForeignText(comm.text);
    const cachedTranslation = this.translationCache[itemId] || CommentaryViewer?.translationCache?.[itemId];
    const isShowingTranslated = this.showTranslatedVersion[itemId] !== false && !!cachedTranslation;

    let displayedText = comm.text || '';
    if (cachedTranslation && isShowingTranslated) {
      displayedText = cachedTranslation;
    }

    // Formatage Markdown / Rich HTML
    const formattedHtml = this.formatCommentaryContent(displayedText);

    // Bannière de traduction
    let translationBannerHtml = '';
    if (cachedTranslation) {
      if (isShowingTranslated) {
        translationBannerHtml = `
          <div class="comm-view-trans-banner">
            <span class="comm-trans-badge-text">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Traduction fidèle en français (générée par IA)</span>
            </span>
            <button class="comm-trans-toggle-btn" id="btn-comm-view-toggle-orig">Voir la version originale</button>
          </div>
        `;
      } else {
        translationBannerHtml = `
          <div class="comm-view-trans-banner">
            <span class="comm-trans-badge-text">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>Texte original (${comm.source || authorName})</span>
            </span>
            <button class="comm-trans-toggle-btn" id="btn-comm-view-toggle-orig">Voir la traduction française</button>
          </div>
        `;
      }
    }

    this.articleContent.innerHTML = `
      <div class="comm-view-author-card">
        <div class="comm-author-top-row">
          <div class="comm-author-profile">
            <div class="comm-author-big-avatar" style="background-color: ${sourceMeta.color || '#1E3A8A'};">
              ${sourceMeta.initials || 'C'}
            </div>
            <div>
              <div class="comm-author-headline-name">${sourceMeta.title || authorName}</div>
              <div class="comm-author-headline-period">${sourceMeta.period || 'Ouvrage d\'exégèse biblique'} • ${sourceMeta.author || authorName}</div>
            </div>
          </div>
          
          <div class="comm-author-top-actions">
            ${isForeign && !cachedTranslation ? `
              <button class="comm-action-btn-pill" id="btn-comm-view-translate-btn" title="Traduire cet article en français avec l'IA">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>Traduire en français</span>
              </button>
            ` : ''}
            
            <button class="comm-action-btn-pill" id="btn-comm-view-copy-article" title="Copier ce commentaire">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copier</span>
            </button>

            <button class="comm-action-btn-pill" id="btn-comm-view-export-note" title="Enregistrer comme note d'étude">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              <span>Créer une note</span>
            </button>
          </div>
        </div>

        ${translationBannerHtml}

        <div class="comm-view-reading-body">
          ${formattedHtml}
        </div>
      </div>
    `;

    // Écouteurs pour la bascule de traduction
    const toggleBtn = this.articleContent.querySelector('#btn-comm-view-toggle-orig');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.showTranslatedVersion[itemId] = !isShowingTranslated;
        if (typeof CommentaryViewer !== 'undefined') {
          CommentaryViewer.showTranslatedVersion[itemId] = this.showTranslatedVersion[itemId];
        }
        this.selectCommentary(index);
      });
    }

    // Écouteur pour le lancement de la traduction
    const translateBtn = this.articleContent.querySelector('#btn-comm-view-translate-btn');
    if (translateBtn) {
      translateBtn.addEventListener('click', () => {
        this.translateActiveCommentary();
      });
    }

    // Écouteur pour la copie
    const copyBtn = this.articleContent.querySelector('#btn-comm-view-copy-article');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const fullCitation = `[Commentaire de ${authorName} - ${this.currentBookFrench} ${this.currentChapter}:${this.currentVerse}]\n\n${displayedText}`;
        navigator.clipboard.writeText(fullCitation).then(() => {
          App.showToast('Commentaire copié dans le presse-papier !');
        }).catch(err => {
          console.error('Erreur copie:', err);
          App.showToast('Impossible de copier le texte');
        });
      });
    }

    // Écouteur pour exporter vers les notes
    const noteBtn = this.articleContent.querySelector('#btn-comm-view-export-note');
    if (noteBtn) {
      noteBtn.addEventListener('click', () => {
        this.exportToNotes(authorName, displayedText);
      });
    }
  },

  /* ======================================================= */
  /* GESTION COMPLÈTE DE LA SYNTHÈSE IA SUR LA PAGE DÉDIÉE   */
  /* ======================================================= */

  async openAISynthesis() {
    this.isSynthMode = true;

    // Masquer l'article individuel, afficher le panneau synthèse pleine page
    this.articleContainer?.classList.add('hidden');
    this.synthPanel?.classList.remove('hidden');
    this.btnSynthHeader?.classList.add('active');

    // Mettre à jour l'état actif des pilules
    if (this.authorsTabsContainer) {
      this.authorsTabsContainer.querySelectorAll('.comm-author-pill').forEach(pill => {
        pill.classList.toggle('active', pill.classList.contains('comm-synth-pill'));
      });
    }

    // Récupérer le réglage du plafond max depuis la config
    try {
      const cfg = await API.getSettings();
      if (cfg && cfg.synthesis_max_verses) {
        this.synthMaxVersesLimit = parseInt(cfg.synthesis_max_verses, 10) || 5;
      }
    } catch (e) {}

    if (this.synthCeilingLimitNum) {
      this.synthCeilingLimitNum.textContent = this.synthMaxVersesLimit;
    }

    this.synthVerseStart = this.currentVerse;
    this.synthVerseEnd = this.currentVerse;

    if (this.synthStartInput) this.synthStartInput.value = this.synthVerseStart;
    if (this.synthEndInput) this.synthEndInput.value = this.synthVerseEnd;

    this.updateSynthRangeDisplay();

    // Si nous n'avons pas encore de résultat pour ce passage exact, afficher la configuration
    if (!this.latestSynthesisMarkdown) {
      this.showSynthConfigMode();
    }
  },

  closeAISynthesis() {
    this.isSynthMode = false;
    this.synthPanel?.classList.add('hidden');
    this.btnSynthHeader?.classList.remove('active');
    this.selectCommentary(this.activeIndex);
  },

  handleSynthRangeChange() {
    if (!this.synthStartInput || !this.synthEndInput) return;

    let vStart = parseInt(this.synthStartInput.value, 10) || 1;
    let vEnd = parseInt(this.synthEndInput.value, 10) || vStart;

    if (vStart < 1) vStart = 1;
    if (vEnd < 1) vEnd = 1;

    let vMin = Math.min(vStart, vEnd);
    let vMax = Math.max(vStart, vEnd);

    const span = (vMax - vMin + 1);

    if (span > this.synthMaxVersesLimit) {
      vMax = vMin + this.synthMaxVersesLimit - 1;
      this.synthEndInput.value = vMax;
      this.synthCeilingWarning?.classList.remove('hidden');
    } else {
      this.synthCeilingWarning?.classList.add('hidden');
    }

    this.synthVerseStart = vMin;
    this.synthVerseEnd = vMax;
    this.updateSynthRangeDisplay();
  },

  updateSynthRangeDisplay() {
    const span = (this.synthVerseEnd - this.synthVerseStart + 1);
    const refStr = span === 1
      ? `${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}`
      : `${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}-${this.synthVerseEnd}`;

    if (this.synthRangeBook) this.synthRangeBook.textContent = `${this.currentBookFrench} ${this.currentChapter}:`;
    if (this.synthPassageBadge) this.synthPassageBadge.textContent = refStr;
    if (this.synthRangeInfo) this.synthRangeInfo.textContent = span === 1 ? '1 verset' : `${span} versets (max: ${this.synthMaxVersesLimit})`;

    if (this.synthSourcesHint) {
      const commsCount = (this.currentComments && this.currentComments.length) || 'Plusieurs';
      this.synthSourcesHint.textContent = `~${commsCount} sources indexées pour ce passage`;
    }
  },

  showSynthConfigMode() {
    this.synthRangeControls?.classList.remove('hidden');
    this.synthQuickOptions?.classList.remove('hidden');
    this.btnLaunchSynth?.classList.remove('hidden');
    this.synthLoadingBox?.classList.add('hidden');
    this.synthResultContainer?.classList.add('hidden');
    if (this.lblEditSynthRange) this.lblEditSynthRange.textContent = 'Plage';
  },

  toggleSynthRangeEdit() {
    const isShowingResult = !this.synthResultContainer?.classList.contains('hidden');
    const isRangeVisible = !this.synthRangeControls?.classList.contains('hidden');

    if (isRangeVisible && isShowingResult) {
      // Masquer la plage, afficher seulement le résultat
      this.synthRangeControls?.classList.add('hidden');
      this.synthQuickOptions?.classList.add('hidden');
      this.btnLaunchSynth?.classList.add('hidden');
      if (this.lblEditSynthRange) this.lblEditSynthRange.textContent = 'Plage';
    } else {
      // Afficher les contrôles de plage pour ajuster et relancer
      this.synthRangeControls?.classList.remove('hidden');
      this.synthQuickOptions?.classList.remove('hidden');
      this.btnLaunchSynth?.classList.remove('hidden');
      if (this.lblEditSynthRange) this.lblEditSynthRange.textContent = 'Résultat';
    }
  },

  async launchAISynthesis() {
    if (!this.btnLaunchSynth) return;

    this.btnLaunchSynth.disabled = true;
    this.synthLoadingBox?.classList.remove('hidden');
    this.synthResultContainer?.classList.add('hidden');

    if (this.synthStepStatus) {
      this.synthStepStatus.textContent = 'Extraction de tous les commentaires bibliques...';
    }

    const t1 = setTimeout(() => {
      if (this.synthStepStatus) this.synthStepStatus.textContent = 'Formatage des sources et analyse théologique...';
    }, 900);

    const t2 = setTimeout(() => {
      if (this.synthStepStatus) this.synthStepStatus.textContent = 'Génération de la synthèse comparative par IA...';
    }, 2400);

    try {
      const res = await API.synthesizeCommentaries(
        this.currentBook,
        this.currentChapter,
        this.synthVerseStart,
        this.synthVerseEnd
      );

      clearTimeout(t1);
      clearTimeout(t2);

      if (res && res.success) {
        this.latestSynthesisMarkdown = res.synthesis || '';
        this.renderSynthesisResult(res);
      } else {
        App.showError('Erreur Synthèse IA', res?.error || 'Impossible de générer la synthèse.');
      }
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      App.showError('Erreur Réseau IA', err?.message || String(err));
    } finally {
      this.btnLaunchSynth.disabled = false;
      this.synthLoadingBox?.classList.add('hidden');
    }
  },

  renderSynthesisResult(data) {
    if (this.synthModelTag) this.synthModelTag.textContent = data.model_used || 'Gemini 3.7 Flash';
    if (this.synthSourcesTag) this.synthSourcesTag.textContent = `${data.sources_count || (this.currentComments?.length || 0)} sources`;

    if (this.synthMarkdownContent) {
      this.synthMarkdownContent.innerHTML = this.formatSynthesisMarkdown(data.synthesis || '');
    }

    // Masquer les champs de saisie pour n'afficher que la synthèse en grand format
    this.synthRangeControls?.classList.add('hidden');
    this.synthQuickOptions?.classList.add('hidden');
    this.btnLaunchSynth?.classList.add('hidden');
    this.synthResultContainer?.classList.remove('hidden');
    if (this.lblEditSynthRange) this.lblEditSynthRange.textContent = 'Plage';
  },

  formatSynthesisMarkdown(text) {
    if (!text) return '<p class="empty-hint">Aucun contenu généré.</p>';

    const svgIcon = `<svg class="synth-cite-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path></svg>`;

    let processed = text;

    // Remplacer les balises explicites {sources: A, B}
    processed = processed.replace(/\{sources:\s*([^\}]+)\}/gi, (match, raw) => {
      const sources = raw.split(',').map(s => s.trim().replace(/[\[\]]/g, '')).filter(Boolean);
      return ` <span class="synth-cite-pill" style="display:inline-flex; align-items:center; gap:3px; background:rgba(2, 132, 199, 0.12); color:var(--accent-blue); padding:1px 6px; border-radius:10px; font-size:10.5px; font-weight:700;">${svgIcon}<span>${sources.length} sources</span></span>`;
    });

    // Supprimer les crochets autour des auteurs
    processed = processed.replace(/\*{0,2}\[([a-zA-Z0-9\.\'\s\(\)\-éèêëàâäôöûüçÉÈÊËÀÂÄÔÖÛÜÇ]+)\]\*{0,2}/g, '**$1**');

    let html = processed
      .replace(/^### (.*$)/gim, '<h3 class="comm-body-h3" style="color:var(--accent-blue); margin: 20px 0 8px 0; font-size: 16px;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="comm-body-h2" style="color:var(--accent-blue); margin: 24px 0 12px 0; font-size: 18px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="comm-body-h1" style="color:var(--accent-blue); margin: 28px 0 14px 0; font-size: 22px;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^> (.*$)/gim, '<blockquote class="comm-body-quote" style="border-left: 3px solid var(--accent-blue); background: var(--bg-subtle); padding: 10px 16px; margin: 14px 0; border-radius: 0 6px 6px 0; font-style: italic; color: var(--text-secondary);">$1</blockquote>')
      .replace(/^[\*\-] (.*$)/gim, '<li class="comm-body-li" style="margin-left: 24px; margin-bottom: 6px;">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="comm-body-li" style="margin-left: 24px; margin-bottom: 6px;">$1</li>')
      .replace(/\n\n/g, '<br><br>');

    return `<div class="rendered-synth" style="font-family: var(--font-bible, serif); font-size: var(--bible-font-size-base, 17px); line-height: 1.8;">${html}</div>`;
  },

  copySynthesis() {
    const span = (this.synthVerseEnd - this.synthVerseStart + 1);
    const refStr = span === 1
      ? `${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}`
      : `${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}-${this.synthVerseEnd}`;

    const textToCopy = `[Synthèse Exégétique IA - ${refStr}]\n\n${this.latestSynthesisMarkdown}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      App.showToast('Synthèse copiée dans le presse-papier !');
    }).catch(err => {
      console.error('Erreur copie:', err);
      App.showToast('Impossible de copier la synthèse');
    });
  },

  exportSynthesisToNote() {
    const span = (this.synthVerseEnd - this.synthVerseStart + 1);
    const refStr = span === 1
      ? `${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}`
      : `${this.currentBookFrench} ${this.currentChapter}:${this.synthVerseStart}-${this.synthVerseEnd}`;

    const noteTitle = `Synthèse Exégétique — ${refStr}`;
    const noteContent = `## Synthèse Comparative des Commentaires sur ${refStr}\n\n> « ${(this.verseBannerText?.textContent || '').replace(/[«»]/g, '').trim()} » (${refStr})\n\n${this.latestSynthesisMarkdown}\n`;

    App.switchView('notes');
    if (typeof NotesView !== 'undefined') {
      NotesView.createNewNote(refStr, noteTitle);
      if (NotesView.contentInput) {
        NotesView.contentInput.innerText = noteContent;
      }
      if (NotesView.currentNote) {
        NotesView.currentNote.content = noteContent;
      }
      App.showToast(`Synthèse enregistrée dans vos notes pour ${refStr} !`);
    }
  },

  async translateActiveCommentary() {
    const comm = this.currentComments[this.activeIndex];
    if (!comm || !comm.text) return;

    const authorName = comm.author || comm.source || 'Commentaire';
    const itemId = `${comm.source || authorName}_${this.currentBook}_${this.currentChapter}_${comm.verse_start || this.currentVerse}`;
    const btn = this.articleContent.querySelector('#btn-comm-view-translate-btn');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span><span>Traduction en cours...</span>';
    }

    try {
      const res = await API.translateText(comm.text, 'commentary', itemId);
      if (res && res.success && res.translated_text) {
        this.translationCache[itemId] = res.translated_text;
        this.showTranslatedVersion[itemId] = true;
        
        if (typeof CommentaryViewer !== 'undefined') {
          CommentaryViewer.translationCache[itemId] = res.translated_text;
          CommentaryViewer.showTranslatedVersion[itemId] = true;
        }

        this.selectCommentary(this.activeIndex);
        App.showToast('Article traduit en français avec succès !');
      } else {
        App.showError('Erreur de Traduction', res?.error || 'Impossible de traduire l\'article.');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span>Réessayer</span>';
        }
      }
    } catch (e) {
      App.showError('Erreur de Traduction', String(e));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg><span>Réessayer</span>';
      }
    }
  },

  exportToNotes(authorName, text) {
    const refStr = `${this.currentBookFrench} ${this.currentChapter}:${this.currentVerse}`;
    const noteTitle = `Étude ${refStr} - ${authorName}`;
    const noteContent = `## Commentaire de ${authorName} sur ${refStr}\n\n> « ${(this.verseBannerText?.textContent || '').replace(/[«»]/g, '').trim()} » (${refStr})\n\n### Exposition Exégétique :\n\n${text}\n`;

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

  openInBibleReader() {
    App.switchView('bible');
    if (typeof BibleReader !== 'undefined') {
      BibleReader.navigateTo(this.currentBook, this.currentChapter, this.currentVerse);
    }
  },

  renderEmptyState() {
    if (this.articleContent) {
      this.articleContent.innerHTML = `
        <div class="comm-view-empty-state">
          <div class="comm-empty-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div class="comm-empty-title">Aucun commentaire direct trouvé pour ce verset</div>
          <p class="comm-empty-desc">Utilisez les flèches ◀ ▶ ou le champ de recherche pour explorer d'autres passages bibliques.</p>
        </div>
      `;
    }
  },

  formatCommentaryContent(text) {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gim, '<h3 class="comm-body-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="comm-body-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="comm-body-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\> (.*$)/gim, '<blockquote class="comm-body-quote">$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li class="comm-body-li">$1</li>')
      .replace(/\n\n/g, '<br><br>');
  },

  isForeignText(text) {
    if (!text) return false;
    const clean = text.toLowerCase();
    const englishIndicators = [
      ' the ', ' and ', ' that ', ' with ', ' from ', ' which ', ' this ', ' have ', ' from ',
      'unto', 'wherefore', 'saith', 'thy', 'thou', 'thee', 'hath', 'chapter', 'verse', 'lord'
    ];
    let count = 0;
    for (const ind of englishIndicators) {
      if (clean.includes(ind)) count++;
    }
    return count >= 2;
  },

  getSourceMeta(name) {
    if (typeof CommentaryViewer !== 'undefined' && CommentaryViewer.getSourceInfo) {
      return CommentaryViewer.getSourceInfo(name);
    }
    const initials = name ? name.split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 3).toUpperCase() : 'C';
    return {
      title: `Commentaire de ${name}`,
      author: name,
      period: 'Ouvrage d\'exégèse',
      color: '#1E3A8A',
      initials
    };
  }
};
