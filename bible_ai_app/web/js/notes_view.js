/**
 * Notes View Controller
 * Gère la prise de notes bibliques, la recherche de notes et la persistance.
 */

const NotesView = {
  notes: [],
  currentNote: null,

  listContainer: null,
  searchInput: null,
  titleInput: null,
  refInput: null,
  tagsInput: null,
  contentInput: null,

  init() {
    this.listContainer = document.getElementById('notes-list-items');
    this.searchInput = document.getElementById('notes-search-input');
    this.titleInput = document.getElementById('note-edit-title');
    this.refInput = document.getElementById('note-edit-ref');
    this.tagsInput = document.getElementById('note-edit-tags');
    this.contentInput = document.getElementById('note-edit-content');

    this.searchInput.addEventListener('input', () => this.renderList());

    document.getElementById('btn-new-note').addEventListener('click', () => {
      this.createNewNote();
    });

    document.getElementById('btn-save-current-note').addEventListener('click', () => {
      this.saveCurrentNote();
    });

    document.getElementById('btn-delete-current-note').addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    this.loadNotes();
  },

  async loadNotes() {
    try {
      this.notes = await API.call('get_notes_list') || [];
      this.renderList();
      if (this.notes.length > 0) {
        this.selectNote(this.notes[0]);
      } else {
        this.createNewNote();
      }
    } catch (e) {
      console.error('Erreur chargement notes:', e);
    }
  },

  renderList() {
    const q = this.searchInput.value.toLowerCase().trim();
    const filtered = this.notes.filter(n => {
      if (!q) return true;
      return (n.title || '').toLowerCase().includes(q) ||
             (n.reference || '').toLowerCase().includes(q) ||
             (n.content || '').toLowerCase().includes(q) ||
             (n.tags || '').toLowerCase().includes(q);
    });

    this.listContainer.innerHTML = '';

    if (filtered.length === 0) {
      this.listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">Aucune note trouvée.</div>`;
      return;
    }

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-list-item ${this.currentNote?.id === note.id ? 'active' : ''}`;
      item.innerHTML = `
        <div class="note-item-title">${note.title || 'Note sans titre'}</div>
        <div class="note-item-meta">
          ${note.reference ? `<span class="note-ref-badge">${note.reference}</span>` : ''}
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
    this.titleInput.value = note.title || '';
    this.refInput.value = note.reference || '';
    this.tagsInput.value = note.tags || '';
    this.contentInput.value = note.content || '';
    this.renderList();
  },

  createNewNote() {
    const newNote = {
      id: null,
      title: 'Nouvelle Note',
      reference: `${BibleReader.currentBook} ${BibleReader.currentChapter}`,
      tags: '',
      content: '',
      updated_at: 'À l\'instant'
    };
    this.currentNote = newNote;
    this.selectNote(newNote);
    this.titleInput.focus();
  },

  async saveCurrentNote() {
    if (!this.currentNote) return;

    const noteToSave = {
      id: this.currentNote.id,
      title: this.titleInput.value.trim() || 'Note sans titre',
      reference: this.refInput.value.trim(),
      tags: this.tagsInput.value.trim(),
      content: this.contentInput.value
    };

    try {
      await API.call('save_note', noteToSave);
      App.showToast('Note enregistrée !');
      await this.loadNotes();
    } catch (e) {
      alert(`Erreur sauvegarde note : ${e}`);
    }
  },

  async deleteCurrentNote() {
    if (!this.currentNote || !this.currentNote.id) {
      this.createNewNote();
      return;
    }

    if (confirm(`Supprimer définitivement la note « ${this.currentNote.title} » ?`)) {
      try {
        await API.call('delete_note', this.currentNote.id);
        App.showToast('Note supprimée');
        await this.loadNotes();
      } catch (e) {
        alert(`Erreur suppression note : ${e}`);
      }
    }
  }
};
