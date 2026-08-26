/**
 * Notes View Controller & Obsidian-Style WYSIWYG Rich Editor
 * Gère la prise de notes bibliques WYSIWYG, le stockage Markdown (.md) standard,
 * les tableaux interactifs réels, les encarts Obsidian, l'historique Annuler/Rétablir (Ctrl+Z, Ctrl+Y),
 * le menu contextuel clic droit, la recherche et la synchronisation avec le RAG IA.
 */

const NotesView = {
  notes: [],
  currentNote: null,
  isPreviewMode: false,
  activeTargetInput: null,

  // Éléments du DOM
  listContainer: null,
  searchInput: null,
  titleInput: null,
  refInput: null,
  tagsInput: null,
  aiToggle: null,
  contentInput: null, // Div contenteditable WYSIWYG
  previewContainer: null,
  contextMenu: null,

  // Pile d'historique Undo / Redo
  history: [],
  historyIndex: -1,
  maxHistory: 80,
  historyDebounceTimer: null,

  // Système d'enregistrement automatique continu
  autoSaveTimer: null,
  autoSaveDelay: 800,
  isSaving: false,
  lastSavedSignature: null,
  autoSaveIndicator: null,

  init() {
    this.listContainer = document.getElementById('notes-list-items');
    this.searchInput = document.getElementById('notes-search-input');
    this.titleInput = document.getElementById('note-edit-title');
    this.refInput = document.getElementById('note-edit-ref');
    this.tagsInput = document.getElementById('note-edit-tags');
    this.aiToggle = document.getElementById('note-edit-ai-toggle');
    this.contentInput = document.getElementById('note-edit-content');
    this.previewContainer = document.getElementById('note-preview-content');
    this.contextMenu = document.getElementById('obsidian-context-menu');
    this.autoSaveIndicator = document.getElementById('note-autosave-indicator');

    this.searchInput?.addEventListener('input', () => this.renderList());

    document.getElementById('btn-new-note')?.addEventListener('click', () => {
      this.createNewNote();
    });

    document.getElementById('btn-open-notes-folder')?.addEventListener('click', async () => {
      try {
        const res = await API.call('open_notes_folder');
        if (res && res.success) {
          App.showToast(`Dossier ouvert : ${res.path}`);
        } else {
          alert(`Erreur d'ouverture du dossier : ${res?.error || 'Inconnu'}`);
        }
      } catch (e) {
        alert(`Erreur : ${e}`);
      }
    });

    document.getElementById('btn-delete-current-note')?.addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    document.getElementById('btn-toggle-note-preview')?.addEventListener('click', () => {
      this.togglePreview();
    });

    // Boutons Historique Annuler / Rétablir
    document.getElementById('btn-note-undo')?.addEventListener('click', () => {
      this.undo();
    });

    document.getElementById('btn-note-redo')?.addEventListener('click', () => {
      this.redo();
    });

    // Infobulle flottante style Anytype sur sélection de texte
    this.bindFloatingToolbar();

    // Menu contextuel style Obsidian (Clic droit) & Raccourcis clavier
    this.bindContextMenu();
    this.bindEditorShortcuts(this.contentInput);

    // Écoute de la saisie pour l'historique Undo / Redo et l'enregistrement automatique continu
    this.contentInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
      this.triggerAutoSave();
    });
    this.titleInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
      this.triggerAutoSave();
    });
    this.refInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
      this.triggerAutoSave();
    });
    this.tagsInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
      this.triggerAutoSave();
    });
    this.aiToggle?.addEventListener('change', () => {
      this.triggerAutoSave();
    });

    // Enregistrement immédiat au changement de focus (blur)
    this.contentInput?.addEventListener('blur', () => {
      this.saveCurrentNote(true);
    });
    this.titleInput?.addEventListener('blur', () => {
      this.saveCurrentNote(true);
    });
    this.refInput?.addEventListener('blur', () => {
      this.saveCurrentNote(true);
    });
    this.tagsInput?.addEventListener('blur', () => {
      this.saveCurrentNote(true);
    });

    // Gestion du collage intelligent dans l'éditeur riche
    this.contentInput?.addEventListener('paste', (e) => {
      this.handlePaste(e);
    });

    // Boutons de génération IA (Titre & Tags)
    document.getElementById('btn-note-gen-title-ai')?.addEventListener('click', () => {
      this.generateTitleWithAI();
    });
    document.getElementById('btn-note-gen-tags-ai')?.addEventListener('click', () => {
      this.generateTagsWithAI();
    });

    // Écoute de la saisie Slash (/) dans l'éditeur
    this.contentInput?.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key) && this.isSlashMenuOpen) {
        return;
      }
      this.handleSlashInput(e);
    });

    this.updateAiToggleVisibility();
    this.loadNotes();
  },

  // =========================================================================
  // INFOBULLE FLOTTANTE DE SÉLECTION STYLE ANYTYPE
  // =========================================================================

  bindFloatingToolbar() {
    const toolbar = document.getElementById('notes-floating-toolbar');
    if (!toolbar) return;
    this.floatingToolbar = toolbar;

    // Empêcher la perte de sélection lors du clic sur la barre flottante
    toolbar.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    const blockTypeBtn = document.getElementById('nft-btn-block-type');
    const blockMenu = document.getElementById('nft-block-menu');
    const moreBtn = document.getElementById('nft-btn-more');
    const moreMenu = document.getElementById('nft-more-menu');

    // Menu Type de Bloc
    blockTypeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      moreMenu?.classList.add('hidden');
      blockMenu?.classList.toggle('hidden');
    });

    // Menu Plus d'options
    moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      blockMenu?.classList.add('hidden');
      moreMenu?.classList.toggle('hidden');
    });

    // Clic sur les boutons principaux
    toolbar.querySelectorAll('.nft-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        this.handleFloatingToolbarAction(action);
      });
    });

    // Clic sur les éléments des menus déroulants
    toolbar.querySelectorAll('.nft-dropdown-item[data-action]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        blockMenu?.classList.add('hidden');
        moreMenu?.classList.add('hidden');
        this.handleFloatingToolbarAction(action);
      });
    });

    // Fermer les sous-menus au clic extérieur
    document.addEventListener('click', (e) => {
      if (!toolbar.contains(e.target)) {
        blockMenu?.classList.add('hidden');
        moreMenu?.classList.add('hidden');
      }
    });

    // Détection de la sélection dans l'éditeur
    const updateSelectionToolbar = () => {
      if (this.isPreviewMode) {
        this.hideFloatingToolbar();
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        this.hideFloatingToolbar();
        return;
      }

      const range = sel.getRangeAt(0);
      const editor = this.contentInput;
      if (!editor || !editor.contains(range.commonAncestorContainer)) {
        this.hideFloatingToolbar();
        return;
      }

      const text = sel.toString().trim();
      if (!text) {
        this.hideFloatingToolbar();
        return;
      }

      this.showFloatingToolbar(range);
    };

    document.addEventListener('selectionchange', () => {
      setTimeout(updateSelectionToolbar, 10);
    });

    this.contentInput?.addEventListener('mouseup', updateSelectionToolbar);
    this.contentInput?.addEventListener('keyup', (e) => {
      if (['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        updateSelectionToolbar();
      }
    });

    window.addEventListener('scroll', () => {
      if (!this.floatingToolbar?.classList.contains('hidden')) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount) {
          this.showFloatingToolbar(sel.getRangeAt(0));
        }
      }
    }, true);
  },

  showFloatingToolbar(range) {
    const toolbar = this.floatingToolbar;
    if (!toolbar) return;

    this.currentSelectionRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hideFloatingToolbar();
      return;
    }

    toolbar.classList.remove('hidden');

    const toolbarWidth = toolbar.offsetWidth || 310;
    const toolbarHeight = toolbar.offsetHeight || 36;

    // Centrage horizontal exact par rapport au début et à la fin de la sélection
    let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);

    // Positionnement vertical : juste au-dessus du texte sélectionné avec une marge de 8px
    let top = rect.top - toolbarHeight - 8;

    // Si la marge supérieure est trop faible (< 55px pour éviter d'être caché sous les en-têtes), placer juste en dessous
    if (top < 55) {
      top = rect.bottom + 8;
    }

    // Contraintes dans les limites horizontales et verticales du viewport
    if (left < 10) left = 10;
    if (left + toolbarWidth > window.innerWidth - 10) {
      left = window.innerWidth - toolbarWidth - 10;
    }
    if (top + toolbarHeight > window.innerHeight - 10) {
      top = window.innerHeight - toolbarHeight - 10;
    }

    toolbar.style.top = `${Math.round(top)}px`;
    toolbar.style.left = `${Math.round(left)}px`;

    this.updateCurrentBlockLabel(range);
    this.updateFloatingButtonsState();
  },

  hideFloatingToolbar() {
    if (this.floatingToolbar) {
      this.floatingToolbar.classList.add('hidden');
      document.getElementById('nft-block-menu')?.classList.add('hidden');
      document.getElementById('nft-more-menu')?.classList.add('hidden');
    }
  },

  updateCurrentBlockLabel(range) {
    const labelEl = document.getElementById('nft-current-block-label');
    if (!labelEl) return;

    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

    const block = node.closest('h1, h2, h3, blockquote, .note-callout, .note-task-item, ul, ol, p') || node;
    const tag = block.tagName ? block.tagName.toLowerCase() : '';

    if (tag === 'h1') labelEl.textContent = 'H1';
    else if (tag === 'h2') labelEl.textContent = 'H2';
    else if (tag === 'h3') labelEl.textContent = 'H3';
    else if (tag === 'blockquote') labelEl.textContent = '”';
    else if (block.classList?.contains('note-callout')) labelEl.textContent = '💡';
    else if (block.classList?.contains('note-task-item')) labelEl.textContent = '☑';
    else if (tag === 'ul') labelEl.textContent = '•';
    else if (tag === 'ol') labelEl.textContent = '1.';
    else labelEl.textContent = 'Aa';
  },

  updateFloatingButtonsState() {
    if (!this.floatingToolbar) return;
    const checkState = (action, query) => {
      const btn = this.floatingToolbar.querySelector(`.nft-btn[data-action="${action}"]`);
      if (btn) {
        try {
          const isActive = document.queryCommandState(query);
          btn.classList.toggle('active', !!isActive);
        } catch (e) {
          btn.classList.remove('active');
        }
      }
    };

    checkState('bold', 'bold');
    checkState('italic', 'italic');
    checkState('underline', 'underline');
    checkState('strikethrough', 'strikeThrough');
  },

  handleFloatingToolbarAction(action) {
    if (this.currentSelectionRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this.currentSelectionRange);
    }

    if (['h1', 'h2', 'h3', 'text', 'quote', 'callout', 'bullet', 'number', 'task'].includes(action)) {
      this.setBlockType(action);
    } else if (action === 'bold') {
      document.execCommand('bold');
    } else if (action === 'italic') {
      document.execCommand('italic');
    } else if (action === 'underline') {
      document.execCommand('underline');
    } else if (action === 'strikethrough') {
      document.execCommand('strikeThrough');
    } else if (action === 'code') {
      this.surroundSelectionWithTag('code');
    } else if (action === 'highlight') {
      this.surroundSelectionWithTag('mark');
    } else if (action === 'link') {
      this.handleLinkAction();
    } else if (action === 'superscript') {
      document.execCommand('superscript');
    } else if (action === 'subscript') {
      document.execCommand('subscript');
    } else if (action === 'datetime') {
      const now = new Date();
      const dStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const tStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      document.execCommand('insertHTML', false, `<strong>${dStr} à ${tStr}</strong> `);
    } else if (action === 'clear-format') {
      document.execCommand('removeFormat');
    }

    this.pushHistoryState();
    this.triggerAutoSave();
    this.updateFloatingButtonsState();
  },

  handleLinkAction() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const text = sel.toString().trim();
    
    const refRegex = /^([1-3]?\s?[A-ZÀ-Ÿa-zà-ÿ]{3,15})\s+(\d{1,3}):(\d{1,3}(?:-\d{1,3})?)$/;
    if (refRegex.test(text)) {
      const html = `<a href="#" class="scripture-link" data-ref="${text}" style="color: var(--accent-blue); font-weight: 700; text-decoration: underline; cursor: pointer;">${text}</a>`;
      document.execCommand('insertHTML', false, html);
      return;
    }

    const url = prompt("Entrez l'URL du lien :", "https://");
    if (url) {
      document.execCommand('createLink', false, url);
    }
  },

  bindContextMenu() {
    const menu = this.contextMenu;
    if (!menu) return;

    // Détecter le clic droit sur la vue notes complète ou dans le tiroir latéral
    const handleContextMenu = (e) => {
      const target = e.target.closest('#note-edit-content, input[type="text"], textarea') || this.contentInput;
      this.activeTargetInput = target;

      e.preventDefault();
      e.stopPropagation();

      // Fermer d'abord les sous-menus
      menu.querySelectorAll('.ctx-submenu').forEach(s => s.classList.remove('open-left'));

      // Afficher le menu
      menu.classList.remove('hidden');

      // Calcul des dimensions et positionnement
      const menuWidth = 230;
      const menuHeight = menu.offsetHeight || 340;
      let x = e.clientX;
      let y = e.clientY;

      if (x + menuWidth > window.innerWidth - 10) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight - 10) {
        y = Math.max(10, window.innerHeight - menuHeight - 10);
      }

      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;

      // Détecter si les sous-menus doivent s'ouvrir à gauche
      const submenuWidth = 210;
      const opensLeft = (x + menuWidth + submenuWidth > window.innerWidth - 10);
      menu.querySelectorAll('.ctx-submenu').forEach(s => {
        if (opensLeft) {
          s.classList.add('open-left');
        } else {
          s.classList.remove('open-left');
        }
      });
    };

    document.getElementById('view-notes')?.addEventListener('contextmenu', handleContextMenu);
    document.getElementById('drawer-tab-notes')?.addEventListener('contextmenu', handleContextMenu);

    // Clic sur une action du menu
    menu.querySelectorAll('.ctx-menu-item[data-action]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        const target = this.activeTargetInput || this.contentInput;
        this.executeAction(action, target);
        this.hideContextMenu();
      });
    });

    // Fermeture du menu au clic extérieur ou touche Échap
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    window.addEventListener('resize', () => this.hideContextMenu());
    window.addEventListener('scroll', () => this.hideContextMenu(), true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu();
      }
    });
  },

  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.classList.add('hidden');
    }
  },

  bindEditorShortcuts(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('keydown', (e) => {
      // Si le menu Slash est ouvert, laisser le gestionnaire de Slash intercepter flèches, entrée et échap
      if (this.isSlashMenuOpen) {
        if (this.handleSlashKeyDown(e)) {
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        
        // Annuler : Ctrl+Z
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.undo();
          return;
        }
        // Rétablir : Ctrl+Y ou Ctrl+Shift+Z
        if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          this.redo();
          return;
        }

        // Formatage clavier direct
        if (key === 'b') {
          e.preventDefault();
          this.executeAction('bold', inputEl);
        } else if (key === 'i') {
          e.preventDefault();
          this.executeAction('italic', inputEl);
        } else if (key === 'u') {
          e.preventDefault();
          this.executeAction('underline', inputEl);
        } else if (e.shiftKey && key === 'x') {
          e.preventDefault();
          this.executeAction('strikethrough', inputEl);
        } else if (e.shiftKey && key === 'h') {
          e.preventDefault();
          this.executeAction('highlight', inputEl);
        } else if (e.shiftKey && key === 'd') {
          e.preventDefault();
          this.executeAction('datetime', inputEl);
        } else if (key === 's') {
          e.preventDefault();
          this.saveCurrentNote(false);
        }
      } else if (e.key === 'Tab') {
        // Gestion de l'indentation avec Tab
        e.preventDefault();
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      }
    });
  },

  // =========================================================================
  // SYSTÈME D'HISTORIQUE (UNDO / REDO AVANCÉ)
  // =========================================================================

  debouncedPushHistory() {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
    }
    this.historyDebounceTimer = setTimeout(() => {
      this.pushHistoryState();
    }, 400);
  },

  pushHistoryState() {
    const currentState = {
      html: this.contentInput ? this.contentInput.innerHTML : '',
      title: this.titleInput ? this.titleInput.value : '',
      ref: this.refInput ? this.refInput.value : '',
      tags: this.tagsInput ? this.tagsInput.value : ''
    };

    // Éviter d'empiler des états identiques
    if (this.historyIndex >= 0) {
      const prev = this.history[this.historyIndex];
      if (prev && prev.html === currentState.html && prev.title === currentState.title && prev.ref === currentState.ref && prev.tags === currentState.tags) {
        return;
      }
    }

    // Tronquer l'historique futur si on a annulé puis modifié
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(currentState);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  },

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistoryState(this.history[this.historyIndex]);
      App.showToast('↶ Annulé (Ctrl+Z)');
    } else {
      App.showToast('Début de l\'historique atteint');
    }
  },

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistoryState(this.history[this.historyIndex]);
      App.showToast('↷ Rétabli (Ctrl+Y)');
    } else {
      App.showToast('Fin de l\'historique atteinte');
    }
  },

  restoreHistoryState(state) {
    if (!state) return;
    if (this.contentInput) this.contentInput.innerHTML = state.html || '';
    if (this.titleInput) this.titleInput.value = state.title || '';
    if (this.refInput) this.refInput.value = state.ref || '';
    if (this.tagsInput) this.tagsInput.value = state.tags || '';
    this.triggerAutoSave();
  },

  // =========================================================================
  // EXÉCUTION DES ACTIONS DE FORMATAGE RICHE WYSIWYG
  // =========================================================================

  async executeAction(action, target) {
    const isRichEditor = target === this.contentInput || target?.id === 'note-edit-content';
    
    if (isRichEditor) {
      this.contentInput.focus();
    } else if (target && typeof target.focus === 'function') {
      target.focus();
    }

    switch (action) {
      // 0. Historique
      case 'undo':
        this.undo();
        return;
      case 'redo':
        this.redo();
        return;

      // 1. Formater
      case 'bold':
        if (isRichEditor) {
          document.execCommand('bold');
        }
        break;
      case 'italic':
        if (isRichEditor) {
          document.execCommand('italic');
        }
        break;
      case 'underline':
        if (isRichEditor) {
          document.execCommand('underline');
        }
        break;
      case 'strikethrough':
        if (isRichEditor) {
          document.execCommand('strikeThrough');
        }
        break;
      case 'highlight':
        if (isRichEditor) {
          this.surroundSelectionWithTag('mark');
        }
        break;
      case 'inline-code':
        if (isRichEditor) {
          this.surroundSelectionWithTag('code');
        }
        break;
      case 'superscript':
        if (isRichEditor) {
          document.execCommand('superscript');
        }
        break;
      case 'subscript':
        if (isRichEditor) {
          document.execCommand('subscript');
        }
        break;

      // 2. Paragraphe & Titres
      case 'h1':
        if (isRichEditor) {
          this.applyBlockFormat('h1');
        }
        break;
      case 'h2':
        if (isRichEditor) {
          this.applyBlockFormat('h2');
        }
        break;
      case 'h3':
        if (isRichEditor) {
          this.applyBlockFormat('h3');
        }
        break;
      case 'text':
      case 'paragraph':
        if (isRichEditor) {
          this.applyBlockFormat('p');
        }
        break;
      case 'quote':
        if (isRichEditor) {
          this.applyBlockFormat('blockquote');
        }
        break;
      case 'scripture':
        if (isRichEditor) {
          this.insertScriptureQuote();
        }
        break;
      case 'bullet-list':
      case 'bullet':
        if (isRichEditor) {
          document.execCommand('insertUnorderedList');
        }
        break;
      case 'number-list':
      case 'number':
        if (isRichEditor) {
          document.execCommand('insertOrderedList');
        }
        break;
      case 'task-list':
      case 'task':
        if (isRichEditor) {
          this.insertTaskItem();
        }
        break;

      // 3. Insérer (Tableaux réels, Encarts, Horodatage...)
      case 'horizontal-rule':
      case 'divider':
      case 'hr':
        if (isRichEditor) {
          document.execCommand('insertHorizontalRule');
        }
        break;
      case 'datetime':
        if (isRichEditor) {
          const now = new Date();
          const dStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const tStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          document.execCommand('insertHTML', false, `<strong>${dStr} à ${tStr}</strong> `);
        }
        break;
      case 'table':
        if (isRichEditor) {
          this.insertRealTable();
        }
        break;
      case 'code-block':
      case 'code':
        if (isRichEditor) {
          this.insertCodeBlock();
        }
        break;
      case 'callout':
        if (isRichEditor) {
          this.insertCallout();
        }
        break;

      // 4. Presse-papier
      case 'cut':
        document.execCommand('cut');
        App.showToast('Texte coupé');
        break;
      case 'copy':
        document.execCommand('copy');
        App.showToast('Texte copié');
        break;
      case 'paste':
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            document.execCommand('insertText', false, text);
          }
        } catch (e) {
          document.execCommand('paste');
        }
        break;
      case 'paste-plain':
        try {
          let text = await navigator.clipboard.readText();
          if (text) {
            text = text.replace(/<[^>]*>?/gm, '');
            document.execCommand('insertText', false, text);
          }
        } catch (e) {
          document.execCommand('paste');
        }
        break;
      case 'select-all':
        if (isRichEditor) {
          document.execCommand('selectAll');
        } else if (typeof target?.select === 'function') {
          target.select();
        }
        break;
    }

    this.pushHistoryState();
    this.triggerAutoSave();
  },

  surroundSelectionWithTag(tagName) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const selectedContent = range.extractContents();
    const el = document.createElement(tagName);
    if (!selectedContent.textContent.trim()) {
      el.textContent = tagName === 'mark' ? 'Texte surligné' : 'code';
    } else {
      el.appendChild(selectedContent);
    }
    range.insertNode(el);
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  },

  setBlockType(type) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (type === 'callout') {
      this.insertCallout();
      return;
    } else if (type === 'task') {
      this.insertTaskItem();
      return;
    } else if (type === 'bullet') {
      document.execCommand('insertUnorderedList');
      return;
    } else if (type === 'number') {
      document.execCommand('insertOrderedList');
      return;
    }

    const tag = (type === 'text' || type === 'paragraph') ? 'p' : (type === 'quote' ? 'blockquote' : type.toLowerCase());

    // Trouver le bloc actuel à formater
    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }

    let block = node.closest('h1, h2, h3, blockquote, p, div, li');
    if (!block || !this.contentInput.contains(block) || block === this.contentInput) {
      // Trouver l'enfant direct de contentInput contenant la sélection
      let child = range.startContainer;
      while (child && child.parentNode !== this.contentInput && child !== this.contentInput) {
        child = child.parentNode;
      }
      block = (child && child !== this.contentInput) ? child : null;
    }

    if (block && block.parentNode) {
      const currentTagName = block.tagName ? block.tagName.toLowerCase() : '';
      const targetTag = (currentTagName === tag && tag !== 'p') ? 'p' : tag;
      const newBlock = document.createElement(targetTag);

      const rawText = block.textContent.replace(/[\r\n\s]+/g, '').trim();
      if (!rawText) {
        newBlock.innerHTML = '<br>';
      } else {
        while (block.firstChild) {
          newBlock.appendChild(block.firstChild);
        }
      }

      block.parentNode.replaceChild(newBlock, block);

      // Repositionner le curseur dans le nouveau bloc
      const newRange = document.createRange();
      newRange.selectNodeContents(newBlock);
      newRange.collapse(!rawText);
      sel.removeAllRanges();
      sel.addRange(newRange);
      this.contentInput.focus();
    } else {
      // Insertion d'un nouveau bloc
      const newBlock = document.createElement(tag);
      newBlock.innerHTML = '<br>';
      range.deleteContents();
      range.insertNode(newBlock);

      const newRange = document.createRange();
      newRange.selectNodeContents(newBlock);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      this.contentInput.focus();
    }
  },

  applyBlockFormat(tag) {
    this.setBlockType(tag);
  },

  insertRealTable() {
    const tableHtml = `
      <table class="note-table">
        <thead>
          <tr>
            <th>Colonne 1</th>
            <th>Colonne 2</th>
            <th>Colonne 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valeur 1</td>
            <td>Valeur 2</td>
            <td>Valeur 3</td>
          </tr>
          <tr>
            <td>Donnée A</td>
            <td>Donnée B</td>
            <td>Donnée C</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
  },

  insertCallout() {
    const calloutHtml = `
      <div class="note-callout">
        <div class="note-callout-title">Remarque</div>
        <div>Votre réflexion, référence ou méditation ici...</div>
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, calloutHtml);
  },

  insertScriptureQuote() {
    const scriptureHtml = `
      <blockquote>
        <em>« Votre verset biblique ici... »</em><br>
        <strong>— Référence (ex: Jean 3:16)</strong>
      </blockquote>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, scriptureHtml);
  },

  insertCodeBlock() {
    const codeHtml = `
      <pre><code>// Note ou extrait de code ici</code></pre>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, codeHtml);
  },

  insertTaskItem() {
    const taskHtml = `
      <div class="note-task-item">
        <input type="checkbox">
        <span>Tâche ou point à vérifier</span>
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, taskHtml);
  },

  handlePaste(e) {
    // Si c'est du texte brut collé, laisser faire ou formater proprement
    const text = e.clipboardData?.getData('text/plain');
    if (text && text.includes('\n\n')) {
      // Préserver les paragraphes
      e.preventDefault();
      const paras = text.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      document.execCommand('insertHTML', false, paras);
    }
  },

  // =========================================================================
  // CONVERTISSEURS HAUTE FIDÉLITÉ (MARKDOWN <-> HTML WYSIWYG)
  // =========================================================================

  markdownToRichHtml(md) {
    if (!md || !md.trim()) return '<p><br></p>';

    let text = md.trim();

    // 1. Enlever l'éventuel titre H1 initial si dupliqué
    text = text.replace(/^#\s+[^\n]+\n+/, '');

    // 2. Traitement des Encarts Obsidian : > [!NOTE] Titre
    text = text.replace(/^\> \[!([A-Z]+)\][ ]?(.*$)\n((?:> .*$\n?)*)/gim, (match, type, title, body) => {
      const cleanBody = body.replace(/^\> /gm, '').replace(/\n/g, '<br>');
      const typeLabel = title || type;
      return `<div class="note-callout"><div class="note-callout-title">${typeLabel}</div><div>${cleanBody}</div></div>\n\n`;
    });

    // 3. Tableaux Markdown -> Tableaux HTML réels
    text = text.replace(/((?:^\|[^\n]+\|\r?\n)+)/gm, (match) => {
      const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return match;

      // Première ligne = Entête
      const headerCells = lines[0].split('|').slice(1, -1).map(c => c.trim());
      // Ligne 2 = Séparateur (|---|---|)
      const dataRows = lines.slice(2);

      let tableHtml = '<table class="note-table"><thead><tr>';
      headerCells.forEach(cell => {
        tableHtml += `<th>${cell}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      dataRows.forEach(row => {
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        tableHtml += '<tr>';
        cells.forEach(c => {
          tableHtml += `<td>${c}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table>\n\n';
      return tableHtml;
    });

    // 4. Blocs de code
    text = text.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre><code>${p1.trim()}</code></pre>\n\n`;
    });

    // 5. Titres
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>\n');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>\n');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>\n');

    // 6. Citations
    text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>\n');

    // 7. Tâches
    text = text.replace(/^\- \[x\] (.*$)/gim, '<div class="note-task-item"><input type="checkbox" checked> <span>$1</span></div>\n');
    text = text.replace(/^\- \[ \] (.*$)/gim, '<div class="note-task-item"><input type="checkbox"> <span>$1</span></div>\n');

    // 8. Listes à puces & numérotées
    text = text.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>');
    text = text.replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
    // Fusionner les listes consécutives
    text = text.replace(/<\/ul>\s*<ul>/g, '').replace(/<\/ol>\s*<ol>/g, '');

    // 9. Ligne horizontale
    text = text.replace(/^---$/gim, '<hr>\n');

    // 10. Formatage en ligne
    text = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/==(.*?)==/g, '<mark>$1</mark>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\^([^\^]+)\^/g, '<sup>$1</sup>')
      .replace(/~([^~]+)~/g, '<sub>$1</sub>');

    // 11. Paragraphes normaux
    const blocks = text.split(/\n\s*\n/);
    const htmlBlocks = blocks.map(block => {
      const b = block.trim();
      if (!b) return '';
      if (b.startsWith('<h1') || b.startsWith('<h2') || b.startsWith('<h3') || 
          b.startsWith('<table') || b.startsWith('<pre') || b.startsWith('<blockquote') || 
          b.startsWith('<div') || b.startsWith('<ul') || b.startsWith('<ol') || b.startsWith('<hr')) {
        return b;
      }
      return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    });

    return htmlBlocks.filter(Boolean).join('\n') || '<p><br></p>';
  },

  richHtmlToMarkdown(container) {
    if (!container) return '';

    const serializeNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tag = node.tagName.toLowerCase();
      const childrenText = Array.from(node.childNodes).map(serializeNode).join('');

      switch (tag) {
        case 'h1':
          return `\n\n# ${childrenText.trim()}\n\n`;
        case 'h2':
          return `\n\n## ${childrenText.trim()}\n\n`;
        case 'h3':
          return `\n\n### ${childrenText.trim()}\n\n`;
        case 'strong':
        case 'b':
          return `**${childrenText}**`;
        case 'em':
        case 'i':
          return `*${childrenText}*`;
        case 'del':
        case 's':
        case 'strike':
          return `~~${childrenText}~~`;
        case 'mark':
          return `==${childrenText}==`;
        case 'code':
          return node.parentNode?.tagName.toLowerCase() === 'pre' ? childrenText : `\`${childrenText}\``;
        case 'pre':
          return `\n\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
        case 'sup':
          return `^${childrenText}^`;
        case 'sub':
          return `~${childrenText}~`;
        case 'blockquote':
          return `\n\n> ${childrenText.trim().replace(/\n/g, '\n> ')}\n\n`;
        case 'hr':
          return `\n\n---\n\n`;
        case 'p':
          return childrenText.trim() ? `\n\n${childrenText.trim()}\n\n` : '';
        case 'br':
          return '\n';
        case 'ul':
          return `\n${childrenText}\n`;
        case 'ol':
          return `\n${childrenText}\n`;
        case 'li':
          return `- ${childrenText.trim()}\n`;
        case 'table': {
          const rows = Array.from(node.querySelectorAll('tr'));
          if (!rows.length) return '';
          let mdTable = '\n\n';

          // En-tête
          const ths = Array.from(rows[0].querySelectorAll('th, td')).map(c => c.textContent.trim() || ' ');
          mdTable += `| ${ths.join(' | ')} |\n`;
          mdTable += `| ${ths.map(() => ':---').join(' | ')} |\n`;

          // Lignes de corps
          const bodyRows = rows.slice(1);
          bodyRows.forEach(r => {
            const tds = Array.from(r.querySelectorAll('td, th')).map(c => c.textContent.trim() || ' ');
            mdTable += `| ${tds.join(' | ')} |\n`;
          });
          mdTable += '\n';
          return mdTable;
        }
        case 'div': {
          // Encart Obsidian
          if (node.classList.contains('note-callout')) {
            const titleEl = node.querySelector('.note-callout-title');
            const rawTitle = titleEl ? titleEl.textContent.trim() : 'NOTE';
            const bodyEl = node.querySelector('.note-callout-content') || node;
            const bodyText = Array.from(bodyEl.childNodes)
              .filter(n => n !== titleEl)
              .map(serializeNode)
              .join('')
              .trim();
            const prefixLines = bodyText.split('\n').map(l => `> ${l}`).join('\n');
            return `\n\n> [!NOTE] ${rawTitle}\n${prefixLines}\n\n`;
          }

          // Tâche / Checkbox
          if (node.classList.contains('note-task-item')) {
            const chk = node.querySelector('input[type="checkbox"]');
            const isChecked = chk && chk.checked;
            const textSpan = node.querySelector('span') || node;
            const textVal = textSpan.textContent.trim();
            return `\n- [${isChecked ? 'x' : ' '}] ${textVal}\n`;
          }

          return childrenText ? `\n${childrenText}\n` : '';
        }
        default:
          return childrenText;
      }
    };

    let md = serializeNode(container);
    // Nettoyage des sauts de ligne multiples
    md = md.replace(/\n{3,}/g, '\n\n').trim();
    return md;
  },

  // =========================================================================
  // GESTION DU CYCLE DE VIE DES NOTES
  // =========================================================================

  async loadNotes(selectId = null) {
    try {
      this.notes = await API.call('get_notes_list') || [];
      this.renderList();
      if (this.notes.length > 0) {
        const target = selectId ? this.notes.find(n => n.id === selectId) : this.notes[0];
        this.selectNote(target || this.notes[0]);
      } else {
        this.createNewNote();
      }
    } catch (e) {
      console.error('Erreur chargement notes:', e);
    }
  },

  updateAiToggleVisibility() {
    const isGlobalAiEnabled = SettingsView?.config?.include_notes_in_ai !== false;
    const toggleLabel = document.getElementById('note-edit-ai-toggle-label');
    if (toggleLabel) {
      toggleLabel.style.display = isGlobalAiEnabled ? 'flex' : 'none';
    }
    const drawerToggleLabel = document.getElementById('drawer-note-ai-toggle-label');
    if (drawerToggleLabel) {
      drawerToggleLabel.style.display = isGlobalAiEnabled ? 'flex' : 'none';
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
  },

  renderList() {
    const countEl = document.getElementById('notes-header-count');
    const q = (this.searchInput?.value || '').toLowerCase().trim();
    const filtered = this.notes.filter(n => {
      if (!q) return true;
      return (n.title || '').toLowerCase().includes(q) ||
             (n.reference || '').toLowerCase().includes(q) ||
             (n.content || '').toLowerCase().includes(q) ||
             (n.tags || '').toLowerCase().includes(q);
    });

    if (countEl) {
      countEl.textContent = q ? `${filtered.length}/${this.notes.length}` : `${this.notes.length}`;
    }

    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    if (filtered.length === 0) {
      this.listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">Aucune note trouvée.</div>`;
      return;
    }

    const isGlobalAiEnabled = SettingsView?.config?.include_notes_in_ai !== false;

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-list-item ${this.currentNote?.id === note.id ? 'active' : ''}`;
      item.setAttribute('data-note-id', note.id || '');
      
      const aiBadge = (isGlobalAiEnabled && note.include_in_ai !== false) 
        ? '<span title="Prise en compte par l\'IA" style="display:inline-flex; align-items:center; margin-left: 4px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1 1.3-1.3Z"/></svg></span>' 
        : '';
      
      const safeTitle = this.escapeHtml(note.title || 'Note sans titre');
      const safeRef = note.reference ? this.escapeHtml(note.reference) : '';
      const safeDate = this.escapeHtml(note.updated_at || '');

      item.innerHTML = `
        <div class="note-list-item-body">
          <div class="note-item-title" title="${safeTitle}">
            <span class="note-item-title-text">${safeTitle}</span> ${aiBadge}
          </div>
          <div class="note-item-meta">
            ${safeRef ? `<span class="note-ref-badge">${safeRef}</span>` : '<span style="font-size: 10px; color: var(--text-muted);">Générale</span>'}
            <span class="note-item-date">${safeDate}</span>
          </div>
        </div>
        <div class="note-list-item-actions">
          <button type="button" class="btn-history-action btn-note-menu" title="Options (Clic droit)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-note-menu')) {
          e.stopPropagation();
          const btn = e.target.closest('.btn-note-menu');
          const rect = btn.getBoundingClientRect();
          this.showNoteContextMenu(note.id, note.title, rect.right, rect.bottom);
          return;
        }
        this.selectNote(note);
      });

      // Clic droit (Menu contextuel)
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showNoteContextMenu(note.id, note.title, e.clientX, e.clientY);
      });

      this.listContainer.appendChild(item);
    });
  },

  showNoteContextMenu(noteId, currentTitle, x, y) {
    let menu = document.getElementById('notes-item-context-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'notes-item-context-menu';
      menu.className = 'smooth-context-menu';
      document.body.appendChild(menu);
    }

    menu.innerHTML = `
      <div class="context-menu-item" data-action="rename">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        <span>Renommer</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="delete">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>Supprimer</span>
      </div>
    `;

    menu.style.display = 'flex';
    menu.style.position = 'fixed';
    menu.style.zIndex = '99999';
    
    const menuWidth = 160;
    const menuHeight = 85;
    const posX = Math.min(x, window.innerWidth - menuWidth - 10);
    const posY = Math.min(y, window.innerHeight - menuHeight - 10);

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    const closeMenu = () => {
      menu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', handleKey);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
      document.addEventListener('keydown', handleKey);
    }, 10);

    menu.querySelector('[data-action="rename"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      this.promptRenameNote(noteId, currentTitle);
    });

    menu.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      this.deleteNoteWithConfirm(noteId);
    });
  },

  async promptRenameNote(noteId, currentTitle) {
    const itemEl = document.querySelector(`.note-list-item[data-note-id="${noteId}"]`);
    const titleEl = itemEl?.querySelector('.note-item-title-text');
    
    if (itemEl && titleEl) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'history-rename-input';
      input.value = currentTitle || '';
      
      titleEl.replaceWith(input);
      input.focus();
      input.select();
      
      let isSaving = false;
      const saveRename = async () => {
        if (isSaving) return;
        isSaving = true;
        const newTitle = input.value.trim() || currentTitle || 'Note sans titre';
        try {
          const note = this.notes.find(n => n.id === noteId);
          if (note) {
            note.title = newTitle;
            if (this.currentNote?.id === noteId) {
              this.currentNote.title = newTitle;
              if (this.titleInput) this.titleInput.value = newTitle;
            }
            await API.call('save_note', note);
            await this.loadNotes(this.currentNote?.id || noteId);
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Note renommée.');
            }
          } else {
            await this.loadNotes(this.currentNote?.id);
          }
        } catch (e) {
          console.error("Erreur renommage note:", e);
          await this.loadNotes(this.currentNote?.id);
        }
      };

      input.addEventListener('blur', saveRename);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.renderList();
        }
      });
    } else {
      const newTitle = prompt("Nouveau titre de la note :", currentTitle);
      if (newTitle !== null && newTitle.trim() && newTitle.trim() !== currentTitle) {
        try {
          const note = this.notes.find(n => n.id === noteId);
          if (note) {
            note.title = newTitle.trim();
            if (this.currentNote?.id === noteId) {
              this.currentNote.title = newTitle.trim();
              if (this.titleInput) this.titleInput.value = newTitle.trim();
            }
            await API.call('save_note', note);
            await this.loadNotes(this.currentNote?.id || noteId);
            if (typeof App !== 'undefined' && App.showToast) {
              App.showToast('Note renommée.');
            }
          }
        } catch (e) {
          console.error("Erreur renommage note:", e);
        }
      }
    }
  },

  async deleteNoteWithConfirm(noteId) {
    if (!noteId) {
      if (this.currentNote && !this.currentNote.id) {
        this.createNewNote();
      }
      return;
    }

    const note = this.notes.find(n => n.id === noteId) || (this.currentNote?.id === noteId ? this.currentNote : null);
    const noteTitle = note?.title || 'cette note';

    let confirmed = false;
    if (typeof App !== 'undefined' && App.showConfirmModal) {
      confirmed = await App.showConfirmModal({
        title: "Supprimer la note",
        message: "Voulez-vous supprimer définitivement cette note ?",
        confirmText: "Supprimer",
        cancelText: "Annuler",
        danger: true,
        icon: "trash"
      });
    } else {
      confirmed = confirm("Voulez-vous supprimer définitivement cette note ?");
    }

    if (!confirmed) return;

    try {
      await API.call('delete_note', noteId);
      if (this.currentNote?.id === noteId) {
        this.currentNote = null;
        await this.loadNotes();
      } else {
        await this.loadNotes(this.currentNote?.id);
      }
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast("Note supprimée.");
      }
    } catch (e) {
      console.error("Erreur suppression note:", e);
      alert(`Erreur suppression note : ${e}`);
    }
  },

  async selectNote(note) {
    if (this.currentNote && this.currentNote !== note) {
      await this.saveCurrentNote(true);
    }

    this.currentNote = note;
    if (this.titleInput) this.titleInput.value = note.title || '';
    if (this.refInput) this.refInput.value = note.reference || '';
    if (this.tagsInput) this.tagsInput.value = note.tags || '';
    if (this.aiToggle) this.aiToggle.checked = note.include_in_ai !== false;

    // Injection dans l'éditeur WYSIWYG
    if (this.contentInput) {
      this.contentInput.innerHTML = this.markdownToRichHtml(note.content || '');
    }

    // Réinitialiser la pile d'historique pour cette note
    this.history = [];
    this.historyIndex = -1;
    this.pushHistoryState();

    this.lastSavedSignature = this.computeCurrentSignature();
    this.updateAutoSaveIndicator('saved');
    this.updateAiToggleVisibility();

    if (this.isPreviewMode) {
      this.renderPreview();
    }

    this.renderList();
  },

  async createNewNote(initialRef = null, initialTitle = null) {
    if (this.currentNote) {
      await this.saveCurrentNote(true);
    }
    const defaultRef = initialRef || '';
    const newNote = {
      id: null,
      title: initialTitle || 'Nouvelle Note',
      reference: defaultRef,
      tags: '',
      include_in_ai: true,
      content: '',
      updated_at: 'À l\'instant'
    };
    this.currentNote = newNote;
    await this.selectNote(newNote);
    if (this.isPreviewMode) this.togglePreview();
    this.titleInput?.focus();
  },

  async generateTitleWithAI() {
    const rawMarkdown = this.richHtmlToMarkdown(this.contentInput);
    if (!rawMarkdown || rawMarkdown.trim().length < 15) {
      App.showToast('Veuillez d\'abord rédiger du contenu dans la note pour générer un titre.');
      return;
    }

    const btn = document.getElementById('btn-note-gen-title-ai');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('loading');
    }

    try {
      const ref = this.refInput?.value.trim() || '';
      const currentTitle = this.titleInput?.value.trim() || '';
      const res = await API.call('generate_note_title', rawMarkdown, ref, currentTitle);
      
      if (res && res.success && res.title) {
        if (this.titleInput) {
          this.titleInput.value = res.title;
        }
        if (this.currentNote) {
          this.currentNote.title = res.title;
        }
        this.pushHistoryState();
        this.saveCurrentNote(true);
        App.showToast(`Titre généré par IA (${res.model_used || 'IA'}) !`);
      } else {
        App.showToast(`Erreur génération titre : ${res?.error || 'Échec'}`);
      }
    } catch (e) {
      console.error('Erreur generateTitleWithAI:', e);
      App.showToast(`Erreur : ${e?.message || e}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    }
  },

  async generateTagsWithAI() {
    const rawMarkdown = this.richHtmlToMarkdown(this.contentInput);
    if (!rawMarkdown || rawMarkdown.trim().length < 15) {
      App.showToast('Veuillez d\'abord rédiger du contenu dans la note pour générer des tags.');
      return;
    }

    const btn = document.getElementById('btn-note-gen-tags-ai');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('loading');
    }

    try {
      const ref = this.refInput?.value.trim() || '';
      const currentTags = this.tagsInput?.value.trim() || '';
      const res = await API.call('generate_note_tags', rawMarkdown, ref, currentTags);
      
      if (res && res.success && res.tags) {
        if (this.tagsInput) {
          this.tagsInput.value = res.tags;
        }
        if (this.currentNote) {
          this.currentNote.tags = res.tags;
        }
        this.pushHistoryState();
        this.saveCurrentNote(true);
        App.showToast(`Tags générés par IA (${res.model_used || 'IA'}) !`);
      } else {
        App.showToast(`Erreur génération tags : ${res?.error || 'Échec'}`);
      }
    } catch (e) {
      console.error('Erreur generateTagsWithAI:', e);
      App.showToast(`Erreur : ${e?.message || e}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    }
  },

  // =========================================================================
  // GESTION DU MENU SLASH MODAL (/) DANS L'ÉDITEUR
  // =========================================================================

  isSlashMenuOpen: false,
  slashMenuEl: null,
  slashSelectedIndex: 0,
  slashCurrentItems: [],
  slashAnchorRange: null,

  getSlashCommandsDefinitions() {
    return [
      {
        category: "Structure & Titres",
        items: [
          { id: "h1", label: "Titre 1 (H1)", iconText: "H1", desc: "Grand titre de section", action: "h1" },
          { id: "h2", label: "Titre 2 (H2)", iconText: "H2", desc: "Titre secondaire", action: "h2" },
          { id: "h3", label: "Titre 3 (H3)", iconText: "H3", desc: "Sous-section de note", action: "h3" },
          { id: "text", label: "Texte normal", iconText: "¶", desc: "Paragraphe standard", action: "text" }
        ]
      },
      {
        category: "Listes & Tâches",
        items: [
          { id: "bullet", label: "Liste à puces", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`, desc: "Liste à puces standard", action: "bullet" },
          { id: "number", label: "Liste numérotée", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/></svg>`, desc: "Liste ordonnée 1, 2, 3...", action: "number" },
          { id: "task", label: "Case à cocher (To-do)", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`, desc: "Tâche ou point à vérifier", action: "task" }
        ]
      },
      {
        category: "Étude & Réflexion",
        items: [
          { id: "scripture", label: "Citation biblique", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`, desc: "Verset ou passage des Écritures", action: "scripture" },
          { id: "quote", label: "Citation d'auteur", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>`, desc: "Citation en retrait", action: "quote" },
          { id: "callout", label: "Encart Remarque", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`, desc: "Encart mis en valeur [!NOTE]", action: "callout" }
        ]
      },
      {
        category: "Tableaux & Outils",
        items: [
          { id: "table", label: "Tableau interactif", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`, desc: "Tableau à colonnes et lignes", action: "table" },
          { id: "code", label: "Bloc de code", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`, desc: "Code ou texte préformaté", action: "code" },
          { id: "divider", label: "Séparateur horizontal", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>`, desc: "Ligne de séparation (---)", action: "divider" },
          { id: "datetime", label: "Date & Heure", iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`, desc: "Horodatage actuel", action: "datetime" }
        ]
      }
    ];
  },

  handleSlashInput(e) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      this.closeSlashMenu();
      return;
    }

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      this.closeSlashMenu();
      return;
    }

    const textBefore = node.textContent.slice(0, range.startOffset);
    const lastSlashIndex = textBefore.lastIndexOf('/');

    if (lastSlashIndex !== -1) {
      const isStartOrSpace = lastSlashIndex === 0 || /\s/.test(textBefore[lastSlashIndex - 1]);
      if (isStartOrSpace) {
        const query = textBefore.slice(lastSlashIndex + 1);
        const rect = range.getBoundingClientRect();
        this.openSlashMenu(query, rect);
        return;
      }
    }

    this.closeSlashMenu();
  },

  openSlashMenu(query = '', rect = null) {
    if (!this.slashMenuEl) {
      this.createSlashMenuEl();
    }

    try {
      this.slashAnchorRange = window.getSelection().getRangeAt(0).cloneRange();
    } catch (e) {
      this.slashAnchorRange = null;
    }

    this.renderSlashMenuItems(query);

    if (rect && rect.top > 0) {
      const left = Math.min(window.innerWidth - 300, Math.max(10, rect.left));
      const top = rect.bottom + window.scrollY + 6;
      this.slashMenuEl.style.left = `${left}px`;
      this.slashMenuEl.style.top = `${top}px`;
    }

    this.slashMenuEl.classList.remove('hidden');
    this.isSlashMenuOpen = true;
  },

  closeSlashMenu() {
    if (this.slashMenuEl) {
      this.slashMenuEl.classList.add('hidden');
    }
    this.isSlashMenuOpen = false;
  },

  createSlashMenuEl() {
    let el = document.getElementById('notes-slash-menu');
    if (!el) {
      el = document.createElement('div');
      el.id = 'notes-slash-menu';
      el.className = 'notes-slash-dropdown hidden';
      document.body.appendChild(el);
    }
    this.slashMenuEl = el;

    document.addEventListener('click', (e) => {
      if (this.isSlashMenuOpen && !this.slashMenuEl.contains(e.target) && e.target !== this.contentInput && !this.contentInput?.contains(e.target)) {
        this.closeSlashMenu();
      }
    });
  },

  renderSlashMenuItems(query = '') {
    const q = query.toLowerCase().trim();
    const categories = this.getSlashCommandsDefinitions();

    let flatItems = [];
    let html = '';

    categories.forEach(cat => {
      const matching = cat.items.filter(item => 
        !q || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
      );

      if (matching.length > 0) {
        html += `<div class="slash-category-header">${cat.category}</div>`;
        matching.forEach(item => {
          const currentIndex = flatItems.length;
          flatItems.push(item);
          const icon = item.iconSvg || `<span class="slash-icon-text">${item.iconText || 'Aa'}</span>`;
          html += `
            <div class="slash-item ${currentIndex === 0 ? 'active' : ''}" data-action="${item.action}" data-index="${currentIndex}">
              <div class="slash-item-icon">${icon}</div>
              <div class="slash-item-text">
                <div class="slash-item-label">${this.escapeHtml(item.label)}</div>
                <div class="slash-item-desc">${this.escapeHtml(item.desc)}</div>
              </div>
            </div>
          `;
        });
      }
    });

    this.slashCurrentItems = flatItems;
    this.slashSelectedIndex = 0;

    if (flatItems.length === 0) {
      html = `<div class="slash-empty">Aucune commande trouvée</div>`;
    }

    this.slashMenuEl.innerHTML = html;

    this.slashMenuEl.querySelectorAll('.slash-item').forEach(itemEl => {
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = itemEl.dataset.action;
        this.executeSlashCommand(action);
      });
    });
  },

  handleSlashKeyDown(e) {
    if (!this.isSlashMenuOpen) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.slashCurrentItems.length > 0) {
        this.slashSelectedIndex = (this.slashSelectedIndex + 1) % this.slashCurrentItems.length;
        this.updateSlashSelection();
      }
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.slashCurrentItems.length > 0) {
        this.slashSelectedIndex = (this.slashSelectedIndex - 1 + this.slashCurrentItems.length) % this.slashCurrentItems.length;
        this.updateSlashSelection();
      }
      return true;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.slashCurrentItems[this.slashSelectedIndex]) {
        this.executeSlashCommand(this.slashCurrentItems[this.slashSelectedIndex].action);
      }
      return true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.closeSlashMenu();
      return true;
    }
    return false;
  },

  updateSlashSelection() {
    this.slashMenuEl.querySelectorAll('.slash-item').forEach((item, idx) => {
      const isActive = idx === this.slashSelectedIndex;
      item.classList.toggle('active', isActive);
      if (isActive) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  },

  executeSlashCommand(action) {
    this.closeSlashMenu();

    if (this.slashAnchorRange) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.slashAnchorRange);

        const node = this.slashAnchorRange.startContainer;
        if (node && node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          const lastSlash = text.lastIndexOf('/');
          if (lastSlash !== -1) {
            node.textContent = text.slice(0, lastSlash);
          }
        }
      } catch (e) {
        console.warn('Erreur nettoyage slash anchor:', e);
      }
    }

    if (['h1', 'h2', 'h3', 'text', 'paragraph', 'quote', 'callout', 'bullet', 'number', 'task'].includes(action)) {
      this.setBlockType(action);
    } else if (action === 'scripture') {
      this.insertScriptureQuote();
    } else if (action === 'table') {
      this.insertRealTable();
    } else if (action === 'code') {
      this.insertCodeBlock();
    } else if (action === 'divider') {
      document.execCommand('insertHorizontalRule');
    } else if (action === 'datetime') {
      const now = new Date();
      const dStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const tStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      document.execCommand('insertHTML', false, `<strong>${dStr} à ${tStr}</strong> `);
    } else {
      this.executeAction(action, this.contentInput);
    }

    this.pushHistoryState();
    this.triggerAutoSave();
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  togglePreview() {
    this.isPreviewMode = !this.isPreviewMode;
    const btn = document.getElementById('btn-toggle-note-preview');

    this.hideFloatingToolbar();
    this.closeSlashMenu();

    if (this.isPreviewMode) {
      if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Éditer</span>';
      this.contentInput?.classList.add('hidden');
      this.previewContainer?.classList.remove('hidden');
      this.renderPreview();
    } else {
      if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>Aperçu</span>';
      this.previewContainer?.classList.add('hidden');
      this.contentInput?.classList.remove('hidden');
    }
  },

  renderPreview() {
    if (!this.previewContainer) return;
    const markdownText = this.richHtmlToMarkdown(this.contentInput);
    if (!markdownText.trim()) {
      this.previewContainer.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Note vide. Cliquez sur Éditer pour rédiger.</p>';
      return;
    }

    let html = this.markdownToRichHtml(markdownText);
    html = this.linkifyScriptureRefs(html);
    this.previewContainer.innerHTML = html;

    this.previewContainer.querySelectorAll('.scripture-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const ref = link.getAttribute('data-ref');
        if (ref) {
          App.switchView('bible');
          BibleReader.navigateTo(ref);
        }
      });
    });
  },

  linkifyScriptureRefs(html) {
    const refRegex = /\b([1-3]?\s?[A-ZÀ-Ÿa-zà-ÿ]{3,15})\s+(\d{1,3}):(\d{1,3}(?:-\d{1,3})?)\b/g;
    return html.replace(refRegex, (match, book, chap, verse) => {
      return `<a href="#" class="scripture-link" data-ref="${book} ${chap}:${verse}" style="color: var(--accent-blue); font-weight: 700; text-decoration: underline; cursor: pointer;">${match}</a>`;
    });
  },

  triggerAutoSave() {
    this.updateAutoSaveIndicator('dirty');
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.saveCurrentNote(true);
    }, this.autoSaveDelay);
  },

  updateAutoSaveIndicator(status) {
    const el = this.autoSaveIndicator || document.getElementById('note-autosave-indicator');
    if (!el) return;
    this.autoSaveIndicator = el;

    if (status === 'saving') {
      el.className = 'note-autosave-indicator saving';
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span>Enregistrement...</span>
      `;
    } else if (status === 'dirty') {
      el.className = 'note-autosave-indicator dirty';
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
        <span>Modifié</span>
      `;
    } else if (status === 'saved') {
      el.className = 'note-autosave-indicator';
      el.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span>Enregistré</span>
      `;
    }
  },

  computeCurrentSignature() {
    const title = this.titleInput?.value.trim() || '';
    const ref = this.refInput?.value.trim() || '';
    const tags = this.tagsInput?.value.trim() || '';
    const ai = this.aiToggle?.checked !== false;
    const content = this.contentInput?.innerHTML || '';
    return `${title}__${ref}__${tags}__${ai}__${content}`;
  },

  async saveCurrentNote(silent = true) {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (!this.currentNote) return;

    const rawMarkdown = this.richHtmlToMarkdown(this.contentInput);
    const titleVal = this.titleInput?.value.trim() || '';
    const refVal = this.refInput?.value.trim() || '';
    const tagsVal = this.tagsInput?.value.trim() || '';
    const aiVal = this.aiToggle?.checked !== false;

    // Ne rien sauvegarder si la note est neuve et totalement vide
    if (!this.currentNote.id && !titleVal && !rawMarkdown.trim() && !refVal && !tagsVal) {
      this.updateAutoSaveIndicator('saved');
      return;
    }

    const currentSig = this.computeCurrentSignature();
    if (silent && this.lastSavedSignature === currentSig) {
      this.updateAutoSaveIndicator('saved');
      return;
    }

    const noteToSave = {
      id: this.currentNote.id,
      title: titleVal || 'Note sans titre',
      reference: refVal,
      tags: tagsVal,
      include_in_ai: aiVal,
      content: rawMarkdown
    };

    this.isSaving = true;
    this.updateAutoSaveIndicator('saving');

    try {
      const saved = await API.call('save_note', noteToSave);
      if (saved && saved.id) {
        this.currentNote.id = saved.id;
        this.currentNote.title = noteToSave.title;
        this.currentNote.reference = noteToSave.reference;
        this.currentNote.tags = noteToSave.tags;
        this.currentNote.include_in_ai = noteToSave.include_in_ai;
        this.currentNote.content = noteToSave.content;
        this.currentNote.updated_at = saved.updated_at || 'À l\'instant';
        this.lastSavedSignature = this.computeCurrentSignature();

        // Mettre à jour l'élément dans le tableau local et rafraîchir la barre latérale sans toucher à l'éditeur
        const existingIdx = this.notes.findIndex(n => n.id === saved.id);
        if (existingIdx !== -1) {
          this.notes[existingIdx] = { ...this.currentNote };
        } else {
          this.notes.unshift({ ...this.currentNote });
        }
        this.renderList();
      }

      this.updateAutoSaveIndicator('saved');
      if (!silent) {
        App.showToast('Note enregistrée !');
      }
    } catch (e) {
      console.error('Erreur sauvegarde note automatique:', e);
      if (!silent) {
        alert(`Erreur sauvegarde note : ${e}`);
      }
    } finally {
      this.isSaving = false;
    }
  },

  async deleteCurrentNote() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (!this.currentNote || !this.currentNote.id) {
      this.createNewNote();
      return;
    }
    await this.deleteNoteWithConfirm(this.currentNote.id);
  }
};
