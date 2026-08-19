/**
 * Notes View Controller & Obsidian-Style Editor
 * Gère la prise de notes bibliques en Markdown (.md), la recherche,
 * le menu contextuel clic droit Obsidian, la synchronisation avec le lecteur et le RAG IA.
 */

const NotesView = {
  notes: [],
  currentNote: null,
  isPreviewMode: false,
  activeTargetInput: null,

  listContainer: null,
  searchInput: null,
  titleInput: null,
  refInput: null,
  tagsInput: null,
  aiToggle: null,
  contentInput: null,
  previewContainer: null,
  contextMenu: null,

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

    document.getElementById('btn-save-current-note')?.addEventListener('click', () => {
      this.saveCurrentNote();
    });

    document.getElementById('btn-delete-current-note')?.addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    document.getElementById('btn-toggle-note-preview')?.addEventListener('click', () => {
      this.togglePreview();
    });

    // Raccourcis de formatage Markdown (Barre rapide)
    this.bindMarkdownTools();

    // Menu contextuel style Obsidian (Clic droit) & Raccourcis clavier
    this.bindContextMenu();
    this.bindEditorShortcuts(this.contentInput);
    const drawerContentInp = document.getElementById('drawer-note-content-input');
    if (drawerContentInp) {
      this.bindEditorShortcuts(drawerContentInp);
    }

    this.updateAiToggleVisibility();
    this.loadNotes();
  },

  bindMarkdownTools() {
    document.getElementById('btn-md-bold')?.addEventListener('click', () => this.executeAction('bold', this.contentInput));
    document.getElementById('btn-md-italic')?.addEventListener('click', () => this.executeAction('italic', this.contentInput));
    document.getElementById('btn-md-quote')?.addEventListener('click', () => this.executeAction('quote', this.contentInput));
    document.getElementById('btn-md-list')?.addEventListener('click', () => this.executeAction('bullet-list', this.contentInput));
  },

  bindContextMenu() {
    const menu = this.contextMenu;
    if (!menu) return;

    // Détecter le clic droit sur la vue notes complète ou dans le volet latéral
    const handleContextMenu = (e) => {
      const target = e.target.closest('textarea, input[type="text"]') || this.contentInput;
      this.activeTargetInput = target;

      e.preventDefault();
      e.stopPropagation();

      // Fermer d'abord les éventuels sous-menus
      menu.querySelectorAll('.ctx-submenu').forEach(s => s.classList.remove('open-left'));

      // Afficher le menu
      menu.classList.remove('hidden');

      // Calcul des dimensions et positionnement
      const menuWidth = 230;
      const menuHeight = menu.offsetHeight || 300;
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

    // Attacher à la vue notes et au tiroir
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

    // Fermeture du menu au clic ailleurs ou sur Escape
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
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'b') {
          e.preventDefault();
          this.executeAction('bold', inputEl);
        } else if (key === 'i') {
          e.preventDefault();
          this.executeAction('italic', inputEl);
        } else if (e.shiftKey && key === 'x') {
          e.preventDefault();
          this.executeAction('strikethrough', inputEl);
        } else if (e.shiftKey && key === 'h') {
          e.preventDefault();
          this.executeAction('highlight', inputEl);
        } else if (e.shiftKey && key === 'd') {
          e.preventDefault();
          this.executeAction('datetime', inputEl);
        }
      } else if (e.key === 'Tab') {
        // Indentation fluide avec Tab / Shift+Tab
        e.preventDefault();
        const start = inputEl.selectionStart;
        const end = inputEl.selectionEnd;
        const text = inputEl.value;

        if (e.shiftKey) {
          // Désindenter
          const before = text.substring(0, start);
          const sel = text.substring(start, end);
          const after = text.substring(end);
          if (sel.includes('\n')) {
            const unindented = sel.split('\n').map(l => l.startsWith('  ') ? l.substring(2) : (l.startsWith('\t') ? l.substring(1) : l)).join('\n');
            inputEl.value = before + unindented + after;
            inputEl.setSelectionRange(start, start + unindented.length);
          }
        } else {
          // Indenter
          if (start !== end && text.substring(start, end).includes('\n')) {
            const sel = text.substring(start, end);
            const indented = sel.split('\n').map(l => '  ' + l).join('\n');
            inputEl.value = text.substring(0, start) + indented + text.substring(end);
            inputEl.setSelectionRange(start, start + indented.length);
          } else {
            inputEl.value = text.substring(0, start) + '  ' + text.substring(end);
            inputEl.setSelectionRange(start + 2, start + 2);
          }
        }
      }
    });
  },

  async executeAction(action, target) {
    if (!target) return;
    target.focus();

    const wrapSelection = (before, after, defaultText = 'texte') => {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const text = target.value;
      const hasSel = start !== end;
      const sel = hasSel ? text.substring(start, end) : defaultText;
      target.value = text.substring(0, start) + before + sel + after + text.substring(end);
      target.focus();
      if (hasSel) {
        target.setSelectionRange(start + before.length, start + before.length + sel.length);
      } else {
        target.setSelectionRange(start + before.length, start + before.length + defaultText.length);
      }
    };

    const prefixLines = (prefix, defaultText = 'Texte') => {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const text = target.value;

      if (start === end) {
        // Trouver le début de la ligne actuelle
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        target.value = text.substring(0, lineStart) + prefix + text.substring(lineStart);
        target.focus();
        target.setSelectionRange(start + prefix.length, start + prefix.length);
      } else {
        const sel = text.substring(start, end);
        const prefixed = sel.split('\n').map(line => prefix + line).join('\n');
        target.value = text.substring(0, start) + prefixed + text.substring(end);
        target.focus();
        target.setSelectionRange(start, start + prefixed.length);
      }
    };

    const insertText = (str, selectOffset = 0, selectLen = 0) => {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const text = target.value;
      target.value = text.substring(0, start) + str + text.substring(end);
      target.focus();
      const newPos = start + (selectOffset || str.length);
      target.setSelectionRange(newPos, newPos + (selectLen || 0));
    };

    switch (action) {
      // 1. Formater
      case 'bold':
        wrapSelection('**', '**', 'texte en gras');
        break;
      case 'italic':
        wrapSelection('*', '*', 'texte en italique');
        break;
      case 'strikethrough':
        wrapSelection('~~', '~~', 'texte barré');
        break;
      case 'highlight':
        wrapSelection('==', '==', 'texte surligné');
        break;
      case 'inline-code':
        wrapSelection('`', '`', 'code');
        break;
      case 'superscript':
        wrapSelection('^', '^', 'exposant');
        break;
      case 'subscript':
        wrapSelection('~', '~', 'indice');
        break;

      // 2. Paragraphe
      case 'h1':
        prefixLines('# ', 'Titre 1');
        break;
      case 'h2':
        prefixLines('## ', 'Titre 2');
        break;
      case 'h3':
        prefixLines('### ', 'Titre 3');
        break;
      case 'quote':
        prefixLines('> ', 'Citation');
        break;
      case 'bullet-list':
        prefixLines('- ', 'Élément');
        break;
      case 'number-list':
        prefixLines('1. ', 'Élément');
        break;
      case 'task-list':
        prefixLines('- [ ] ', 'Tâche à faire');
        break;

      // 3. Insérer
      case 'horizontal-rule':
        insertText('\n\n---\n\n');
        break;
      case 'datetime': {
        const now = new Date();
        const dStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const tStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        insertText(`**${dStr} à ${tStr}** `);
        break;
      }
      case 'table': {
        const tableTemplate = `\n| Colonne 1 | Colonne 2 | Colonne 3 |\n| :--- | :--- | :--- |\n| Valeur 1 | Valeur 2 | Valeur 3 |\n| Donnée A | Donnée B | Donnée C |\n\n`;
        insertText(tableTemplate);
        break;
      }
      case 'code-block': {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        if (start !== end) {
          wrapSelection('\n```\n', '\n```\n', '');
        } else {
          insertText('\n```\n// Votre bloc de code ou note ici\n```\n');
        }
        break;
      }
      case 'callout': {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        if (start !== end) {
          wrapSelection('> [!NOTE] Remarque\n> ', '\n', '');
        } else {
          insertText('\n> [!NOTE] Remarque\n> Votre texte ou réflexion ici.\n\n');
        }
        break;
      }

      // 4. Couper, Copier, Coller, Tout sélectionner
      case 'cut': {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const text = target.value;
        const sel = text.substring(start, end);
        if (sel) {
          try {
            await navigator.clipboard.writeText(sel);
          } catch (e) {
            document.execCommand('copy');
          }
          target.value = text.substring(0, start) + text.substring(end);
          target.setSelectionRange(start, start);
          App.showToast('Texte coupé');
        }
        break;
      }
      case 'copy': {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const sel = target.value.substring(start, end);
        if (sel) {
          try {
            await navigator.clipboard.writeText(sel);
          } catch (e) {
            document.execCommand('copy');
          }
          App.showToast('Texte copié dans le presse-papier');
        }
        break;
      }
      case 'paste': {
        try {
          const clipText = await navigator.clipboard.readText();
          if (clipText) {
            insertText(clipText);
          }
        } catch (e) {
          document.execCommand('paste');
        }
        break;
      }
      case 'paste-plain': {
        try {
          let clipText = await navigator.clipboard.readText();
          if (clipText) {
            // Nettoyage formatage HTML éventuel
            clipText = clipText.replace(/<[^>]*>?/gm, '');
            insertText(clipText);
          }
        } catch (e) {
          document.execCommand('paste');
        }
        break;
      }
      case 'select-all': {
        if (typeof target.select === 'function') {
          target.select();
        }
        break;
      }
    }
  },

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

  renderList() {
    const q = (this.searchInput?.value || '').toLowerCase().trim();
    const filtered = this.notes.filter(n => {
      if (!q) return true;
      return (n.title || '').toLowerCase().includes(q) ||
             (n.reference || '').toLowerCase().includes(q) ||
             (n.content || '').toLowerCase().includes(q) ||
             (n.tags || '').toLowerCase().includes(q);
    });

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
      
      const aiBadge = (isGlobalAiEnabled && note.include_in_ai !== false) ? '<span title="Prise en compte par l\'IA" style="font-size: 11px; margin-left: 4px;">🤖</span>' : '';
      
      item.innerHTML = `
        <div class="note-item-title">${note.title || 'Note sans titre'} ${aiBadge}</div>
        <div class="note-item-meta">
          ${note.reference ? `<span class="note-ref-badge">${note.reference}</span>` : '<span style="font-size: 10px; color: var(--text-muted);">Générale</span>'}
          <span class="note-item-date">${note.updated_at || ''}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        this.selectNote(note);
      });

      this.listContainer.appendChild(item);
    });
  },

  selectNote(note) {
    this.currentNote = note;
    if (this.titleInput) this.titleInput.value = note.title || '';
    if (this.refInput) this.refInput.value = note.reference || '';
    if (this.tagsInput) this.tagsInput.value = note.tags || '';
    if (this.aiToggle) this.aiToggle.checked = note.include_in_ai !== false;
    if (this.contentInput) this.contentInput.value = note.content || '';

    this.updateAiToggleVisibility();

    if (this.isPreviewMode) {
      this.renderPreview();
    }

    this.renderList();
  },

  createNewNote(initialRef = null, initialTitle = null) {
    const defaultRef = initialRef || (BibleReader.currentBook ? `${BibleReader.currentBook} ${BibleReader.currentChapter || 1}` : 'Genèse 1:1');
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
    this.selectNote(newNote);
    if (this.isPreviewMode) this.togglePreview(); // Repasser en mode édition
    this.titleInput?.focus();
  },

  togglePreview() {
    this.isPreviewMode = !this.isPreviewMode;
    const btn = document.getElementById('btn-toggle-note-preview');

    if (this.isPreviewMode) {
      if (btn) btn.textContent = '✏️ Éditer';
      this.contentInput?.classList.add('hidden');
      this.previewContainer?.classList.remove('hidden');
      this.renderPreview();
    } else {
      if (btn) btn.textContent = '👁️ Aperçu';
      this.previewContainer?.classList.add('hidden');
      this.contentInput?.classList.remove('hidden');
    }
  },

  renderPreview() {
    if (!this.previewContainer) return;
    const raw = this.contentInput?.value || '';
    if (!raw.trim()) {
      this.previewContainer.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Note vide. Cliquez sur Éditer pour rédiger.</p>';
      return;
    }

    let html = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Code blocks ```code```
      .replace(/```([\s\S]*?)```/g, (match, p1) => `<pre style="background: var(--bg-subtle); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); font-family: monospace; font-size: 13px; overflow-x: auto; margin: 12px 0;"><code>${p1.trim()}</code></pre>`)
      // Callout > [!NOTE] Title
      .replace(/^\> \[!([A-Z]+)\][ ]?(.*$)\n((?:> .*$\n?)*)/gim, (match, type, title, body) => {
        const cleanBody = body.replace(/^\> /gm, '').replace(/\n/g, '<br>');
        return `<div class="note-callout"><div class="note-callout-title">💡 ${title || type}</div><div>${cleanBody}</div></div>`;
      })
      // Titres
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 700; color: var(--accent-blue); margin: 14px 0 6px 0;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 16px 0 8px 0;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 22px; font-weight: 800; color: var(--accent-blue); margin: 18px 0 10px 0;">$1</h1>')
      // Lignes de séparation
      .replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 16px 0;">')
      // Blockquotes classiques
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding-left: 12px; margin: 10px 0; color: var(--text-secondary); font-style: italic; background: var(--bg-subtle); padding: 8px 12px; border-radius: 0 6px 6px 0;">$1</blockquote>')
      // Formatage en ligne
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/~~(.*?)~~/gim, '<del>$1</del>')
      .replace(/==(.*?)==/gim, '<mark style="background: rgba(234, 179, 8, 0.35); color: inherit; padding: 1px 4px; border-radius: 3px;">$1</mark>')
      .replace(/`([^`]+)`/gim, '<code style="background: var(--bg-subtle); border: 1px solid var(--border-color); padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 13px;">$1</code>')
      .replace(/\^([^\^]+)\^/gim, '<sup>$1</sup>')
      .replace(/~([^~]+)~/gim, '<sub>$1</sub>')
      // Tâches
      .replace(/^\- \[x\] (.*$)/gim, '<li style="list-style: none; display: flex; align-items: center; gap: 6px; margin: 4px 0;"><input type="checkbox" checked disabled> <del>$1</del></li>')
      .replace(/^\- \[ \] (.*$)/gim, '<li style="list-style: none; display: flex; align-items: center; gap: 6px; margin: 4px 0;"><input type="checkbox" disabled> <span>$1</span></li>')
      // Listes à puces & numérotées
      .replace(/^\- (.*$)/gim, '<li style="margin-left: 20px; list-style-type: disc; margin: 3px 0;">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li style="margin-left: 20px; list-style-type: decimal; margin: 3px 0;">$1</li>')
      // Retours à la ligne
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    // Rendre les références bibliques cliquables
    html = this.linkifyScriptureRefs(html);

    this.previewContainer.innerHTML = html;

    // Attacher les écouteurs de saut vers le verset
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
    // Regex pour détecter les références simples comme Jean 3:16 ou Genèse 1:1
    const refRegex = /\b([1-3]?\s?[A-ZÀ-Ÿa-zà-ÿ]{3,15})\s+(\d{1,3}):(\d{1,3}(?:-\d{1,3})?)\b/g;
    return html.replace(refRegex, (match, book, chap, verse) => {
      return `<a href="#" class="scripture-link" data-ref="${book} ${chap}:${verse}" style="color: var(--accent-blue); font-weight: 700; text-decoration: underline; cursor: pointer;">${match}</a>`;
    });
  },

  async saveCurrentNote() {
    if (!this.currentNote) return;

    const noteToSave = {
      id: this.currentNote.id,
      title: this.titleInput?.value.trim() || 'Note sans titre',
      reference: this.refInput?.value.trim() || '',
      tags: this.tagsInput?.value.trim() || '',
      include_in_ai: this.aiToggle?.checked !== false,
      content: this.contentInput?.value || ''
    };

    try {
      const saved = await API.call('save_note', noteToSave);
      App.showToast('Note enregistrée en fichier Markdown (.md) !');
      await this.loadNotes(saved?.id || this.currentNote.id);
    } catch (e) {
      alert(`Erreur sauvegarde note : ${e}`);
    }
  },

  async deleteCurrentNote() {
    if (!this.currentNote || !this.currentNote.id) {
      this.createNewNote();
      return;
    }

    if (confirm(`Supprimer définitivement le fichier Markdown de la note « ${this.currentNote.title} » ?`)) {
      try {
        await API.call('delete_note', this.currentNote.id);
        App.showToast('Note supprimée du disque.');
        await this.loadNotes();
      } catch (e) {
        alert(`Erreur suppression note : ${e}`);
      }
    }
  }
};
