/**
 * Notes View Controller
 * Gère la prise de notes bibliques en Markdown (.md), la recherche,
 * la synchronisation avec le lecteur et la compatibilité RAG IA.
 */

const NotesView = {
  notes: [],
  currentNote: null,
  isPreviewMode: false,

  listContainer: null,
  searchInput: null,
  titleInput: null,
  refInput: null,
  tagsInput: null,
  aiToggle: null,
  contentInput: null,
  previewContainer: null,

  init() {
    this.listContainer = document.getElementById('notes-list-items');
    this.searchInput = document.getElementById('notes-search-input');
    this.titleInput = document.getElementById('note-edit-title');
    this.refInput = document.getElementById('note-edit-ref');
    this.tagsInput = document.getElementById('note-edit-tags');
    this.aiToggle = document.getElementById('note-edit-ai-toggle');
    this.contentInput = document.getElementById('note-edit-content');
    this.previewContainer = document.getElementById('note-preview-content');

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

    // Raccourcis de formatage Markdown
    this.bindMarkdownTools();

    this.loadNotes();
  },

  bindMarkdownTools() {
    const wrapSelection = (before, after) => {
      if (!this.contentInput) return;
      const start = this.contentInput.selectionStart;
      const end = this.contentInput.selectionEnd;
      const text = this.contentInput.value;
      const sel = text.substring(start, end) || 'texte';
      this.contentInput.value = text.substring(0, start) + before + sel + after + text.substring(end);
      this.contentInput.focus();
      this.contentInput.setSelectionRange(start + before.length, start + before.length + sel.length);
    };

    document.getElementById('btn-md-bold')?.addEventListener('click', () => wrapSelection('**', '**'));
    document.getElementById('btn-md-italic')?.addEventListener('click', () => wrapSelection('*', '*'));
    document.getElementById('btn-md-quote')?.addEventListener('click', () => wrapSelection('\n> ', '\n'));
    document.getElementById('btn-md-list')?.addEventListener('click', () => wrapSelection('\n- ', '\n'));
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

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-list-item ${this.currentNote?.id === note.id ? 'active' : ''}`;
      
      const aiBadge = note.include_in_ai !== false ? '<span title="Prise en compte par l\'IA" style="font-size: 11px; margin-left: 4px;">🤖</span>' : '';
      
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
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 700; color: var(--accent-blue); margin: 12px 0 6px 0;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 14px 0 8px 0;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 22px; font-weight: 800; color: var(--accent-blue); margin: 16px 0 10px 0;">$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding-left: 12px; margin: 10px 0; color: var(--text-secondary); font-style: italic; background: var(--bg-subtle); padding: 8px 12px; border-radius: 0 6px 6px 0;">$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^\- (.*$)/gim, '<li style="margin-left: 20px; list-style-type: disc;">$1</li>')
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
