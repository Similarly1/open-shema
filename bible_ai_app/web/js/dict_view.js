/**
 * Dictionary View Controller
 * Gère la consultation des dictionnaires bibliques et du lexique Strong.
 */

const DictView = {
  searchInput: null,
  contentContainer: null,

  init() {
    this.searchInput = document.getElementById('dict-search-input');
    this.contentContainer = document.getElementById('dict-view-content');

    document.getElementById('btn-dict-search').addEventListener('click', () => {
      this.executeLookup();
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeLookup();
      }
    });
  },

  async executeLookup(term = null) {
    const word = term || this.searchInput.value.trim();
    if (!word) return;

    this.contentContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Recherche dans les dictionnaires...</div>`;

    try {
      const data = await API.call('lookup_dictionary', word);
      if (!data) {
        this.contentContainer.innerHTML = `
          <div class="empty-state" style="text-align: center; padding: 60px; color: var(--text-muted);">
            <span style="font-size: 40px; display: block; margin-bottom: 10px;">📖</span>
            <p>Aucune entrée trouvée pour « ${word} » dans vos dictionnaires actifs.</p>
          </div>
        `;
        return;
      }

      this.contentContainer.innerHTML = `
        <div class="dict-entry-card">
          <div class="dict-entry-header">
            <span class="dict-entry-title">${data.title}</span>
            <span class="dict-entry-badge">${data.badge}</span>
          </div>
          <div class="dict-entry-body">${data.full_text.replace(/\n\n/g, '<br><br>')}</div>
        </div>
      `;
    } catch (e) {
      console.error('Erreur dictionnaire:', e);
      this.contentContainer.innerHTML = `<div style="color: var(--accent-red); padding: 20px;">Erreur de consultation.</div>`;
    }
  }
};
