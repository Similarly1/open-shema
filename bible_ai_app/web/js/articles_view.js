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
    if (/extrait\s+du\s+livre|tiré\s+du\s+livre|chapitre\s+\d+|éditions|editions|éditeur|editeur|ouvrage|pp\.\s*\d+|méditation\s+\d+/i.test(lower)) {
      return 'EXTRAIT D’OUVRAGE';
    }
    if (/série\s+de|série\s+sur|épisode\s+\d+|partie\s+\d+|série\s+d’articles|série\s+d'articles/i.test(lower)) {
      return 'SÉRIE THÉMATIQUE';
    }
    if (/travail\s+de\s+recherche|thèse|mémoire|séminaire|seminary|académique|theological\s+seminary/i.test(lower)) {
      return 'RECHERCHE & SÉMINAIRE';
    }
    if (/traduction|traduit\s+de|autoris|droits\s+réservés|reproduit\s+avec/i.test(lower)) {
      return 'NOTE ÉDITORIALE';
    }
    return 'CONTEXTE & PROVENANCE';
  },

  init() {
    this.loadReadingPreferences();
    this.bindEvents();
  },

  loadReadingPreferences() {
    try {
      const saved = localStorage.getItem('open_shema_article_reading_opts');
      if (saved) {
        this.readingOpts = { ...this.readingOpts, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[ArticlesView] Erreur lecture préférences:', e);
    }
  },

  saveReadingPreferences() {
    try {
      localStorage.setItem('open_shema_article_reading_opts', JSON.stringify(this.readingOpts));
    } catch (e) {}
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

    // 2. Bouton Synchroniser
    document.getElementById('btn-sync-articles')?.addEventListener('click', () => {
      this.syncArticles();
    });

    // 2b. Bouton Réglages RAG (Routage direct vers l'onglet IA + scroll automatique)
    document.getElementById('btn-articles-settings')?.addEventListener('click', () => {
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('settings');
        if (typeof SettingsView !== 'undefined' && SettingsView.switchToSection) {
          SettingsView.switchToSection('ai', 'sec-articles-rag-settings');
        }
      }
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

    let html = `
      <button class="source-filter-pill ${this.currentSourceFilter === 'ALL' ? 'active' : ''}" data-source-id="ALL">
        <span>Toutes les sources</span>
        <span class="source-count">${this.sources.reduce((acc, s) => acc + (s.article_count || 0), 0)}</span>
      </button>
    `;

    this.sources.forEach(src => {
      const isActive = this.currentSourceFilter === src.id;
      html += `
        <button class="source-filter-pill ${isActive ? 'active' : ''}" data-source-id="${src.id}">
          <span class="source-bullet" style="background-color: ${this.getSourceColor(src.id)};"></span>
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

  currentArchivePage: 1,

  async loadArticles() {
    const listContainer = document.getElementById('articles-grid-container');
    const emptyContainer = document.getElementById('articles-empty-state');
    const paginationFooter = document.getElementById('articles-pagination-footer');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="articles-loading-state">
        <div class="spinner-sm"></div>
        <span>Chargement des articles...</span>
      </div>
    `;
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
                  ${this.escapeHtml(art.source_name || art.source_id)}
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
      if (pubDateEl) pubDateEl.textContent = this.formatDate(art.published_at);
      if (sourceNameEl) sourceNameEl.textContent = art.source_name || art.source_id;

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
      const leadText = this.fixMojibake(art.lead_summary || art.summary || '');
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

  async syncArticles() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const btn = document.getElementById('btn-sync-articles');
    if (btn) {
      btn.classList.add('loading');
      btn.innerHTML = `<div class="spinner-xs"></div><span>Synchronisation...</span>`;
    }

    try {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Synchronisation des flux RSS en cours...', 'info');
      }

      const res = await API.call('sync_article_sources');
      if (res && res.success) {
        const totalNew = res.total_new || 0;
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Synchronisation terminée : ${totalNew} nouvel(s) article(s).`, 'success');
        }
        await this.loadSources();
        await this.loadArticles();
      } else {
        if (typeof App !== 'undefined' && App.showToast) {
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
    
    let text = this.fixMojibake(md);

    // 1. Nettoyer les résidus de lecteur ElevenLabs audio sans déborder sur le texte
    text = text.replace(/Loading\s+the\s*(?:\[[^\]]*Elevenlabs[^\]]*\]\([^)]+\)|Elevenlabs[^\n.]*)/gi, '');
    text = text.replace(/AudioNative\s+Player[\.\u2026]*/gi, '');

    // 1b. Si l'article entier est sur une seule ligne compactée, découper proprement les paragraphes (sans couper les listes 1., 2. ni les abréviations)
    if (!text.includes('\n\n')) {
      text = text.replace(/(?<!\b(?:pp|p|chap|ch|vol|v|vs|dr|etc|ex|cf|art|\d+))\.\s+([A-ZÀ-ÿ—–«])/gi, '.\n\n$1');
      text = text.replace(/([!?…»])\s+([A-ZÀ-ÿ0-9—–«])/g, '$1\n\n$2');
    }

    // 2. Nettoyer les blocs promotionnels, parcours e-mail et mentions de droits réservés
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

    // 5. Nettoyer les tirets initiaux sur les mentions éditoriales et normaliser les espaces (ex: "livreIl" -> "livre Il")
    text = text.replace(/(livre|ouvrage|série|revue|magazine|journal)([A-ZÀ-ÿ])/gi, '$1 $2');
    text = text.replace(/([.!?…»])\s*(Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)/gi, '$1\n\n$2');
    text = text.replace(/(?:^|\n)\s*[—–-]\s*(Cet article\s+(?:est extrait|fait partie|est tiré|a été publié|provient|est une adaptation))/gi, '\n\n$1');

    const supToNum = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
    const normalizeSuperscripts = (str) => str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => supToNum[ch] || ch);

    // 5a-1. Normaliser immédiatement les exposants dans les références scripturaires (ex: Actes ¹.⁸-¹¹ -> Actes 1.8-11)
    text = text.replace(/(\b(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,6})\.?)\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:[\s.:,/-]+[⁰¹²³⁴⁵⁶⁷⁸⁹0-9]+)*)/gi, (match, book, sups) => {
      return book + ' ' + normalizeSuperscripts(sups);
    });

    // 5a-2. Dans les cartouches éditoriaux et mentions bibliographiques, convertir systématiquement les exposants en chiffres normaux
    text = text.replace(/(?:Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation)|Extrait du livre|Tiré du livre|Publié avec)[^\n]+/gi, (match) => {
      return normalizeSuperscripts(match);
    });

    // 5b. Détection et mise en valeur du cartouche éditorial de fin d'article (Option 3 : Badge contextuel dynamique, sans émoji/svg)
    text = text.replace(
      /(?:^|\n\n+)((?:Cet article\s+(?:fait partie|est extrait|est tiré|a été publié|provient|est une adaptation|est la traduction|est une traduction|est le premier|est le second|est le troisième|est basé)|Extrait du livre|Tiré du livre)[\s\S]+?)(?=\s*$)/gi,
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
    const bibleBooksPattern = '(?:Actes|Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|Samuel|Rois|Chroniques|Esdras|Néhémie|Esther|Job|Psaumes?|Proverbes?|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Romains|Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|Thessaloniciens|Timothée|Tite|Philémon|Hébreux|Jacques|Pierre|Jude|Apocalypse|[123]\\s*[A-Za-zÀ-ÿ]+|[A-ZÀ-ÿ]{2,6})';
    const notBibleRefAhead = `(?!(?:\\s*${bibleBooksPattern}\\.?\\s*[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]))`;

    text = text.replace(/([:!?…»])\s*([—–\u2013\u2014]\s*)/g, '$1\n\n$2');
    text = new RegExp(`\\.\\s+([—–\\u2013\\u2014]${notBibleRefAhead}\\s*[A-ZÀ-ÿ])`, 'g')[Symbol.replace](text, '.\n\n$1');

    // Convertir les lignes de dialogue au tiret en encadrés distincts (en protégeant les citations scripturaires)
    text = new RegExp(`(?:^|\\n)\\s*([—–\\u2013\\u2014]${notBibleRefAhead}\\s*[^\\n]+)`, 'g')[Symbol.replace](text, '\n\n<div class="article-speaker-turn"><p class="article-speaker-speech">$1</p></div>\n\n');

    // 5f. Convertir les citations bibliques avec tiret de référence (« ... » – Réf)
    text = text.replace(/(?:^|\n)«\s*([^»]+?)\s*»\s*([–—\u2013\u2014-]\s*[A-ZÀ-ÿ0-9.:\s-]+)/g, '\n\n<blockquote class="article-bible-quote"><p>« $1 » $2</p></blockquote>\n\n');

    // 5g. Détecter et formater les blocs de notes de bas de page avec ancres de retour [↩︎](#...)
    const backlinkRegex = /\[(?:↩︎|↩)\]\(#[^)]+\)/;
    if (backlinkRegex.test(text)) {
      text = text.replace(/Dans\s+la\s+même\s+série[\s\S]*$/gi, '');
      const segments = text.split(/\[(?:↩︎|↩)\]\(#[^)]+\)/);
      let mainBody = segments[0];
      let firstNote = '';
      
      const fnBoundaryMatch = mainBody.match(/^([\s\S]*[a-zA-ZÀ-ÿ]{2,}[.!?…»])\s+((?:[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-ß]\.?)?\s+[A-ZÀ-ÖØ-ß][a-zà-öø-ÿ]+|[A-ZÀ-ÿ*«]|Ibid)[^\n]*?(?:ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp?\.\s*\d+|p\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit)[\s\S]*)$/i);
      if (fnBoundaryMatch) {
        mainBody = fnBoundaryMatch[1];
        firstNote = fnBoundaryMatch[2];
      }
      
      const notes = [firstNote, ...segments.slice(1, -1)].map(s => s.trim()).filter(s => s.length > 0);
      const trailing = segments[segments.length - 1] || '';
      
      const formattedNotes = notes.map((noteText, idx) => {
        const num = idx + 1;
        const cleanBody = normalizeSuperscripts(noteText.trim());
        return `<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${cleanBody}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>`;
      }).join('\n\n');
      
      text = `${mainBody}\n\n${formattedNotes}\n\n${trailing}`;
    }

    // 5h. Détecter et formater les listes de notes de bas de page numérotées (1. Auteur, Ibid...)
    text = text.replace(/(?:^|\n)(\d+)\.\s+([^\n]+(?:\n(?!\d+\.|\s*#|\s*---|\s*$)[^\n]+)*)/g, (match, num, body) => {
      if (/ibid|éditions|editions|editor|publisher|press|university|chapitre|vol\.|tome|trad\.|pp\.\s*\d+|p\.\s*\d+|19\d\d|20\d\d|op\.\s*cit|loc\.\s*cit/i.test(body)) {
        return `\n\n<div class="article-footnote-item" id="article-fn-${num}"><span class="article-footnote-num">${num}.</span><span class="article-footnote-text">${normalizeSuperscripts(body.trim())}</span> <a href="#article-fnref-${num}" class="article-footnote-backlink" title="Retour au texte">↩</a></div>\n\n`;
      }
      return match;
    });

    // 5i. Normaliser les années, plages de pages et grands nombres en exposant
    text = text.replace(/(pp?\.\s*|[0-9]+[\s-]*)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gi, (match, prefix, sups) => {
      return prefix + normalizeSuperscripts(sups);
    });
    text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]{3,})/g, (match) => {
      return normalizeSuperscripts(match);
    });

    // 5j. Remplacer les vrais appels de note [^9] ou exposants isolés collés au texte (valeur <= 50)
    text = text.replace(/\[\^(\d+)\]/g, (match, num) => {
      return `<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
    });
    text = text.replace(/([a-zA-ZÀ-ÿ»"'\).,;!?])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2})(?!\w)/g, (match, prevChar, sups) => {
      const num = parseInt(normalizeSuperscripts(sups), 10);
      if (num <= 50) {
        return `${prevChar}<sup class="article-fn-badge" id="article-fnref-${num}"><a href="#article-fn-${num}" title="Note ${num}">${num}</a></sup>`;
      }
      return `${prevChar}${num}`;
    });
    // Normaliser tout exposant orphelin restant en chiffre normal
    text = text.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (match) => normalizeSuperscripts(match));
    // Supprimer les espaces indésirables entre l'appel de note et la ponctuation suivante
    text = text.replace(/<\/sup>\s+([.,;:!?])/g, '</sup>$1');

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
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Rétablir les balises HTML injectées (dialogues, callouts, tables, blockquotes, notes, badges)
      .replace(/&lt;(\/?(?:div|table|thead|tbody|tr|th|td|blockquote|p|sup|span|a)(?:\s+[a-zA-Z0-9_\-]+="[^"]*")*)(\s*\/)?&gt;/gi, '<$1$2>')
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
      .replace(/^---\s*$/gim, '<div class="article-ornamental-divider"><span class="article-ornamental-divider-icon">❦</span></div>')
      .replace(/\n\n+/gim, '</p><p>')
      .replace(/\n/gim, '<br>');

    // 11. Détection et liaisonnement des références bibliques (ex: 1 Corinthiens 1.2, 1 Pierre 5.10, Romains 3.22-23)
    if (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences) {
      html = TheologyView.highlightScriptureReferences(html);
    }

    return `<div class="article-markdown-body"><p>${html}</p></div>`;
  },

  async loadDrawerArticles(bookCode, chapter) {
    const listEl = document.getElementById('drawer-articles-list');
    const badgeEl = document.getElementById('lbl-drawer-articles-passage');
    if (!listEl) return;

    if (badgeEl) {
      badgeEl.textContent = `${bookCode || 'Gen'} ${chapter || 1}`;
    }

    listEl.innerHTML = `<div class="articles-loading-state" style="padding: 20px;"><div class="spinner-sm"></div><span>Recherche des articles associés...</span></div>`;

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
                ${this.escapeHtml(art.source_name || art.source_id)}
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
          App.switchView('articles');
          ArticlesView.openArticle(artId);
        });
      });
    } catch (e) {
      console.error('[ArticlesView] Erreur loadDrawerArticles:', e);
      listEl.innerHTML = `<p class="empty-hint">Erreur de chargement des articles.</p>`;
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
