/**
 * Selection Context Menu - Menu contextuel universel sur sélection de texte
 * Offre un menu contextuel flottant (clic droit) avec icônes SVG modernes sur toute sélection de texte :
 * Copier, Traduire en français, Demander à l'IA, Créer une note, Rechercher, Ouvrir le passage biblique.
 */

const SelectionContextMenu = {
  menuEl: null,
  translationPopoverEl: null,
  currentSelectionText: '',
  currentSelectionRange: null,
  currentSourceContext: null,

  init() {
    this.createMenuDom();
    this.bindEvents();
  },

  createMenuDom() {
    if (document.getElementById('selection-context-menu')) return;

    // Menu contextuel principal
    const menu = document.createElement('div');
    menu.id = 'selection-context-menu';
    menu.className = 'selection-context-menu hidden';
    menu.innerHTML = `
      <div class="scm-header">
        <div class="scm-selection-preview" id="scm-selection-preview"></div>
      </div>
      <div class="scm-items">
        <button type="button" class="scm-item" data-action="copy">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copier</span>
          <span class="scm-shortcut">Ctrl+C</span>
        </button>

        <button type="button" class="scm-item" data-action="translate" id="scm-btn-translate">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m5 8 6 6"></path>
            <path d="m4 14 6-6 2-3"></path>
            <path d="M2 5h12"></path>
            <path d="M7 2h1"></path>
            <path d="m22 22-5-10-5 10"></path>
            <path d="M14 18h6"></path>
          </svg>
          <span>Traduire en français</span>
        </button>

        <button type="button" class="scm-item" data-action="ask-ai">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>
          </svg>
          <span>Demander à l'IA</span>
        </button>

        <button type="button" class="scm-item" data-action="create-note">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>Créer une note</span>
        </button>

        <div class="scm-divider"></div>

        <button type="button" class="scm-item" data-action="open-verse" id="scm-btn-open-verse" style="display: none;">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <span id="scm-open-verse-label">Ouvrir le passage</span>
        </button>

        <button type="button" class="scm-item" data-action="search-library">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Rechercher dans la bibliothèque</span>
        </button>
      </div>
    `;

    document.body.appendChild(menu);
    this.menuEl = menu;

    // Popover de traduction instantanée
    const transPopover = document.createElement('div');
    transPopover.id = 'selection-translation-popover';
    transPopover.className = 'selection-translation-popover hidden';
    transPopover.innerHTML = `
      <div class="stp-header">
        <div class="stp-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m5 8 6 6"></path>
            <path d="m4 14 6-6 2-3"></path>
            <path d="M2 5h12"></path>
            <path d="M7 2h1"></path>
            <path d="m22 22-5-10-5 10"></path>
            <path d="M14 18h6"></path>
          </svg>
          <span>Traduction en français</span>
        </div>
        <div class="stp-actions">
          <button type="button" class="stp-btn-copy" id="stp-btn-copy" title="Copier la traduction">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button type="button" class="stp-btn-close" id="stp-btn-close" title="Fermer">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="stp-body" id="stp-translation-content">
        <div class="stp-loading">
          <div class="theol-spinner"></div>
          <span>Traduction soignée en cours...</span>
        </div>
      </div>
    `;

    document.body.appendChild(transPopover);
    this.translationPopoverEl = transPopover;
  },

  bindEvents() {
    // 1. Déclenchement au clic droit (contextmenu) sur sélection de texte
    document.addEventListener('contextmenu', (e) => {
      // Ignorer si clic dans un éditeur riche de notes ou champ de saisie actif où le menu standard est pertinent
      if (e.target.closest('#note-edit-content, #obsidian-context-menu, input, textarea')) {
        return;
      }

      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';

      if (text && text.length > 0) {
        e.preventDefault();
        this.currentSelectionText = text;
        if (selection.rangeCount > 0) {
          this.currentSelectionRange = selection.getRangeAt(0);
        }
        this.captureSourceContext(e.target);
        this.show(e.clientX, e.clientY, text);
      } else {
        this.hide();
      }
    });

    // 2. Clics sur les options du menu contextuel
    this.menuEl?.querySelectorAll('.scm-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        this.handleAction(action);
      });
    });

    // 3. Fermeture au clic n'importe où ailleurs
    document.addEventListener('mousedown', (e) => {
      if (!this.menuEl?.contains(e.target) && !this.translationPopoverEl?.contains(e.target)) {
        this.hide();
      }
    });

    // 4. Fermeture sur défilement ou touche Échap
    window.addEventListener('scroll', () => this.hide(), true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
        this.hideTranslationPopover();
      }
    });

    // 5. Fermeture et copie dans le popover de traduction
    document.getElementById('stp-btn-close')?.addEventListener('click', () => {
      this.hideTranslationPopover();
    });

    document.getElementById('stp-btn-copy')?.addEventListener('click', () => {
      const transText = document.getElementById('stp-translation-content')?.textContent || '';
      if (transText) {
        navigator.clipboard.writeText(transText);
        App.showToast('Traduction copiée dans le presse-papiers');
      }
    });

    // 6. Délégation globale pour tous les liens externes (.theol-ext-web-link)
    document.addEventListener('click', (e) => {
      const extLink = e.target.closest('.theol-ext-web-link');
      if (extLink && extLink.href) {
        e.preventDefault();
        API.openExternalUrl(extLink.href);
      }
    });
  },

  captureSourceContext(target) {
    let source = {
      type: 'general',
      title: '',
      reference: ''
    };

    if (target.closest('#theol-main-scroll, #view-theology')) {
      source.type = 'theology';
      source.title = TheologyView?.currentBookTitle || TheologyView?.currentBook || 'Théologie';
      source.reference = `${source.title}${TheologyView?.currentChapterData?.chapter_title ? ' - ' + TheologyView.currentChapterData.chapter_title : ''}`;
    } else if (target.closest('#dict-main-scroll, #view-dict')) {
      source.type = 'dictionary';
      source.title = DictView?.currentArticle?.title || 'Dictionnaire biblique';
      source.reference = `Dictionnaire : ${source.title}`;
    } else if (target.closest('.reader-container, #view-reader')) {
      source.type = 'bible';
      source.title = `${BibleReader?.currentBook || 'Bible'} ${BibleReader?.currentChapter || ''}`.trim();
      source.reference = source.title;
    }

    this.currentSourceContext = source;
  },

  show(x, y, text) {
    if (!this.menuEl) return;

    // Aperçu de la sélection écourtée
    const previewEl = document.getElementById('scm-selection-preview');
    if (previewEl) {
      previewEl.textContent = text.length > 55 ? text.slice(0, 52) + '...' : text;
    }

    // Détecter si la sélection contient ou est une référence biblique
    const verseBtn = document.getElementById('scm-btn-open-verse');
    const verseLabel = document.getElementById('scm-open-verse-label');
    const potentialRef = this.detectScriptureReference(text);

    if (potentialRef && verseBtn) {
      verseBtn.style.display = 'flex';
      if (verseLabel) verseLabel.textContent = `Ouvrir ${potentialRef}`;
      verseBtn.dataset.ref = potentialRef;
    } else if (verseBtn) {
      verseBtn.style.display = 'none';
      verseBtn.removeAttribute('data-ref');
    }

    // Positionner le menu dans la fenêtre
    this.menuEl.classList.remove('hidden');
    const rect = this.menuEl.getBoundingClientRect();
    const pad = 10;

    let posX = x;
    let posY = y;

    if (posX + rect.width > window.innerWidth - pad) {
      posX = window.innerWidth - rect.width - pad;
    }
    if (posY + rect.height > window.innerHeight - pad) {
      posY = window.innerHeight - rect.height - pad;
    }

    this.menuEl.style.left = `${Math.max(pad, posX)}px`;
    this.menuEl.style.top = `${Math.max(pad, posY)}px`;
  },

  hide() {
    if (this.menuEl) {
      this.menuEl.classList.add('hidden');
    }
  },

  detectScriptureReference(text) {
    if (!text || text.length > 70) return null;
    const clean = text.replace(/^[\(\[\{«"'\s]+|[\)\]\}»"'\s\.\,\;]+$/g, '').trim();

    if (typeof TheologyView !== 'undefined' && TheologyView.highlightScriptureReferences) {
      const html = TheologyView.highlightScriptureReferences(clean);
      const m = html.match(/data-ref="([^"]+)"/);
      if (m) return m[1];
    }
    return null;
  },

  async handleAction(action) {
    const text = this.currentSelectionText;
    const ctx = this.currentSourceContext;
    this.hide();

    switch (action) {
      case 'copy':
        try {
          await navigator.clipboard.writeText(text);
          App.showToast('Texte copié dans le presse-papiers');
        } catch (e) {
          console.error('Erreur copie:', e);
        }
        break;

      case 'translate':
        this.showTranslationPopover(text);
        break;

      case 'ask-ai':
        this.openAiWithSelection(text, ctx);
        break;

      case 'create-note':
        this.createNoteFromSelection(text, ctx);
        break;

      case 'open-verse': {
        const ref = document.getElementById('scm-btn-open-verse')?.dataset.ref || this.detectScriptureReference(text);
        if (ref) {
          if (typeof TheologyView !== 'undefined') {
            TheologyView.openScriptureReference(ref);
          } else if (typeof BibleReader !== 'undefined') {
            BibleReader.navigateTo(ref);
          }
        }
        break;
      }

      case 'search-library':
        this.searchSelectionInLibrary(text);
        break;
    }
  },

  async showTranslationPopover(text) {
    if (!this.translationPopoverEl) return;

    this.translationPopoverEl.classList.remove('hidden');
    const contentEl = document.getElementById('stp-translation-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="stp-loading">
          <div class="theol-spinner"></div>
          <span>Traduction soignée en cours...</span>
        </div>
      `;
    }

    // Positionner au niveau de la sélection
    if (this.currentSelectionRange) {
      const rect = this.currentSelectionRange.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left;

      if (left + 360 > window.innerWidth - 16) {
        left = window.innerWidth - 360 - 16;
      }
      if (top + 180 > window.innerHeight - 16) {
        top = rect.top - 190;
      }

      this.translationPopoverEl.style.top = `${Math.max(16, top)}px`;
      this.translationPopoverEl.style.left = `${Math.max(16, left)}px`;
    }

    try {
      const res = await API.translateText(text, 'selection_snippet', '');
      const translated = res?.translated_text || res?.text || (typeof res === 'string' ? res : '');

      if (contentEl) {
        if (translated) {
          contentEl.innerHTML = `<div class="stp-text">${TheologyView.escapeHtml(translated)}</div>`;
        } else {
          contentEl.innerHTML = `<div class="stp-error">Impossible d'obtenir la traduction.</div>`;
        }
      }
    } catch (e) {
      if (contentEl) {
        contentEl.innerHTML = `<div class="stp-error">Erreur de traduction : ${TheologyView.escapeHtml(String(e))}</div>`;
      }
    }
  },

  hideTranslationPopover() {
    if (this.translationPopoverEl) {
      this.translationPopoverEl.classList.add('hidden');
    }
  },

  openAiWithSelection(text, ctx) {
    // 1. Ouvrir l'onglet Assistant IA dans le panneau droit
    const aiTabBtn = document.querySelector('.drawer-tab[data-drawer-tab="ai"]');
    if (aiTabBtn) {
      aiTabBtn.click();
    }

    // 2. Préremplir le champ de chat
    const chatInput = document.getElementById('chat-input') || document.getElementById('ai-chat-input');
    if (chatInput) {
      const contextPrefix = ctx?.reference ? `[Contexte : ${ctx.reference}]\n` : '';
      chatInput.value = `${contextPrefix}Explique et commente ce passage : "${text}"`;
      chatInput.focus();
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    App.showToast('Passage envoyé à l\'assistant IA');
  },

  createNoteFromSelection(text, ctx) {
    const ref = ctx?.reference || ctx?.title || 'Passage sélectionné';
    const title = ctx?.title ? `Note sur ${ctx.title}` : 'Nouvelle Note';
    const quoteContent = `> ${text.split('\n').join('\n> ')}\n\n`;

    if (typeof NotesView !== 'undefined' && typeof NotesView.createNewNote === 'function') {
      App.switchView('notes');
      NotesView.createNewNote(ref, title);
      setTimeout(() => {
        if (NotesView.contentInput) {
          NotesView.contentInput.innerHTML = NotesView.markdownToRichHtml(quoteContent);
          NotesView.contentInput.focus();
        }
      }, 100);
      App.showToast('Note créée à partir de la sélection');
    }
  },

  searchSelectionInLibrary(text) {
    const cleanQuery = text.slice(0, 50).trim();
    if (typeof TheologyView !== 'undefined' && document.getElementById('theol-book-search-input')) {
      App.switchView('theology');
      const searchInput = document.getElementById('theol-book-search-input');
      if (searchInput) {
        searchInput.value = cleanQuery;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.focus();
      }
    } else if (typeof DictView !== 'undefined') {
      App.switchView('dict');
      const searchInput = document.getElementById('dict-search-input');
      if (searchInput) {
        searchInput.value = cleanQuery;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.focus();
      }
    }
  }
};

window.SelectionContextMenu = SelectionContextMenu;
