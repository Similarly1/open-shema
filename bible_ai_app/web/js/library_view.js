/**
 * Library View Controller
 * Gère l'affichage de la bibliothèque en grille, les filtres, l'activation et l'import.
 */

const LibraryView = {
  books: [],
  containerEl: null,
  searchInput: null,
  typeFilter: null,
  countSubtitle: null,

  init() {
    this.containerEl = document.getElementById('library-cards-grid');
    this.searchInput = document.getElementById('lib-search-input');
    this.typeFilter = document.getElementById('lib-type-filter');
    this.countSubtitle = document.getElementById('lib-count-subtitle');

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
        <div class="empty-state">
          <span class="empty-icon">📚</span>
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
          
          <div class="btn-group-right">
            <button class="lib-btn-icon delete" data-book="${book.name}" title="Supprimer">🗑️</button>
          </div>
        </div>
      `;

      // Événements
      const switchEl = card.querySelector('input[type="checkbox"]');
      switchEl.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        await API.call('toggle_book', book.name, isActive);
        book.active = isActive;
        card.classList.toggle('inactive', !isActive);
        App.showToast(`« ${book.name} » ${isActive ? 'activé' : 'désactivé'}`);
      });

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

  async importBook() {
    try {
      const res = await API.call('pick_and_import_book');
      if (res && res.success) {
        App.showToast('Ouvrage importé avec succès !');
        this.loadBooks();
      } else if (res && res.error) {
        alert(`Erreur d'import : ${res.error}`);
      }
    } catch (e) {
      console.error('Erreur import:', e);
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
