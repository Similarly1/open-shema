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

    document.getElementById('btn-lib-import')?.addEventListener('click', () => {
      this.importBook();
    });

    document.getElementById('btn-lib-open-store')?.addEventListener('click', () => {
      if (typeof OpenShemaStore !== 'undefined') {
        OpenShemaStore.open();
      }
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
      const isOfficial = b.is_official === true || 
                         b.source === 'open-shema-data' || 
                         ['vigouroux'].includes(b.id || b.dict_id) || 
                         (b.name && (b.name.toLowerCase().includes('hodge') || b.name.toLowerCase().includes('calvin'))) || 
                         (b.title && (b.title.toLowerCase().includes('hodge') || b.title.toLowerCase().includes('calvin')));

      if (type === 'openshema' && !isOfficial) return false;
      if (type !== 'Tous' && type !== 'openshema' && b.type !== type) return false;
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
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 8px auto; opacity: 0.5;"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
          <p>Aucun ouvrage ne correspond à vos critères de recherche.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(book => {
      const card = document.createElement('div');
      card.className = `library-card ${book.active ? '' : 'inactive'}`;

      const isOfficial = book.is_official === true || 
                         book.source === 'open-shema-data' || 
                         ['vigouroux'].includes(book.id || book.dict_id) || 
                         (book.name && (book.name.toLowerCase().includes('hodge') || book.name.toLowerCase().includes('calvin'))) || 
                         (book.title && (book.title.toLowerCase().includes('hodge') || book.title.toLowerCase().includes('calvin')));

      // Initials ou code court pour couverture
      let initials = book.version_code || book.code || '';
      if (!initials || initials.length > 5) {
        initials = (book.title || book.name || 'B').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'B';
      }
      const coverColors = ['#1E293B', '#0F766E', '#1D4ED8', '#6D28D9', '#334155', '#B45309', '#C2410C', '#991B1B'];
      const color = coverColors[Math.abs(this._hashCode(book.name)) % coverColors.length];

      const coverSrc = book.cover_data_url || book.cover_url || book.cover_path;
      const safeTitle = (book.title || book.name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const coverHtml = coverSrc 
        ? `<div class="lib-cover has-img">
             <img src="${coverSrc}" class="lib-cover-img" alt="${safeTitle}" onerror="this.style.display='none'; this.parentElement.classList.remove('has-img'); this.parentElement.style.backgroundColor='${color}'; this.parentElement.innerHTML='<span class=\\'cover-initials\\'>${initials}</span><span class=\\'cover-title-preview\\'>${safeTitle.slice(0, 22)}</span>';">
           </div>`
        : `<div class="lib-cover" style="background-color: ${color};">
             <span class="cover-initials">${initials}</span>
             <span class="cover-title-preview">${safeTitle.slice(0, 22)}</span>
           </div>`;

      card.innerHTML = `
        ${coverHtml}
        
        <div class="lib-info">
          <div class="lib-title" title="${book.title || book.name}">${book.title || book.name}</div>
          <div class="lib-author">${book.author || 'Auteur non spécifié'}</div>
          
          <div class="lib-tags">
            ${isOfficial ? `<span class="tag tag-openshema" title="Ouvrage certifié issu du catalogue public Open Shema Data">Open Shema</span>` : ''}
            ${book.type ? `<span class="tag tag-type">${book.type}</span>` : ''}
            ${book.corpus_scope ? `<span class="tag tag-scope">${book.corpus_scope === 'OT' ? 'AT' : (book.corpus_scope === 'BOTH' ? 'AT+NT' : (book.corpus_scope === 'APOCRYPHA' ? 'APO' : book.corpus_scope))}</span>` : ''}
            ${book.chapters_count ? `<span class="tag tag-count" style="display:inline-flex; align-items:center; gap:3px;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg><span>${book.chapters_count} ch.</span></span>` : ''}
          </div>
        </div>

        <div class="lib-actions">
          <label class="switch-toggle" title="Activer / Désactiver">
            <input type="checkbox" ${book.active ? 'checked' : ''} data-book="${book.name}">
            <span class="slider round"></span>
          </label>
          
          <div class="btn-group-right" style="display: flex; gap: 4px; margin-top: 8px;">
            <button class="lib-btn-icon read" data-book="${book.name}" title="Lire cet ouvrage" style="display: flex; align-items: center; justify-content: center; background: var(--accent-blue); color: white;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></button>
            <button class="lib-btn-icon edit" data-book="${book.name}" title="Modifier les métadonnées" style="display: flex; align-items: center; justify-content: center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
            <button class="lib-btn-icon delete" data-book="${book.name}" title="Supprimer" style="display: flex; align-items: center; justify-content: center;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
          </div>
        </div>
      `;

      // Read button / card click
      const readBtn = card.querySelector('.lib-btn-icon.read');
      const handleRead = () => {
        const bType = (book.type || '').toLowerCase();
        if (bType.includes('théo') || bType.includes('theo') || bType.includes('étude') || bType.includes('etude') || book.chapters_count > 0) {
          if (typeof TheologyView !== 'undefined') {
            TheologyView.openBook(book.name);
          }
        } else if (bType.includes('comm')) {
          if (typeof CommentariesView !== 'undefined') {
            CommentariesView.openWithCurrentState();
          } else {
            App.switchView('commentaries');
          }
        } else if (bType.includes('bibl')) {
          App.switchView('bible');
          if (typeof BibleReader !== 'undefined') {
            if (typeof BibleReader.switchVersion === 'function') {
              BibleReader.switchVersion(book.name || book.folder_name || book.title);
            } else if (typeof BibleReader.selectBibleVersion === 'function') {
              BibleReader.selectBibleVersion(book.name || book.folder_name);
            }
          }
        } else if (bType.includes('dict')) {
          if (typeof DictView !== 'undefined' && typeof DictView.openDictionary === 'function') {
            DictView.openDictionary(book.dict_id || book.name);
          } else {
            App.switchView('dict');
          }
        } else {
          if (typeof TheologyView !== 'undefined') {
            TheologyView.openBook(book.name);
          }
        }
      };

      readBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRead();
      });

      card.querySelector('.lib-cover')?.addEventListener('click', () => {
        handleRead();
      });
      card.querySelector('.lib-info')?.addEventListener('click', () => {
        handleRead();
      });

      // Switch toggle
      const switchEl = card.querySelector('input[type="checkbox"]');
      switchEl.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        await API.call('toggle_book', book.name, isActive);
        book.active = isActive;
        card.classList.toggle('inactive', !isActive);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`« ${book.title || book.name} » ${isActive ? 'activé' : 'désactivé'}`);
        }
        if (typeof BibleReader !== 'undefined' && BibleReader.reloadInstalledBibles) {
          await BibleReader.reloadInstalledBibles();
          if (typeof BibleReader.renderBibleSelectors === 'function') {
            BibleReader.renderBibleSelectors();
          }
        }
      });

      // Edit button
      const editBtn = card.querySelector('.lib-btn-icon.edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditModal(book);
      });

      // Delete button
      const delBtn = card.querySelector('.lib-btn-icon.delete');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const bookDisplayName = book.title || book.name;
        let confirmed = false;

        if (typeof App !== 'undefined' && App.showConfirmModal) {
          confirmed = await App.showConfirmModal({
            title: "Supprimer cet ouvrage",
            message: `Êtes-vous sûr de vouloir supprimer définitivement « ${bookDisplayName} » de votre bibliothèque ?`,
            confirmText: "Supprimer",
            cancelText: "Annuler",
            danger: true,
            icon: "trash"
          });
        } else {
          confirmed = confirm(`Êtes-vous sûr de vouloir supprimer définitivement « ${bookDisplayName} » ?`);
        }

        if (confirmed) {
          await API.call('delete_book', book.name);
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`« ${bookDisplayName} » a été supprimé`);
          }
          this.loadBooks();
          if (typeof BibleReader !== 'undefined' && BibleReader.reloadInstalledBibles) {
            BibleReader.reloadInstalledBibles();
          }
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
