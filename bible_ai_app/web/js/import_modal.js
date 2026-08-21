/**
 * Import & Book Metadata Modal Controller (Style Logos - Wizard 4 Étapes)
 * Gère l'assistant d'importation par étapes (Fichier -> Métadonnées -> Chapitres -> Classification),
 * le support des formats EPUB, JSON, DOCX, MD, TXT, le collage d'images (Ctrl+V),
 * la détection intelligente des doublons, la désactivation de l'IA et l'animation finale zen.
 */

function cleanHtml(rawHtml) {
  if (!rawHtml) return '';
  let text = String(rawHtml).replace(/<(?:br|p|div|li)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = text;
  text = txt.value;
  text = text.replace(/\n\s*\n+/g, '\n\n').replace(/[ \t]+/g, ' ');
  return text.trim();
}

function generateShortId(title, type = 'Théologie') {
  if (!title) return '';
  const cleanTitle = title.trim();

  // Cas 1 : Si c'est une Bible ou si le titre commence par "Bible" / "La Bible" / "Sainte Bible"
  const isBible = (type && type.toLowerCase() === 'bible') || /^((la|le|sainte|nouvelle)\s+)?bible\b/i.test(cleanTitle);
  
  if (isBible) {
    let versionOnly = cleanTitle
      .replace(/^(la\s+|le\s+|sainte\s+|nouvelle\s+)?bible(\s+(de|du|des|en|d'))?\s*/i, '')
      .replace(/\s*\bbible\b\s*/gi, ' ')
      .trim();

    if (versionOnly) {
      versionOnly = versionOnly.replace(/^(de|du|des|d')\s+/i, '').trim();
      return versionOnly.toUpperCase();
    }
  }

  // Cas 2 : Première lettre de chaque mot, 5 maximum, TOUT EN MAJUSCULE
  const stripped = cleanTitle.replace(/[^\w\s\u00C0-\u017F]/g, ' ');
  const words = stripped.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return cleanTitle.slice(0, 5).toUpperCase();

  // Prendre la première lettre de chaque mot, 5 maximum
  const initials = words.slice(0, 5).map(w => w[0].toUpperCase()).join('');
  return initials;
}

function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function playSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Accord majeur lumineux & zen : Do5 (523Hz) -> Mi5 (659Hz) -> Sol5 (784Hz) -> Do6 (1046Hz)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.14, now + i * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.7);
    });
  } catch (err) {
    console.debug('Audio not available:', err);
  }
}

const ImportModal = {
  modalEl: null,
  gbModalEl: null,
  
  currentStep: 1,
  isEditMode: false,
  oldBookName: '',
  
  filePath: '',
  fileName: '',
  fileSize: 0,
  fileFormat: '',
  coverPath: '',
  coverDataUrl: '',
  chapters: [],
  userModifiedId: false,
  installedBooksList: [],
  lastImportedBookInfo: null,

  // Verrous anti-rebond pour éviter l'ouverture multiple de boîtes de dialogue natives
  _isPickingFile: false,
  _isPickingCover: false,

  init() {
    this.modalEl = document.getElementById('modal-import-book');
    this.gbModalEl = document.getElementById('modal-google-books');

    // Événements Modal Principal
    document.getElementById('btn-close-import-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-import-modal')?.addEventListener('click', () => this.close());
    
    // Navigation du Wizard
    document.getElementById('btn-import-prev')?.addEventListener('click', () => this.prevStep());
    document.getElementById('btn-import-next')?.addEventListener('click', () => this.nextStep());
    document.getElementById('btn-submit-import-modal')?.addEventListener('click', () => this.submit());

    // Clics sur les indicateurs du stepper
    document.querySelectorAll('.wizard-step').forEach(stepEl => {
      stepEl.addEventListener('click', () => {
        const targetStep = parseInt(stepEl.dataset.step, 10);
        if (this.isEditMode || targetStep < this.currentStep || (this.filePath && targetStep <= 4)) {
          this.goToStep(targetStep);
        }
      });
    });

    // Génération automatique dynamique du titre court & détection doublon
    const titleInput = document.getElementById('import-book-title');
    const typeInput = document.getElementById('import-book-type');
    const idInput = document.getElementById('import-book-id');

    idInput?.addEventListener('input', () => {
      this.userModifiedId = idInput.value.trim().length > 0;
      this.checkForDuplicates();
    });

    titleInput?.addEventListener('input', () => {
      if (!this.userModifiedId) {
        idInput.value = generateShortId(titleInput.value, typeInput.value);
      }
      this.checkForDuplicates();
    });

    typeInput?.addEventListener('change', () => {
      this.updateResourceTypeUI(typeInput.value);
      if (!this.userModifiedId) {
        idInput.value = generateShortId(titleInput.value, typeInput.value);
      }
      this.checkForDuplicates();
    });

    // File Pickers & Dropzone (avec stopPropagation pour éviter le double déclenchement)
    document.getElementById('btn-import-pick-file')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.pickFile();
    });
    document.getElementById('btn-change-selected-file')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.pickFile();
    });
    
    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) {
      dropzone.addEventListener('click', (e) => {
        if (e.target.closest('#btn-import-pick-file')) return;
        this.pickFile();
      });
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        this.pickFile();
      });
    }

    // Cover Pickers & Paste
    document.getElementById('btn-import-pick-cover')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.pickCover();
    });
    document.getElementById('btn-import-smart-cover')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.generateSmartCover();
    });
    document.getElementById('btn-import-paste-cover')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.pasteCoverFromClipboard();
    });

    // Écouteur global pour coller une image (Ctrl+V) quand le modal est ouvert à l'étape 2
    window.addEventListener('paste', (e) => {
      if (!this.modalEl || this.modalEl.classList.contains('hidden')) return;
      if (this.currentStep === 2) {
        this.handlePasteEvent(e);
      }
    });

    // Google Books & Auto-Classification
    document.getElementById('btn-import-google-books')?.addEventListener('click', () => this.openGoogleBooks());
    document.getElementById('btn-import-autoclassify')?.addEventListener('click', () => this.runAutoClassify());

    // Google Books Modal
    document.getElementById('btn-close-gb-modal')?.addEventListener('click', () => this.closeGoogleBooks());
    document.getElementById('btn-gb-search')?.addEventListener('click', () => this.searchGoogleBooks());
    document.getElementById('gb-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchGoogleBooks();
    });

    // Checkbox Actions pour les chapitres
    document.getElementById('btn-ch-check-all')?.addEventListener('click', () => this.toggleAllChapters(true));
    document.getElementById('btn-ch-uncheck-all')?.addEventListener('click', () => this.toggleAllChapters(false));
    document.getElementById('btn-ch-rag-only')?.addEventListener('click', () => this.selectRagOnlyChapters());

    // Boutons de l'écran de succès
    document.getElementById('btn-success-open-reader')?.addEventListener('click', () => {
      this.close();
      if (this.lastImportedBookInfo?.type === 'Bible') {
        App.switchView('bible');
        if (typeof BibleReader !== 'undefined') {
          BibleReader.currentBible1 = this.lastImportedBookInfo.name;
          BibleReader.navigateTo('Gen', 1);
        }
      } else {
        App.switchView('theology');
        if (typeof TheologyView !== 'undefined') {
          TheologyView.openBook(this.lastImportedBookInfo?.name);
        }
      }
    });

    document.getElementById('btn-success-open-library')?.addEventListener('click', () => {
      this.close();
      App.switchView('library');
    });

    document.getElementById('btn-success-import-another')?.addEventListener('click', () => {
      this.open(false);
    });

    this.populateBookDropdown();
  },

  goToStep(step) {
    this.currentStep = step;

    // 1. Masquer tous les panneaux
    document.querySelectorAll('.wizard-pane').forEach(p => p.classList.add('hidden'));
    
    // 2. Afficher le panneau actif
    const targetPane = document.getElementById(`import-step-${step}`);
    if (targetPane) targetPane.classList.remove('hidden');

    // 3. Mettre à jour les indicateurs du stepper
    for (let i = 1; i <= 4; i++) {
      const ind = document.getElementById(`wizard-step-indicator-${i}`);
      const conn = document.getElementById(`wizard-conn-${i}`);
      
      if (ind) {
        ind.classList.toggle('active', i === step);
        ind.classList.toggle('completed', i < step);
      }
      if (conn) {
        conn.classList.toggle('completed', i < step);
      }
    }

    // 4. Mettre à jour les boutons du pied de page
    this.updateFooterButtonsUI();

    // 5. Ajustements selon l'étape
    if (step === 2) {
      this.checkForDuplicates();
    } else if (step === 4) {
      this.updateStep4Display();
    }
  },

  nextStep() {
    if (this.currentStep === 1) {
      if (!this.filePath) {
        alert('Veuillez sélectionner un fichier à importer avant de continuer.');
        return;
      }
      this.goToStep(2);
    } else if (this.currentStep === 2) {
      const id = document.getElementById('import-book-id').value.trim();
      const title = document.getElementById('import-book-title').value.trim();
      if (!id || !title) {
        alert('Veuillez renseigner au moins le titre et l\'identifiant court de l\'ouvrage.');
        return;
      }
      this.goToStep(3);
    } else if (this.currentStep === 3) {
      this.goToStep(4);
    }
  },

  prevStep() {
    if (this.currentStep > 1 && this.currentStep !== 'success') {
      this.goToStep(this.currentStep - 1);
    }
  },

  updateFooterButtonsUI() {
    const prevBtn = document.getElementById('btn-import-prev');
    const nextBtn = document.getElementById('btn-import-next');
    const submitBtn = document.getElementById('btn-submit-import-modal');
    const submitLabel = document.getElementById('btn-submit-import-label');

    if (this.isEditMode) {
      prevBtn?.classList.add('hidden');
      nextBtn?.classList.add('hidden');
      submitBtn?.classList.remove('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span id="btn-submit-import-label">Enregistrer les Modifications</span>`;
      }
      return;
    }

    if (this.currentStep === 1) {
      prevBtn?.classList.add('hidden');
      nextBtn?.classList.remove('hidden');
      submitBtn?.classList.add('hidden');
      if (nextBtn) {
        nextBtn.disabled = !this.filePath;
        nextBtn.innerHTML = `<span>Suivant : Métadonnées ➔</span>`;
      }
    } else if (this.currentStep === 2) {
      prevBtn?.classList.remove('hidden');
      nextBtn?.classList.remove('hidden');
      submitBtn?.classList.add('hidden');
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.innerHTML = `<span>Suivant : Structure ➔</span>`;
      }
    } else if (this.currentStep === 3) {
      prevBtn?.classList.remove('hidden');
      nextBtn?.classList.remove('hidden');
      submitBtn?.classList.add('hidden');
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.innerHTML = `<span>Suivant : Finalisation ➔</span>`;
      }
    } else if (this.currentStep === 4) {
      prevBtn?.classList.remove('hidden');
      nextBtn?.classList.add('hidden');
      submitBtn?.classList.remove('hidden');
      
      const isBible = document.getElementById('import-book-type')?.value === 'Bible';
      const isAI = App.isAIEnabled !== false;
      let labelText = "Lancer l'Importation & l'Indexation RAG";

      if (isBible) {
        labelText = 'Importer la Bible dans la Bibliothèque';
      } else if (!isAI) {
        labelText = 'Ajouter à la Bibliothèque (Local)';
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg><span id="btn-submit-import-label">${labelText}</span>`;
      }
    } else if (this.currentStep === 'success') {
      prevBtn?.classList.add('hidden');
      nextBtn?.classList.add('hidden');
      submitBtn?.classList.add('hidden');
      document.getElementById('btn-cancel-import-modal')?.classList.add('hidden');
    }
  },

  updateStep4Display() {
    const isBible = document.getElementById('import-book-type')?.value === 'Bible';
    const isAI = App.isAIEnabled !== false;
    
    const ragContent = document.getElementById('import-step-4-rag-content');
    const localContent = document.getElementById('import-step-4-local-content');
    const step4Title = document.getElementById('wizard-step-4-title');
    const step4Subtitle = document.getElementById('wizard-step-4-subtitle');

    if (isBible || !isAI) {
      ragContent?.classList.add('hidden');
      localContent?.classList.remove('hidden');
      if (step4Title) step4Title.textContent = 'Finalisation';
      if (step4Subtitle) step4Subtitle.textContent = 'Intégration locale';
    } else {
      ragContent?.classList.remove('hidden');
      localContent?.classList.add('hidden');
      if (step4Title) step4Title.textContent = 'Classification';
      if (step4Subtitle) step4Subtitle.textContent = 'Indexation & RAG';
    }
  },

  updateResourceTypeUI(type) {
    const isBible = type === 'Bible';
    const banner = document.getElementById('import-bible-banner');
    const ragOnlyLabel = document.getElementById('btn-ch-rag-label');

    if (banner) banner.classList.toggle('hidden', !isBible);
    
    if (ragOnlyLabel) {
      ragOnlyLabel.textContent = (App.isAIEnabled === false) ? 'Principaux' : 'RAG utile';
    }

    this.updateStep4Display();
    this.updateFooterButtonsUI();
  },

  checkForDuplicates() {
    const banner = document.getElementById('import-duplicate-alert');
    const descEl = document.getElementById('import-duplicate-desc');
    if (!banner || this.isEditMode) {
      banner?.classList.add('hidden');
      return;
    }

    const currentTitle = document.getElementById('import-book-title')?.value.trim() || '';
    const currentId = document.getElementById('import-book-id')?.value.trim() || '';

    if (!currentTitle && !currentId) {
      banner.classList.add('hidden');
      return;
    }

    const normTitle = normalizeString(currentTitle);
    const normId = normalizeString(currentId);

    const dup = this.installedBooksList.find(b => {
      const bTitle = normalizeString(b.title || b.name);
      const bId = normalizeString(b.name);
      if (bId && bId === normId) return true;
      if (bTitle && bTitle === normTitle) return true;
      if (bTitle.length > 8 && normTitle.length > 8 && (bTitle.includes(normTitle) || normTitle.includes(bTitle))) return true;
      return false;
    });

    if (dup) {
      banner.classList.remove('hidden');
      if (descEl) {
        descEl.textContent = `Un ouvrage nommé « ${dup.title || dup.name} » (${dup.name}) existe déjà dans votre bibliothèque. Vous pouvez le remplacer ou modifier le titre court pour créer une version distincte.`;
      }
    } else {
      banner.classList.add('hidden');
    }
  },

  populateBookDropdown() {
    const select = document.getElementById('import-rag-bookcode');
    if (!select) return;
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

  async open(editMode = false, book = null) {
    this.isEditMode = editMode;
    this.oldBookName = book ? (book.name || '') : '';
    this.filePath = book ? (book.file_path || '') : '';
    this.coverPath = book ? (book.cover_path || '') : '';
    this.coverDataUrl = book ? (book.cover_data_url || book.cover_url || book.cover_path || '') : '';
    this.chapters = [];
    this.userModifiedId = editMode;
    this.lastImportedBookInfo = null;

    // Recharger la liste des livres existants pour la détection des doublons
    try {
      this.installedBooksList = await API.call('get_library_books') || [];
    } catch (e) {
      this.installedBooksList = [];
    }

    const modalTitle = document.getElementById('import-modal-title');
    const stepper = document.getElementById('import-wizard-stepper');
    const cancelBtn = document.getElementById('btn-cancel-import-modal');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    if (editMode && book) {
      if (modalTitle) modalTitle.textContent = `Modifier les Métadonnées de l'Ouvrage`;
      if (stepper) stepper.style.display = 'none';

      document.getElementById('import-book-id').value = book.name || '';
      document.getElementById('import-book-title').value = book.title || book.name || '';
      document.getElementById('import-book-author').value = book.author || '';
      document.getElementById('import-book-desc').value = cleanHtml(book.description || '');
      document.getElementById('import-book-type').value = book.type || 'Théologie';
      document.getElementById('import-book-year').value = book.year || '';

      document.getElementById('import-rag-scope').value = book.corpus_scope || 'GLOBAL';
      document.getElementById('import-rag-stype').value = book.source_type || 'general';
      document.getElementById('import-rag-bookcode').value = book.book_code || '';
      document.getElementById('import-rag-embed').value = book.embedding_model || 'bge_multilingual_gemma2 (Infomaniak)';

      this.updateCoverPreview(this.coverDataUrl || this.coverPath);
      this.updateResourceTypeUI(book.type || 'Théologie');
      this.goToStep(2);
    } else {
      if (modalTitle) modalTitle.textContent = `Assistant d'Importation d'Ouvrages`;
      if (stepper) stepper.style.display = 'flex';

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

      document.getElementById('import-selected-file-card')?.classList.add('hidden');
      this.updateCoverPreview(null);
      this.renderChaptersList([]);
      this.updateResourceTypeUI('Théologie');
      this.goToStep(1);
    }

    document.getElementById('right-drawer')?.classList.add('collapsed');
    document.getElementById('btn-toggle-right-drawer')?.classList.remove('active');
    this.modalEl?.classList.remove('hidden');
  },

  close() {
    this.modalEl?.classList.add('hidden');
  },

  async pickFile() {
    if (this._isPickingFile) return;
    this._isPickingFile = true;

    try {
      const res = await API.call('pick_import_file');
      if (!res || res.cancelled) return;
      if (!res.success) {
        alert(`Erreur de sélection : ${res.error}`);
        return;
      }

      this.filePath = res.file_path;
      this.fileName = res.file_name;
      this.fileSize = res.file_size || 0;
      this.fileFormat = (res.format || '').toUpperCase();

      // Afficher la fiche du fichier chargé à l'étape 1
      const fileCard = document.getElementById('import-selected-file-card');
      const badgeEl = document.getElementById('file-card-format-badge');
      const nameEl = document.getElementById('import-selected-file-name');
      const metaEl = document.getElementById('import-selected-file-meta');

      if (fileCard) {
        fileCard.classList.remove('hidden');
        if (badgeEl) badgeEl.textContent = this.fileFormat || 'FICHIER';
        if (nameEl) nameEl.textContent = this.fileName;
        const sizeMb = (this.fileSize / (1024 * 1024)).toFixed(1);
        if (metaEl) metaEl.textContent = `${sizeMb} Mo • Prêt pour extraction`;
      }

      const info = res.info || {};
      const isBible = info.type === 'Bible' || info.is_bible;

      if (isBible) {
        document.getElementById('import-book-type').value = 'Bible';
        this.updateResourceTypeUI('Bible');
      } else {
        if (info.type) document.getElementById('import-book-type').value = info.type;
        this.updateResourceTypeUI(document.getElementById('import-book-type').value);
      }

      if (info.short_id) {
        document.getElementById('import-book-id').value = info.short_id;
        this.userModifiedId = true;
      } else if (info.title && !this.userModifiedId) {
        document.getElementById('import-book-id').value = generateShortId(info.title, document.getElementById('import-book-type').value);
      }

      if (info.title) {
        document.getElementById('import-book-title').value = info.title;
      }
      if (info.author) {
        document.getElementById('import-book-author').value = info.author;
      }
      if (info.description) {
        document.getElementById('import-book-desc').value = cleanHtml(info.description);
      }
      if (info.year) {
        document.getElementById('import-book-year').value = info.year;
      }

      if (info.cover_data_url || info.cover_path || info.cover_url) {
        const cUrl = info.cover_data_url || info.cover_url || info.cover_path;
        this.coverPath = cUrl;
        this.coverDataUrl = cUrl;
        this.updateCoverPreview(cUrl);
      } else if (isBible) {
        // Générer automatiquement une Smart Cover 2D épurée pour les Bibles
        this.generateSmartCover();
      }

      // Remplissage des chapitres
      if (info.chapters && info.chapters.length > 0) {
        this.chapters = info.chapters;
        this.renderChaptersList(this.chapters);
      } else {
        this.chapters = [];
        this.renderChaptersList([]);
      }

      // Activer le bouton Suivant à l'étape 1
      const nextBtn = document.getElementById('btn-import-next');
      if (nextBtn) nextBtn.disabled = false;

      App.showToast(`Document analysé avec succès : ${info.title || this.fileName}`);

    } catch (e) {
      console.error('Erreur pickFile:', e);
    } finally {
      this._isPickingFile = false;
    }
  },

  async pickCover() {
    if (this._isPickingCover) return;
    this._isPickingCover = true;

    try {
      const res = await API.call('pick_cover_image');
      if (!res || res.cancelled) return;
      if (res.success && (res.cover_data_url || res.cover_path)) {
        this.coverPath = res.cover_path;
        this.coverDataUrl = res.cover_data_url;
        this.updateCoverPreview(res.cover_data_url || res.cover_path);
        App.showToast('Image de couverture appliquée !');
      }
    } catch (e) {
      console.error('Erreur pickCover:', e);
    } finally {
      this._isPickingCover = false;
    }
  },

  async pasteCoverFromClipboard() {
    try {
      const bookId = document.getElementById('import-book-id')?.value.trim() || 'cover';
      const res = await API.call('paste_native_clipboard_cover', bookId);
      if (res && res.success && (res.cover_data_url || res.cover_path)) {
        this.coverPath = res.cover_path;
        this.coverDataUrl = res.cover_data_url;
        this.updateCoverPreview(res.cover_data_url || res.cover_path);
        App.showToast('Image collée depuis le presse-papier avec succès !');
        return;
      }
      
      if (res && res.error) {
        App.showToast(res.error);
        return;
      }
    } catch (err) {
      console.warn('Erreur paste native clipboard:', err);
      App.showToast('Erreur lors du collage depuis le presse-papier.');
    }
  },

  async handlePasteEvent(e) {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
          await this.applyClipboardBase64(loadEvent.target.result);
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
      }
    }
  },

  async applyClipboardBase64(dataUrl) {
    if (!dataUrl) return;
    try {
      const bookId = document.getElementById('import-book-id')?.value.trim() || 'cover';
      const res = await API.call('save_clipboard_cover', dataUrl, bookId);
      if (res && res.success) {
        this.coverPath = res.cover_path;
        this.coverDataUrl = res.cover_data_url;
        this.updateCoverPreview(res.cover_data_url || res.cover_path);
        App.showToast('Image collée depuis le presse-papier avec succès !');
      } else {
        this.coverPath = dataUrl;
        this.coverDataUrl = dataUrl;
        this.updateCoverPreview(dataUrl);
      }
    } catch (err) {
      this.coverPath = dataUrl;
      this.coverDataUrl = dataUrl;
      this.updateCoverPreview(dataUrl);
    }
  },

  generateSmartCover() {
    const title = document.getElementById('import-book-title')?.value || document.getElementById('import-book-id')?.value || 'OUVRAGE BIBLIQUE';
    const author = document.getElementById('import-book-author')?.value || '';
    const isBible = document.getElementById('import-book-type')?.value === 'Bible';
    
    // Génération locale de couverture élégante et épurée 2D avec Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');

    // Fond dégradé sobre et élégant
    const grad = ctx.createLinearGradient(0, 0, 0, 280);
    if (isBible) {
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(1, '#0F172A');
    } else {
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(1, '#1E3A8A');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 200, 280);

    // Cadre doré fin
    ctx.strokeStyle = isBible ? '#F59E0B' : '#60A5FA';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(10, 10, 180, 260);

    // Filet intérieur subtil
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, 172, 252);

    // Titre de l'ouvrage
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    const words = title.split(' ');
    let line1 = words.slice(0, 3).join(' ');
    let line2 = words.slice(3, 6).join(' ');
    let line3 = words.slice(6, 9).join(' ');

    ctx.fillText(line1, 100, 95);
    if (line2) ctx.fillText(line2, 100, 115);
    if (line3) ctx.fillText(line3, 100, 135);

    // Badge / type
    ctx.fillStyle = isBible ? '#FDE68A' : '#93C5FD';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(author || (isBible ? 'SAINTE BIBLE' : 'ÉTUDE THÉOLOGIQUE'), 100, 230);

    const dataUrl = canvas.toDataURL('image/png');
    this.coverPath = dataUrl;
    this.coverDataUrl = dataUrl;
    this.updateCoverPreview(dataUrl);
    App.showToast('Smart Cover 2D générée !');
  },

  async updateCoverPreview(pathOrUrl) {
    const imgEl = document.getElementById('import-cover-img');
    const placeholderEl = document.getElementById('import-cover-placeholder');

    if (!pathOrUrl) {
      if (imgEl) {
        imgEl.src = '';
        imgEl.classList.add('hidden');
      }
      if (placeholderEl) {
        placeholderEl.classList.remove('hidden');
        placeholderEl.textContent = 'Aucune image';
      }
      return;
    }

    let src = pathOrUrl;
    if (!src.startsWith('data:image/') && !src.startsWith('http://') && !src.startsWith('https://')) {
      try {
        const res = await API.call('get_cover_image_data', src);
        if (res && res.success && res.data_url) {
          src = res.data_url;
        }
      } catch (e) {
        console.warn('Erreur récupération cover data:', e);
      }
    }

    if (imgEl) {
      imgEl.src = src;
      imgEl.onload = () => {
        imgEl.classList.remove('hidden');
        placeholderEl?.classList.add('hidden');
      };
      imgEl.onerror = () => {
        imgEl.classList.add('hidden');
        if (placeholderEl) {
          placeholderEl.classList.remove('hidden');
          placeholderEl.textContent = 'Image non disponible';
        }
      };
    }
  },

  renderChaptersList(chapters) {
    const container = document.getElementById('import-chapters-scroll');
    const countEl = document.getElementById('import-ch-count');
    if (countEl) countEl.textContent = chapters.length;

    if (!container) return;

    if (chapters.length === 0) {
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;">Aucun chapitre distinct (le document sera indexé dans sa totalité).</div>`;
      return;
    }

    container.innerHTML = '';
    chapters.forEach((ch, idx) => {
      const row = document.createElement('div');
      row.className = 'import-chapter-row';

      const isSec = ch.is_section_header;
      const isSub = (ch.depth && ch.depth > 0) || ch.is_subsection;
      let titleHtml = ch.title;
      if (isSec) {
        titleHtml = `<span style="display: inline-block; padding: 1px 5px; background: rgba(245, 158, 11, 0.15); color: #F59E0B; border-radius: 4px; font-size: 10px; font-weight: 700; margin-right: 6px;">PARTIE</span><strong style="color: var(--text-primary);">${ch.title}</strong>`;
      } else if (isSub) {
        titleHtml = `<span style="color: var(--text-muted); margin-right: 4px;">↳</span><span style="opacity: 0.85;">${ch.title}</span>`;
      } else {
        titleHtml = `<span style="font-weight: 600;">${ch.title}</span>`;
      }

      row.innerHTML = `
        <input type="checkbox" id="ch-cb-${idx}" ${ch.include !== false ? 'checked' : ''}>
        <span class="import-chapter-title" style="${isSub ? 'padding-left: 14px;' : ''}" title="${ch.title}">${titleHtml}</span>
        
        <select class="import-chapter-select ch-scope-sel">
          <option value="GLOBAL" ${ch.corpus_scope === 'GLOBAL' ? 'selected' : ''}>GLOBAL</option>
          <option value="OT" ${ch.corpus_scope === 'OT' || ch.corpus_scope === 'AT' ? 'selected' : ''}>AT</option>
          <option value="NT" ${ch.corpus_scope === 'NT' ? 'selected' : ''}>NT</option>
          <option value="INTER" ${ch.corpus_scope === 'INTER' ? 'selected' : ''}>INTER</option>
          <option value="APO" ${ch.corpus_scope === 'APO' || ch.corpus_scope === 'APOCRYPHA' ? 'selected' : ''}>APO</option>
        </select>

        <select class="import-chapter-select ch-stype-sel">
          <option value="general" ${ch.source_type === 'general' ? 'selected' : ''}>Général</option>
          <option value="book_intro" ${ch.source_type === 'book_intro' ? 'selected' : ''}>Intro</option>
          <option value="systematic_theology" ${ch.source_type === 'systematic_theology' || ch.source_type === 'biblical_theology' ? 'selected' : ''}>Théol.</option>
          <option value="ot_context" ${ch.source_type === 'ot_context' || ch.source_type === 'nt_context' ? 'selected' : ''}>Contexte</option>
          <option value="commentary_verse" ${ch.source_type === 'commentary_verse' ? 'selected' : ''}>Commentaire</option>
          <option value="appendix" ${ch.source_type === 'appendix' ? 'selected' : ''}>Annexe</option>
        </select>
      `;

      row.querySelector(`#ch-cb-${idx}`)?.addEventListener('change', (e) => {
        ch.include = e.target.checked;
      });

      row.querySelector('.ch-scope-sel')?.addEventListener('change', (e) => {
        ch.corpus_scope = e.target.value;
      });

      row.querySelector('.ch-stype-sel')?.addEventListener('change', (e) => {
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
      const isApp = ch.source_type === 'appendix' || (ch.size && ch.size < 60) || (ch.size_chars && ch.size_chars < 60);
      ch.include = !isApp;
      const cb = document.getElementById(`ch-cb-${idx}`);
      if (cb) cb.checked = !isApp;
    });
  },

  openGoogleBooks() {
    const titleVal = document.getElementById('import-book-title')?.value || document.getElementById('import-book-id')?.value;
    const input = document.getElementById('gb-search-input');
    if (input) input.value = titleVal || '';
    this.gbModalEl?.classList.remove('hidden');
    if (titleVal) {
      this.searchGoogleBooks();
    }
  },

  closeGoogleBooks() {
    this.gbModalEl?.classList.add('hidden');
  },

  async searchGoogleBooks() {
    const q = document.getElementById('gb-search-input')?.value.trim();
    if (!q) return;

    const listEl = document.getElementById('gb-results-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 12px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div class="theol-spinner" style="width: 20px; height: 20px; border: 2px solid var(--border-color); border-top-color: var(--accent-blue); border-radius: 50%; animation: theolSpin 0.8s linear infinite;"></div>
        <span>Recherche simultanée sur <strong>Google Books, Open Library, BnF Gallica et Wikipédia</strong>...</span>
      </div>
    `;

    try {
      const results = await API.call('search_google_books_metadata', q);
      if (!results || results.length === 0) {
        listEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 12px;">Aucun résultat trouvé pour « ${q} ».</div>`;
        return;
      }

      listEl.innerHTML = '';
      results.forEach(res => {
        const card = document.createElement('div');
        card.className = 'gb-result-card';

        const thumbHtml = res.cover_url 
          ? `<img src="${res.cover_url}" class="gb-thumb" alt="Cover" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="gb-thumb" style="display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted); text-align: center; padding: 4px;">Sans image</div>`;

        const cleanDesc = cleanHtml(res.description || '');
        const authorsText = res.author_str || (res.authors || []).join(', ') || 'Auteur inconnu';
        const yearText = res.year || (res.published_date ? String(res.published_date).slice(0, 4) : '') || '—';
        const badgeColor = res.source_badge_color || '#2563EB';
        const badgeLabel = res.source_badge || res.source || 'Catalogue';

        card.innerHTML = `
          ${thumbHtml}
          <div class="gb-info">
            <div class="gb-title-row">
              <div class="gb-title">${res.title}</div>
              <span class="gb-source-badge" style="background-color: ${badgeColor};">${badgeLabel}</span>
            </div>
            <div class="gb-author">${authorsText} • <span style="opacity: 0.85;">${yearText}</span>${res.publisher ? ` • <span style="font-size: 10.5px; opacity: 0.75;">${res.publisher}</span>` : ''}</div>
            <div class="gb-desc">${cleanDesc || 'Notice bibliographique indexée.'}</div>
          </div>
        `;

        card.addEventListener('click', async () => {
          document.getElementById('import-book-title').value = res.title || '';
          
          if (!this.userModifiedId) {
            document.getElementById('import-book-id').value = generateShortId(res.title, document.getElementById('import-book-type').value);
          }
          
          document.getElementById('import-book-author').value = authorsText !== 'Auteur inconnu' ? authorsText : '';
          document.getElementById('import-book-desc').value = cleanDesc;
          if (res.year || res.published_date) {
            document.getElementById('import-book-year').value = res.year || String(res.published_date).slice(0, 4);
          }

          if (res.cover_url) {
            try {
              App.showToast(`Téléchargement de la couverture (${badgeLabel})...`);
              const localCover = await API.call('download_book_cover', res.cover_url, res.title);
              if (localCover) {
                this.coverPath = localCover;
                this.updateCoverPreview(localCover);
              } else {
                this.coverPath = res.cover_url;
                this.updateCoverPreview(res.cover_url);
              }
            } catch (err) {
              this.coverPath = res.cover_url;
              this.updateCoverPreview(res.cover_url);
            }
          }

          this.closeGoogleBooks();
          this.checkForDuplicates();
          App.showToast(`Métadonnées appliquées depuis ${badgeLabel} !`);
        });

        listEl.appendChild(card);
      });

    } catch (e) {
      listEl.innerHTML = `<div style="padding: 20px; color: var(--accent-red); text-align: center;">Erreur lors de la recherche en ligne.</div>`;
    }
  },

  async runAutoClassify() {
    const title = document.getElementById('import-book-title')?.value || document.getElementById('import-book-id')?.value;
    const desc = document.getElementById('import-book-desc')?.value || '';
    if (!title && !desc) {
      alert('Veuillez renseigner au moins le titre ou la description pour lancer la classification IA.');
      return;
    }

    const btn = document.getElementById('btn-import-autoclassify');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span><span>Classification IA...</span>`;

    try {
      const tags = await API.call('auto_classify_document_metadata', title, desc);
      if (tags) {
        if (tags.corpus_scope) document.getElementById('import-rag-scope').value = tags.corpus_scope;
        if (tags.source_type) document.getElementById('import-rag-stype').value = tags.source_type;
        if (tags.book_code) document.getElementById('import-rag-bookcode').value = tags.book_code;
        App.showToast('Classification RAG Tri-Flux appliquée par IA !');
      }
    } catch (e) {
      console.error('Erreur auto_classify:', e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg><span>Auto-classifier (IA)</span>`;
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
      description: cleanHtml(document.getElementById('import-book-desc').value.trim()),
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

    const isBible = payload.type === 'Bible';
    const submitBtn = document.getElementById('btn-submit-import-modal');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = this.isEditMode
        ? `<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span> <span>Enregistrement...</span>`
        : (isBible 
          ? `<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span> <span>Intégration de la Bible...</span>`
          : `<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span> <span>Préparation et indexation...</span>`);
    }

    try {
      const res = await API.call('execute_document_import', payload);
      if (res && res.success) {
        this.lastImportedBookInfo = payload;
        
        if (this.isEditMode) {
          this.close();
          App.showToast('Métadonnées enregistrées avec succès !', 'success');
          if (typeof LibraryView !== 'undefined' && typeof LibraryView.loadBooks === 'function') {
            LibraryView.loadBooks();
          }
          if (typeof TheologyView !== 'undefined' && typeof TheologyView.loadBooksList === 'function') {
            TheologyView.loadBooksList();
          }
        } else {
          // Jouer le son zen harmonieux
          playSuccessSound();

          // Afficher l'écran de succès animé
          this.showSuccessScreen(payload, res);
          
          if (typeof LibraryView !== 'undefined' && typeof LibraryView.loadBooks === 'function') {
            LibraryView.loadBooks();
          }
          if (typeof TheologyView !== 'undefined' && typeof TheologyView.loadBooksList === 'function') {
            TheologyView.loadBooksList();
          }
          if (typeof BibleReader !== 'undefined') {
            API.call('get_installed_bibles').then(bList => {
              BibleReader.installedBibles = bList || [];
            }).catch(() => {});
          }
        }
      } else {
        alert(`Erreur d'import : ${res?.error || 'Erreur inconnue'}`);
      }
    } catch (e) {
      alert(`Erreur d'importation : ${e}`);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      this.updateResourceTypeUI(payload.type);
    }
  },

  showSuccessScreen(bookInfo, res) {
    this.currentStep = 'success';

    // Masquer tous les panneaux
    document.querySelectorAll('.wizard-pane').forEach(p => p.classList.add('hidden'));

    // Masquer le stepper et afficher l'écran de succès
    const stepper = document.getElementById('import-wizard-stepper');
    if (stepper) stepper.style.display = 'none';

    const successPane = document.getElementById('import-step-success');
    if (successPane) successPane.classList.remove('hidden');

    // Remplir la fiche résumé du livre importé
    const titleEl = document.getElementById('success-book-title');
    const metaEl = document.getElementById('success-book-meta');
    const subtitleEl = document.getElementById('import-success-subtitle');
    const thumbEl = document.getElementById('success-cover-thumb');

    if (titleEl) titleEl.textContent = bookInfo.title || bookInfo.name;
    
    const isBible = bookInfo.type === 'Bible';
    const isBackground = res?.background_indexing;

    if (subtitleEl) {
      if (isBible) {
        subtitleEl.textContent = `La Bible « ${bookInfo.title || bookInfo.name} » a été convertie et intégrée (${res.books_count || 66} livres). Prête à être consultée !`;
      } else if (isBackground) {
        subtitleEl.textContent = `L'ouvrage « ${bookInfo.title || bookInfo.name} » est immédiatement disponible à la lecture. L'indexation vectorielle IA se poursuit en arrière-plan (progression visible en bas à droite).`;
      } else {
        subtitleEl.textContent = `L'ouvrage « ${bookInfo.title || bookInfo.name} » a été ajouté à votre bibliothèque (${res.chunks_count || 0} fragments traités).`;
      }
    }

    if (metaEl) {
      metaEl.textContent = `${bookInfo.author || 'Auteur non précisé'} • ${bookInfo.type || 'Théologie'} • ${bookInfo.year || 'Édition'}`;
    }

    if (thumbEl) {
      const coverSrc = this.coverDataUrl || this.coverPath;
      if (coverSrc) {
        thumbEl.src = coverSrc;
        thumbEl.style.display = 'block';
      } else {
        thumbEl.style.display = 'none';
      }
    }

    this.updateFooterButtonsUI();
  }
};

window.ImportModal = ImportModal;
