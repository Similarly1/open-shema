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

    this.updateTopPopoverUi();
  },

  getColorName(colorId) {
    const found = this.colors.find(c => c.id === colorId);
    return found ? found.name : colorId;
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

      if (text && text.length > 0 && e.target.closest('.reader-container, #view-reader')) {
        this.captureSelectionRef(selection);
        if (this.currentSelectionRef) {
          if (this.isPenModeActive) {
            // Surlignage direct en mode stylo actif
            this.applyHighlight(this.activeColor, this.activeStyle);
            selection.removeAllRanges();
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

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const endNode = range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer;

    const startVerseItem = startNode.closest('.verse-item, .word-token');
    const endVerseItem = endNode.closest('.verse-item, .word-token');

    if (startVerseItem && typeof BibleReader !== 'undefined') {
      const book = startVerseItem.dataset.bookCode || BibleReader.currentBook;
      const chapter = parseInt(startVerseItem.dataset.chapter || BibleReader.currentChapter, 10);
      let vStart = parseInt(startVerseItem.dataset.verseNum || startVerseItem.dataset.verse || 1, 10);
      let vEnd = vStart;

      if (endVerseItem) {
        vEnd = parseInt(endVerseItem.dataset.verseNum || endVerseItem.dataset.verse || vStart, 10);
      }
      if (vStart > vEnd) [vStart, vEnd] = [vEnd, vStart];

      this.currentSelectionRef = {
        book,
        chapter,
        verseStart: vStart,
        verseEnd: vEnd,
        text: selection.toString().trim()
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
    this.updateTopPopoverUi();
    
    if (this.isPenModeActive) {
      App.showToast(`✏️ Mode Surligneur activé (${this.getColorName(this.activeColor)}). Glissez sur le texte biblique.`, 2500);
    } else {
      App.showToast("Mode Surligneur désactivé.", 1500);
    }
  },

  async applyHighlight(color, style) {
    if (!this.currentSelectionRef) return;
    
    const { book, chapter, verseStart, verseEnd, text } = this.currentSelectionRef;
    
    const hlData = {
      book,
      chapter,
      verse_start: verseStart,
      verse_end: verseEnd,
      selected_text: text,
      color: color || this.activeColor,
      style: style || this.activeStyle
    };

    try {
      const saved = await API.saveHighlight(hlData);
      if (saved) {
        this.hidePalette();
        await this.renderChapterHighlights(book, chapter);
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
    const { book, chapter, verseStart, verseEnd } = this.currentSelectionRef;
    
    try {
      const highlights = await API.getHighlightsForChapter(book, chapter);
      if (highlights) {
        let deletedCount = 0;
        for (const hl of highlights) {
          if (hl.verse_start <= verseEnd && hl.verse_end >= verseStart) {
            await API.deleteHighlight(hl.id);
            deletedCount++;
          }
        }
        this.hidePalette();
        await this.renderChapterHighlights(book, chapter);
        if (deletedCount > 0) {
          App.showToast("Surlignage effacé.");
        }
      }
    } catch (e) {
      console.error('Erreur effacement surlignage', e);
    }
  },

  async createNoteForHighlight() {
    if (!this.currentSelectionRef) return;
    const { book, chapter, verseStart, verseEnd, text } = this.currentSelectionRef;
    
    const hlData = {
      book, chapter, verse_start: verseStart, verse_end: verseEnd, selected_text: text,
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
          await this.renderChapterHighlights(book, chapter);
          
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

  async renderChapterHighlights(book, chapter) {
    if (typeof BibleReader === 'undefined') return;
    
    try {
      const highlights = await API.getHighlightsForChapter(book, chapter);
      if (!highlights) return;

      const cleanBook = (book || '').toLowerCase();
      const chNum = parseInt(chapter, 10);

      // Nettoyer les anciens surlignages du DOM du chapitre
      document.querySelectorAll('.verse-item').forEach(el => {
        const elBook = (el.dataset.bookCode || '').toLowerCase();
        const elChap = parseInt(el.dataset.chapter, 10);
        if (elBook === cleanBook && elChap === chNum) {
          this.clearHighlightClasses(el);
          el.querySelectorAll('.word-token').forEach(w => this.clearHighlightClasses(w));
        }
      });

      // Appliquer les nouveaux
      highlights.forEach(hl => {
        const styleName = hl.style || 'felt';
        const colorName = hl.color || 'yellow';
        const className = `hl-${styleName}-${colorName}`;

        for (let v = hl.verse_start; v <= hl.verse_end; v++) {
          const verseEls = document.querySelectorAll(`.verse-item[data-verse-num="${v}"]`);
          
          verseEls.forEach(vEl => {
            const elBook = (vEl.dataset.bookCode || '').toLowerCase();
            const elChap = parseInt(vEl.dataset.chapter, 10);
            if (elBook === cleanBook && elChap === chNum) {
              const wordTokens = vEl.querySelectorAll('.word-token');
              if (wordTokens.length > 0) {
                wordTokens.forEach(w => {
                  w.classList.add(className);
                  if (hl.note_id) w.classList.add('hl-has-note');
                });
              } else {
                vEl.classList.add(className);
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

  clearHighlightClasses(element) {
    if (!element) return;
    this.colors.forEach(c => {
      this.styles.forEach(s => {
        element.classList.remove(`hl-${s.id}-${c.id}`);
      });
    });
    element.classList.remove('hl-has-note');
  }
};
