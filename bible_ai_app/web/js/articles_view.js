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
    let fontStack = `'${this.readingOpts.fontFamily}', Georgia, serif`;
    if (this.readingOpts.fontFamily === 'Inter') {
      fontStack = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    }
    container.style.fontFamily = fontStack;

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
        btn.classList.toggle('active', btn.dataset.font === this.readingOpts.fontFamily);
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
    if (rawAuthor.includes('@')) {
      const user = rawAuthor.split('@')[0].replace('.', ' ');
      return user.charAt(0).toUpperCase() + user.slice(1);
    }
    return rawAuthor;
  },

  filterMainCategories(tagsList) {
    if (!tagsList || tagsList.length === 0) return [];
    // Prioriser les catégories majeures (débutant par une majuscule) et limiter à 4 max
    const uppercaseTags = tagsList.filter(t => t && t[0] === t[0].toUpperCase());
    const result = uppercaseTags.length > 0 ? uppercaseTags : tagsList;
    return result.slice(0, 4);
  },

  async loadArticles() {
    const listContainer = document.getElementById('articles-grid-container');
    const emptyContainer = document.getElementById('articles-empty-state');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="articles-loading-state">
        <div class="spinner-sm"></div>
        <span>Chargement des articles...</span>
      </div>
    `;

    try {
      const sourceParam = this.currentSourceFilter === 'ALL' ? null : this.currentSourceFilter;
      this.articles = await API.call('get_articles', sourceParam, null, null, this.currentSearchQuery, 60, 0) || [];

      if (!this.articles || this.articles.length === 0) {
        listContainer.innerHTML = '';
        emptyContainer?.classList.remove('hidden');
        return;
      }

      emptyContainer?.classList.add('hidden');
      this.renderArticlesGrid(this.articles);
    } catch (e) {
      console.error('[ArticlesView] Erreur chargement articles:', e);
      listContainer.innerHTML = `<div class="articles-error-state">Erreur lors de la récupération des articles.</div>`;
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
                📖 ${this.escapeHtml(r.raw_ref || `${r.book_code} ${r.chapter}`)}
              </span>
            `).join('')}
            ${refs.length > 4 ? `<span class="scripture-badge-more">+${refs.length - 4}</span>` : ''}
          </div>
        `;
      }

      html += `
        <div class="article-card" data-article-id="${art.id}">
          ${thumbHtml}

          <div class="article-card-content">
            <div class="article-card-header">
              <span class="article-source-badge" style="background-color: ${color}18; color: ${color}; border: 1px solid ${color}35;">
                ${this.escapeHtml(art.source_name || art.source_id)}
              </span>
              <span class="article-pub-date">${pubDate}</span>
            </div>

            <h3 class="article-card-title">${this.escapeHtml(art.title)}</h3>
            
            ${tagsHtml}

            <div class="article-card-author-row">
              ${authorAvatarHtml}
              <span class="article-card-author">Par <strong>${this.escapeHtml(author)}</strong></span>
            </div>

            <p class="article-card-summary">${this.escapeHtml(art.summary || 'Cliquez pour lire l\'intégralité de cet article...')}</p>

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

    if (viewList) viewList.classList.add('hidden');
    if (viewReader) viewReader.classList.remove('hidden');

    if (contentEl) {
      contentEl.innerHTML = `<div class="articles-loading-state"><div class="spinner-sm"></div><span>Chargement de l'article...</span></div>`;
    }

    try {
      const res = await API.call('get_article_content', articleId);
      if (!res || !res.success || !res.article) {
        if (contentEl) contentEl.innerHTML = `<div class="articles-error-state">Impossible de charger l'article.</div>`;
        return;
      }

      const art = res.article;
      const author = this.formatAuthor(art.author);

      if (titleEl) titleEl.textContent = art.title;

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
      const leadText = art.lead_summary || art.summary || '';
      if (leadText && leadEl) {
        leadEl.textContent = leadText;
        leadEl.classList.remove('hidden');
      } else if (leadEl) {
        leadEl.classList.add('hidden');
      }

      // 4. Badges thématiques
      const mainTags = this.filterMainCategories(art.tags_list || []);
      if (tagsEl) {
        if (mainTags.length > 0) {
          tagsEl.innerHTML = mainTags.map(t => `<span class="article-topic-tag" data-tag="${this.escapeHtml(t)}">${this.escapeHtml(t)}</span>`).join('');
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
      const mdRaw = res.content_markdown || art.summary || '';
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
      }

      // Calcul des statistiques de lecture (mots & temps)
      this.updateReadingStats(mdRaw);

      // Appliquer les préférences de lecture actuelles
      this.applyReadingOptions();

      // Scroller en haut du container
      const scrollParent = document.getElementById('view-articles');
      if (scrollParent) scrollParent.scrollTop = 0;

    } catch (e) {
      console.error('[ArticlesView] Erreur lecture article:', e);
      if (contentEl) contentEl.innerHTML = `<div class="articles-error-state">Erreur lors de l'affichage.</div>`;
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

  closeArticleReader() {
    const viewList = document.getElementById('articles-list-section');
    const viewReader = document.getElementById('articles-reader-section');
    if (viewReader) viewReader.classList.add('hidden');
    if (viewList) viewList.classList.remove('hidden');
    this.selectedArticleId = null;
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
    
    let text = md;

    // 1. Nettoyer les résidus de lecteur ElevenLabs audio
    text = text.replace(/Loading\s+the[\s\S]*?AudioNative\s+Player\.\.\./gi, '');
    text = text.replace(/Loading\s+the[\s\S]*?Elevenlabs[^\n]*\n*/gi, '');
    text = text.replace(/AudioNative\s+Player\.\.\./gi, '');

    // 2. Nettoyer les blocs promotionnels et parcours e-mail de fin d'article
    text = text.replace(/(?:#+\s*)?Parcours\s+e-?mail[\s\S]*$/gi, '');
    text = text.replace(/Pour\s+aller\s+plus\s+loin,\s+inscris-toi[\s\S]*$/gi, '');
    text = text.replace(/(?:#+\s*)?Inscrivez-vous\s+à\s+notre\s+newsletter[\s\S]*$/gi, '');

    // 3. Nettoyer tout bloc d'en-tête redondant (titre, auteur, source, date dupliqués)
    text = text.replace(/^(#\s+[^\n]+\n+)?/gi, '');
    text = text.replace(/^(\*\*(?:Auteur|Source|Date)\s*:\*\*[^\n]*\n*|Auteur\s*:[^\n]*\n*|Source\s*:[^\n]*\n*|Date\s*:[^\n]*\n*|---\n*)+/gim, '');

    // 4. Nettoyer les émojis décoratifs pour une mise en page typographique sobre
    text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/gu, '');

    // 5. Nettoyer les séparateurs multiples ou en fin d'article
    text = text.replace(/---\s*$/gi, '');

    // 6. Remplacement Markdown vers HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gim, '<h3 class="article-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="article-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="article-h1">$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote class="article-quote">$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" class="article-link">$1</a>')
      .replace(/^---\s*$/gim, '<div class="article-ornamental-divider"><span class="article-ornamental-divider-icon">❦</span></div>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>');

    // 7. Détection et liaisonnement des références bibliques (ex: 1 Corinthiens 1.2, 1 Pierre 5.10, Romains 3.22-23)
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
