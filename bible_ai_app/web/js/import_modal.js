/**
 * Import & Book Metadata Modal Controller (Style Logos)
 * Gère l'importation complète d'ouvrages, la recherche Google Books,
 * la classification IA RAG Tri-Flux et la sélection interactive des chapitres.
 */

const ImportModal = {
  modalEl: null,
  gbModalEl: null,
  
  isEditMode: false,
  oldBookName: '',
  
  filePath: '',
  coverPath: '',
  chapters: [],

  init() {
    this.modalEl = document.getElementById('modal-import-book');
    this.gbModalEl = document.getElementById('modal-google-books');

    // Événements Modal Principal
    document.getElementById('btn-close-import-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-import-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-submit-import-modal').addEventListener('click', () => this.submit());

    // File & Cover Pickers
    document.getElementById('btn-import-pick-file').addEventListener('click', () => this.pickFile());
    document.getElementById('btn-import-pick-cover').addEventListener('click', () => this.pickCover());
    document.getElementById('btn-import-smart-cover').addEventListener('click', () => this.generateSmartCover());

    // Google Books & Auto-Classification
    document.getElementById('btn-import-google-books').addEventListener('click', () => this.openGoogleBooks());
    document.getElementById('btn-import-autoclassify').addEventListener('click', () => this.runAutoClassify());

    // Google Books Modal
    document.getElementById('btn-close-gb-modal').addEventListener('click', () => this.closeGoogleBooks());
    document.getElementById('btn-gb-search').addEventListener('click', () => this.searchGoogleBooks());
    document.getElementById('gb-search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchGoogleBooks();
    });

    // Checkbox Actions pour les chapitres
    document.getElementById('btn-ch-check-all').addEventListener('click', () => this.toggleAllChapters(true));
    document.getElementById('btn-ch-uncheck-all').addEventListener('click', () => this.toggleAllChapters(false));
    document.getElementById('btn-ch-rag-only').addEventListener('click', () => this.selectRagOnlyChapters());

    this.populateBookDropdown();
  },

  populateBookDropdown() {
    const select = document.getElementById('import-rag-bookcode');
    select.innerHTML = `<option value="">(Aucun - Thème transversal ou multi-livres)</option>`;
    
    if (typeof CANONICAL_BOOKS !== 'undefined') {
      CANONICAL_BOOKS.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.code;
        opt.textContent = `${b.code} - ${b.name}`;
        select.appendChild(opt);
      });
    }
  },

  open(editMode = false, book = null) {
    this.isEditMode = editMode;
    this.oldBookName = book ? (book.name || '') : '';
    this.filePath = book ? (book.file_path || '') : '';
    this.coverPath = book ? (book.cover_path || '') : '';
    this.chapters = [];

    const modalTitle = document.getElementById('import-modal-title');
    const submitBtn = document.getElementById('btn-submit-import-modal');

    if (editMode && book) {
      modalTitle.textContent = `✏️ Modifier les Métadonnées de l'Ouvrage`;
      submitBtn.textContent = `💾 Enregistrer les Modifications`;
      
      document.getElementById('import-book-id').value = book.name || '';
      document.getElementById('import-book-title').value = book.title || book.name || '';
      document.getElementById('import-book-author').value = book.author || '';
      document.getElementById('import-book-desc').value = book.description || '';
      document.getElementById('import-book-type').value = book.type || 'Théologie';
      document.getElementById('import-book-year').value = book.year || '';

      document.getElementById('import-rag-scope').value = book.corpus_scope || 'GLOBAL';
      document.getElementById('import-rag-stype').value = book.source_type || 'general';
      document.getElementById('import-rag-bookcode').value = book.book_code || '';
      document.getElementById('import-rag-embed').value = book.embedding_model || 'bge_multilingual_gemma2 (Infomaniak)';

      document.getElementById('import-selected-file-label').textContent = this.filePath ? this.filePath.split(/[\\/]/).pop() : 'Fichier existant';
      this.updateCoverPreview(this.coverPath);
      this.renderChaptersList([]);
    } else {
      modalTitle.textContent = `📥 Importer un Nouvel Ouvrage dans la Bibliothèque`;
      submitBtn.textContent = `📥 Lancer l'Importation & l'Indexation RAG`;

      document.getElementById('import-book-id').value = '';
      document.getElementById('import-book-title').value = '';
      document.getElementById('import-book-author').value = '';
      document.getElementById('import-book-desc').value = '';
      document.getElementById('import-book-type').value = 'Théologie';
      document.getElementById('import-book-year').value = '';

      document.getElementById('import-rag-scope').value = 'GLOBAL';
      document.getElementById('import-rag-stype').value = 'general';
      document.getElementById('import-rag-bookcode').value = '';
      document.getElementById('import-rag-embed').value = 'bge_multilingual_gemma2 (Infomaniak)';

      document.getElementById('import-selected-file-label').textContent = 'Aucun fichier sélectionné';
      this.updateCoverPreview(null);
      this.renderChaptersList([]);
    }

    this.modalEl.classList.remove('hidden');
  },

  close() {
    this.modalEl.classList.add('hidden');
  },

  async pickFile() {
    try {
      const res = await API.call('pick_import_file');
      if (!res || res.cancelled) return;
      if (!res.success) {
        alert(`Erreur de sélection : ${res.error}`);
        return;
      }

      this.filePath = res.file_path;
      document.getElementById('import-selected-file-label').textContent = res.file_name;

      // Pré-remplissage avec les informations extraites de l'EPUB ou du fichier
      const info = res.info || {};
      if (info.title && !document.getElementById('import-book-title').value) {
        document.getElementById('import-book-title').value = info.title;
        if (!document.getElementById('import-book-id').value) {
          document.getElementById('import-book-id').value = info.title.slice(0, 20);
        }
      }
      if (info.author && !document.getElementById('import-book-author').value) {
        document.getElementById('import-book-author').value = info.author;
      }
      if (info.description && !document.getElementById('import-book-desc').value) {
        document.getElementById('import-book-desc').value = info.description;
      }
      if (info.year && !document.getElementById('import-book-year').value) {
        document.getElementById('import-book-year').value = info.year;
      }
      if (info.cover_path) {
        this.coverPath = info.cover_path;
        this.updateCoverPreview(info.cover_path);
      }

      // Remplissage des chapitres
      if (info.chapters && info.chapters.length > 0) {
        this.chapters = info.chapters;
        this.renderChaptersList(this.chapters);
      } else {
        this.chapters = [];
        this.renderChaptersList([]);
      }

    } catch (e) {
      console.error('Erreur pickFile:', e);
    }
  },

  async pickCover() {
    try {
      const res = await API.call('pick_cover_image');
      if (!res || res.cancelled) return;
      if (res.success && res.cover_path) {
        this.coverPath = res.cover_path;
        this.updateCoverPreview(this.coverPath);
      }
    } catch (e) {
      console.error('Erreur pickCover:', e);
    }
  },

  generateSmartCover() {
    const title = document.getElementById('import-book-title').value || document.getElementById('import-book-id').value || 'BIBLE';
    const author = document.getElementById('import-book-author').value || '';
    
    // Génération locale de couverture élégante avec Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#1E3A8A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 180, 240);

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 164, 224);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    const words = title.split(' ');
    let line1 = words.slice(0, 3).join(' ');
    let line2 = words.slice(3, 6).join(' ');
    ctx.fillText(line1, 90, 80);
    if (line2) ctx.fillText(line2, 90, 100);

    ctx.fillStyle = '#93C5FD';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(author || 'OUVRAGE BIBLIQUE', 90, 200);

    const dataUrl = canvas.toDataURL('image/png');
    this.coverPath = dataUrl;
    this.updateCoverPreview(dataUrl);
  },

  updateCoverPreview(pathOrUrl) {
    const imgEl = document.getElementById('import-cover-img');
    const placeholderEl = document.getElementById('import-cover-placeholder');

    if (pathOrUrl) {
      imgEl.src = pathOrUrl;
      imgEl.classList.remove('hidden');
      placeholderEl.classList.add('hidden');
    } else {
      imgEl.src = '';
      imgEl.classList.add('hidden');
      placeholderEl.classList.remove('hidden');
    }
  },

  renderChaptersList(chapters) {
    const container = document.getElementById('import-chapters-scroll');
    const countEl = document.getElementById('import-ch-count');
    countEl.textContent = chapters.length;

    if (chapters.length === 0) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 11px;">Aucun chapitre extrait.</div>`;
      return;
    }

    container.innerHTML = '';
    chapters.forEach((ch, idx) => {
      const row = document.createElement('div');
      row.className = 'import-chapter-row';

      row.innerHTML = `
        <input type="checkbox" id="ch-cb-${idx}" ${ch.include ? 'checked' : ''}>
        <span class="import-chapter-title" title="${ch.title}">${ch.title}</span>
        
        <select class="import-chapter-select ch-scope-sel">
          <option value="GLOBAL" ${ch.corpus_scope === 'GLOBAL' ? 'selected' : ''}>GLOBAL</option>
          <option value="OT" ${ch.corpus_scope === 'OT' ? 'selected' : ''}>OT</option>
          <option value="NT" ${ch.corpus_scope === 'NT' ? 'selected' : ''}>NT</option>
          <option value="INTER" ${ch.corpus_scope === 'INTER' ? 'selected' : ''}>INTER</option>
          <option value="APO" ${ch.corpus_scope === 'APO' ? 'selected' : ''}>APO</option>
        </select>

        <select class="import-chapter-select ch-stype-sel">
          <option value="general" ${ch.source_type === 'general' ? 'selected' : ''}>📄 Général</option>
          <option value="book_intro" ${ch.source_type === 'book_intro' ? 'selected' : ''}>📖 Intro</option>
          <option value="biblical_theology" ${ch.source_type === 'biblical_theology' ? 'selected' : ''}>💡 Théol.</option>
          <option value="ot_context" ${ch.source_type === 'ot_context' ? 'selected' : ''}>🏛️ Context</option>
          <option value="appendix" ${ch.source_type === 'appendix' ? 'selected' : ''}>⚙️ Annexe</option>
        </select>
      `;

      row.querySelector(`#ch-cb-${idx}`).addEventListener('change', (e) => {
        ch.include = e.target.checked;
      });

      row.querySelector('.ch-scope-sel').addEventListener('change', (e) => {
        ch.corpus_scope = e.target.value;
      });

      row.querySelector('.ch-stype-sel').addEventListener('change', (e) => {
        ch.source_type = e.target.value;
      });

      container.appendChild(row);
    });
  },

  toggleAllChapters(state) {
    this.chapters.forEach((ch, idx) => {
      ch.include = state;
      const cb = document.getElementById(`ch-cb-${idx}`);
      if (cb) cb.checked = state;
    });
  },

  selectRagOnlyChapters() {
    this.chapters.forEach((ch, idx) => {
      const isApp = ch.source_type === 'appendix' || (ch.size_chars && ch.size_chars < 60);
      ch.include = !isApp;
      const cb = document.getElementById(`ch-cb-${idx}`);
      if (cb) cb.checked = !isApp;
    });
  },

  openGoogleBooks() {
    const titleVal = document.getElementById('import-book-title').value || document.getElementById('import-book-id').value;
    document.getElementById('gb-search-input').value = titleVal;
    this.gbModalEl.classList.remove('hidden');
    if (titleVal) {
      this.searchGoogleBooks();
    }
  },

  closeGoogleBooks() {
    this.gbModalEl.classList.add('hidden');
  },

  async searchGoogleBooks() {
    const q = document.getElementById('gb-search-input').value.trim();
    if (!q) return;

    const listEl = document.getElementById('gb-results-list');
    listEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 12px;">Recherche en direct sur Google Books...</div>`;

    try {
      const results = await API.call('search_google_books_metadata', q);
      if (!results || results.length === 0) {
        listEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 12px;">Aucun résultat Google Books trouvé pour « ${q} ».</div>`;
        return;
      }

      listEl.innerHTML = '';
      results.forEach(res => {
        const card = document.createElement('div');
        card.className = 'gb-result-card';

        const thumbHtml = res.cover_url 
          ? `<img src="${res.cover_url}" class="gb-thumb" alt="Cover">`
          : `<div class="gb-thumb" style="display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted);">Pas d'image</div>`;

        card.innerHTML = `
          ${thumbHtml}
          <div class="gb-info">
            <div class="gb-title">${res.title}</div>
            <div class="gb-author">${(res.authors || []).join(', ') || 'Auteur inconnu'} (${res.publishedDate ? res.publishedDate.slice(0, 4) : '—'})</div>
            <div class="gb-desc">${res.description || 'Aucune description fournie.'}</div>
          </div>
        `;

        card.addEventListener('click', async () => {
          document.getElementById('import-book-title').value = res.title || '';
          if (!document.getElementById('import-book-id').value) {
            document.getElementById('import-book-id').value = (res.title || '').slice(0, 20);
          }
          document.getElementById('import-book-author').value = (res.authors || []).join(', ');
          document.getElementById('import-book-desc').value = res.description || '';
          if (res.publishedDate) {
            document.getElementById('import-book-year').value = res.publishedDate.slice(0, 4);
          }

          if (res.cover_url) {
            const localCover = await API.call('download_book_cover', res.cover_url, res.title);
            if (localCover) {
              this.coverPath = localCover;
              this.updateCoverPreview(localCover);
            } else {
              this.coverPath = res.cover_url;
              this.updateCoverPreview(res.cover_url);
            }
          }

          this.closeGoogleBooks();
          App.showToast('Métadonnées Google Books appliquées avec succès !');
        });

        listEl.appendChild(card);
      });

    } catch (e) {
      listEl.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur lors de la recherche Google Books.</div>`;
    }
  },

  async runAutoClassify() {
    const title = document.getElementById('import-book-title').value || document.getElementById('import-book-id').value;
    const desc = document.getElementById('import-book-desc').value || '';
    if (!title && !desc) {
      alert('Veuillez renseigner au moins le titre ou la description pour lancer la classification IA.');
      return;
    }

    const btn = document.getElementById('btn-import-autoclassify');
    btn.disabled = true;
    btn.textContent = '⏳ Classification IA...';

    try {
      const tags = await API.call('auto_classify_document_metadata', title, desc);
      if (tags) {
        if (tags.corpus_scope) document.getElementById('import-rag-scope').value = tags.corpus_scope;
        if (tags.source_type) document.getElementById('import-rag-stype').value = tags.source_type;
        if (tags.book_code) document.getElementById('import-rag-bookcode').value = tags.book_code;
        App.showToast('✨ Classification RAG Tri-Flux détectée et appliquée par IA !');
      }
    } catch (e) {
      console.error('Erreur auto_classify:', e);
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Auto-classifier (IA)';
    }
  },

  async submit() {
    const id = document.getElementById('import-book-id').value.trim();
    if (!id) {
      alert('Veuillez entrer un identifiant / titre court obligatoire.');
      return;
    }

    const payload = {
      name: id,
      title: document.getElementById('import-book-title').value.trim() || id,
      author: document.getElementById('import-book-author').value.trim(),
      description: document.getElementById('import-book-desc').value.trim(),
      type: document.getElementById('import-book-type').value,
      year: document.getElementById('import-book-year').value.trim(),
      corpus_scope: document.getElementById('import-rag-scope').value,
      source_type: document.getElementById('import-rag-stype').value,
      book_code: document.getElementById('import-rag-bookcode').value || null,
      embedding_model: document.getElementById('import-rag-embed').value,
      file_path: this.filePath,
      cover_path: this.coverPath,
      chapters: this.chapters,
      edit_mode: this.isEditMode,
      old_name: this.oldBookName
    };

    const submitBtn = document.getElementById('btn-submit-import-modal');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳</span> <span>Indexation RAG en cours...</span>`;

    try {
      const res = await API.call('execute_document_import', payload);
      if (res && res.success) {
        this.close();
        App.showToast(this.isEditMode ? 'Métadonnées enregistrées avec succès !' : `Ouvrage « ${id} » importé et indexé avec succès !`);
        LibraryView.loadBooks();
      } else {
        alert(`Erreur d'import : ${res?.error || 'Erreur inconnue'}`);
      }
    } catch (e) {
      alert(`Erreur d'importation : ${e}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = this.isEditMode ? `💾 Enregistrer les Modifications` : `📥 Lancer l'Importation & l'Indexation RAG`;
    }
  }
};
