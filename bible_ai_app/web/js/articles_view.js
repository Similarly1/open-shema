/**
 * Articles & Blogs View Manager
 * Gère l'affichage, la recherche, le filtrage par source/verset et la lecture des articles de blogs théologiques.
 */

const ArticlesView = {
  currentSourceFilter: 'ALL',
  currentSearchQuery: '',
  selectedArticleId: null,
  articles: [],
  sources: [],
  isSyncing: false,

  init() {
    this.bindEvents();
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
      const refs = art.scripture_references || [];

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
          <div class="article-card-header">
            <span class="article-source-badge" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color}40;">
              ${this.escapeHtml(art.source_name || art.source_id)}
            </span>
            <span class="article-pub-date">${pubDate}</span>
          </div>

          <h3 class="article-card-title">${this.escapeHtml(art.title)}</h3>
          
          <div class="article-card-author">
            Par <strong>${this.escapeHtml(art.author || 'Auteur inconnu')}</strong>
          </div>

          <p class="article-card-summary">${this.escapeHtml(art.summary || 'Cliquez pour lire l\'intégralité de cet article...')}</p>

          ${refsHtml}
        </div>
      `;
    });

    container.innerHTML = html;

    // Clic pour ouvrir un article
    container.querySelectorAll('.article-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Si clic direct sur un badge biblique, ouvrir dans la Bible
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
    const metaEl = document.getElementById('article-reader-meta');
    const extLink = document.getElementById('article-reader-external-link');

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
      if (titleEl) titleEl.textContent = art.title;
      if (metaEl) {
        metaEl.innerHTML = `
          <span>Source : <strong>${this.escapeHtml(art.source_name)}</strong></span> • 
          <span>Auteur : <strong>${this.escapeHtml(art.author || 'Anonyme')}</strong></span> • 
          <span>Publié le : <strong>${this.formatDate(art.published_at)}</strong></span>
        `;
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

      // Rendu Markdown en HTML propre
      if (contentEl) {
        contentEl.innerHTML = this.renderMarkdown(res.content_markdown || art.summary || '');
      }

      // Scroller en haut
      const scrollParent = document.getElementById('view-articles');
      if (scrollParent) scrollParent.scrollTop = 0;

    } catch (e) {
      console.error('[ArticlesView] Erreur lecture article:', e);
      if (contentEl) contentEl.innerHTML = `<div class="articles-error-state">Erreur lors de l'affichage.</div>`;
    }
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
    
    // Nettoyer les métadonnées de tête redondantes
    let text = md.replace(/^#\s+.*\n/g, ''); // Enlève le premier titre H1 car affiché dans le header

    // Remplacement basique Markdown vers HTML fluide
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
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>');

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
        html += `
          <div class="article-card" style="padding: 12px 14px; margin-bottom: 8px;" data-article-id="${art.id}">
            <div class="article-card-header" style="margin-bottom: 6px;">
              <span class="article-source-badge" style="background-color: ${color}20; color: ${color}; border: 1px solid ${color}40; font-size: 10px;">
                ${this.escapeHtml(art.source_name || art.source_id)}
              </span>
              <span class="article-pub-date" style="font-size: 10px;">${this.formatDate(art.published_at)}</span>
            </div>
            <h4 style="font-size: 13px; font-weight: 600; margin: 0 0 6px 0; color: var(--text-primary); line-height: 1.3;">
              ${this.escapeHtml(art.title)}
            </h4>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">
              Par ${this.escapeHtml(art.author || 'Auteur')}
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
