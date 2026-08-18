/**
 * Library View Controller
 * Gère l'affichage de la bibliothèque en grille, les filtres, l'activation, l'édition et la suppression.
 */

const LibraryView = {
  books: [],
  containerEl: null,
  searchInput: null,
  typeFilter: null,
  countSubtitle: null,

  // Modal d'édition
  editModalEl: null,
  currentEditingBook: null,

  init() {
    this.containerEl = document.getElementById('library-cards-grid');
    this.searchInput = document.getElementById('lib-search-input');
    this.typeFilter = document.getElementById('lib-type-filter');
    this.countSubtitle = document.getElementById('lib-count-subtitle');
    this.editModalEl = document.getElementById('modal-edit-book');

    this.searchInput.addEventListener('input', () => this.render());
    this.typeFilter.addEventListener('change', () => this.render());

    document.getElementById('btn-lib-import').addEventListener('click', () => {
      this.importBook();
    });

    this.loadBooks();
  },

  async loadBooks() {
    try {
      this.books = await API.call('get_library_books') || [];
      this.render();
    } catch (e) {
      console.error('Erreur chargement bibliothèque:', e);
    }
  },

  render() {
    const q = this.searchInput.value.toLowerCase().trim();
    const type = this.typeFilter.value;

    const filtered = this.books.filter(b => {
      if (type !== 'Tous' && b.type !== type) return false;
      if (q) {
        const title = (b.title || b.name || '').toLowerCase();
        const author = (b.author || '').toLowerCase();
        return title.includes(q) || author.includes(q);
      }
      return true;
    });

    this.countSubtitle.textContent = `${filtered.length} ouvrage(s) affiché(s) sur ${this.books.length} au total.`;
    this.containerEl.innerHTML = '';

    if (filtered.length === 0) {
      this.containerEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <span style="font-size: 36px; display: block; margin-bottom: 8px;">📚</span>
          <p>Aucun ouvrage ne correspond à vos critères de recherche.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(book => {
      const card = document.createElement('div');
      card.className = `library-card ${book.active ? '' : 'inactive'}`;

      // Initials pour couverture
      const initials = (book.title || book.name || 'B').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'B';
      const coverColors = ['#1E293B', '#0F766E', '#1D4ED8', '#6D28D9', '#334155', '#B45309', '#C2410C', '#991B1B'];
      const color = coverColors[Math.abs(this._hashCode(book.name)) % coverColors.length];

      card.innerHTML = `
        <div class="lib-cover" style="background-color: ${color};">
          <span class="cover-initials">${initials}</span>
          <span class="cover-title-preview">${(book.title || book.name).slice(0, 22)}</span>
        </div>
        
        <div class="lib-info">
          <div class="lib-title" title="${book.title || book.name}">${book.title || book.name}</div>
          <div class="lib-author">${book.author || 'Auteur non spécifié'}</div>
          
          <div class="lib-tags">
            ${book.type ? `<span class="tag tag-type">${book.type}</span>` : ''}
            ${book.corpus_scope ? `<span class="tag tag-scope">${book.corpus_scope}</span>` : ''}
            ${book.chapters_count ? `<span class="tag tag-count">📑 ${book.chapters_count} ch.</span>` : ''}
          </div>
        </div>

        <div class="lib-actions">
          <label class="switch-toggle" title="Activer / Désactiver">
            <input type="checkbox" ${book.active ? 'checked' : ''} data-book="${book.name}">
            <span class="slider round"></span>
          </label>
          
          <div class="btn-group-right" style="display: flex; gap: 4px; margin-top: 12px;">
            <button class="lib-btn-icon edit" data-book="${book.name}" title="Modifier les métadonnées">✏️</button>
            <button class="lib-btn-icon delete" data-book="${book.name}" title="Supprimer">🗑️</button>
          </div>
        </div>
      `;

      // Switch toggle
      const switchEl = card.querySelector('input[type="checkbox"]');
      switchEl.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        await API.call('toggle_book', book.name, isActive);
        book.active = isActive;
        card.classList.toggle('inactive', !isActive);
        App.showToast(`« ${book.name} » ${isActive ? 'activé' : 'désactivé'}`);
      });

      // Edit button
      const editBtn = card.querySelector('.lib-btn-icon.edit');
      editBtn.addEventListener('click', () => {
        this.openEditModal(book);
      });

      // Delete button
      const delBtn = card.querySelector('.lib-btn-icon.delete');
      delBtn.addEventListener('click', async () => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement « ${book.name} » ?`)) {
          await API.call('delete_book', book.name);
          App.showToast(`« ${book.name} » a été supprimé`);
          this.loadBooks();
        }
      });

      this.containerEl.appendChild(card);
    });
  },

  openEditModal(book) {
    if (typeof ImportModal !== 'undefined') {
      ImportModal.open(true, book);
    }
  },

  importBook() {
    if (typeof ImportModal !== 'undefined') {
      ImportModal.open(false);
    }
  },

  _hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }
};
