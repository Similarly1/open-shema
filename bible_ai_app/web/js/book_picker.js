/**
 * Book & Chapter Picker Popover (Style Logos)
 * Gère la sélection visuelle des 66 livres bibliques et de leurs chapitres.
 */

const BookPicker = {
  booksData: [],
  selectedBook: null,
  selectedChapter: 1,
  onSelectCallback: null,

  // DOM Elements
  popoverEl: null,
  backdropEl: null,
  searchInput: null,
  otGridEl: null,
  ntGridEl: null,
  chaptersGridEl: null,
  bookTitleEl: null,
  totalChEl: null,

  async init(onSelect) {
    this.onSelectCallback = onSelect;
    
    this.popoverEl = document.getElementById('book-picker-popover');
    this.backdropEl = document.getElementById('popover-backdrop');
    this.searchInput = document.getElementById('picker-search-input');
    this.otGridEl = document.getElementById('grid-ot-books');
    this.ntGridEl = document.getElementById('grid-nt-books');
    this.chaptersGridEl = document.getElementById('grid-chapters');
    this.bookTitleEl = document.getElementById('selected-book-name-title');
    this.totalChEl = document.getElementById('selected-book-total-ch');

    // Événements
    this.backdropEl.addEventListener('click', () => this.close());
    this.searchInput.addEventListener('input', (e) => this.filterBooks(e.target.value));

    // Charger la liste des livres depuis l'API
    API.onReady(async () => {
      try {
        this.booksData = await API.getBooksList();
        this.renderBooks();
      } catch (e) {
        console.error('Erreur chargement livres:', e);
      }
    });
  },

  open(currentBookCode, currentChapter) {
    this.selectedBook = this.booksData.find(b => b.code === currentBookCode) || this.booksData[0];
    this.selectedChapter = currentChapter || 1;

    this.searchInput.value = '';
    this.renderBooks();
    this.renderChapters();

    this.popoverEl.classList.remove('hidden');
    this.backdropEl.classList.remove('hidden');
    this.searchInput.focus();
  },

  close() {
    this.popoverEl.classList.add('hidden');
    this.backdropEl.classList.add('hidden');
  },

  toggle(currentBookCode, currentChapter) {
    if (this.popoverEl.classList.contains('hidden')) {
      this.open(currentBookCode, currentChapter);
    } else {
      this.close();
    }
  },

  renderBooks(filterQuery = '') {
    const q = filterQuery.toLowerCase().trim();
    
    this.otGridEl.innerHTML = '';
    this.ntGridEl.innerHTML = '';

    this.booksData.forEach(book => {
      if (q && !book.name.toLowerCase().includes(q) && !book.code.toLowerCase().includes(q)) {
        return;
      }

      const btn = document.createElement('button');
      btn.className = `book-row-btn ${this.selectedBook?.code === book.code ? 'active' : ''}`;
      btn.innerHTML = `
        <span>${book.name}</span>
        <span class="code">${book.code}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectBook(book);
      });

      if (book.testament === 'OT') {
        this.otGridEl.appendChild(btn);
      } else {
        this.ntGridEl.appendChild(btn);
      }
    });
  },

  selectBook(book) {
    this.selectedBook = book;
    this.renderBooks(this.searchInput.value);
    this.renderChapters();
  },

  renderChapters() {
    if (!this.selectedBook) return;

    this.bookTitleEl.textContent = this.selectedBook.name;
    this.totalChEl.textContent = `${this.selectedBook.chapters} chapitres`;

    this.chaptersGridEl.innerHTML = '';

    for (let i = 1; i <= this.selectedBook.chapters; i++) {
      const chBtn = document.createElement('button');
      chBtn.className = `ch-btn ${this.selectedChapter === i ? 'active' : ''}`;
      chBtn.textContent = i;
      chBtn.addEventListener('click', () => {
        this.confirmSelection(this.selectedBook.code, i);
      });
      this.chaptersGridEl.appendChild(chBtn);
    }
  },

  filterBooks(query) {
    this.renderBooks(query);
  },

  confirmSelection(bookCode, chapterNum) {
    this.close();
    if (this.onSelectCallback) {
      this.onSelectCallback(bookCode, chapterNum);
    }
  }
};
