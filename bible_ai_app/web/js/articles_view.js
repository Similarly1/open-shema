/**
 * Articles & Blogs View Manager
 * Gère l'affichage, la recherche, le filtrage par source/verset et la lecture enrichie des articles de blogs théologiques.
 */

const ArticlesView = {
  currentSourceFilter: 'ALL',
  currentSearchQuery: '',
  selectedArticleId: null,
  articles: [],
  sources: [],
  isSyncing: false,

  // Préférences de lecture harmonisées avec Open Shema
  readingOpts: {
    bg: 'auto',
    fontFamily: 'EB Garamond',
    zoom: 100, // Pourcentage de zoom (style - 100% +)
    isFullWidth: false,
    isJustified: false
  },

  // Table des abréviations bibliques françaises standards (ex: Rm 4.2, Jn 3.16, Gn 1, Ex 19)
  BOOK_ABBREVIATIONS: {
    'Gen': 'Gn', 'Exo': 'Ex', 'Lev': 'Lv', 'Num': 'Nb', 'Deu': 'Dt',
    'Jos': 'Jos', 'Jdg': 'Jg', 'Rut': 'Rt', '1Sa': '1S', '2Sa': '2S',
    '1Ki': '1R', '2Ki': '2R', '1Ch': '1Ch', '2Ch': '2Ch', 'Ezr': 'Esd',
    'Neh': 'Ne', 'Est': 'Est', 'Job': 'Jb', 'Psa': 'Ps', 'Pro': 'Pr',
    'Ecc': 'Ec', 'Sng': 'Ct', 'Isa': 'És', 'Jer': 'Jr', 'Lam': 'Lm',
    'Ezk': 'Ez', 'Dan': 'Dn', 'Hos': 'Os', 'Jol': 'Jl', 'Amo': 'Am',
    'Oba': 'Ab', 'Jon': 'Jon', 'Mic': 'Mi', 'Nah': 'Na', 'Hab': 'Ha',
    'Zep': 'So', 'Hag': 'Ag', 'Zec': 'Za', 'Mal': 'Ml', 'Mat': 'Mt',
    'Mrk': 'Mc', 'Luk': 'Lc', 'Jhn': 'Jn', 'Act': 'Ac', 'Rom': 'Rm',
    '1Co': '1Co', '2Co': '2Co', 'Gal': 'Ga', 'Eph': 'Ép', 'Php': 'Ph',
    'Col': 'Col', '1Th': '1Th', '2Th': '2Th', '1Ti': '1Tm', '2Ti': '2Tm',
    'Tit': 'Tt', 'Phm': 'Phm', 'Heb': 'He', 'Jas': 'Jc', '1Pe': '1P',
    '2Pe': '2P', '1Jn': '1Jn', '2Jn': '2Jn', '3Jn': '3Jn', 'Jud': 'Jde',
    'Rev': 'Ap'
  },

  formatShortScriptureRef(r) {
    if (!r) return '';
    const bookCode = r.book_code || '';
    const abbr = this.BOOK_ABBREVIATIONS[bookCode] || bookCode;
    const ch = r.chapter;
    const v = r.verse;

    if (ch && v) {
      const cleanV = String(v).replace(':', '.');
      return `${abbr} ${ch}.${cleanV}`;
    } else if (ch) {
      return `${abbr} ${ch}`;
    }
    
    if (r.raw_ref) {
      let raw = r.raw_ref.trim();
      for (const [code, short] of Object.entries(this.BOOK_ABBREVIATIONS)) {
        if (code.toLowerCase() === bookCode.toLowerCase()) {
          raw = raw.replace(new RegExp(`^(?:${code}|[a-zà-ÿ]+)`, 'i'), short);
          break;
        }
      }
      return raw.replace(':', '.');
    }
    return abbr;
  },

  getEditorialBadgeLabel(text) {
    if (!text) return 'CONTEXTE & PROVENANCE';
    const lower = text.toLowerCase();
    if (/traduction|traduit\s+de|article\s+original|source\s+originale|the\s+gospel\s+coalition|desiring\s+god|9marks|crossway/i.test(lower)) {
      return 'SOURCE ORIGINALE & TRADUCTION';
    }
    if (/extrait\s+du\s+livre|tiré\s+du\s+livre|chapitre\s+\d+|éditions|editions|éditeur|editeur|ouvrage|pp\.\s*\d+|méditation\s+\d+/i.test(lower)) {
      return 'EXTRAIT D’OUVRAGE';
    }
    if (/série\s+de|série\s+sur|épisode\s+\d+|partie\s+\d+|série\s+d’articles|série\s+d'articles/i.test(lower)) {
      return 'SÉRIE THÉMATIQUE';
    }
    if (/travail\s+de\s+recherche|thèse|mémoire|séminaire|seminary|académique|theological\s+seminary/i.test(lower)) {
      return 'RECHERCHE & SÉMINAIRE';
    }
    if (/autoris|droits\s+réservés|reproduit\s+avec/i.test(lower)) {
      return 'NOTE ÉDITORIALE';
    }
    return 'CONTEXTE & PROVENANCE';
  },

  getSourceLogo(sourceId) {
    if (!sourceId) return null;
    const s = sourceId.toLowerCase();
    if (s.includes('tpsg') || s.includes('toutpoursagloire')) {
      return 'img/sources/tpsg.svg';
    }
    if (s.includes('e21') || s.includes('evangile21') || s.includes('gospelcoalition')) {
      return 'img/sources/e21.svg';
    }
    return null;
  },

  // Préférences de synchronisation des flux RSS
  syncOpts: {
    frequency: 'startup', // 'manual' | 'startup' | 'interval'
    intervalDays: 3,
    lastSyncTimestamp: null
  },

  init() {
    this.loadReadingPreferences();
    this.loadSyncPreferences();
    this.bindEvents();
    this.checkAutoSync();
  },

  loadReadingPreferences() {
    try {
      const saved = localStorage.getItem('open_shema_article_reading_opts');
      if (saved) {
        this.readingOpts = { ...this.readingOpts, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[ArticlesView] Erreur lecture préférences lecture:', e);
    }
  },

  saveReadingPreferences() {
    try {
      localStorage.setItem('open_shema_article_reading_opts', JSON.stringify(this.readingOpts));
    } catch (e) {}
  },

  loadSyncPreferences() {
    try {
      const saved = localStorage.getItem('open_shema_articles_sync_opts');
      if (saved) {
        this.syncOpts = { ...this.syncOpts, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[ArticlesView] Erreur lecture préférences synchronisation:', e);
    }
  },

  saveSyncPreferences(partialOpts = null) {
    try {
      if (partialOpts) {
        this.syncOpts = { ...this.syncOpts, ...partialOpts };
      }
      localStorage.setItem('open_shema_articles_sync_opts', JSON.stringify(this.syncOpts));
      
      // Synchroniser le sélecteur dans la page de paramètres généraux si présent
      const generalSelect = document.getElementById('cfg-articles-sync-freq-select');
      if (generalSelect) {
        generalSelect.value = this.syncOpts.frequency === 'interval' 
          ? String(this.syncOpts.intervalDays || 3) 
          : this.syncOpts.frequency;
      }
    } catch (e) {}
  },

  checkAutoSync() {
    const opts = this.syncOpts;
    if (!opts || opts.frequency === 'manual') return;

    if (opts.frequency === 'startup') {
      // Déclenchement discret en arrière-plan 2.5 secondes après le démarrage
      setTimeout(() => {
        this.syncArticles(true);
      }, 2500);
      return;
    }

    if (opts.frequency === 'interval') {
      const intervalDays = parseInt(opts.intervalDays, 10) || 3;
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
      const lastSync = opts.lastSyncTimestamp ? parseInt(opts.lastSyncTimestamp, 10) : 0;
      const elapsed = Date.now() - lastSync;

      if (elapsed >= intervalMs) {
        setTimeout(() => {
          this.syncArticles(true);
        }, 3000);
      }
    }
  },

  bindEvents() {
    // 1. Recherche plein texte
    const searchInput = document.getElementById('articles-search-input');
    let debounceTimer = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.currentSearchQuery = e.target.value.trim();
        this.loadArticles();
      }, 300);
    });

    // 2. Bouton Synchroniser manuel
    document.getElementById('btn-sync-articles')?.addEventListener('click', () => {
      this.syncArticles(false);
    });

    // 2b. Bouton Réglages des articles (Ouvre la modale de réglages et de synchronisation)
    document.getElementById('btn-articles-settings')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    // 2c. Contrôles de la modale de réglages
    document.getElementById('btn-close-articles-settings')?.addEventListener('click', () => {
      this.closeSettingsModal();
    });
    document.getElementById('btn-cancel-articles-settings')?.addEventListener('click', () => {
      this.closeSettingsModal();
    });
    document.getElementById('btn-save-articles-settings')?.addEventListener('click', () => {
      this.saveSettingsModal();
    });
    document.getElementById('btn-modal-trigger-sync')?.addEventListener('click', () => {
      this.syncArticles(false);
    });

    // Écoute des changements de radio de fréquence pour afficher/masquer le sélecteur d'intervalle
    document.querySelectorAll('input[name="articles-sync-freq"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const intervalWrap = document.getElementById('articles-interval-wrap');
        if (intervalWrap) {
          intervalWrap.style.opacity = e.target.value === 'interval' ? '1' : '0.5';
          intervalWrap.style.pointerEvents = e.target.value === 'interval' ? 'auto' : 'none';
        }
      });
    });

    // 3. Bouton Suggérer un blog (ouvre la modale)
    document.getElementById('btn-suggest-blog')?.addEventListener('click', () => {
      this.openSuggestModal();
    });

    // 3b. Contrôles de la modale de suggestion
    document.getElementById('btn-close-suggest-modal')?.addEventListener('click', () => {
      this.closeSuggestModal();
    });
    document.getElementById('btn-cancel-suggest')?.addEventListener('click', () => {
      this.closeSuggestModal();
    });
    document.getElementById('btn-submit-suggest')?.addEventListener('click', () => {
      this.submitSuggestion();
    });

    // 4. Bouton Retour dans la vue lecture
    document.getElementById('btn-articles-back-to-list')?.addEventListener('click', () => {
      this.closeArticleReader();
    });

    // 5. Options d'Affichage & Lecture (Popover standard Open Shema)
    const btnReadingOpts = document.getElementById('btn-article-reading-options');
    const popoverOpts = document.getElementById('article-reading-options-popover');
    
    btnReadingOpts?.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverOpts?.classList.toggle('hidden');
    });

    // Fermer le popover au clic en dehors
    document.addEventListener('click', (e) => {
      if (popoverOpts && !popoverOpts.classList.contains('hidden') && !popoverOpts.contains(e.target) && !btnReadingOpts?.contains(e.target)) {
        popoverOpts.classList.add('hidden');
      }
    });

    // 5b. Bouton Charger plus d'articles précédents
    document.getElementById('btn-load-more-articles')?.addEventListener('click', () => {
      this.loadMoreArticles();
    });

    // 5c. Bouton Toggle Sommaire Interactif (TOC)
    document.getElementById('btn-article-toggle-toc')?.addEventListener('click', () => {
      const sidebar = document.getElementById('article-toc-sidebar');
      const btn = document.getElementById('btn-article-toggle-toc');
      if (sidebar) {
        const isHidden = sidebar.classList.toggle('hidden');
        this.tocHiddenByUser = isHidden;
        if (btn) btn.classList.toggle('active', !isHidden);
      }
    });

    // Événements dans le popover d'options
    this.bindReadingOptionsControls();
  },

  bindReadingOptionsControls() {
    const popover = document.getElementById('article-reading-options-popover');
    if (!popover) return;

    // 1. Choix de Police (Boutons style Open Shema)
    popover.querySelectorAll('.article-font-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        popover.querySelectorAll('.article-font-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.readingOpts.fontFamily = btn.dataset.font || 'EB Garamond';
        this.saveReadingPreferences();
        this.applyReadingOptions();
      });
    });

    // 2. Zoom de texte (Contrôles style - 100% +)
    document.getElementById('btn-article-zoom-out')?.addEventListener('click', () => {
      const cur = this.readingOpts.zoom || 100;
      if (cur > 70) {
        this.readingOpts.zoom = cur - 10;
        this.saveReadingPreferences();
        this.applyReadingOptions();
      }
    });

    document.getElementById('btn-article-zoom-in')?.addEventListener('click', () => {
      const cur = this.readingOpts.zoom || 100;
      if (cur < 180) {
        this.readingOpts.zoom = cur + 10;
        this.saveReadingPreferences();
        this.applyReadingOptions();
      }
    });

    document.getElementById('btn-article-zoom-reset')?.addEventListener('click', () => {
      this.readingOpts.zoom = 100;
      this.saveReadingPreferences();
      this.applyReadingOptions();
    });

    // 3. Fond de lecture (Swatches style Open Shema)
    popover.querySelectorAll('.article-bg-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        popover.querySelectorAll('.article-bg-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        this.readingOpts.bg = sw.dataset.bg || 'auto';
        this.saveReadingPreferences();
        this.applyReadingOptions();
      });
    });

    // 4. Pleine largeur & Justifié
    const chkFullWidth = document.getElementById('article-opt-full-width');
    chkFullWidth?.addEventListener('change', (e) => {
      this.readingOpts.isFullWidth = e.target.checked;
      this.saveReadingPreferences();
      this.applyReadingOptions();
    });

    const chkJustify = document.getElementById('article-opt-justify');
    chkJustify?.addEventListener('change', (e) => {
      this.readingOpts.isJustified = e.target.checked;
      this.saveReadingPreferences();
      this.applyReadingOptions();
    });
  },

  applyReadingOptions() {
    const container = document.getElementById('article-reader-container');
    const popover = document.getElementById('article-reading-options-popover');
    if (!container) return;

    const zoom = this.readingOpts.zoom || 100;

    // 1. Fond de lecture
    container.classList.remove('reading-bg-white', 'reading-bg-sepia', 'reading-bg-dark');
    if (this.readingOpts.bg !== 'auto') {
      container.classList.add(`reading-bg-${this.readingOpts.bg}`);
    }

    // 2. Police
    let fontStack = `'EB Garamond', 'Lora', Georgia, serif`;
    const selectedFont = this.readingOpts.fontFamily || 'EB Garamond';
    
    if (selectedFont === 'Georgia') {
      fontStack = `Georgia, 'Times New Roman', Times, serif`;
    } else if (selectedFont === 'Inter' || selectedFont === 'system' || selectedFont === 'sans') {
      fontStack = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
    } else if (selectedFont === 'EB Garamond') {
      fontStack = `'EB Garamond', 'Lora', Georgia, serif`;
    } else {
      fontStack = `'${selectedFont}', Georgia, serif`;
    }

    container.style.setProperty('--article-font-family', fontStack);
    container.style.fontFamily = fontStack;

    // Forcer l'application sur le texte markdown, chapô et titre
    const contentEl = document.getElementById('article-reader-content');
    if (contentEl) contentEl.style.fontFamily = fontStack;
    const leadEl = document.getElementById('article-reader-lead');
    if (leadEl) leadEl.style.fontFamily = fontStack;
    const titleEl = document.getElementById('article-reader-title');
    if (titleEl) titleEl.style.fontFamily = fontStack;

    // 3. Facteur de Zoom CSS appliqué sur le container
    container.style.setProperty('--article-zoom-factor', (zoom / 100).toString());

    const lblZoom = document.getElementById('lbl-article-zoom-val');
    if (lblZoom) {
      lblZoom.textContent = `${zoom}%`;
    }

    // 4. Largeur
    container.classList.toggle('is-full-width', !!this.readingOpts.isFullWidth);

    // 5. Justifié
    container.classList.toggle('is-justified', !!this.readingOpts.isJustified);

    // Synchroniser l'état visuel du popover
    if (popover) {
      popover.querySelectorAll('.article-font-btn').forEach(btn => {
        const btnFont = btn.dataset.font;
        const curFont = this.readingOpts.fontFamily;
        const isActive = (btnFont === curFont) ||
          ((btnFont === 'Inter' || btnFont === 'system') && (curFont === 'Inter' || curFont === 'system'));
        btn.classList.toggle('active', isActive);
      });
      popover.querySelectorAll('.article-bg-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.bg === this.readingOpts.bg);
      });
      const chkFull = document.getElementById('article-opt-full-width');
      if (chkFull) chkFull.checked = !!this.readingOpts.isFullWidth;

      const chkJust = document.getElementById('article-opt-justify');
      if (chkJust) chkJust.checked = !!this.readingOpts.isJustified;
    }
  },

  async onViewActivated() {
    await this.loadSources();
    await this.loadArticles();
  },

  async loadSources() {
    try {
      this.sources = await API.call('get_article_sources') || [];
      this.renderSourceFilters();
    } catch (e) {
      console.error('[ArticlesView] Erreur chargement sources:', e);
    }
  },

  renderSourceFilters() {
    const container = document.getElementById('articles-sources-filters');
    if (!container) return;

    // Filtrer les sources valides (activées ou possédant des articles)
    const validSources = (this.sources || []).filter(s => 
      s.is_enabled === 1 || s.is_enabled === true || (s.article_count || 0) > 0
    );

    const totalCount = validSources.reduce((acc, s) => acc + (s.article_count || 0), 0);

    let html = `
      <button class="source-filter-pill ${this.currentSourceFilter === 'ALL' ? 'active' : ''}" data-source-id="ALL">
        <span>Toutes les sources</span>
        <span class="source-count">${totalCount}</span>
      </button>
    `;

    validSources.forEach(src => {
      const isActive = this.currentSourceFilter === src.id;
      const logoUrl = this.getSourceLogo(src.id);
      const iconHtml = logoUrl 
        ? `<img src="${logoUrl}" alt="${this.escapeHtml(src.name)}" class="source-filter-logo-img">`
        : `<span class="source-bullet" style="background-color: ${this.getSourceColor(src.id)};"></span>`;
      html += `
        <button class="source-filter-pill ${isActive ? 'active' : ''}" data-source-id="${src.id}">
          ${iconHtml}
          <span>${this.escapeHtml(src.name)}</span>
          <span class="source-count">${src.article_count || 0}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    // Attacher événements de clic sur les filtres
    container.querySelectorAll('.source-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.source-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentSourceFilter = btn.dataset.sourceId;
        this.loadArticles();
      });
    });
  },

  getSourceColor(sourceId) {
    const colors = {
      'tpsg': '#3B82F6',        // Bleu
      'evangile21': '#10B981',   // Émeraude
      'leboncombat': '#F59E0B'   // Ambre
    };
    return colors[sourceId] || '#8B5CF6';
  },

  formatAuthor(rawAuthor) {
    if (!rawAuthor) return 'Auteur inconnu';
    let author = this.fixMojibake(rawAuthor);
    if (author.includes('@')) {
      const user = author.split('@')[0].replace('.', ' ');
      return user.charAt(0).toUpperCase() + user.slice(1);
    }
    return author;
  },

  fixMojibake(str) {
    if (!str) return '';
    if (/Ã©|Ã |Ã¨|Ãª|Ã®|Ã¯|Ã´|Ã¹|Ã»|Ã§|Â«|Â»|â€™|â€|Ã‰|Ã€|â€¯|Ã¢|Ã´|Ã®|Ã»/.test(str)) {
      try {
        return decodeURIComponent(escape(str));
      } catch (e) {
        return str;
      }
    }
    return str;
  },

  filterMainCategories(tagsList) {
    if (!tagsList || tagsList.length === 0) return [];
    // Prioriser les catégories majeures (débutant par une majuscule) et limiter à 4 max
    const uppercaseTags = tagsList.filter(t => t && t[0] === t[0].toUpperCase());
    const result = uppercaseTags.length > 0 ? uppercaseTags : tagsList;
    return result.slice(0, 4);
  },

  getGridSkeletonHtml(count = 6) {
    return Array.from({ length: count }, () => `
      <div class="article-card article-card-skeleton">
        <div class="skeleton-card-thumb skeleton-shimmer"></div>
        <div class="article-card-content">
          <div class="article-card-header">
            <div class="skeleton-shimmer" style="width: 105px; height: 20px; border-radius: 12px;"></div>
            <div class="skeleton-shimmer" style="width: 75px; height: 13px; border-radius: 4px;"></div>
          </div>
          <div class="skeleton-shimmer" style="width: 90%; height: 20px; border-radius: 4px; margin: 10px 0 6px 0;"></div>
          <div class="skeleton-shimmer" style="width: 65%; height: 20px; border-radius: 4px; margin-bottom: 12px;"></div>
          <div class="article-topics-list" style="margin-bottom: 12px; display: flex; gap: 6px;">
            <div class="skeleton-shimmer" style="width: 110px; height: 18px; border-radius: 10px;"></div>
            <div class="skeleton-shimmer" style="width: 85px; height: 18px; border-radius: 10px;"></div>
          </div>
          <div class="article-card-author-row" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <div class="skeleton-shimmer" style="width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;"></div>
            <div class="skeleton-shimmer" style="width: 110px; height: 13px; border-radius: 4px;"></div>
          </div>
          <div class="skeleton-shimmer" style="width: 100%; height: 13px; border-radius: 4px; margin-bottom: 6px;"></div>
          <div class="skeleton-shimmer" style="width: 94%; height: 13px; border-radius: 4px; margin-bottom: 6px;"></div>
          <div class="skeleton-shimmer" style="width: 55%; height: 13px; border-radius: 4px; margin-bottom: 16px;"></div>
          <div class="article-card-scripture-refs" style="margin-top: auto; display: flex; gap: 6px;">
            <div class="skeleton-shimmer" style="width: 48px; height: 20px; border-radius: 6px;"></div>
            <div class="skeleton-shimmer" style="width: 64px; height: 20px; border-radius: 6px;"></div>
            <div class="skeleton-shimmer" style="width: 42px; height: 20px; border-radius: 6px;"></div>
          </div>
        </div>
      </div>
    `).join('');
  },

  getDrawerSkeletonHtml(count = 3) {
    return Array.from({ length: count }, () => `
      <div class="drawer-article-card-skeleton">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <div class="skeleton-shimmer" style="width: 85px; height: 16px; border-radius: 10px;"></div>
          <div class="skeleton-shimmer" style="width: 55px; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="skeleton-shimmer" style="width: 92%; height: 16px; border-radius: 4px; margin-bottom: 5px;"></div>
        <div class="skeleton-shimmer" style="width: 70%; height: 16px; border-radius: 4px; margin-bottom: 8px;"></div>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <div class="skeleton-shimmer" style="width: 18px; height: 18px; border-radius: 50%;"></div>
          <div class="skeleton-shimmer" style="width: 80px; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="skeleton-shimmer" style="width: 100%; height: 12px; border-radius: 4px; margin-bottom: 4px;"></div>
        <div class="skeleton-shimmer" style="width: 85%; height: 12px; border-radius: 4px;"></div>
      </div>
    `).join('');
  },

  async loadArticles() {
    const listContainer = document.getElementById('articles-grid-container');
    const emptyContainer = document.getElementById('articles-empty-state');
    const paginationFooter = document.getElementById('articles-pagination-footer');
    if (!listContainer) return;

    listContainer.innerHTML = this.getGridSkeletonHtml(6);
    if (paginationFooter) paginationFooter.classList.add('hidden');

    try {
      const sourceParam = this.currentSourceFilter === 'ALL' ? null : this.currentSourceFilter;
      this.articles = await API.call('get_articles', sourceParam, null, null, this.currentSearchQuery, 100, 0) || [];

      if (!this.articles || this.articles.length === 0) {
        listContainer.innerHTML = '';
        emptyContainer?.classList.remove('hidden');
        if (paginationFooter) paginationFooter.classList.add('hidden');
        return;
      }

      emptyContainer?.classList.add('hidden');
      this.renderArticlesGrid(this.articles);
      this.updatePaginationFooter();
    } catch (e) {
      console.error('[ArticlesView] Erreur chargement articles:', e);
      listContainer.innerHTML = `<div class="articles-error-state">Erreur lors de la récupération des articles.</div>`;
    }
  },

  updatePaginationFooter() {
    const footer = document.getElementById('articles-pagination-footer');
    const info = document.getElementById('articles-pagination-info');
    const btn = document.getElementById('btn-load-more-articles');
    if (!footer) return;

    const count = this.articles.length;
    footer.classList.remove('hidden');
    if (info) {
      info.textContent = `${count} article${count > 1 ? 's' : ''} affiché${count > 1 ? 's' : ''}`;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        <span>Charger 10 articles précédents</span>
      `;
    }
  },

  async loadMoreArticles() {
    const btn = document.getElementById('btn-load-more-articles');
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.innerHTML = `
      <div class="spinner-sm" style="width: 14px; height: 14px; border-width: 2px;"></div>
      <span>Récupération des 10 articles suivants...</span>
    `;

    try {
      this.currentArchivePage += 1;
      const res = await API.call('load_more_articles_archive', 'tpsg', this.currentArchivePage);
      
      const sourceParam = this.currentSourceFilter === 'ALL' ? null : this.currentSourceFilter;
      this.articles = await API.call('get_articles', sourceParam, null, null, this.currentSearchQuery, 200, 0) || [];
      
      this.renderArticlesGrid(this.articles);
      this.updatePaginationFooter();

      if (typeof App !== 'undefined' && App.showToast) {
        if (res && res.new_count > 0) {
          App.showToast(`${res.new_count} articles précédents ajoutés !`, 'success');
        } else {
          App.showToast('Articles chargés avec succès.', 'info');
        }
      }
    } catch (e) {
      console.error('[ArticlesView] Erreur chargement archives:', e);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Erreur lors de la récupération des archives.', 'error');
      }
      this.updatePaginationFooter();
    }
  },

  renderArticlesGrid(articles) {
    const container = document.getElementById('articles-grid-container');
    if (!container) return;

    let html = '';
    articles.forEach(art => {
      const color = this.getSourceColor(art.source_id);
      const pubDate = this.formatDate(art.published_at);
      const author = this.formatAuthor(art.author);
      const refs = art.scripture_references || [];
      const mainTags = this.filterMainCategories(art.tags_list || []);
      const imageUrl = art.image_url;
      const avatarUrl = art.author_avatar_url;

      let thumbHtml = '';
      if (imageUrl) {
        thumbHtml = `
          <div class="article-card-thumb-wrap">
            <img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(art.title)}" class="article-card-thumb-img" loading="lazy">
          </div>
        `;
      }

      let tagsHtml = '';
      if (mainTags.length > 0) {
        tagsHtml = `
          <div class="article-card-tags">
            ${mainTags.map(t => `<span class="article-topic-tag" data-tag="${this.escapeHtml(t)}">${this.escapeHtml(t)}</span>`).join('')}
          </div>
        `;
      }

      let authorAvatarHtml = '';
      if (avatarUrl) {
        authorAvatarHtml = `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(author)}" class="article-card-author-avatar">`;
      }

      let refsHtml = '';
      if (refs.length > 0) {
        refsHtml = `
          <div class="article-card-refs">
            ${refs.slice(0, 4).map(r => `
              <span class="scripture-badge" data-book="${r.book_code}" data-ch="${r.chapter}" data-v="${r.verse || ''}">
                ${this.escapeHtml(this.formatShortScriptureRef(r))}
              </span>
            `).join('')}
            ${refs.length > 4 ? `<span class="scripture-badge-more">+${refs.length - 4}</span>` : ''}
          </div>
        `;
      }

      const isPodcast = !!art.audio_url || (art.tags_list || []).some(t => /podcast|prédication|predication|audio/i.test(t));
      const podcastBadgeHtml = isPodcast ? `<span class="article-podcast-badge">🎧 Podcast</span>` : '';

      html += `
        <div class="article-card" data-article-id="${art.id}">
          ${thumbHtml}

          <div class="article-card-content">
            <div class="article-card-header">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="article-source-badge" style="background-color: ${color}18; color: ${color}; border: 1px solid ${color}35;">
                  ${this.getSourceLogo(art.source_id) ? `<img src="${this.getSourceLogo(art.source_id)}" alt="" class="article-source-logo-img">` : ''}<span>${this.escapeHtml(art.source_name || art.source_id)}</span>
                </span>
                ${podcastBadgeHtml}
              </div>
              <span class="article-pub-date">${pubDate}</span>
            </div>

            <h3 class="article-card-title">${this.escapeHtml(this.fixMojibake(art.title))}</h3>
            
            ${tagsHtml}

            <div class="article-card-author-row">
              ${authorAvatarHtml}
              <span class="article-card-author">Par <strong>${this.escapeHtml(author)}</strong></span>
            </div>

            <p class="article-card-summary">${this.escapeHtml(this.fixMojibake(art.summary || 'Cliquez pour lire l\'intégralité de cet article...'))}</p>

            ${refsHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Clic pour ouvrir un article ou filtrer par tag / verset
    container.querySelectorAll('.article-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Clic sur un badge thématique -> filtre par tag
        const tagEl = e.target.closest('.article-topic-tag');
        if (tagEl) {
          e.stopPropagation();
          const tag = tagEl.dataset.tag;
          const searchInput = document.getElementById('articles-search-input');
          if (searchInput) searchInput.value = tag;
          this.currentSearchQuery = tag;
          this.loadArticles();
          return;
        }

        // Clic sur un badge biblique -> ouvrir dans la Bible
        const refBadge = e.target.closest('.scripture-badge');
        if (refBadge) {
          e.stopPropagation();
          const b = refBadge.dataset.book;
          const ch = parseInt(refBadge.dataset.ch, 10) || 1;
          const v = parseInt(refBadge.dataset.v, 10) || 1;
          if (typeof BibleReader !== 'undefined') {
            App.switchView('bible');
            BibleReader.navigateTo(b, ch, v);
          }
          return;
        }

        const artId = card.dataset.articleId;
        this.openArticle(artId);
      });
    });
  },

  async openArticle(articleId) {
    this.selectedArticleId = articleId;
    const viewList = document.getElementById('articles-list-section');
    const viewReader = document.getElementById('articles-reader-section');
    const skeletonEl = document.getElementById('article-reader-skeleton');
    const realContentEl = document.getElementById('article-reader-real-content');
    const contentEl = document.getElementById('article-reader-body');
    const titleEl = document.getElementById('article-reader-title');
    const tagsEl = document.getElementById('article-reader-tags');
    const extLink = document.getElementById('article-reader-external-link');

    const heroBanner = document.getElementById('article-reader-hero-banner');
    const heroImg = document.getElementById('article-reader-hero-img');
    const authorImg = document.getElementById('article-author-avatar-img');
    const authorPlaceholder = document.getElementById('article-author-avatar-placeholder');
    const authorNameEl = document.getElementById('article-author-name');
    const pubDateEl = document.getElementById('article-pub-date');
    const sourceNameEl = document.getElementById('article-source-name');
    const leadEl = document.getElementById('article-reader-lead');

    // 1. Basculer immédiatement sur la vue lecture et afficher le Skeleton
    if (viewList) viewList.classList.add('hidden');
    if (viewReader) viewReader.classList.remove('hidden');

    if (skeletonEl) skeletonEl.classList.remove('hidden');
    if (realContentEl) {
      realContentEl.classList.add('hidden');
      realContentEl.classList.remove('fade-in');
    }

    const container = document.querySelector('.articles-view-container');
    if (container) container.scrollTop = 0;

    try {
      const fetchPromise = API.call('get_article_content', articleId);
      const minDelay = new Promise(resolve => setTimeout(resolve, 420));
      const [res] = await Promise.all([fetchPromise, minDelay]);

      if (!res || !res.success || !res.article) {
        if (skeletonEl) skeletonEl.classList.add('hidden');
        if (realContentEl) realContentEl.classList.remove('hidden');
        if (contentEl) contentEl.innerHTML = `<div class="articles-error-state">Impossible de charger l'article.</div>`;
        return;
      }

      const art = res.article;
      const author = this.formatAuthor(art.author);

      if (titleEl) titleEl.textContent = this.fixMojibake(art.title);

      // 1. Image Héro avec dégradé
      if (art.image_url && heroBanner && heroImg) {
        heroImg.src = art.image_url;
        heroBanner.classList.remove('hidden');
      } else if (heroBanner) {
        heroBanner.classList.add('hidden');
      }

      // 2. Auteur & Avatar
      if (authorNameEl) authorNameEl.textContent = author;
      if (pubDateEl) pubDateEl.textContent = this.formatDate(art.published_at) || '';
      if (sourceNameEl) {
        const logoUrl = this.getSourceLogo(art.source_id);
        const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="" class="author-source-logo">` : '';
        sourceNameEl.innerHTML = `${logoHtml}<span>${this.escapeHtml(art.source_name || art.source_id)}</span>`;
      }

      if (art.author_avatar_url && authorImg) {
        authorImg.src = art.author_avatar_url;
        authorImg.classList.remove('hidden');
        authorPlaceholder?.classList.add('hidden');
      } else {
        authorImg?.classList.add('hidden');
        if (authorPlaceholder) {
          authorPlaceholder.textContent = (author.charAt(0) || 'A').toUpperCase();
          authorPlaceholder.classList.remove('hidden');
        }
      }

      // 3. Chapô / Introduction
      let leadText = this.fixMojibake(art.lead_summary || art.summary || '');
      leadText = leadText
        .replace(/^(?:(?:\*\*)?\s*(?:Editors[’']\s*note|Note\s+de\s+l[’']éditeur|Editor[’']s\s+note|Note\s+de\s+la\s+rédaction|NDLR)\s*(?:\*\*)?\s*:?\s*\n*)+(?:Initialement\s+publié[^\n.]+[\.\s]*)?/gi, '')
        .trim();
      if (leadText && leadEl) {
        let formattedLead = this.escapeHtml(leadText);
        if (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences) {
          formattedLead = TheologyView.highlightScriptureReferences(formattedLead);
        }
        leadEl.innerHTML = formattedLead;
        leadEl.classList.remove('hidden');

        // Lier les infobulles et clics vers la Bible dans le chapô
        if (typeof ScriptureTooltip !== 'undefined' && ScriptureTooltip.bindToElements) {
          ScriptureTooltip.bindToElements(leadEl.querySelectorAll('.theol-inline-scripture-ref'));
        }
        leadEl.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
          span.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ref = span.dataset.ref || span.textContent.trim();
            if (typeof BibleReader !== 'undefined') {
              try {
                const parsed = await API.parseReference(ref);
                if (parsed && parsed.book) {
                  await BibleReader.navigateTo(parsed.book, parsed.chapter || 1, parsed.verse || null);
                }
              } catch (err) {
                BibleReader.navigateTo(ref);
              }
            }
          });
        });
      } else if (leadEl) {
        leadEl.classList.add('hidden');
      }

      // 3b. Lecteur Audio / Podcast
      const audioWrap = document.getElementById('article-reader-audio-wrap');
      const audioCard = document.getElementById('article-audio-player-card');
      if (art.audio_url && audioWrap && audioCard) {
        audioWrap.classList.remove('hidden');
        if (art.audio_url.includes('open.spotify.com') || art.audio_url.includes('ausha') || art.audio_url.includes('soundcloud') || art.audio_url.includes('podbean')) {
          let embedUrl = art.audio_url;
          if (embedUrl.includes('open.spotify.com') && !embedUrl.includes('utm_source')) {
            embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'utm_source=generator&theme=0';
          }
          audioCard.innerHTML = `
            <div class="article-audio-iframe-wrap">
              <iframe src="${this.escapeHtml(embedUrl)}" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
            </div>
          `;
        } else {
          audioCard.innerHTML = `
            <div class="article-audio-native-player">
              <audio controls preload="none" src="${this.escapeHtml(art.audio_url)}" style="width: 100%;">
                Votre navigateur ne supporte pas l'élément audio.
              </audio>
            </div>
          `;
        }
      } else if (audioWrap) {
        audioWrap.classList.add('hidden');
        if (audioCard) audioCard.innerHTML = '';
      }

      // 4. Badges thématiques & Badge de Série Podcast (Option A)
      const mainTags = this.filterMainCategories(art.tags_list || []);
      let podcastSeriesName = '';
      const mdRaw = res.content_markdown || art.summary || '';
      
      const seriesMatch = mdRaw.match(/^\s*\*\*Podcast\*\*\s*\n*\[([^\]]+)\]/i);
      if (seriesMatch) {
        podcastSeriesName = seriesMatch[1].trim();
      }

      if (tagsEl) {
        let tagsHtml = '';
        if (podcastSeriesName) {
          tagsHtml += `<span class="article-topic-tag article-topic-tag-podcast" data-tag="${this.escapeHtml(podcastSeriesName)}">🎙️ Série : ${this.escapeHtml(podcastSeriesName)}</span>`;
        }
        if (mainTags.length > 0) {
          tagsHtml += mainTags.map(t => `<span class="article-topic-tag" data-tag="${this.escapeHtml(t)}">${this.escapeHtml(t)}</span>`).join('');
        }

        if (tagsHtml) {
          tagsEl.innerHTML = tagsHtml;
          tagsEl.classList.remove('hidden');

          tagsEl.querySelectorAll('.article-topic-tag').forEach(tagBtn => {
            tagBtn.addEventListener('click', () => {
              const tag = tagBtn.dataset.tag;
              this.closeArticleReader();
              const searchInput = document.getElementById('articles-search-input');
              if (searchInput) searchInput.value = tag;
              this.currentSearchQuery = tag;
              this.loadArticles();
            });
          });
        } else {
          tagsEl.innerHTML = '';
          tagsEl.classList.add('hidden');
        }
      }

      if (extLink) {
        extLink.href = art.url;
        extLink.onclick = (e) => {
          e.preventDefault();
          if (window.pywebview?.api?.open_external_url) {
            window.pywebview.api.open_external_url(art.url);
          } else {
            window.open(art.url, '_blank');
          }
        };
      }

      // 5. Rendu Markdown propre et calcul des statistiques de lecture
      const renderedHtml = this.renderMarkdown(mdRaw);
      
      if (contentEl) {
        contentEl.innerHTML = renderedHtml;

        // Liaison des infobulles et clics sur les références bibliques
        if (typeof ScriptureTooltip !== 'undefined' && ScriptureTooltip.bindToElements) {
          ScriptureTooltip.bindToElements(contentEl.querySelectorAll('.theol-inline-scripture-ref'));
        }

        contentEl.querySelectorAll('.theol-inline-scripture-ref').forEach(span => {
          span.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ref = span.dataset.ref || span.textContent.trim();
            if (ref && typeof TheologyView !== 'undefined' && TheologyView.openScriptureReference) {
              await TheologyView.openScriptureReference(ref);
            } else if (ref && typeof BibleReader !== 'undefined') {
              App.switchView('bible');
              try {
                const parsed = await API.parseReference(ref);
                if (parsed && parsed.book) {
                  await BibleReader.navigateTo(parsed.book, parsed.chapter || 1, parsed.verse || null);
                }
              } catch (err) {
                BibleReader.navigateTo(ref);
              }
            }
          });
        });

        // 1. Liaison des liens internes (notes de bas de page et retour au texte)
        contentEl.querySelectorAll('a[href^="#"]').forEach(aTag => {
          aTag.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetId = aTag.getAttribute('href').replace(/^#/, '');
            if (!targetId) return;
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetEl.classList.remove('article-fn-flash');
              void targetEl.offsetWidth; // Force reflow
              targetEl.classList.add('article-fn-flash');
              setTimeout(() => targetEl.classList.remove('article-fn-flash'), 1800);
            }
          });
        });

        // 1b. Liaison des infobulles de prévisualisation au survol des notes de bas de page
        contentEl.querySelectorAll('.article-fn-badge a').forEach(aTag => {
          const targetId = aTag.getAttribute('href').replace(/^#/, '');
          const fnNum = aTag.textContent.trim();
          aTag.addEventListener('mouseenter', (e) => {
            const fnEl = document.getElementById(targetId);
            if (!fnEl) return;
            const fnText = fnEl.querySelector('.article-footnote-text')?.textContent || fnEl.textContent;
            this.showFootnoteTooltip(e, fnNum, fnText);
          });
          aTag.addEventListener('mouseleave', () => {
            this.hideFootnoteTooltip();
          });
        });

        // 2. Liaison des liens externes (ouverture propre dans le navigateur par défaut)
        contentEl.querySelectorAll('a:not([href^="#"])').forEach(aTag => {
          aTag.addEventListener('click', (e) => {
            const href = aTag.getAttribute('href');
            if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
              e.preventDefault();
              e.stopPropagation();
              if (window.pywebview?.api?.open_external_url) {
                window.pywebview.api.open_external_url(href);
              } else {
                window.open(href, '_blank');
              }
            }
          });
        });
      }

      // Calcul des statistiques de lecture (mots & temps)
      this.updateReadingStats(mdRaw);

      // Appliquer les préférences de lecture actuelles
      this.applyReadingOptions();

      // Révéler le contenu en masquant le skeleton avec une transition fluide
      if (skeletonEl) skeletonEl.classList.add('hidden');
      if (realContentEl) {
        realContentEl.classList.remove('hidden');
        realContentEl.classList.add('fade-in');
      }

      // Générer le sommaire interactif latéral (TOC)
      this.buildTableOfContents();

    } catch (e) {
      console.error('[ArticlesView] Erreur affichage article:', e);
      if (skeletonEl) skeletonEl.classList.add('hidden');
      if (realContentEl) realContentEl.classList.remove('hidden');
      if (contentEl) contentEl.innerHTML = `<div class="articles-error-state">Erreur lors de l'affichage de l'article.</div>`;
    }
  },

  updateReadingStats(markdownText) {
    const statsEl = document.getElementById('article-stats-text');
    if (!statsEl || !markdownText) return;

    // Compter les mots réels
    const words = markdownText.trim().replace(/[#*>\-_`\[\]\(\)]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Vitesse moyenne de lecture : 220 mots / minute
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 220));

    statsEl.textContent = `${readTimeMinutes} min de lecture • ${wordCount.toLocaleString('fr-FR')} mots`;
  },

  buildTableOfContents() {
    const sidebarEl = document.getElementById('article-toc-sidebar');
    const navEl = document.getElementById('article-toc-nav');
    const toggleBtn = document.getElementById('btn-article-toggle-toc');
    const contentEl = document.getElementById('article-reader-body');
    if (!sidebarEl || !navEl || !contentEl) return;

    navEl.innerHTML = '';

    // Trouver tous les titres H1, H2, H3, H4 du corps de texte (en excluant absolument les dialogues de podcast, callouts, etc.)
    const allHeadings = Array.from(contentEl.querySelectorAll('h1, h2, h3, h4')).filter(h => {
      // Exclure formellement les interventions/dialogues de podcast
      if (h.closest('.article-speaker-turn') || h.closest('.article-speaker-speech') || h.closest('.article-speaker-badge')) return false;
      // Exclure les callouts d'information et encarts éditoriaux
      if (h.closest('.article-info-callout') || h.closest('.article-editorial-footer-card') || h.closest('.article-table-wrap')) return false;
      // Exclure le titre principal de l'article s'il a été injecté dans le corps
      if (h.classList.contains('article-reader-title')) return false;
      // Exclure les titres trop courts
      const text = h.textContent.trim();
      return text.length >= 2;
    });

    if (allHeadings.length < 2) {
      sidebarEl.classList.add('hidden');
      if (toggleBtn) toggleBtn.classList.add('hidden');
      return;
    }

    if (toggleBtn) {
      toggleBtn.classList.remove('hidden');
      toggleBtn.classList.toggle('active', !this.tocHiddenByUser);
    }
    if (!this.tocHiddenByUser) {
      sidebarEl.classList.remove('hidden');
    } else {
      sidebarEl.classList.add('hidden');
    }

    let navHtml = '';
    allHeadings.forEach((h, index) => {
      const headingId = `article-heading-${index + 1}`;
      h.id = headingId;
      const level = parseInt(h.tagName.substring(1), 10) || 2;
      const titleText = h.textContent.trim();

      navHtml += `
        <a href="#${headingId}" class="article-toc-item article-toc-level-${level}" data-target-id="${headingId}">
          <span class="article-toc-bullet"></span>
          <span class="article-toc-text">${this.escapeHtml(titleText)}</span>
        </a>
      `;
    });

    navEl.innerHTML = navHtml;

    // Écouteur de clic sur chaque élément du sommaire avec défilement fluide et illumination
    navEl.querySelectorAll('.article-toc-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = item.dataset.targetId;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          targetEl.classList.remove('article-heading-flash');
          void targetEl.offsetWidth; // Force reflow
          targetEl.classList.add('article-heading-flash');
          setTimeout(() => targetEl.classList.remove('article-heading-flash'), 1800);
        }
      });
    });

    this.initScrollSpy(allHeadings);
  },

  initScrollSpy(headings) {
    const container = document.querySelector('.articles-view-container') || window;
    const progressPctEl = document.getElementById('article-toc-progress-pct');
    const progressBarFill = document.getElementById('article-toc-progress-bar-fill');
    const navEl = document.getElementById('article-toc-nav');

    if (this._scrollSpyHandler) {
      (container === window ? window : container).removeEventListener('scroll', this._scrollSpyHandler);
    }

    this._scrollSpyHandler = () => {
      const scrollEl = container === window ? (document.scrollingElement || document.documentElement) : container;
      const scrollTop = scrollEl.scrollTop;
      const scrollHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
      const pct = scrollHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100))) : 0;

      if (progressPctEl) progressPctEl.textContent = `${pct}%`;
      if (progressBarFill) progressBarFill.style.width = `${pct}%`;

      // Détecter la section active selon la position des titres
      let activeHeadingId = null;
      for (let i = headings.length - 1; i >= 0; i--) {
        const h = headings[i];
        const rect = h.getBoundingClientRect();
        if (rect.top <= 180) {
          activeHeadingId = h.id;
          break;
        }
      }
      if (!activeHeadingId && headings.length > 0) {
        activeHeadingId = headings[0].id;
      }

      if (navEl) {
        navEl.querySelectorAll('.article-toc-item').forEach(item => {
          if (item.dataset.targetId === activeHeadingId) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      }
    };

    (container === window ? window : container).addEventListener('scroll', this._scrollSpyHandler, { passive: true });
    // Calcul initial
    this._scrollSpyHandler();
  },

  closeArticleReader() {
    this.hideFootnoteTooltip();
    if (this._scrollSpyHandler) {
      const container = document.querySelector('.articles-view-container') || window;
      (container === window ? window : container).removeEventListener('scroll', this._scrollSpyHandler);
      this._scrollSpyHandler = null;
    }
    const viewList = document.getElementById('articles-list-section');
    const viewReader = document.getElementById('articles-reader-section');
    if (viewReader) viewReader.classList.add('hidden');
    if (viewList) viewList.classList.remove('hidden');
    this.selectedArticleId = null;

    // Remonter automatiquement tout en haut du conteneur de liste
    const container = document.querySelector('.articles-view-container');
    if (container) {
      container.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  },

  showFootnoteTooltip(e, num, text) {
    if (!this.fnTooltipEl) {
      this.fnTooltipEl = document.createElement('div');
      this.fnTooltipEl.className = 'article-fn-tooltip';
      document.body.appendChild(this.fnTooltipEl);
    }
    const cleanText = (text || '').replace(/↩\s*$/, '').trim();
    this.fnTooltipEl.innerHTML = `<div class="article-fn-tooltip-header"><span class="article-fn-tooltip-num">Note ${num}</span></div><div class="article-fn-tooltip-body">${this.escapeHtml(cleanText)}</div>`;
    this.positionFootnoteTooltip(e);
    this.fnTooltipEl.classList.add('visible');
  },

  positionFootnoteTooltip(e) {
    if (!this.fnTooltipEl) return;
    const rect = e.target.getBoundingClientRect();
    const tooltip = this.fnTooltipEl;
    let left = rect.left + rect.width / 2 - 140;
    let top = rect.bottom + 8;

    // Éviter les débordements d'écran
    if (left < 12) left = 12;
    if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
    if (top + 120 > window.innerHeight) top = rect.top - 90;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  },

  hideFootnoteTooltip() {
    if (this.fnTooltipEl) {
      this.fnTooltipEl.classList.remove('visible');
    }
  },

  async syncArticles(isSilent = false) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const btn = document.getElementById('btn-sync-articles');
    const modalBtn = document.getElementById('btn-modal-trigger-sync');

    if (!isSilent && btn) {
      btn.classList.add('loading');
      btn.innerHTML = `<div class="spinner-xs"></div><span>Synchronisation...</span>`;
    }
    if (modalBtn) {
      modalBtn.disabled = true;
      modalBtn.innerHTML = `<div class="spinner-xs"></div><span>En cours...</span>`;
    }

    try {
      if (!isSilent && typeof App !== 'undefined' && App.showToast) {
        App.showToast('Synchronisation des flux RSS en cours...', 'info');
      }

      const res = await API.call('sync_article_sources');
      if (res && res.success) {
        const totalNew = res.total_new || 0;
        this.syncOpts.lastSyncTimestamp = Date.now();
        this.saveSyncPreferences();

        this.updateLastSyncLabel();

        if (totalNew > 0 && typeof App !== 'undefined' && App.showToast) {
          App.showToast(`${totalNew} nouvel(s) article(s) théologique(s) synchronisé(s).`, 'success');
        } else if (!isSilent && typeof App !== 'undefined' && App.showToast) {
          App.showToast('Tous les flux sont déjà à jour.', 'info');
        }

        await this.loadSources();
        await this.loadArticles();
      } else {
        if (!isSilent && typeof App !== 'undefined' && App.showToast) {
          App.showToast('Erreur lors de la synchronisation des flux.', 'warning');
        }
      }
    } catch (e) {
      console.error('[ArticlesView] Erreur synchro:', e);
    } finally {
      this.isSyncing = false;
      if (btn) {
        btn.classList.remove('loading');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Synchroniser</span>
        `;
      }
      if (modalBtn) {
        modalBtn.disabled = false;
        modalBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          <span>Synchroniser maintenant</span>
        `;
      }
    }
  },

  updateLastSyncLabel() {
    const lbl = document.getElementById('articles-last-sync-label');
    if (!lbl) return;
    if (!this.syncOpts.lastSyncTimestamp) {
      lbl.textContent = 'Jamais synchronisé';
      return;
    }
    const d = new Date(this.syncOpts.lastSyncTimestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    lbl.textContent = `${day} ${month} ${year} à ${hours}:${mins}`;
  },

  openSettingsModal() {
    const modal = document.getElementById('modal-articles-settings');
    if (!modal) return;

    const freq = this.syncOpts.frequency || 'startup';
    const radio = document.querySelector(`input[name="articles-sync-freq"][value="${freq}"]`);
    if (radio) radio.checked = true;

    const intervalSelect = document.getElementById('articles-sync-interval-days');
    if (intervalSelect) {
      intervalSelect.value = String(this.syncOpts.intervalDays || 3);
    }

    const intervalWrap = document.getElementById('articles-interval-wrap');
    if (intervalWrap) {
      intervalWrap.style.opacity = freq === 'interval' ? '1' : '0.5';
      intervalWrap.style.pointerEvents = freq === 'interval' ? 'auto' : 'none';
    }

    this.updateLastSyncLabel();
    modal.classList.remove('hidden');
  },

  closeSettingsModal() {
    const modal = document.getElementById('modal-articles-settings');
    if (modal) modal.classList.add('hidden');
  },

  saveSettingsModal() {
    const selectedRadio = document.querySelector('input[name="articles-sync-freq"]:checked');
    const freq = selectedRadio ? selectedRadio.value : 'startup';
    const intervalSelect = document.getElementById('articles-sync-interval-days');
    const intervalDays = intervalSelect ? parseInt(intervalSelect.value, 10) || 3 : 3;

    this.saveSyncPreferences({
      frequency: freq,
      intervalDays: intervalDays
    });

    this.closeSettingsModal();

    if (typeof App !== 'undefined' && App.showToast) {
      let msg = 'Préférences de synchronisation enregistrées.';
      if (freq === 'startup') msg = 'Synchronisation automatique activée à chaque démarrage.';
      else if (freq === 'interval') msg = `Synchronisation automatique programmée tous les ${intervalDays} jours.`;
      else if (freq === 'manual') msg = 'Synchronisation configurée en mode manuel.';
      App.showToast(msg, 'success');
    }
  },

  openSuggestModal() {
    const modal = document.getElementById('modal-suggest-blog');
    if (!modal) return;
    
    // Réinitialiser les champs
    const nameInput = document.getElementById('suggest-blog-name');
    const urlInput = document.getElementById('suggest-blog-url');
    const reasonInput = document.getElementById('suggest-blog-reason');
    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';
    if (reasonInput) reasonInput.value = '';

    modal.classList.remove('hidden');
    nameInput?.focus();
  },

  closeSuggestModal() {
    const modal = document.getElementById('modal-suggest-blog');
    if (modal) modal.classList.add('hidden');
  },

  async submitSuggestion() {
    const nameInput = document.getElementById('suggest-blog-name');
    const urlInput = document.getElementById('suggest-blog-url');
    const reasonInput = document.getElementById('suggest-blog-reason');

    const name = nameInput?.value?.trim() || '';
    const url = urlInput?.value?.trim() || '';
    const reason = reasonInput?.value?.trim() || '';

    if (!name || !url) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Veuillez renseigner le nom et l\'URL du blog.', 'warning');
      }
      return;
    }

    try {
      const res = await API.call('get_article_suggestion_url', name, url, reason);
      this.closeSuggestModal();

      if (res && res.success && res.mailto_url) {
        window.location.href = res.mailto_url;
      }

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Merci ! Votre suggestion a été préparée.', 'success');
      }
    } catch (e) {
      console.error('[ArticlesView] Erreur suggestion:', e);
      this.closeSuggestModal();
    }
  },

  renderMarkdown(md) {
    if (!md) return '';
    
    let text = this.fixMojibake(md).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Nettoyer les résidus de lecteur ElevenLabs audio sans déborder sur le texte
    text = text.replace(/Loading\s+the\s*(?:\[[^\]]*Elevenlabs[^\]]*\]\([^)]+\)|Elevenlabs[^\n.]*)/gi, '');
    text = text.replace(/AudioNative\s+Player[\.\u2026]*/gi, '');

    // 1b-1. Convertir les blockquotes Markdown (> Citation [– Auteur]) AVANT le découpage de phrases
    text = text.replace(/(?:^|\n)>\s*([^\n]+(?:\n(?!>|[#\n]|---)[^\n]+)*)/g, (match, bqContent) => {
      let content = bqContent.replace(/\n>\s*/g, ' ').replace(/\n/g, ' ').trim();
      
      const authorMatch = content.match(/^([\s\S]+?)\s+([—–\u2013\u2014-]\s*[A-ZÀ-ÖØ-ß][^\n]*?\*(?:\[[^\]]+\]\([^)]+\)|[^*]+)\*[.,\s]*)(?:\s+([A-ZÀ-ÿ«][\s\S]*))?$/);
      if (authorMatch) {
        const quoteText = authorMatch[1].trim();
        const quoteAuthor = authorMatch[2].trim();
        const nextParagraph = authorMatch[3] ? `\n\n${authorMatch[3].trim()}` : '';
        return `\n\n<blockquote class="article-bible-quote"><p>${quoteText}</p><footer class="article-quote-author">${quoteAuthor}</footer></blockquote>${nextParagraph}\n\n`;
      }
      
      const simpleAuthorMatch = content.match(/^([\s\S]+?)\s+([—–\u2013\u2014-]\s*[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ.]*(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ.]*){1,4}[.,\s]*)(?:\s+([A-ZÀ-ÿ«][\s\S]*))?$/);
      if (simpleAuthorMatch) {
        const quoteText = simpleAuthorMatch[1].trim();
        const quoteAuthor = simpleAuthorMatch[2].trim();
        const nextParagraph = simpleAuthorMatch[3] ? `\n\n${simpleAuthorMatch[3].trim()}` : '';
        return `\n\n<blockquote class="article-bible-quote"><p>${quoteText}</p><footer class="article-quote-author">${quoteAuthor}</footer></blockquote>${nextParagraph}\n\n`;
      }

      return `\n\n<blockquote class="article-bible-quote"><p>${content}</p></blockquote>\n\n`;
    });

    // 1b-2. Structurer "Transcription de la prédication" et son avertissement
    text = text.replace(/\s*Transcription\s+de\s+la\s+prédication\s*:?\s*(?:(?:\*|<em>)?ℹ️\s*([^*\n<]+)(?:\*|<\/em>)?)?/gi, (match, note) => {
      const noteHtml = note ? `\n\n<div class="article-info-callout"><span>ℹ️</span><div>${note.trim()}</div></div>\n\n` : '';
      return `\n\n### Transcription de la prédication\n\n${noteHtml}`;
    });

    // 1b-3. Structurer "Dans la même série"
    text = text.replace(/(?:^|\n|[.!?…»])\s*(Dans\s+la\s+même\s+série\s*:?)\s*(\[|[A-ZÀ-ÿ])/gi, '\n\n### Dans la même série\n\n- $2');
    text = text.replace(/(?<=### Dans la même série[\s\S]*?)(?<=\))\s*([—–\u2013\u2014-]\s*[A-ZÀ-ÿ][^\n\[]+?)\s+(\[[^\]]+\]\([^)]+\))/g, '$1\n- $2');
    text = text.replace(/(?<=### Dans la même série[\s\S]*?)(?<=\))\s+(\[[^\]]+\]\([^)]+\))/g, '\n- $1');

    // 1b-4. Découper les blocs et lignes excessivement longs (transcriptions brutes compactées) en paragraphes
    const abbrevsPattern = '(?:Sam|Rois|Chron|Thess|Cor|Tim|Pierre|Jean|Gen|Ex|Lv|Nb|Dt|Jos|Jg|Rt|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|Mt|Mc|Lc|Jn|Ac|Rm|Ga|Ep|Ph|Col|Tt|Phm|He|Jc|Jd|Ap|p|pp|vol|tome|chap|art|col|éd|ed|cf|ex|al|etc|dr|prof|st|ste|vs|v|vv)';
    const sentenceSplitRegex = new RegExp(`(?<!\\b${abbrevsPattern})[.!?…»]\\s+(?!–|—)([A-ZÀ-ÖØ-ß«])`, 'g');

    const rawLines = text.split('\n');
    const processedLines = rawLines.map(line => {
      if (line.startsWith('#') || line.startsWith('>') || line.startsWith('-') || line.startsWith('<') || line.length < 650) {
        return line;
      }
      let sentenceCount = 0;
      return line.replace(sentenceSplitRegex, (match, nextChar, offset, str) => {
        // Ne jamais couper à l'intérieur d'une parenthèse (ex: "(voir 2 Sam. 7)")
        const prefix = str.substring(0, offset);
        const openParens = (prefix.match(/\(/g) || []).length;
        const closeParens = (prefix.match(/\)/g) || []).length;
        if (openParens > closeParens) {
          return match;
        }

        sentenceCount++;
        if (sentenceCount >= 3) {
          sentenceCount = 0;
          return match.charAt(0) + '\n\n' + nextChar;
        }
        return match;
      });
    });
    text = processedLines.join('\n');

    // 2. Nettoyer les emojis résiduels dans les listes et structurer "Pour aller plus loin"
    text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');
    text = text.replace(/(?:^|\n|[.!?…»])\s*(Pour\s+aller\s+plus\s+loin\s*:?)\s*(\[|Un\s+article|[A-ZÀ-ÿ])/gi, '\n\n### Pour aller plus loin\n\n- $2');
    text = text.replace(/([A-Za-zÀ-ÿ0-9\)\]*])\s+(Un\s+article\s+de\s+[^\n:]+:\s*)/g, '$1\n- $2');
    text = text.replace(/(?<=### Pour aller plus loin[\s\S]*?)(?:\n|[.!?…»]|\))\s*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?,\s*\*?\[[^\]]+\])/g, '\n- $1');

    // 2b. Nettoyer les blocs promotionnels, parcours e-mail et mentions de droits réservés
    text = text.replace(/(?:#+\s*)?Parcours\s+e-?mail[\s\S]*$/gi, '');
    text = text.replace(/Pour\s+aller\s+plus\s+loin,\s+inscris-toi[\s\S]*$/gi, '');
    text = text.replace(/(?:#+\s*)?Inscrivez-vous\s+à\s+notre\s+newsletter[\s\S]*$/gi, '');
    text = text.replace(/(?:Tous\s+droits\s+réservés[\.\s]*|All\s+rights\s+reserved[\.\s]*)/gi, '');

    // 3. Nettoyer tout bloc d'en-tête redondant (titre, auteur, source, date dupliqués, Publié le..., Podcast orphelin)
    text = text.replace(/^(#\s+[^\n]+\n+)?/gi, '');
    text = text.replace(/^(\*\*(?:Auteur|Source|Date|Publié le|Podcast)\s*:\*\*[^\n]*\n*|\*\*Podcast\*\*\s*\n*|Podcast\s*\n*|Auteur\s*:[^\n]*\n*|Source\s*:[^\n]*\n*|Date\s*:[^\n]*\n*|Publié\s+le[^\n]*\n*|---\n*)+/gim, '');
    text = text.replace(/^(?:\[[A-ZÉÈÊÀ\s\-]+\]\(https?:\/\/[^\)]+\)\s*)+(?:\d+\s*min\s+de\s+lecture)?[^\n]*\n+/gim, '');

    // 4. Formater les callouts d'information (ex: note de transcription automatique) et nettoyer les astérisques résiduels
    text = text.replace(/(?:^|\n)\s*\*?\s*(?:ℹ️|ℹ)\s*([^\n*]+?)\*?\s*(?=\n|$)/gi, '\n\n<div class="article-info-callout"><span>ℹ️</span><div>$1</div></div>\n\n');
    text = text.replace(/(?:^|\n)\s*\*\s*(?=\n|$)/g, '\n');

    // 4b. Formater les bandeaux de note de la rédaction / Note de l'éditeur / Editors' note en début d'article
    text = text.replace(/(?:^|\n)(?:(?:\*\*)?\s*(Editors[’']\s*note|Note\s+de\s+l[’']éditeur|Editor[’']s\s+note|Note\s+de\s+la\s+rédaction|NDLR)\s*(?:\*\*)?\s*:?\s*\n*)+(?:\*\*)?\s*([^\n]+?)(?=\n|$)/gi, (match, labelRaw, noteContent) => {
      let cleanLabel = labelRaw.trim();
      if (/Note\s+de\s+l/i.test(cleanLabel)) cleanLabel = "Note de l’éditeur :";
      else if (/Note\s+de\s+la/i.test(cleanLabel)) cleanLabel = "Note de la rédaction :";
      else if (/NDLR/i.test(cleanLabel)) cleanLabel = "NDLR :";
      else cleanLabel = "Editors’ note :";

      let cleanContent = noteContent.trim();
      return `\n\n<div class="article-editors-note-banner"><strong class="article-editors-note-label">${cleanLabel}</strong> ${cleanContent}</div>\n\n`;
    });

    // 5. Nettoyer les tirets initiaux sur les mentions éditoriales et normaliser les espaces (ex: "livreIl" -> "livre Il")
    text = text.replace(/(livre|ouvrage|série|revue|magazine|journal)([A-ZÀ-ÿ])/gi, '$1 $2');
    text = text.replace(/([.!?…»])\s*(Merci\s+à\s+[^\n]+pour\s+la\s+traduction|Article\s+original\s*:|Publié\s+pour\s+la\s+première\s+fois|Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)/gi, '$1\n\n$2');
    text = text.replace(/(Publié\s+par\s+[^\n.]+[\.\s]*)\s*(Publié\s+pour\s+la\s+première\s+fois[^\n]+)/gi, '$1\n$2');
    text = text.replace(/(?:^|\n)\s*[—–-]\s*(Cet article\s+(?:est extrait|fait partie|est tiré|a été publié|provient|est une adaptation))/gi, '\n\n$1');

    const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
    const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

    // 5a-1. Normaliser immédiatement les exposants dans les références scripturaires (ex: Actes ¹.⁸-¹¹ -> Actes 1.8-11, Éphésiens ³.¹⁴-¹⁵)
    const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|Gen|Ex|Lv|Nb|Dt|Jos|Jg|Rt|1S|2S|1R|2R|1Ch|2Ch|Esd|Ne|Est|Jb|Ps|Pr|Ec|Ct|Es|Jr|Lm|Ez|Dn|Os|Jl|Am|Ab|Jon|Mi|Na|Ha|So|Ag|Za|Ml|Mt|Mc|Lc|Jn|Ac|Rm|1Co|2Co|Ga|Ep|Ph|Col|1Th|2Th|1Tm|2Tm|Tt|Phm|He|Jc|1P|2P|1Jn|2Jn|3Jn|Jd|Ap)';
    text = text.replace(new RegExp(`(\\b${bibleBooksPattern}\\.?)\\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[\\s.:,/-]+[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)*)`, 'gi'), (match, book, sups) => {
      return book + ' ' + normalizeSuperscripts(sups);
    });

    // 5a-2. Dans les cartouches éditoriaux et mentions bibliographiques, convertir systématiquement les exposants en chiffres normaux
    text = text.replace(/(?:Merci\s+à|Article\s+original|Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation)|Extrait du livre|Tiré du livre|Publié avec)[^\n]+/gi, (match) => {
      return normalizeSuperscripts(match);
    });

    // 5b-1. Détection et mise en valeur des encadrés biographiques d'auteurs et de partenaires (ex: Ben Lattimore, SOLA)
    const solaImg = 'https://media.thegospelcoalition.org/wp-content/uploads/sites/5/2023/03/17092830/327176131_865371428018991_2189346806125016085_n-300x300.jpg';
    
    // Encadré SOLA / Partenaire
    text = text.replace(/(?:^|\n)(\*\*SOLA\*\*\s*[–—-]\s*La Coalition de l’Évangile[^\n]+(?:\n(?!\n)[^\n]+)*)/gi, (match, body) => {
      return `\n\n<div class="article-author-bio-card"><div class="article-author-bio-avatar"><img src="${solaImg}" alt="SOLA" class="article-author-bio-img" loading="lazy"></div><div class="article-author-bio-content"><p>${body.trim()}</p></div></div>\n\n`;
    });

    // Encadré biographique d'auteur (ex: "Ben Lattimore est marié à...", "Wyatt Graham est le directeur...")
    text = text.replace(/(?:^|\n)([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+){1,3}\s+est\s+(?:marié|pasteur|auteur|enseignant|théologien|directeur|fondateur|professeur|étudiant|membre|rédacteur|titulaire|responsable|doyen)[^\n]+(?:\n(?!\n)[^\n]+)*)/g, (match, body) => {
      const authorName = body.split(/\s+est\s+/i)[0].trim();
      const initial = authorName.charAt(0);
      return `\n\n<div class="article-author-bio-card"><div class="article-author-bio-avatar"><span style="font-weight:700; font-size:18px; color:var(--accent-primary, #60a5fa);">${initial}</span></div><div class="article-author-bio-content"><p>${body.trim()}</p></div></div>\n\n`;
    });

    // 5b-2. Détection et mise en valeur du cartouche éditorial de fin d'article (Option 3 : Badge contextuel dynamique, sans émoji/svg)
    text = text.replace(
      /(?:^|\n\n+)((?:Merci\s+à\s+[^\n]+pour\s+la\s+traduction|Article\s+original\s*:|Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)[\s\S]+?)(?=\n\n###|\n\n<|\s*$)/gi,
      (match, content) => {
        const badge = this.getEditorialBadgeLabel(content);
        const cleanContent = normalizeSuperscripts(content.trim());
        return `\n\n<div class="article-editorial-footer-card"><div class="article-editorial-footer-header"><span class="article-editorial-badge">${badge}</span></div><div class="article-editorial-footer-content">${cleanContent}</div></div>\n\n`;
      }
    );

    // 5c. Formater les dialogues et transcriptions de podcast (intervenants multiples)
    // Séparer les prises de parole par des sauts de ligne
    text = text.replace(/(?<!\n)\s*\*\*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?)\*\*\s*:?\s*/g, '\n\n**$1 :** ');
    // Convertir les lignes de prise de parole en encadrés de dialogue stylisés
    text = text.replace(/(?:^|\n)\*\*([A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+)?)\s*:\*\*\s*([^\n]+)/g, '\n\n<div class="article-speaker-turn"><span class="article-speaker-badge">$1</span><p class="article-speaker-speech">$2</p></div>\n\n');

    // 5d. Structurer les sous-titres et directives bibliques ("Cléopas et la désillusion **Lisez Luc 24.13-35.**")
    text = text.replace(/(?:^|\n)([A-ZÀ-ÿ][^\n*]+?)\s+(\*\*Lisez\s+[^*]+\*\*)/gim, '\n\n### $1\n\n$2\n\n');
    text = text.replace(/(\*\*[^*]+\*\*)\s+([A-ZÀ-ÿ])/g, '$1\n\n$2');

    // 5e. Découpage et mise en page soignée des dialogues au tiret cadratin (sans couper les attributions de citations comme ". – Actes 1.8-11")
    const notBibleRefAhead = `(?!(?:\\s*${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))`;

    text = text.replace(/([:!?…»])\s*([—–\u2013\u2014]\s+[A-ZÀ-ÿ])/g, '$1\n\n$2');
    text = new RegExp(`\\.\\s+([—–\\u2013\\u2014]${notBibleRefAhead}\\s+[A-ZÀ-ÿ])`, 'g')[Symbol.replace](text, '.\n\n$1');

    // Convertir les lignes de dialogue au tiret en encadrés distincts (en protégeant les citations scripturaires)
    text = new RegExp(`(?:^|\\n)\\s*([—–\\u2013\\u2014]${notBibleRefAhead}\\s+[A-ZÀ-ÿ][^\\n]+)`, 'g')[Symbol.replace](text, '\n\n<div class="article-speaker-turn"><p class="article-speaker-speech">$1</p></div>\n\n');

    // 5f. Convertir les citations bibliques et littéraires avec tiret de référence (« ... » – Réf / Auteur)
    text = text.replace(/(?:^|\n)«\s*([^»]+?)\s*»\s*([–—\u2013\u2014-]\s*[A-ZÀ-ÿ0-9.:\s-]+)/g, (match, quote, author) => {
      return `\n\n<blockquote class="article-bible-quote"><p>« ${quote} »</p><footer class="article-quote-author">${author.trim()}</footer></blockquote>\n\n`;
    });

    // 5g. Remplacer tous les appels de notes dans le texte: [[[^1]](#fn1), [[^4]]](#fn4), [[1]](#fn1), [^1], [1](#fn1), [[¹]](#fn1), etc.
    text = text.replace(/\[+(?:\^)?([0-9¹²³⁴⁵⁶⁷⁸⁹]+)\]+(?:\(#(?:fn|article-fn|note|ftnt)[^)]*\))?\]*/gi, (match, n) => {
      const num = parseInt(normalizeSuperscripts(n), 10);
      if (num >= 1 && num <= 99) {
        return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
      }
      return match;
    });

    text = text.replace(/([a-zA-ZÀ-ÿ»"'\).,;!?])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2})(?!\w)/g, (match, prevChar, sups) => {
      const num = parseInt(normalizeSuperscripts(sups), 10);
      if (num <= 50) {
        return `${prevChar}<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
      }
      return `${prevChar}${num}`;
    });

    // Supprimer les espaces indésirables entre l'appel de note et la ponctuation suivante (ex: </sup> . -> </sup>.)
    text = text.replace(/<\/sup>\s+([.,;:!?])/g, '</sup>$1');

    // 5h. Normaliser les notes de bas de page : suppression des symboles ↩ et jonction des numéros
    text = text.replace(/[↩︎↩]/g, '');
    text = text.replace(/(?:^|\n)(\d+)\.\s*\n+([^\n]+)/g, '\n$1. $2');

    // 5i. Formater et nettoyer les liens d'URLs brutes dans les notes (ex: [https://...])
    text = text.replace(/\[(https?:\/\/[^\]]+)\]/g, (match, url) => {
      try {
        const cleanUrl = url.split('?')[0];
        const u = new URL(cleanUrl);
        const host = u.hostname.replace(/^www\./, '');
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="article-footnote-link">${host}</a>`;
      } catch (e) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="article-footnote-link">consulter la source</a>`;
      }
    });

    // 5i-2. Joindre les lignes orphelines de citations secondaires à l'intérieur des notes (ex: "8. Stephen...\n\nGrudem, p. 24.\n\n9. John...")
    text = text.replace(/(?:^|\n)(\d+\.\s+[^\n]+(?:\n\n(?!\d+\.|\s*#|\s*<|\s*---|\s*\*\*)[^\n]+)+)/g, (match) => {
      return match.replace(/\n\n+/g, ' ');
    });

    // 5j. Détecter et formater les listes de notes de bas de page numérotées (y compris les notes multi-citations)
    text = text.replace(/(?:^|\n)(\d+)\.\s+([^\n]+(?:\n(?!\d+\.|\s*#|\s*<|\s*---|\s*$)[^\n]+)*)/g, (match, num, body) => {
      let cleanBody = normalizeSuperscripts(body.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim());
      return `\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
    });

    // 5k. Envelopper la suite de <div class="article-footnote-item"> dans une section stylisée
    text = text.replace(/(?:<div class="article-footnote-item"[\s\S]+?<\/div>(?:\s*|\n*))+/g, (match) => {
      return `\n\n<div class="article-footnotes-section"><div class="article-footnotes-title"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>Notes de bas de page</span></div><div class="article-footnotes-list">${match.trim()}</div></div>\n\n`;
    });

    // Normaliser les années, plages de pages et grands nombres en exposant
    text = text.replace(/(pp?\.\s*|[0-9]+[\s-]*)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gi, (match, prefix, sups) => {
      return prefix + normalizeSuperscripts(sups);
    });
    text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]{3,})/g, (match) => {
      return normalizeSuperscripts(match);
    });

    // Normaliser tout exposant orphelin restant en chiffre normal
    text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (match) => normalizeSuperscripts(match));

    // 6. Nettoyer les émojis décoratifs résiduels
    text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');

    // 7. Convertir les tables Markdown (| Col 1 | Col 2 | ...)
    text = text.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (match) => {
      const rows = match.trim().split('\n').map(r => r.trim()).filter(r => r.startsWith('|') && r.endsWith('|'));
      if (rows.length < 2) return match;
      
      let tableHtml = '\n\n<div class="article-table-wrap"><table class="article-table">';
      let headerPassed = false;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.includes('---')) {
          headerPassed = true;
          continue;
        }
        const cells = row.slice(1, -1).split('|').map(c => c.trim());
        if (!headerPassed && i === 0) {
          tableHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        } else {
          tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
        }
      }
      tableHtml += '</tbody></table></div>\n\n';
      return tableHtml;
    });

    // 8. Convertir les blockquotes consécutifs
    text = text.replace(/((?:^>[^\n]*\r?\n?)+)/gm, (match) => {
      const bqLines = match.split('\n').map(l => l.replace(/^>\s?/, '').trim()).filter(l => l.length > 0);
      const bqContent = bqLines.join(' ');
      return `\n<blockquote class="article-bible-quote"><p>${bqContent}</p></blockquote>\n\n`;
    });

    // 9. Nettoyer les séparateurs multiples ou en fin d'article
    text = text.replace(/---\s*$/gi, '');

    // 10. Remplacement Markdown vers HTML
    // Remplacer d'abord les crochets imbriqués dans les titres de liens avant le parseur de liens
    text = text.replace(/\[([^\]]*?)\[([^\]]*?)\]([^\]]*?)\]\((https?:\/\/[^\)]+)\)/g, '[$1$2$3]($4)');

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Rétablir les balises HTML & SVG injectées (dialogues, callouts, tables, blockquotes, footer auteur, notes, badges, img, svg, strong, em)
      .replace(/&lt;(\/?(?:div|table|thead|tbody|tr|th|td|blockquote|footer|cite|p|sup|span|a|img|svg|path|polyline|line|circle|rect|polygon|strong|em|b|i)(?:\s+[a-zA-Z0-9_\-]+(?:="[^"]*")*)*)(\s*\/)?&gt;/gi, '<$1$2>')
      .replace(/^#### (.*$)/gim, '<h4 class="article-h4">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="article-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="article-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="article-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, (match, label, href) => {
        if (href.startsWith('#')) {
          return `<a href="${href}" class="article-internal-link">${label}</a>`;
        }
        return `<a href="${href}" target="_blank" class="article-link">${label}</a>`;
      })
      .replace(/^-\s+(.*$)/gim, '<div class="article-bullet-item"><span class="article-bullet-dot">•</span><div class="article-bullet-text">$1</div></div>')
      .replace(/^---\s*$/gim, '<div class="article-ornamental-divider"><span class="article-ornamental-divider-icon">❦</span></div>')
      .replace(/\n\n+/gim, '</p><p>')
      .replace(/\n/gim, '<br>');

    // 11. Détection et liaisonnement des références bibliques (ex: 1 Corinthiens 1.2, 1 Pierre 5.10, Romains 3.22-23)
    if (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences) {
      html = TheologyView.highlightScriptureReferences(html);
    }

    // Nettoyage des balises <p> autour des blocs structurés
    html = html
      .replace(/<p>\s*(<(?:div|blockquote|h1|h2|h3|h4|section)[\s\S]*?<\/(?:div|blockquote|h1|h2|h3|h4|section)>)\s*<\/p>/gi, '$1')
      .replace(/<p>\s*<\/p>/gi, '');

    return `<div class="article-markdown-body"><p>${html}</p></div>`;
  },

  async loadDrawerArticles(bookCode, chapter) {
    const listEl = document.getElementById('drawer-articles-list');
    const badgeEl = document.getElementById('lbl-drawer-articles-passage');
    if (!listEl) return;

    if (badgeEl) {
      const frenchName = (typeof getFrenchBookName === 'function' ? getFrenchBookName(bookCode) : null) || bookCode || 'Genèse';
      badgeEl.textContent = `${frenchName} ${chapter || 1}`;
    }


    listEl.innerHTML = this.getDrawerSkeletonHtml(3);

    try {
      const articles = await API.call('get_articles_for_passage', bookCode || 'Gen', parseInt(chapter, 10) || 1, 10) || [];
      if (!articles || articles.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 24px 12px; color: var(--text-muted); font-size: 13px;">
            <p>Aucun article contemporain n'est directement relié à ce chapitre pour le moment.</p>
            <button class="btn-articles-action" style="font-size: 11px; margin-top: 8px;" onclick="App.switchView('articles')">
              Voir tous les articles
            </button>
          </div>
        `;
        return;
      }

      let html = '';
      articles.forEach(art => {
        const color = this.getSourceColor(art.source_id);
        const author = this.formatAuthor(art.author);
        html += `
          <div class="article-card" style="padding: 14px; margin-bottom: 8px;" data-article-id="${art.id}">
            <div class="article-card-header" style="margin-bottom: 6px;">
              <span class="article-source-badge" style="background-color: ${color}18; color: ${color}; border: 1px solid ${color}35; font-size: 10px;">
                ${this.getSourceLogo(art.source_id) ? `<img src="${this.getSourceLogo(art.source_id)}" alt="" class="article-source-logo-img">` : ''}<span>${this.escapeHtml(art.source_name || art.source_id)}</span>
              </span>
              <span class="article-pub-date" style="font-size: 10px;">${this.formatDate(art.published_at)}</span>
            </div>
            <h4 style="font-size: 13px; font-weight: 600; margin: 0 0 6px 0; color: var(--text-primary); line-height: 1.3;">
              ${this.escapeHtml(art.title)}
            </h4>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">
              Par ${this.escapeHtml(author)}
            </div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${this.escapeHtml(art.summary || '')}
            </p>
          </div>
        `;
      });

      listEl.innerHTML = html;

      listEl.querySelectorAll('.article-card').forEach(c => {
        c.addEventListener('click', () => {
          const artId = c.dataset.articleId;
          ArticlesView.openDrawerArticle(artId);
        });
      });
    } catch (e) {
      console.error('[ArticlesView] Erreur loadDrawerArticles:', e);
      listEl.innerHTML = `<p class="empty-hint">Erreur de chargement des articles.</p>`;
    }
  },

  async openDrawerArticle(articleId) {
    const listView = document.getElementById('drawer-articles-list-view');
    const readerView = document.getElementById('drawer-articles-reader-view');
    const contentEl = document.getElementById('drawer-article-reader-content');
    const backBtn = document.getElementById('btn-drawer-article-back');
    const fullBtn = document.getElementById('btn-drawer-article-open-full');
    const extLink = document.getElementById('btn-drawer-article-ext');

    if (!readerView || !contentEl) return;

    // Basculer sur la vue lecteur intégrée
    listView?.classList.add('hidden');
    readerView?.classList.remove('hidden');

    contentEl.innerHTML = `
      <div class="articles-loading-state" style="padding: 40px 20px; text-align: center;">
        <div class="spinner-sm" style="margin: 0 auto 10px auto;"></div>
        <span style="font-size: 12.5px; color: var(--text-muted);">Chargement de l'article complet...</span>
      </div>
    `;

    if (backBtn) {
      backBtn.onclick = () => {
        readerView.classList.add('hidden');
        listView?.classList.remove('hidden');
      };
    }

    if (fullBtn) {
      fullBtn.onclick = () => {
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('articles');
          this.openArticle(articleId);
        }
      };
    }

    try {
      const res = await API.call('get_article_content', articleId);
      if (!res || !res.success || !res.article) {
        contentEl.innerHTML = `<p class="empty-hint" style="color: var(--accent-red); padding: 20px; text-align: center;">Article introuvable ou erreur de chargement.</p>`;
        return;
      }

      const art = res.article;
      const contentMarkdown = res.content_markdown || art.content_markdown || art.content || art.summary || '';

      if (extLink) {
        if (art.canonical_url) {
          extLink.href = art.canonical_url;
          extLink.style.display = 'inline-flex';
        } else {
          extLink.style.display = 'none';
        }
      }

      const color = this.getSourceColor(art.source_id);
      const pubDate = this.formatDate(art.published_at);
      const author = this.formatAuthor(art.author);
      const refs = art.scripture_references || [];
      const tags = this.filterMainCategories(art.tags_list || []);

      let tagsHtml = '';
      if (tags.length > 0) {
        tagsHtml = `
          <div class="article-drawer-tags" style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;">
            ${tags.map(t => `<span class="article-topic-tag" style="font-size: 10px; padding: 2px 6px;">${this.escapeHtml(t)}</span>`).join('')}
          </div>
        `;
      }

      let refsHtml = '';
      if (refs.length > 0) {
        refsHtml = `
          <div class="article-drawer-refs" style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 14px;">
            ${refs.map(r => `
              <span class="scripture-badge" style="font-size: 10px; padding: 2px 6px; cursor: pointer;" data-book="${r.book_code}" data-ch="${r.chapter}" data-v="${r.verse || ''}">
                ${this.escapeHtml(this.formatShortScriptureRef(r))}
              </span>
            `).join('')}
          </div>
        `;
      }

      let audioPlayerHtml = '';
      if (art.audio_url) {
        audioPlayerHtml = `
          <div class="article-drawer-audio-box" style="margin: 12px 0 16px 0; padding: 10px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #c084fc; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
              <span>Version Audio / Prédication</span>
            </div>
            <audio controls src="${this.escapeHtml(art.audio_url)}" style="width: 100%; height: 32px; outline: none;"></audio>
          </div>
        `;
      }

      let heroImageHtml = '';
      if (art.image_url) {
        heroImageHtml = `
          <div class="article-drawer-hero-img-wrap" style="width: 100%; border-radius: 8px; overflow: hidden; margin-bottom: 14px; max-height: 180px;">
            <img src="${this.escapeHtml(art.image_url)}" alt="${this.escapeHtml(art.title)}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        `;
      }

      const renderedBody = this.renderMarkdown(contentMarkdown);


      contentEl.innerHTML = `
        <div class="article-drawer-reader-body">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span class="article-source-badge" style="background-color: ${color}18; color: ${color}; border: 1px solid ${color}35; font-size: 10.5px;">
              ${this.getSourceLogo(art.source_id) ? `<img src="${this.getSourceLogo(art.source_id)}" alt="" class="article-source-logo-img">` : ''}<span>${this.escapeHtml(art.source_name || art.source_id)}</span>
            </span>
            <span style="font-size: 11px; color: var(--text-muted);">${pubDate}</span>
          </div>

          <h2 style="font-size: 17px; font-weight: 800; color: var(--text-primary); line-height: 1.35; margin: 0 0 10px 0;">
            ${this.escapeHtml(this.fixMojibake(art.title))}
          </h2>

          <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${art.author_avatar_url ? `<img src="${this.escapeHtml(art.author_avatar_url)}" style="width: 20px; height: 20px; border-radius: 50%;">` : ''}
            <span>Par <strong>${this.escapeHtml(author)}</strong></span>
          </div>

          ${tagsHtml}
          ${refsHtml}
          ${heroImageHtml}
          ${audioPlayerHtml}

          <div class="article-reader-content-text" style="font-family: var(--font-bible, 'EB Garamond', Georgia, serif); font-size: 15px; line-height: 1.75; color: var(--text-primary);">
            ${renderedBody}
          </div>

          <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); display: flex; justify-content: space-between; align-items: center;">
            <button type="button" class="btn-secondary" style="font-size: 11.5px;" onclick="document.getElementById('btn-drawer-article-back').click();">
              ← Retour à la liste
            </button>
            ${art.canonical_url ? `
              <a href="${art.canonical_url}" target="_blank" class="btn-secondary" style="font-size: 11.5px; text-decoration: none;">
                Lire sur le site original ↗
              </a>
            ` : ''}
          </div>
        </div>
      `;

      // Clics sur les badges bibliques
      contentEl.querySelectorAll('.scripture-badge').forEach(badge => {
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          const b = badge.dataset.book;
          const ch = parseInt(badge.dataset.ch, 10) || 1;
          const v = parseInt(badge.dataset.v, 10) || 1;
          if (typeof BibleReader !== 'undefined') {
            BibleReader.navigateTo(b, ch, v);
          }
        });
      });

      // Infobulles versets bibliques inline
      if (typeof ScriptureTooltip !== 'undefined') {
        ScriptureTooltip.bindToElements(contentEl.querySelectorAll('.theol-inline-scripture-ref'));
      }
    } catch (e) {
      console.error('[ArticlesView] Erreur openDrawerArticle:', e);
      contentEl.innerHTML = `<p class="empty-hint" style="color: var(--accent-red);">Erreur lors de l'ouverture de l'article.</p>`;
    }
  },


  formatDate(isoDateStr) {
    if (!isoDateStr) return '';
    try {
      const d = new Date(isoDateStr);
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return isoDateStr;
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

window.ArticlesView = ArticlesView;
