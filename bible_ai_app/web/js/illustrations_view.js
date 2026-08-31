/**
 * IllustrationsView
 * Gère le réservoir et la banque centrale d'illustrations (Starter Pack de 1000 - 1500 fiches).
 * Mode Consultation propre par défaut (Markdown enrichi, callouts homilétiques, versets navigables),
 * et Mode Édition à la demande.
 */

const IllustrationsView = {
  illustrations: [],
  filteredIllustrations: [],
  currentIllustration: null,
  isEditMode: false,
  isNew: false,
  activeCategory: 'all',
  activeType: 'all',
  activeStatus: 'all',
  searchQuery: '',

  // Éléments DOM
  container: null,
  searchInput: null,
  btnClearSearch: null,
  lblCount: null,
  modal: null,

  init() {
    this.container = document.getElementById('illustrations-cards-container');
    this.searchInput = document.getElementById('illustrations-search-input');
    this.btnClearSearch = document.getElementById('btn-clear-illustrations-search');
    this.lblCount = document.getElementById('lbl-illustrations-count');
    this.modal = document.getElementById('illustration-detail-modal');

    this.bindEvents();
  },

  bindEvents() {
    // 1. Recherche
    this.searchInput?.addEventListener('input', () => {
      this.searchQuery = (this.searchInput.value || '').trim();
      this.btnClearSearch?.classList.toggle('hidden', !this.searchQuery);
      this.applyFilters();
    });

    this.btnClearSearch?.addEventListener('click', () => {
      if (this.searchInput) this.searchInput.value = '';
      this.searchQuery = '';
      this.btnClearSearch.classList.add('hidden');
      this.applyFilters();
    });

    // 2. Filtres par catégorie
    document.querySelectorAll('.ill-category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.ill-category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeCategory = pill.dataset.category || 'all';
        this.applyFilters();
      });
    });

    // 3. Filtres par type / genre
    document.querySelectorAll('.ill-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ill-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeType = btn.dataset.type || 'all';
        this.applyFilters();
      });
    });

    // 4. Filtres par statut d'utilisation
    document.querySelectorAll('.ill-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ill-status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeStatus = btn.dataset.status || 'all';
        this.applyFilters();
      });
    });

    // 5. Actions d'en-tête
    document.getElementById('btn-open-illustrations-folder')?.addEventListener('click', () => {
      API.openIllustrationsFolder();
    });

    document.getElementById('btn-new-illustration')?.addEventListener('click', () => {
      this.openModal({
        id: `ill-${Date.now()}`,
        title: '',
        category: 'Grâce & Salut',
        type: 'Histoire vraie',
        passages_associes: [],
        author: '',
        body: '',
        usage_history: [],
        _isNew: true
      }, true);
    });

    // 6. Modale : actions communes & bascule de mode
    document.getElementById('btn-close-illustration-modal')?.addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('btn-switch-to-edit')?.addEventListener('click', () => {
      this.switchToEditMode();
    });

    document.getElementById('btn-cancel-edit-illustration')?.addEventListener('click', () => {
      this.cancelEdit();
    });

    document.getElementById('btn-save-illustration')?.addEventListener('click', () => {
      this.saveCurrentModal();
    });

    document.getElementById('btn-delete-illustration')?.addEventListener('click', () => {
      this.deleteCurrentModal();
    });

    document.getElementById('btn-copy-illustration-text')?.addEventListener('click', () => {
      this.copyCurrentIllustrationText();
    });

    document.getElementById('btn-insert-illustration-to-sermon')?.addEventListener('click', () => {
      this.insertCurrentIntoSermon();
    });
  },

  pageSize: 30,
  currentPage: 1,
  totalCount: 0,
  hasMore: false,
  isLoading: false,
  searchDebounceTimer: null,
  observer: null,

  async onViewActivated() {
    if (!this.illustrations || this.illustrations.length === 0) {
      await this.loadFirstPage();
    }
  },

  showLoading() {
    if (this.lblCount && (!this.illustrations || this.illustrations.length === 0)) {
      this.lblCount.innerHTML = `<span class="synth-spinner" style="width: 10px; height: 10px; border-width: 1.5px; display: inline-block; vertical-align: middle; margin-right: 5px; border-top-color: var(--accent-amber, #f59e0b);"></span> Chargement...`;
    }
    if (this.container && (!this.illustrations || this.illustrations.length === 0)) {
      this.container.innerHTML = `
        <div style="padding: 70px 24px; text-align: center; color: var(--text-muted); width: 100%; grid-column: 1 / -1;">
          <div class="synth-spinner" style="width: 32px; height: 32px; border-width: 3px; margin: 0 auto 16px auto; border-top-color: var(--accent-amber, #f59e0b);"></div>
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">Chargement des illustrations...</div>
          <div style="font-size: 12.5px; opacity: 0.75;">Récupération du premier lot de 30 fiches</div>
        </div>
      `;
    }
  },

  applyFilters() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.loadFirstPage();
    }, 120);
  },

  async loadFirstPage() {
    this.currentPage = 1;
    this.isLoading = true;
    this.showLoading();

    try {
      const res = await API.getIllustrationsPage({
        page: 1,
        pageSize: this.pageSize,
        query: this.searchQuery,
        category: this.activeCategory,
        type: this.activeType,
        status: this.activeStatus
      });

      this.illustrations = Array.isArray(res.items) ? res.items : [];
      this.totalCount = res.total || 0;
      this.hasMore = Boolean(res.has_more);
      this.isLoading = false;
      this.render();
    } catch (e) {
      console.error('Erreur chargement page illustrations:', e);
      this.isLoading = false;
      if (this.container) {
        this.container.innerHTML = `
          <div style="padding: 50px 24px; text-align: center; color: var(--text-danger, #ef4444); width: 100%; grid-column: 1 / -1;">
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 6px;">Erreur de chargement du réservoir</div>
            <div style="font-size: 13px; opacity: 0.85;">${e.message || e}</div>
          </div>
        `;
      }
    }
  },

  async loadMore() {
    if (this.isLoading || !this.hasMore) return;

    this.isLoading = true;
    const nextPage = this.currentPage + 1;

    const btnLoadMore = document.getElementById('btn-load-more-illustrations');
    if (btnLoadMore) {
      btnLoadMore.disabled = true;
      btnLoadMore.innerHTML = `<span class="synth-spinner" style="width: 12px; height: 12px; border-width: 1.5px; border-top-color: var(--text-primary); display: inline-block;"></span> <span>Chargement du lot suivant...</span>`;
    }

    try {
      const res = await API.getIllustrationsPage({
        page: nextPage,
        pageSize: this.pageSize,
        query: this.searchQuery,
        category: this.activeCategory,
        type: this.activeType,
        status: this.activeStatus
      });

      const newItems = Array.isArray(res.items) ? res.items : [];
      this.currentPage = nextPage;
      this.illustrations = [...this.illustrations, ...newItems];
      this.totalCount = res.total || this.totalCount;
      this.hasMore = Boolean(res.has_more);
      this.isLoading = false;

      const grid = document.getElementById('illustrations-grid-cards');
      if (grid && newItems.length > 0) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newItems.map(ill => this.renderCardHtml(ill)).join('');

        while (tempDiv.firstChild) {
          grid.appendChild(tempDiv.firstChild);
        }

        this.bindCardEvents();
        this.updateHeaderCount();
        this.updateFooter();
      } else {
        this.render();
      }
    } catch (e) {
      console.error('Erreur chargement lot supplémentaire:', e);
      this.isLoading = false;
      if (btnLoadMore) {
        btnLoadMore.disabled = false;
        btnLoadMore.textContent = 'Réessayer de charger';
      }
    }
  },

  updateHeaderCount() {
    if (!this.lblCount) return;
    const showing = this.illustrations.length;
    const total = this.totalCount;

    if (this.searchQuery || this.activeCategory !== 'all' || this.activeType !== 'all' || this.activeStatus !== 'all') {
      this.lblCount.textContent = `${showing} sur ${total.toLocaleString('fr-FR')} ${total > 1 ? 'résultats' : 'résultat'}`;
    } else {
      this.lblCount.textContent = total > this.pageSize 
        ? `${showing} sur ${total.toLocaleString('fr-FR')} fiches` 
        : `${total} ${total > 1 ? 'illustrations' : 'illustration'}`;
    }
  },

  updateFooter() {
    const paginationFooter = document.getElementById('ill-pagination-footer');
    if (!this.hasMore) {
      if (this.observer) this.observer.disconnect();
      paginationFooter?.remove();
    } else {
      const remaining = this.totalCount - this.illustrations.length;
      const nextBatch = Math.min(this.pageSize, remaining);
      const btnLoadMore = document.getElementById('btn-load-more-illustrations');
      if (btnLoadMore) {
        btnLoadMore.disabled = false;
        btnLoadMore.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
          <span>Charger +${nextBatch} illustrations (${this.illustrations.length} / ${this.totalCount.toLocaleString('fr-FR')})</span>
        `;
      }
    }
  },

  renderCardHtml(ill) {
    const type = ill.type || 'Histoire vraie';
    let typeClass = 'type-story';
    if (type.includes('Histoire')) typeClass = 'type-history';
    else if (type.includes('Citation')) typeClass = 'type-quote';
    else if (type.includes('Science')) typeClass = 'type-science';

    const history = ill.usage_history || [];
    const isUsed = history.length > 0;
    const usageText = isUsed ? `Prêchée (${history.length}x)` : 'Jamais prêchée';
    const usageClass = isUsed ? 'used' : '';

    const passages = Array.isArray(ill.passages_associes) ? ill.passages_associes.join(', ') : (ill.passages_associes || '');
    const author = ill.author ? ill.author : (ill.category || 'Général');
    const preview = ill.preview || (ill.body || ill.content || '').replace(/^[#>-]+\s*/gm, '').slice(0, 180).trim();

    return `
      <article class="illustration-card" data-ill-id="${ill.id}">
        <div class="ill-card-top">
          <span class="ill-card-badge ${typeClass}">${this.escapeHtml(type)}</span>
          <span class="ill-card-usage-pill ${usageClass}">${usageText}</span>
        </div>
        <div class="ill-card-title">${this.escapeHtml(ill.title || 'Sans titre')}</div>
        <div class="ill-card-preview">${this.escapeHtml(preview)}</div>
        <div class="ill-card-footer">
          <span class="ill-card-author">${this.escapeHtml(author)}</span>
          ${passages ? `<span class="ill-card-passage">${this.escapeHtml(passages)}</span>` : ''}
        </div>
      </article>
    `;
  },

  render() {
    this.updateHeaderCount();
    if (!this.container) return;

    if (this.illustrations.length === 0) {
      this.container.innerHTML = `
        <div style="padding: 48px 24px; text-align: center; color: var(--text-muted); width: 100%; grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/>
            <path d="M9 18h6"/><path d="M10 22h4"/>
          </svg>
          <div style="font-size: 14.5px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Aucune illustration correspondante</div>
          <div style="font-size: 12.5px;">Essayez d'autres mots-clés ou réinitialisez les filtres.</div>
        </div>
      `;
      return;
    }

    const cardsHtml = this.illustrations.map(ill => this.renderCardHtml(ill)).join('');

    let footerHtml = '';
    if (this.hasMore) {
      const remaining = this.totalCount - this.illustrations.length;
      const nextBatch = Math.min(this.pageSize, remaining);
      footerHtml = `
        <div id="ill-pagination-footer" style="padding: 28px 0 40px 0; text-align: center; width: 100%; grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <button id="btn-load-more-illustrations" class="btn-secondary" style="padding: 9px 24px; font-size: 13px; font-weight: 600; border-radius: 20px; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.15s ease;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
            <span>Charger +${nextBatch} illustrations (${this.illustrations.length} / ${this.totalCount.toLocaleString('fr-FR')})</span>
          </button>
          <div id="ill-sentinel-loader" style="height: 20px; width: 100%;"></div>
        </div>
      `;
    }

    this.container.innerHTML = `<div class="illustrations-grid" id="illustrations-grid-cards" style="width: 100%;">${cardsHtml}</div>${footerHtml}`;

    this.bindCardEvents();
    this.bindPaginationEvents();
  },

  bindCardEvents() {
    this.container.querySelectorAll('.illustration-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.illId;
        const ill = this.illustrations.find(i => i.id === id);
        if (ill) this.openModal(ill, false);
      });
    });
  },

  bindPaginationEvents() {
    const btnLoadMore = document.getElementById('btn-load-more-illustrations');
    btnLoadMore?.addEventListener('click', () => {
      this.loadMore();
    });

    const sentinel = document.getElementById('ill-sentinel-loader');
    if (sentinel && window.IntersectionObserver) {
      if (this.observer) this.observer.disconnect();
      this.observer = new IntersectionObserver((entries) => {
        if (entries[0] && entries[0].isIntersecting && !this.isLoading && this.hasMore) {
          this.loadMore();
        }
      }, { rootMargin: '350px' });
      this.observer.observe(sentinel);
    }
  },

  async openModal(ill, isEdit = false) {
    this.currentIllustration = JSON.parse(JSON.stringify(ill));
    this.isNew = Boolean(ill._isNew);

    if (isEdit) {
      this.showEditMode();
    } else {
      this.showViewMode();
    }

    if (this.modal) this.modal.classList.remove('hidden');

    // Si le corps complet n'est pas encore chargé (fiche paginée légère), récupération instantanée du texte complet
    if (!this.isNew && (!this.currentIllustration.body || this.currentIllustration.body.length <= 220)) {
      try {
        const fullIll = await API.getIllustration(ill.id);
        if (fullIll && this.currentIllustration && this.currentIllustration.id === ill.id) {
          this.currentIllustration = { ...this.currentIllustration, ...fullIll };
          if (isEdit) {
            this.showEditMode();
          } else {
            this.showViewMode();
          }
        }
      } catch (e) {
        console.warn('Erreur chargement texte intégral illustration:', e);
      }
    }
  },

  openViewModal(ill) {
    this.openModal(ill, false);
  },

  openEditModal(ill) {
    this.openModal(ill, true);
  },

  showViewMode() {
    this.isEditMode = false;
    const ill = this.currentIllustration;
    if (!ill) return;

    // Badges en-tête
    const typeBadge = document.getElementById('ill-modal-type-badge');
    const catBadge = document.getElementById('ill-modal-category-badge');
    const modalTitle = document.getElementById('ill-modal-title');

    if (typeBadge) {
      typeBadge.textContent = ill.type || 'Histoire vraie';
      typeBadge.className = 'ill-modal-badge';
      const t = ill.type || '';
      if (t.includes('Histoire')) typeBadge.classList.add('type-history');
      else if (t.includes('Citation')) typeBadge.classList.add('type-quote');
      else if (t.includes('Science')) typeBadge.classList.add('type-science');
    }

    if (catBadge) {
      catBadge.textContent = ill.category || 'Général';
    }

    if (modalTitle) {
      modalTitle.textContent = ill.title ? ill.title : 'Sans titre';
    }

    // Rendu corps de l'illustration
    const viewBody = document.getElementById('ill-view-body');
    if (viewBody) {
      viewBody.innerHTML = this.renderMarkdown(ill.body || ill.content || '');
    }

    // Métadonnées latérales
    const viewTheme = document.getElementById('ill-view-theme');
    if (viewTheme) viewTheme.textContent = ill.category || 'Général';

    const viewType = document.getElementById('ill-view-type');
    if (viewType) viewType.textContent = ill.type || 'Histoire vraie';

    // Passages bibliques cliquables
    const passagesList = document.getElementById('ill-view-passages-list');
    const passagesBox = document.getElementById('ill-view-passages-box');
    if (passagesList) {
      const raw = ill.passages_associes;
      const list = Array.isArray(raw) ? raw : (raw ? String(raw).split(',').map(s => s.trim()).filter(Boolean) : []);
      
      if (list.length === 0) {
        passagesList.innerHTML = '<span class="text-muted" style="font-size: 11.5px; font-style: italic;">Aucun passage lié</span>';
      } else {
        passagesList.innerHTML = list.map(ref => `
          <button class="ill-passage-pill" data-ref="${this.escapeHtml(ref)}" title="Ouvrir ${this.escapeHtml(ref)} dans le lecteur biblique">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>${this.escapeHtml(ref)}</span>
          </button>
        `).join('');

        // Navigation vers le passage biblique au clic
        passagesList.querySelectorAll('.ill-passage-pill').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ref = btn.dataset.ref;
            if (ref && typeof BibleReader !== 'undefined' && BibleReader.navigateTo) {
              BibleReader.navigateTo(ref);
              this.closeModal();
              if (typeof App !== 'undefined' && App.switchView) {
                App.switchView('bible-reader');
              }
            }
          });
        });
      }
    }

    // Source / Auteur
    const viewAuthor = document.getElementById('ill-view-author');
    if (viewAuthor) {
      viewAuthor.textContent = ill.author ? ill.author : 'Auteur non spécifié / Tradition';
    }

    // Historique d'utilisations
    const viewHistoryList = document.getElementById('ill-view-history-list');
    if (viewHistoryList) {
      const history = ill.usage_history || [];
      if (history.length === 0) {
        viewHistoryList.innerHTML = '<span class="text-muted" style="font-size: 11px;">Jamais prêchée à ce jour.</span>';
      } else {
        viewHistoryList.innerHTML = history.map(h => `
          <div class="ill-history-item">
            <strong>${this.escapeHtml(h.church || 'Église')}</strong> • ${this.escapeHtml(h.date || '')}
            ${h.sermon_title ? `<br><em style="color: var(--text-muted); font-size: 10px;">${this.escapeHtml(h.sermon_title)}</em>` : ''}
          </div>
        `).join('');
      }
    }

    // Visibilité des containers
    document.getElementById('ill-modal-view-mode')?.classList.remove('hidden');
    document.getElementById('ill-modal-edit-mode')?.classList.add('hidden');
    document.getElementById('ill-footer-view-actions')?.classList.remove('hidden');
    document.getElementById('ill-footer-edit-actions')?.classList.add('hidden');

    const btnDelete = document.getElementById('btn-delete-illustration');
    if (btnDelete) btnDelete.classList.toggle('hidden', this.isNew);
  },

  showEditMode() {
    this.isEditMode = true;
    const ill = this.currentIllustration || {};

    const inputTitle = document.getElementById('ill-input-title');
    const inputBody = document.getElementById('ill-input-body');
    const selectCategory = document.getElementById('ill-input-category');
    const selectType = document.getElementById('ill-input-type');
    const inputPassages = document.getElementById('ill-input-passages');
    const inputAuthor = document.getElementById('ill-input-author');
    const modalTitle = document.getElementById('ill-modal-title');
    const historyList = document.getElementById('ill-modal-history-list');

    if (inputTitle) inputTitle.value = ill.title || '';
    if (inputBody) inputBody.value = ill.body || ill.content || '';
    if (selectCategory) selectCategory.value = ill.category || 'Grâce & Salut';
    if (selectType) selectType.value = ill.type || 'Histoire vraie';
    if (inputPassages) {
      inputPassages.value = Array.isArray(ill.passages_associes) ? ill.passages_associes.join(', ') : (ill.passages_associes || '');
    }
    if (inputAuthor) inputAuthor.value = ill.author || '';
    if (modalTitle) modalTitle.textContent = this.isNew ? 'Nouvelle illustration' : 'Modifier l\'illustration';

    // Historique
    if (historyList) {
      const history = ill.usage_history || [];
      if (history.length === 0) {
        historyList.innerHTML = '<span class="text-muted" style="font-size: 11px;">Jamais prêchée à ce jour.</span>';
      } else {
        historyList.innerHTML = history.map(h => `
          <div class="ill-history-item">
            <strong>${this.escapeHtml(h.church || 'Église')}</strong> • ${this.escapeHtml(h.date || '')}
            ${h.sermon_title ? `<br><em style="color: var(--text-muted); font-size: 10px;">${this.escapeHtml(h.sermon_title)}</em>` : ''}
          </div>
        `).join('');
      }
    }

    // Visibilité des containers
    document.getElementById('ill-modal-view-mode')?.classList.add('hidden');
    document.getElementById('ill-modal-edit-mode')?.classList.remove('hidden');
    document.getElementById('ill-footer-view-actions')?.classList.add('hidden');
    document.getElementById('ill-footer-edit-actions')?.classList.remove('hidden');

    const btnDelete = document.getElementById('btn-delete-illustration');
    if (btnDelete) btnDelete.classList.toggle('hidden', this.isNew);
  },

  switchToEditMode() {
    this.showEditMode();
  },

  cancelEdit() {
    if (this.isNew) {
      this.closeModal();
    } else {
      this.showViewMode();
    }
  },

  closeModal() {
    if (this.modal) this.modal.classList.add('hidden');
    this.currentIllustration = null;
    this.isEditMode = false;
    this.isNew = false;
  },

  async saveCurrentModal() {
    if (!this.currentIllustration) return;

    const inputTitle = document.getElementById('ill-input-title');
    const inputBody = document.getElementById('ill-input-body');
    const selectCategory = document.getElementById('ill-input-category');
    const selectType = document.getElementById('ill-input-type');
    const inputPassages = document.getElementById('ill-input-passages');
    const inputAuthor = document.getElementById('ill-input-author');

    const passagesRaw = (inputPassages?.value || '').split(',').map(p => p.trim()).filter(Boolean);

    const payload = {
      id: this.currentIllustration.id || `ill-${Date.now()}`,
      title: (inputTitle?.value || '').trim() || 'Sans titre',
      category: selectCategory?.value || 'Général',
      type: selectType?.value || 'Histoire vraie',
      passages_associes: passagesRaw,
      author: (inputAuthor?.value || '').trim(),
      body: inputBody?.value || '',
      usage_history: this.currentIllustration.usage_history || []
    };

    try {
      const res = await API.saveIllustration(payload);
      if (res && res.success !== false) {
        this.currentIllustration = payload;
        this.isNew = false;
        this.showViewMode();
        await this.loadIllustrations();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Illustration enregistrée avec succès !");
        }
      }
    } catch (e) {
      console.error('Erreur sauvegarde illustration:', e);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Erreur lors de l'enregistrement de l'illustration", "error");
      }
    }
  },

  async deleteCurrentModal() {
    if (!this.currentIllustration?.id) return;
    const title = this.currentIllustration.title || 'cette fiche';
    let confirmed = false;
    if (typeof App !== 'undefined' && App.showConfirmModal) {
      confirmed = await App.showConfirmModal({
        title: "Supprimer l'illustration",
        message: `Voulez-vous supprimer définitivement l'illustration "${title}" ?`,
        confirmText: "Supprimer",
        cancelText: "Annuler",
        danger: true,
        icon: "trash"
      });
    } else {
      confirmed = confirm(`Supprimer définitivement l'illustration "${title}" ?`);
    }

    if (!confirmed) return;

    try {
      await API.deleteIllustration(this.currentIllustration.id);
      this.closeModal();
      await this.loadIllustrations();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Illustration supprimée.");
      }
    } catch (e) {
      console.error('Erreur suppression illustration:', e);
    }
  },

  copyCurrentIllustrationText() {
    const ill = this.currentIllustration;
    if (!ill) return;

    const title = ill.title || '';
    const body = ill.body || ill.content || '';
    const author = ill.author ? `\n\n— *${ill.author}*` : '';
    const passages = Array.isArray(ill.passages_associes) && ill.passages_associes.length > 0 
      ? `\n\nPassages associés : ${ill.passages_associes.join(', ')}` 
      : (ill.passages_associes ? `\n\nPassages associés : ${ill.passages_associes}` : '');

    const text = `**${title}**\n\n${body}${author}${passages}`;
    navigator.clipboard.writeText(text.trim());

    const btn = document.getElementById('btn-copy-illustration-text');
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Copié !</span>
      `;
      setTimeout(() => { btn.innerHTML = origHtml; }, 1600);
    }
  },

  insertCurrentIntoSermon() {
    const ill = this.currentIllustration;
    if (!ill) return;

    const title = ill.title || 'Illustration';
    const body = ill.body || ill.content || '';
    const author = ill.author || '';

    const blockHtml = `
      <div class="sermon-callout-block sermon-block-illustration" data-block-type="illustration">
        <div class="sermon-block-header">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
          <span>Illustration : ${this.escapeHtml(title)}</span>
          ${author ? `<span style="font-weight: normal; opacity: 0.8;">(${this.escapeHtml(author)})</span>` : ''}
        </div>
        <p>${this.escapeHtml(body).replace(/\n/g, '<br>')}</p>
      </div>
      <p><br></p>
    `;

    if (typeof SermonsView !== 'undefined' && SermonsView.insertHtmlIntoActiveSection) {
      SermonsView.insertHtmlIntoActiveSection(blockHtml);
    }

    this.closeModal();
    if (typeof App !== 'undefined' && App.switchView) {
      App.switchView('sermon-editor');
      if (App.showToast) {
        App.showToast("Illustration insérée dans la prédication !");
      }
    }
  },

  renderMarkdown(md) {
    if (!md || !md.trim()) {
      return '<p class="text-muted" style="font-style: italic; padding: 12px 0;">Aucun texte rédigé pour cette illustration.</p>';
    }

    let text = String(md).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Découpage en blocs de paragraphes
    const rawBlocks = text.split(/\n\s*\n+/);

    const renderedBlocks = rawBlocks.map(block => {
      let b = block.trim();
      if (!b) return '';

      // A. Titre markdown (# ## ###)
      if (/^###\s+(.+)$/m.test(b)) {
        return `<h4 class="ill-view-h4">${this.renderInline(b.replace(/^###\s+/, ''))}</h4>`;
      }
      if (/^##\s+(.+)$/m.test(b)) {
        return `<h3 class="ill-view-h3">${this.renderInline(b.replace(/^##\s+/, ''))}</h3>`;
      }
      if (/^#\s+(.+)$/m.test(b)) {
        return `<h3 class="ill-view-h3">${this.renderInline(b.replace(/^#\s+/, ''))}</h3>`;
      }

      // B. Citation ou Leçon homilétique (> ...)
      if (b.startsWith('>')) {
        const cleanContent = b.replace(/^>\s*/gm, '').trim();
        
        // Détection de "Leçon homilétique", "Application", "Principe"
        const homileticMatch = cleanContent.match(/^\*\*(?:Leçon(?: homilétique)?|Application|Principe|Morale)\s*:?\*\*\s*:?\s*([\s\S]*)$/i);
        if (homileticMatch) {
          const bodyText = homileticMatch[1] ? this.renderInline(homileticMatch[1]) : '';
          return `
            <div class="ill-homiletic-callout">
              <div class="ill-callout-header">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                <span>Leçon homilétique & Application</span>
              </div>
              <div class="ill-callout-body">${bodyText.replace(/\n/g, '<br>')}</div>
            </div>
          `;
        }

        // Citation générique
        return `
          <blockquote class="ill-quote-callout">
            <div class="ill-quote-text">${this.renderInline(cleanContent).replace(/\n/g, '<br>')}</div>
          </blockquote>
        `;
      }

      // C. Liste à puces (- ou *)
      if (/^[-*]\s+/m.test(b)) {
        const items = b.split(/\n/).map(line => {
          const m = line.match(/^[-*]\s+(.*)$/);
          if (m) {
            return `<li>${this.renderInline(m[1])}</li>`;
          }
          return line ? `<p>${this.renderInline(line)}</p>` : '';
        }).join('');
        return `<ul class="ill-bullet-list">${items}</ul>`;
      }

      // D. Paragraphe standard
      return `<p class="ill-paragraph">${this.renderInline(b).replace(/\n/g, '<br>')}</p>`;
    });

    return renderedBlocks.filter(Boolean).join('');
  },

  renderInline(str) {
    if (!str) return '';
    let escaped = this.escapeHtml(str);

    // Gras: **texte** ou __texte__
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italique: *texte* ou _texte_
    escaped = escaped.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    escaped = escaped.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');

    // Code inline: `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="ill-inline-code">$1</code>');

    return escaped;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.IllustrationsView = IllustrationsView;

