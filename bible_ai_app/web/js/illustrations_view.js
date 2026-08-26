/**
 * IllustrationsView
 * Gère le réservoir et la banque centrale d'illustrations (Starter Pack de 1000 - 1500 fiches).
 * Recherche plein texte, filtres thématiques/genres, historique pastoral et insertion dans le sermon.
 */

const IllustrationsView = {
  illustrations: [],
  filteredIllustrations: [],
  currentIllustration: null,
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
      this.openEditModal({
        id: `ill-${Date.now()}`,
        title: '',
        category: 'Grâce & Salut',
        type: 'Histoire vraie',
        passages_associes: [],
        author: '',
        body: '',
        usage_history: []
      });
    });

    // 6. Modale d'édition
    document.getElementById('btn-close-illustration-modal')?.addEventListener('click', () => {
      this.closeModal();
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

  async onViewActivated() {
    await this.loadIllustrations();
  },

  async loadIllustrations() {
    try {
      const list = await API.getIllustrationsList();
      this.illustrations = Array.isArray(list) ? list : [];
      this.applyFilters();
    } catch (e) {
      console.error('Erreur chargement banque illustrations:', e);
    }
  },

  applyFilters() {
    const q = this.searchQuery.toLowerCase();

    this.filteredIllustrations = this.illustrations.filter(ill => {
      // 1. Catégorie
      if (this.activeCategory !== 'all') {
        const cat = ill.category || '';
        if (!cat.toLowerCase().includes(this.activeCategory.toLowerCase().split(' ')[0])) {
          return false;
        }
      }

      // 2. Type / Genre
      if (this.activeType !== 'all') {
        const type = ill.type || '';
        if (type !== this.activeType) return false;
      }

      // 3. Statut pastoral
      const history = ill.usage_history || [];
      if (this.activeStatus === 'unused' && history.length > 0) return false;
      if (this.activeStatus === 'used' && history.length === 0) return false;

      // 4. Recherche plein texte
      if (q) {
        const titleMatch = (ill.title || '').toLowerCase().includes(q);
        const bodyMatch = (ill.body || ill.content || '').toLowerCase().includes(q);
        const authorMatch = (ill.author || '').toLowerCase().includes(q);
        const passagesMatch = Array.isArray(ill.passages_associes) 
          ? ill.passages_associes.some(p => p.toLowerCase().includes(q))
          : (ill.passages_associes || '').toLowerCase().includes(q);

        if (!titleMatch && !bodyMatch && !authorMatch && !passagesMatch) {
          return false;
        }
      }

      return true;
    });

    this.render();
  },

  render() {
    if (this.lblCount) {
      const count = this.filteredIllustrations.length;
      this.lblCount.textContent = `${count} ${count > 1 ? 'illustrations' : 'illustration'}`;
    }

    if (!this.container) return;

    if (this.filteredIllustrations.length === 0) {
      this.container.innerHTML = `
        <div style="padding: 48px 24px; text-align: center; color: var(--text-muted);">
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

    const cardsHtml = this.filteredIllustrations.map(ill => {
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
      const bodyPreview = (ill.body || ill.content || '').replace(/^[#>-]+\s*/gm, '').trim();

      return `
        <article class="illustration-card" data-ill-id="${ill.id}">
          <div class="ill-card-top">
            <span class="ill-card-badge ${typeClass}">${this.escapeHtml(type)}</span>
            <span class="ill-card-usage-pill ${usageClass}">${usageText}</span>
          </div>
          <div class="ill-card-title">${this.escapeHtml(ill.title || 'Sans titre')}</div>
          <div class="ill-card-preview">${this.escapeHtml(bodyPreview)}</div>
          <div class="ill-card-footer">
            <span class="ill-card-author">${this.escapeHtml(author)}</span>
            ${passages ? `<span class="ill-card-passage">${this.escapeHtml(passages)}</span>` : ''}
          </div>
        </article>
      `;
    }).join('');

    this.container.innerHTML = `<div class="illustrations-grid">${cardsHtml}</div>`;

    // Clic sur carte
    this.container.querySelectorAll('.illustration-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.illId;
        const ill = this.illustrations.find(i => i.id === id);
        if (ill) this.openEditModal(ill);
      });
    });
  },

  openEditModal(ill) {
    this.currentIllustration = JSON.parse(JSON.stringify(ill));

    const inputTitle = document.getElementById('ill-input-title');
    const inputBody = document.getElementById('ill-input-body');
    const selectCategory = document.getElementById('ill-input-category');
    const selectType = document.getElementById('ill-input-type');
    const inputPassages = document.getElementById('ill-input-passages');
    const inputAuthor = document.getElementById('ill-input-author');
    const modalTitle = document.getElementById('ill-modal-title');
    const typeBadge = document.getElementById('ill-modal-type-badge');
    const historyList = document.getElementById('ill-modal-history-list');

    if (inputTitle) inputTitle.value = ill.title || '';
    if (inputBody) inputBody.value = ill.body || ill.content || '';
    if (selectCategory) selectCategory.value = ill.category || 'Grâce & Salut';
    if (selectType) selectType.value = ill.type || 'Histoire vraie';
    if (inputPassages) {
      inputPassages.value = Array.isArray(ill.passages_associes) ? ill.passages_associes.join(', ') : (ill.passages_associes || '');
    }
    if (inputAuthor) inputAuthor.value = ill.author || '';
    if (modalTitle) modalTitle.textContent = ill.title ? ill.title : 'Nouvelle illustration';
    if (typeBadge) typeBadge.textContent = ill.type || 'Histoire vraie';

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

    if (this.modal) this.modal.classList.remove('hidden');
  },

  closeModal() {
    if (this.modal) this.modal.classList.add('hidden');
    this.currentIllustration = null;
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
      title: inputTitle?.value || 'Sans titre',
      category: selectCategory?.value || 'Général',
      type: selectType?.value || 'Histoire vraie',
      passages_associes: passagesRaw,
      author: inputAuthor?.value || '',
      body: inputBody?.value || '',
      usage_history: this.currentIllustration.usage_history || []
    };

    try {
      const res = await API.saveIllustration(payload);
      if (res && res.success !== false) {
        this.closeModal();
        await this.loadIllustrations();
      }
    } catch (e) {
      console.error('Erreur sauvegarde illustration:', e);
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
    const inputTitle = document.getElementById('ill-input-title');
    const inputBody = document.getElementById('ill-input-body');
    const inputAuthor = document.getElementById('ill-input-author');

    const text = `**${inputTitle?.value || ''}**\n\n${inputBody?.value || ''}\n\n— *${inputAuthor?.value || ''}*`;
    navigator.clipboard.writeText(text.trim());

    const btn = document.getElementById('btn-copy-illustration-text');
    if (btn) {
      const origText = btn.innerHTML;
      btn.innerHTML = '<span>Copié !</span>';
      setTimeout(() => { btn.innerHTML = origText; }, 1500);
    }
  },

  insertCurrentIntoSermon() {
    const inputTitle = document.getElementById('ill-input-title');
    const inputBody = document.getElementById('ill-input-body');
    const inputAuthor = document.getElementById('ill-input-author');

    const illId = this.currentIllustration?.id || '';
    const title = inputTitle?.value || 'Illustration';
    const body = inputBody?.value || '';
    const author = inputAuthor?.value || '';

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
    }
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
