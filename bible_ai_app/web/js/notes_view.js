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

    // Boutons Historique Annuler / Rétablir
    document.getElementById('btn-note-undo')?.addEventListener('click', () => {
      this.undo();
    });

    document.getElementById('btn-note-redo')?.addEventListener('click', () => {
      this.redo();
    });

    // Raccourcis de formatage Barre Rapide
    this.bindMarkdownTools();

    // Menu contextuel style Obsidian (Clic droit) & Raccourcis clavier
    this.bindContextMenu();
    this.bindEditorShortcuts(this.contentInput);

    // Écoute de la saisie pour l'historique Undo / Redo
    this.contentInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
    });
    this.titleInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
    });
    this.refInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
    });
    this.tagsInput?.addEventListener('input', () => {
      this.debouncedPushHistory();
    });

    // Gestion du collage intelligent dans l'éditeur riche
    this.contentInput?.addEventListener('paste', (e) => {
      this.handlePaste(e);
    });

    this.updateAiToggleVisibility();
    this.loadNotes();
  },

  bindMarkdownTools() {
    document.getElementById('btn-md-h1')?.addEventListener('click', () => this.executeAction('h1', this.contentInput));
    document.getElementById('btn-md-h2')?.addEventListener('click', () => this.executeAction('h2', this.contentInput));
    document.getElementById('btn-md-bold')?.addEventListener('click', () => this.executeAction('bold', this.contentInput));
    document.getElementById('btn-md-italic')?.addEventListener('click', () => this.executeAction('italic', this.contentInput));
    document.getElementById('btn-md-quote')?.addEventListener('click', () => this.executeAction('quote', this.contentInput));
    document.getElementById('btn-md-list')?.addEventListener('click', () => this.executeAction('bullet-list', this.contentInput));
    document.getElementById('btn-md-table')?.addEventListener('click', () => this.executeAction('table', this.contentInput));
    document.getElementById('btn-md-callout')?.addEventListener('click', () => this.executeAction('callout', this.contentInput));
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
          this.saveCurrentNote();
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
    clearTimeout(this.historyDebounceTimer);
    this.historyDebounceTimer = setTimeout(() => {
      this.pushHistoryState();
    }, 350);
  },

  pushHistoryState() {
    if (!this.contentInput) return;
    const currentState = {
      html: this.contentInput.innerHTML,
      title: this.titleInput?.value || '',
      ref: this.refInput?.value || '',
      tags: this.tagsInput?.value || ''
    };

    // Éviter les doublons consécutifs identiques
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
      case 'quote':
        if (isRichEditor) {
          this.applyBlockFormat('blockquote');
        }
        break;
      case 'bullet-list':
        if (isRichEditor) {
          document.execCommand('insertUnorderedList');
        }
        break;
      case 'number-list':
        if (isRichEditor) {
          document.execCommand('insertOrderedList');
        }
        break;
      case 'task-list':
        if (isRichEditor) {
          this.insertTaskItem();
        }
        break;

      // 3. Insérer (Tableaux réels, Encarts, Horodatage...)
      case 'horizontal-rule':
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

  applyBlockFormat(tag) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let parent = range.commonAncestorContainer;
    if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;

    // Si on est déjà dans ce tag, repasser en <p>
    if (parent.closest(tag)) {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${tag}>`);
    }
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

  selectNote(note) {
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
    if (this.isPreviewMode) this.togglePreview();
    this.titleInput?.focus();
  },

  togglePreview() {
    this.isPreviewMode = !this.isPreviewMode;
    const btn = document.getElementById('btn-toggle-note-preview');

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

  async saveCurrentNote() {
    if (!this.currentNote) return;

    const rawMarkdown = this.richHtmlToMarkdown(this.contentInput);

    const noteToSave = {
      id: this.currentNote.id,
      title: this.titleInput?.value.trim() || 'Note sans titre',
      reference: this.refInput?.value.trim() || '',
      tags: this.tagsInput?.value.trim() || '',
      include_in_ai: this.aiToggle?.checked !== false,
      content: rawMarkdown
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
    await this.deleteNoteWithConfirm(this.currentNote.id);
  }
};
