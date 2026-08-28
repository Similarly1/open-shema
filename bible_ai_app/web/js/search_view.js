/**
 * Search View Controller
 * Gère la recherche plein-texte, les filtres de corpus et le saut direct vers le lecteur.
 */

const SearchView = {
  searchInput: null,
  corpusFilter: null,
  sourceFilter: null,
  resultsContainer: null,
  subtitleEl: null,

  init() {
    this.searchInput = document.getElementById('search-main-input');
    this.corpusFilter = document.getElementById('search-corpus-filter');
    this.sourceFilter = document.getElementById('search-source-filter');
    this.resultsContainer = document.getElementById('search-results-list');
    this.subtitleEl = document.getElementById('search-count-subtitle');

    let debounceTimer = null;
    this.searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.executeSearch(), 250);
    });

    this.corpusFilter.addEventListener('change', () => this.executeSearch());
    this.sourceFilter.addEventListener('change', () => this.executeSearch());

    document.getElementById('btn-search-open-ebooks')?.addEventListener('click', () => {
      const q = this.searchInput.value.trim();
      if (typeof OpenShemaStore !== 'undefined') {
        OpenShemaStore.open('ebooks', q);
      }
    });
  },

  async executeSearch() {
    const query = this.searchInput.value.trim();
    if (!query) {
      this.resultsContainer.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 60px; color: var(--text-muted);">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 10px auto; opacity: 0.5;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <p>Tapez un mot ou une phrase dans la barre ci-dessus pour lancer la recherche.</p>
        </div>
      `;
      this.subtitleEl.textContent = 'Recherchez instantanément dans vos Bibles et commentaires.';
      return;
    }

    const corpus = this.corpusFilter.value;
    const source = this.sourceFilter.value;

    this.subtitleEl.textContent = 'Recherche en cours...';

    try {
      const data = await API.call('search_all', query, corpus, 'ALL_WORDS', source);
      const results = data.results || [];
      this.subtitleEl.textContent = `${results.length} résultat(s) trouvé(s) pour « ${query} »`;

      this.resultsContainer.innerHTML = '';

      if (results.length === 0) {
        this.resultsContainer.innerHTML = `
          <div class="empty-state" style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 10px auto; opacity: 0.5;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <p style="font-size: 1rem; margin-bottom: 8px;">Aucun résultat trouvé dans vos Bibles locales pour « <strong>${query}</strong> ».</p>
            <p style="font-size: 0.85rem; margin-bottom: 20px; opacity: 0.8;">Vous cherchez une traduction ou un ouvrage spécifique ?</p>
            <button class="btn btn-primary" id="btn-search-fallback-ebook" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <span>Chercher en E-book dans les librairies chrétiennes</span>
            </button>
          </div>
        `;
        document.getElementById('btn-search-fallback-ebook')?.addEventListener('click', () => {
          if (typeof OpenShemaStore !== 'undefined') {
            OpenShemaStore.open('ebooks', query);
          }
        });
        return;
      }

      results.forEach(res => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        
        const isBible = res.type === 'Bible';
        const badgeColor = isBible ? 'var(--accent-blue)' : 'var(--accent-orange)';
        const refStr = isBible ? `${res.book_name} ${res.chapter}:${res.verse}` : `${res.book_name} (${res.commentary_name || res.source || 'Commentaire'})`;

        // Mise en évidence du texte recherché
        let highlighted = res.text || '';
        const regex = new RegExp(`(${query})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');

        card.innerHTML = `
          <div class="search-res-header">
            <span class="search-res-ref" style="color: ${badgeColor}; display: inline-flex; align-items: center; gap: 4px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span>${refStr}</span></span>
            <span class="search-res-version">${res.bible_name || res.commentary_name || ''}</span>
          </div>
          <div class="search-res-text">${highlighted}</div>
        `;

        card.addEventListener('click', () => {
          if (isBible && res.book_code && res.chapter) {
            App.switchView('bible');
            BibleReader.navigateTo(res.book_code, parseInt(res.chapter));
          }
        });

        this.resultsContainer.appendChild(card);
      });

    } catch (e) {
      console.error('Erreur recherche:', e);
      this.subtitleEl.textContent = 'Erreur lors de la recherche.';
    }
  }
};
