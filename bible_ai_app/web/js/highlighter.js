/**
 * Highlighter Manager - Système de surlignage réaliste style Logos
 * Gère la palette flottante, le mode stylo actif, le bouton Surligner supérieur et l'application des surlignages au DOM.
 */

const HighlighterManager = {
  activeColor: 'yellow',
  activeStyle: 'felt',
  isPenModeActive: false,
  paletteEl: null,
  popoverEl: null,
  currentSelectionRef: null, // { book, chapter, verseStart, verseEnd, text }

  colors: [
    { id: 'yellow', name: 'Jaune Solaire' },
    { id: 'green', name: 'Vert Sauge' },
    { id: 'blue', name: 'Bleu Céleste' },
    { id: 'amber', name: 'Ambre Doré' },
    { id: 'purple', name: 'Lavande Douce' },
    { id: 'rose', name: 'Rose Corail' }
  ],

  styles: [
    { id: 'felt', name: 'Feutre Large' },
    { id: 'underline', name: 'Souligné Épais' }
  ],

  init() {
    this.createPaletteDom();
    this.initTopToolbar();
    this.bindEvents();
  },

  initTopToolbar() {
    const btn = document.getElementById('btn-highlight-options');
    const popover = document.getElementById('highlight-options-popover');
    if (!btn || !popover) return;

    this.popoverEl = popover;

    // Toggle popover au clic sur le bouton Surligner ▾
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Fermer les autres popovers si ouverts
      document.getElementById('display-options-popover')?.classList.add('hidden');
      document.getElementById('interlinear-layers-popover')?.classList.add('hidden');

      const isHidden = popover.classList.contains('hidden');
      popover.classList.toggle('hidden', !isHidden);
      btn.classList.toggle('active', isHidden);
    });

    // Fermeture au clic extérieur
    document.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        popover.classList.add('hidden');
        btn.classList.remove('active');
      }
    });

    // Bouton Activer / Désactiver Stylo dans le popover
    const penToggleBtn = document.getElementById('btn-top-toggle-pen');
    if (penToggleBtn) {
      penToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePenMode();
        this.updateTopPopoverUi();
      });
    }

    // Sélecteur de couleur dans le popover
    popover.querySelectorAll('.hl-swatch-picker').forEach(sw => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = sw.dataset.color;
        if (color) {
          this.activeColor = color;
          this.updatePenCursor();
          this.updateTopPopoverUi();
          App.showToast(`Couleur active : ${this.getColorName(color)}`);
        }
      });
    });

    // Style de tracé dans le popover
    popover.querySelectorAll('input[name="opt-top-hl-style"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.activeStyle = e.target.value;
      });
    });

    // Exporter en JSON
    document.getElementById('btn-top-export-json')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      popover.classList.add('hidden');
      btn.classList.remove('active');
      try {
        const res = await API.exportHighlights('json');
        if (res && res.success) {
          App.showToast(`Surlignages exportés avec succès (JSON)`);
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur export : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur export JSON', err);
      }
    });

    // Exporter en Markdown (.md)
    document.getElementById('btn-top-export-md')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      popover.classList.add('hidden');
      btn.classList.remove('active');
      try {
        const res = await API.exportHighlights('md');
        if (res && res.success) {
          App.showToast(`Surlignages exportés avec succès (Markdown)`);
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur export : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur export MD', err);
      }
    });

    // Importer en JSON
    document.getElementById('btn-top-import-json')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      popover.classList.add('hidden');
      btn.classList.remove('active');
      try {
        const res = await API.importHighlights('merge');
        if (res && res.success) {
          App.showToast(`✓ ${res.imported_count} surlignage(s) importé(s) avec succès (${res.total_count} au total)`);
          if (typeof BibleReader !== 'undefined') {
            this.renderChapterHighlights(BibleReader.currentBook, BibleReader.currentChapter);
          }
        } else if (res && !res.cancelled) {
          App.showToast(`Erreur import : ${res.error || 'inconnue'}`);
        }
      } catch (err) {
        console.error('Erreur import JSON', err);
      }
    });

    // Effacer le surlignage actif depuis le popover
    document.getElementById('btn-top-erase-selected')?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.add('hidden');
      btn.classList.remove('active');
      if (typeof BibleReader !== 'undefined') {
        const book = BibleReader.currentBook;
        const chapter = BibleReader.currentChapter;
        const verse = BibleReader.selectedVerse || 1;
        this.currentSelectionRef = {
          book, chapter, verseStart: verse, verseEnd: verse, text: ''
        };
        this.eraseHighlight();
      }
    });

    // Ouvrir les notes
    document.getElementById('btn-top-view-all-hl')?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.add('hidden');
      btn.classList.remove('active');
      const drawer = document.getElementById('right-drawer');
      if (drawer) drawer.classList.remove('collapsed');
      document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
    });

    this.updatePenCursor();
    this.updateTopPopoverUi();
  },

  getColorName(colorId) {
    const found = this.colors.find(c => c.id === colorId);
    return found ? found.name : colorId;
  },

  getPenCursor(colorId) {
    const hexMap = {
      yellow: '#EAB308',
      green:  '#22C55E',
      blue:   '#0EA5E9',
      amber:  '#F97316',
      purple: '#A855F7',
      rose:   '#F43F5E'
    };
    const color = hexMap[colorId] || '#EAB308';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <g transform="rotate(-35 8 26)">
        <rect x="5" y="4" width="10" height="16" rx="2" fill="#1e293b" stroke="#ffffff" stroke-width="1.2"/>
        <rect x="7" y="6" width="6" height="8" rx="1" fill="#475569"/>
        <path d="M5 20 L15 20 L13 28 L5 24 Z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
      </g>
    </svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 4 28, crosshair`;
  },

  updatePenCursor() {
    document.documentElement.style.setProperty('--hl-pen-cursor', this.getPenCursor(this.activeColor));
  },

  updateTopPopoverUi() {
    if (!this.popoverEl) return;

    // Mise à jour des pastilles actives
    this.popoverEl.querySelectorAll('.hl-swatch-picker').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === this.activeColor);
    });

    // Mise à jour bouton stylo
    const penToggleBtn = document.getElementById('btn-top-toggle-pen');
    const indicator = document.getElementById('hl-popover-active-indicator');
    if (penToggleBtn) {
      penToggleBtn.textContent = this.isPenModeActive ? 'Désactiver' : 'Activer';
      penToggleBtn.className = this.isPenModeActive ? 'btn-primary' : 'btn-secondary';
    }
    if (indicator) {
      indicator.textContent = this.isPenModeActive ? '✏️ Stylo Actif' : 'Mode Normal';
      indicator.style.color = this.isPenModeActive ? 'var(--accent-green, #10b981)' : 'var(--accent-blue, #2563eb)';
    }

    const btnTop = document.getElementById('btn-highlight-options');
    if (btnTop) {
      if (this.isPenModeActive) {
        btnTop.style.color = 'var(--accent-blue)';
        btnTop.style.fontWeight = '700';
      } else {
        btnTop.style.color = '';
        btnTop.style.fontWeight = '';
      }
    }
  },

  createPaletteDom() {
    if (document.getElementById('hl-palette')) return;

    const palette = document.createElement('div');
    palette.id = 'hl-palette';
    palette.className = 'hl-palette hidden';
    
    let colorsHtml = this.colors.map(c => `
      <button type="button" class="hl-color-btn hl-bg-${c.id}" data-color="${c.id}" title="${c.name}"></button>
    `).join('');

    palette.innerHTML = `
      <div class="hl-palette-colors">
        ${colorsHtml}
        <div class="hl-divider"></div>
        <button type="button" class="hl-action-btn" id="hl-btn-note" title="Ajouter une note">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>
        <button type="button" class="hl-action-btn" id="hl-btn-erase" title="Effacer le surlignage">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    `;

    document.body.appendChild(palette);
    this.paletteEl = palette;

    this.paletteEl.querySelectorAll('.hl-color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyHighlight(btn.dataset.color, this.activeStyle);
      });
    });

    document.getElementById('hl-btn-note')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.createNoteForHighlight();
    });

    document.getElementById('hl-btn-erase')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.eraseHighlight();
    });
  },

  bindEvents() {
    // Écouter la sélection de texte dans BibleReader
    document.addEventListener('mouseup', (e) => {
      // Ignorer si on clique dans la palette ou menus
      if (e.target.closest('.hl-palette, #highlight-options-popover, #display-options-popover, #selection-context-menu, #bible-context-menu, #note-edit-content, input, textarea')) return;

      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';

      if (text && text.length > 0) {
        this.captureSelectionRef(selection);
        if (this.currentSelectionRef) {
          if (this.isPenModeActive) {
            // Surlignage direct automatique en mode stylo actif !
            const color = this.activeColor;
            const style = this.activeStyle;
            this.applyHighlight(color, style);
            setTimeout(() => {
              window.getSelection()?.removeAllRanges();
            }, 50);
          } else {
            this.showPalette(e.clientX, e.clientY);
          }
        }
      } else {
        this.hidePalette();
      }
    });

    // Raccourcis clavier (1-6 pour couleurs, H pour stylo)
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
      
      if (e.key === 'h' || e.key === 'H') {
        this.togglePenMode();
        this.updateTopPopoverUi();
      } else if (['1','2','3','4','5','6'].includes(e.key) && this.currentSelectionRef) {
        const idx = parseInt(e.key) - 1;
        if (this.colors[idx]) {
          this.applyHighlight(this.colors[idx].id, this.activeStyle);
          window.getSelection()?.removeAllRanges();
          this.hidePalette();
        }
      }
    });
  },

  captureSelectionRef(selection) {
    if (!selection || selection.rangeCount === 0) {
      this.currentSelectionRef = null;
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      this.currentSelectionRef = null;
      return;
    }

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const endNode = range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer;

    const startVerseItem = startNode.closest('.verse-item');
    const endVerseItem = endNode.closest('.verse-item');

    if (startVerseItem && typeof BibleReader !== 'undefined') {
      const book = startVerseItem.dataset.bookCode || BibleReader.currentBook;
      const chapter = parseInt(startVerseItem.dataset.chapter || BibleReader.currentChapter, 10);
      let vStart = parseInt(startVerseItem.dataset.verseNum || startVerseItem.dataset.verse || 1, 10);
      let vEnd = endVerseItem ? parseInt(endVerseItem.dataset.verseNum || endVerseItem.dataset.verse || vStart, 10) : vStart;

      if (vStart > vEnd) [vStart, vEnd] = [vEnd, vStart];

      // Récupérer les indices précis de mots de début et de fin
      let startWordIdx = 0;
      const vStartWords = Array.from(startVerseItem.querySelectorAll('.word-token'));
      const startWord = startNode.closest('.word-token');
      if (startWord) {
        const idx = vStartWords.indexOf(startWord);
        if (idx !== -1) startWordIdx = idx;
      } else {
        for (let i = 0; i < vStartWords.length; i++) {
          if (range.intersectsNode(vStartWords[i])) {
            startWordIdx = i;
            break;
          }
        }
      }

      let endWordIdx = -1;
      const targetEndVerse = endVerseItem || startVerseItem;
      const vEndWords = Array.from(targetEndVerse.querySelectorAll('.word-token'));
      const endWord = endNode.closest('.word-token');
      if (endWord) {
        const idx = vEndWords.indexOf(endWord);
        if (idx !== -1) endWordIdx = idx;
      } else {
        for (let i = vEndWords.length - 1; i >= 0; i--) {
          if (range.intersectsNode(vEndWords[i])) {
            endWordIdx = i;
            break;
          }
        }
        if (endWordIdx === -1) endWordIdx = vEndWords.length - 1;
      }

      // Vérifier s'il s'agit d'un surlignage partiel ou d'un verset complet
      let isFullVerse = false;
      if (vStart === vEnd) {
        if (vStartWords.length > 0 && startWordIdx === 0 && endWordIdx >= vStartWords.length - 1) {
          isFullVerse = true;
        }
      }

      const version = (typeof BibleReader !== 'undefined' ? BibleReader.currentVersion : 'lsg') || 'lsg';

      this.currentSelectionRef = {
        book,
        chapter,
        verseStart: vStart,
        verseEnd: vEnd,
        startWordIdx,
        endWordIdx,
        text,
        isFullVerse,
        version
      };
    } else {
      this.currentSelectionRef = null;
    }
  },

  showPalette(x, y) {
    if (!this.paletteEl) return;
    this.paletteEl.classList.remove('hidden');
    
    let left = x - 90;
    let top = y - 55;

    if (left < 10) left = 10;
    if (top < 10) top = y + 25;

    this.paletteEl.style.left = `${left}px`;
    this.paletteEl.style.top = `${top}px`;
  },

  hidePalette() {
    if (this.paletteEl) this.paletteEl.classList.add('hidden');
  },

  togglePenMode() {
    this.isPenModeActive = !this.isPenModeActive;
    document.body.classList.toggle('hl-pen-mode-active', this.isPenModeActive);
    this.updatePenCursor();
    this.updateTopPopoverUi();
    
    if (this.isPenModeActive) {
      App.showToast(`✏️ Mode Surligneur activé (${this.getColorName(this.activeColor)}). Glissez sur le texte biblique.`, 2500);
    } else {
      App.showToast("Mode Surligneur désactivé.", 1500);
    }
  },

  async applyHighlight(color, style) {
    if (!this.currentSelectionRef) return;
    
    const { book, chapter, verseStart, verseEnd, startWordIdx, endWordIdx, text, isFullVerse, version } = this.currentSelectionRef;
    
    const hlData = {
      book,
      chapter,
      verse_start: verseStart,
      verse_end: verseEnd,
      start_word_idx: startWordIdx,
      end_word_idx: endWordIdx,
      selected_text: text,
      is_full_verse: isFullVerse !== false,
      version: version || (typeof BibleReader !== 'undefined' ? BibleReader.currentVersion : 'lsg'),
      color: color || this.activeColor,
      style: style || this.activeStyle
    };

    try {
      const saved = await API.saveHighlight(hlData);
      if (saved) {
        this.hidePalette();
        await this.renderChapterHighlights(book, chapter, hlData.version);
        App.showToast(`Passage surligné en ${this.getColorName(hlData.color)}`);
        
        // Actualiser la vue notes si le volet est ouvert
        if (!document.getElementById('right-drawer').classList.contains('collapsed')) {
          if (typeof BibleReader !== 'undefined') BibleReader.loadNotesForVerse(verseStart, book, chapter);
        }
      }
    } catch (e) {
      console.error('Erreur sauvegarde surlignage', e);
    }
  },

  async eraseHighlight() {
    if (!this.currentSelectionRef) return;
    const { book, chapter, verseStart, verseEnd, version } = this.currentSelectionRef;
    const curVer = version || (typeof BibleReader !== 'undefined' ? BibleReader.currentVersion : '');
    
    try {
      const deletedCount = await API.deleteHighlightsForPassage(book, chapter, verseStart, verseEnd, curVer);
      this.hidePalette();
      await this.renderChapterHighlights(book, chapter, curVer);
      if (deletedCount > 0) {
        App.showToast("Surlignage supprimé avec succès.");
      } else {
        App.showToast("Aucun surlignage à supprimer sur ce passage.", 1500);
      }
    } catch (e) {
      console.error('Erreur effacement surlignage', e);
    }
  },

  async createNoteForHighlight() {
    if (!this.currentSelectionRef) return;
    const { book, chapter, verseStart, verseEnd, startWordIdx, endWordIdx, text, isFullVerse, version } = this.currentSelectionRef;
    
    const hlData = {
      book, chapter, verse_start: verseStart, verse_end: verseEnd,
      start_word_idx: startWordIdx, end_word_idx: endWordIdx,
      selected_text: text,
      is_full_verse: isFullVerse !== false,
      version: version || (typeof BibleReader !== 'undefined' ? BibleReader.currentVersion : 'lsg'),
      color: this.activeColor, style: this.activeStyle
    };

    try {
      const saved = await API.saveHighlight(hlData);
      if (saved) {
        const info = typeof getBookInfo !== 'undefined' ? getBookInfo(book) : { name: book };
        const refStr = `${info.name} ${chapter}:${verseStart === verseEnd ? verseStart : verseStart + '-' + verseEnd}`;
        
        const note = await API.createNoteFromHighlight(saved.id, text, refStr);
        if (note) {
          App.showToast("Note liée créée avec succès.");
          this.hidePalette();
          await this.renderChapterHighlights(book, chapter, hlData.version);
          
          // Ouvrir le volet droit sur l'onglet Notes
          if (typeof BibleReader !== 'undefined') {
            const drawer = document.getElementById('right-drawer');
            if (drawer) drawer.classList.remove('collapsed');
            document.querySelector('.drawer-tab[data-drawer-tab="notes"]')?.click();
            BibleReader.loadNotesForVerse(verseStart, book, chapter);
          }
        }
      }
    } catch (e) {
      console.error('Erreur création note surlignage', e);
    }
  },

  async renderChapterHighlights(book, chapter, version = null) {
    if (typeof BibleReader === 'undefined') return;
    
    try {
      const currentVer = version || (typeof BibleReader !== 'undefined' ? BibleReader.currentVersion : '');
      const highlights = await API.getHighlightsForChapter(book, chapter, currentVer);
      if (!highlights) return;

      const cleanBook = (book || '').toLowerCase();
      const chNum = parseInt(chapter, 10);

      // 1. Nettoyer les anciens surlignages du DOM du chapitre
      document.querySelectorAll('.verse-item').forEach(el => {
        const elBook = (el.dataset.bookCode || '').toLowerCase();
        const elChap = parseInt(el.dataset.chapter, 10);
        if (elBook === cleanBook && elChap === chNum) {
          this.clearHighlightClasses(el);
          el.querySelectorAll('.word-token').forEach(w => this.clearHighlightClasses(w));
        }
      });

      // 2. Appliquer les surlignages
      highlights.forEach(hl => {
        const styleName = hl.style || 'felt';
        const colorName = hl.color || 'yellow';
        const className = `hl-${styleName}-${colorName}`;
        const isMultiVerse = hl.verse_start < hl.verse_end;
        const isPartial = hl.is_full_verse === false;

        for (let v = hl.verse_start; v <= hl.verse_end; v++) {
          const verseEls = document.querySelectorAll(`.verse-item[data-verse-num="${v}"]`);
          
          let rangeClass = 'hl-range-single';
          if (isMultiVerse) {
            if (v === hl.verse_start) {
              rangeClass = 'hl-range-start';
            } else if (v === hl.verse_end) {
              rangeClass = 'hl-range-end';
            } else {
              rangeClass = 'hl-range-mid';
            }
          }

          verseEls.forEach(vEl => {
            const elBook = (vEl.dataset.bookCode || '').toLowerCase();
            const elChap = parseInt(vEl.dataset.chapter, 10);
            if (elBook === cleanBook && elChap === chNum) {
              if (isPartial) {
                // Surlignage partiel sans trous
                this.renderPartialHighlightForVerse(vEl, v, hl, className, rangeClass);
              } else {
                // Surlignage du verset complet
                vEl.classList.add(className, rangeClass);
                if (hl.note_id) vEl.classList.add('hl-has-note');
              }
            }
          });
        }
      });
    } catch (e) {
      console.error('Erreur rendu highlights', e);
    }
  },

  renderPartialHighlightForVerse(verseEl, verseNum, hl, className, rangeClass) {
    if (!verseEl) return;
    const wordTokens = Array.from(verseEl.querySelectorAll('.word-token'));
    if (wordTokens.length === 0) return;

    const isMulti = hl.verse_start < hl.verse_end;
    let sIdx = 0;
    let eIdx = wordTokens.length - 1;

    if (!isMulti) {
      // 1. Verset unique partiel
      if (hl.start_word_idx != null && hl.end_word_idx != null && hl.end_word_idx >= 0) {
        sIdx = hl.start_word_idx;
        eIdx = hl.end_word_idx;
      } else {
        const found = this.findWordRangeInVerse(verseEl, hl.selected_text);
        if (found) {
          sIdx = found.start;
          eIdx = found.end;
        }
      }
    } else {
      // 2. Passage multi-versets partiel
      if (verseNum === hl.verse_start) {
        // Premier verset du passage : commence à start_word_idx et va jusqu'à la FIN du verset
        if (hl.start_word_idx != null) {
          sIdx = hl.start_word_idx;
        } else {
          const found = this.findWordRangeInVerse(verseEl, hl.selected_text);
          if (found) sIdx = found.start;
        }
        eIdx = wordTokens.length - 1;
      } else if (verseNum === hl.verse_end) {
        // Dernier verset du passage : commence au DÉBUT du verset et va jusqu'à end_word_idx
        sIdx = 0;
        if (hl.end_word_idx != null && hl.end_word_idx >= 0) {
          eIdx = hl.end_word_idx;
        } else {
          const found = this.findWordRangeInVerse(verseEl, hl.selected_text);
          if (found) eIdx = found.end;
        }
      } else {
        // Verset intermédiaire : 100% de tout le verset
        sIdx = 0;
        eIdx = wordTokens.length - 1;
      }
    }

    this.wrapWordTokensRange(verseEl, sIdx, eIdx, className, rangeClass, hl.id, !!hl.note_id);
  },

  findWordRangeInVerse(verseEl, selectedText) {
    if (!verseEl || !selectedText) return null;
    const targetText = selectedText.trim();
    if (!targetText) return null;

    const wordTokens = Array.from(verseEl.querySelectorAll('.word-token'));
    if (wordTokens.length === 0) return null;

    const cleanWords = wordTokens.map(w => w.textContent.trim());
    const targetWords = targetText.split(/\s+/).filter(w => w.length > 0);

    const normalize = s => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const normTarget = targetWords.map(normalize).filter(w => w.length > 0);
    const normClean = cleanWords.map(normalize);

    if (normTarget.length === 0) return null;

    // 1. Chercher la séquence complète continue
    for (let i = 0; i <= normClean.length - normTarget.length; i++) {
      let match = true;
      for (let j = 0; j < normTarget.length; j++) {
        if (!normClean[i + j].includes(normTarget[j]) && !normTarget[j].includes(normClean[i + j])) {
          match = false;
          break;
        }
      }
      if (match) {
        return { start: i, end: i + normTarget.length - 1 };
      }
    }

    // 2. Chercher les premiers mots (début de sélection)
    for (let len = Math.min(normTarget.length, 5); len >= 1; len--) {
      const subTarget = normTarget.slice(0, len);
      for (let i = 0; i <= normClean.length - len; i++) {
        let match = true;
        for (let j = 0; j < len; j++) {
          if (!normClean[i + j].includes(subTarget[j]) && !subTarget[j].includes(normClean[i + j])) {
            match = false;
            break;
          }
        }
        if (match) {
          return { start: i, end: Math.min(normClean.length - 1, i + normTarget.length - 1) };
        }
      }
    }

    // 3. Chercher les derniers mots (fin de sélection)
    for (let len = Math.min(normTarget.length, 5); len >= 1; len--) {
      const subTarget = normTarget.slice(normTarget.length - len);
      for (let i = normClean.length - len; i >= 0; i--) {
        let match = true;
        for (let j = 0; j < len; j++) {
          if (!normClean[i + j].includes(subTarget[j]) && !subTarget[j].includes(normClean[i + j])) {
            match = false;
            break;
          }
        }
        if (match) {
          return { start: 0, end: i + len - 1 };
        }
      }
    }

    return null;
  },

  wrapWordTokensRange(verseEl, startIdx, endIdx, className, rangeClass, hlId, hasNote) {
    if (!verseEl) return;
    const wordTokens = Array.from(verseEl.querySelectorAll('.word-token'));
    if (wordTokens.length === 0) return;

    const sIdx = Math.max(0, Math.min(startIdx, wordTokens.length - 1));
    const eIdx = Math.max(0, Math.min(endIdx === -1 ? wordTokens.length - 1 : endIdx, wordTokens.length - 1));

    if (sIdx > eIdx) return;

    let startEl = wordTokens[sIdx];
    const endEl = wordTokens[eIdx];

    // Si on commence au début du verset (mot 0), inclure le numéro de verset <sup class="verse-num"> pour éliminer toute coupure
    if (sIdx === 0) {
      const numEl = verseEl.querySelector('.verse-num');
      if (numEl && numEl.parentNode === verseEl) {
        startEl = numEl;
      }
    }

    if (startEl.closest('.verse-highlight') || endEl.closest('.verse-highlight')) return;

    const hlSpan = document.createElement('span');
    hlSpan.className = `verse-highlight ${className} ${rangeClass}`;
    if (hlId) hlSpan.dataset.hlId = hlId;
    if (hasNote) hlSpan.classList.add('hl-has-note');

    const nodesToWrap = [];
    let curr = startEl;
    while (curr) {
      nodesToWrap.push(curr);
      if (curr === endEl) {
        // Si c'est le dernier mot du verset, englober également l'espace ou ponctuation finale pour un raccordement sans faille
        if (eIdx === wordTokens.length - 1) {
          while (curr.nextSibling && (curr.nextSibling.nodeType === 3 || !curr.nextSibling.classList?.contains('word-token'))) {
            curr = curr.nextSibling;
            nodesToWrap.push(curr);
          }
        }
        break;
      }
      curr = curr.nextSibling;
    }

    if (nodesToWrap.length > 0 && startEl.parentNode) {
      startEl.parentNode.insertBefore(hlSpan, startEl);
      nodesToWrap.forEach(node => hlSpan.appendChild(node));
    }
  },

  clearHighlightClasses(element) {
    if (!element) return;
    this.colors.forEach(c => {
      this.styles.forEach(s => {
        element.classList.remove(`hl-${s.id}-${c.id}`);
      });
    });
    element.classList.remove('hl-has-note', 'hl-range-single', 'hl-range-start', 'hl-range-mid', 'hl-range-end');
    
    // Dé-emballer les spans .verse-highlight
    element.querySelectorAll('.verse-highlight').forEach(wrapper => {
      const parent = wrapper.parentNode;
      if (parent) {
        while (wrapper.firstChild) {
          parent.insertBefore(wrapper.firstChild, wrapper);
        }
        parent.removeChild(wrapper);
      }
    });
  }
};
