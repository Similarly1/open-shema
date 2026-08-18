/**
 * Dictionary View Controller
 * Gère la consultation interactive multi-dictionnaires, Wikipédia et le polissage IA.
 */

const DictView = {
  searchInput: null,
  contentContainer: null,
  currentTerm: '',
  currentMatches: [],
  activeSourceIndex: 0,

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

    this.currentTerm = word;
    this.activeSourceIndex = 0;
    this.contentContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Recherche dans les dictionnaires pour « ${word} »...</div>`;

    try {
      const data = await API.call('lookup_dictionary', word);
      this.currentMatches = data?.matches || [];
      this.render();
    } catch (e) {
      console.error('Erreur dictionnaire:', e);
      this.contentContainer.innerHTML = `<div style="color: var(--accent-red); padding: 20px;">Erreur de consultation.</div>`;
    }
  },

  render() {
    this.contentContainer.innerHTML = '';

    if (this.currentMatches.length === 0 && this.activeSourceIndex === 0) {
      // Proposer quand même Wikipédia
    }

    const card = document.createElement('div');
    card.className = 'dict-entry-card';

    // Toolbar de sélection de dictionnaire (Strong, Calmet, Vigouroux, Bailly, Wikipédia)
    const toolbar = document.createElement('div');
    toolbar.className = 'lexicon-header-toolbar';
    toolbar.style.borderRadius = '8px 8px 0 0';

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'lexicon-source-tabs';

    this.currentMatches.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.className = `lex-source-pill ${this.activeSourceIndex === idx ? 'active' : ''}`;
      btn.innerHTML = `${m.badge || m.dict_name}`;
      btn.addEventListener('click', () => {
        this.activeSourceIndex = idx;
        this.render();
      });
      tabsContainer.appendChild(btn);
    });

    const wikiIdx = this.currentMatches.length;
    const wikiBtn = document.createElement('button');
    wikiBtn.className = `lex-source-pill ${this.activeSourceIndex === wikiIdx ? 'active' : ''}`;
    wikiBtn.innerHTML = `🌐 Wikipédia`;
    wikiBtn.addEventListener('click', () => {
      this.activeSourceIndex = wikiIdx;
      this.render();
    });
    tabsContainer.appendChild(wikiBtn);

    toolbar.appendChild(tabsContainer);
    card.appendChild(toolbar);

    const bodyContainer = document.createElement('div');
    card.appendChild(bodyContainer);
    this.contentContainer.appendChild(card);

    if (this.activeSourceIndex === wikiIdx) {
      this.renderWikipedia(bodyContainer);
    } else if (this.currentMatches[this.activeSourceIndex]) {
      this.renderDictionaryMatch(bodyContainer, this.currentMatches[this.activeSourceIndex]);
    } else {
      bodyContainer.innerHTML = `
        <div style="padding: 40px; color: var(--text-muted); text-align: center;">
          <span style="font-size: 36px; display: block; margin-bottom: 10px;">📖</span>
          Aucune entrée trouvée pour « <strong>${this.currentTerm}</strong> » dans ce dictionnaire.
        </div>
      `;
    }
  },

  renderDictionaryMatch(container, match) {
    const isPolished = match.is_polished;
    const modelName = match.polished_model || 'Mistral 14B';

    let polishBarHtml = '';
    if (match.dict_id !== 'strong') {
      polishBarHtml = `
        <div class="ai-polish-bar">
          <div>
            ${isPolished 
              ? `<span class="ai-polished-badge">✨ Notice restaurée par IA (${modelName})</span>` 
              : `<span style="font-size: 11px; color: #4338CA; font-weight: 600;">Restructurer et restaurer avec l'IA</span>`
            }
          </div>
          <button class="ai-polish-btn" id="btn-dict-polish">
            <span>✨</span>
            <span>${isPolished ? 'Re-générer' : "Améliorer avec l'IA (Mistral 14B)"}</span>
          </button>
        </div>
      `;
    }

    const textToRender = (match.full_text || match.preview || '')
      .replace(/### (.*)/g, '<h3 style="margin: 14px 0 8px 0; color: var(--accent-blue); font-size: 17px;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<br><br>');

    container.innerHTML = `
      <div style="padding: 20px;">
        <div class="dict-entry-header" style="margin-bottom: 14px;">
          <span class="dict-entry-title">${match.title || this.currentTerm}</span>
          <span class="dict-entry-badge">${match.badge || match.dict_name}</span>
        </div>
        ${polishBarHtml}
        <div class="dict-entry-body" id="dict-match-body">${textToRender}</div>
      </div>
    `;

    const btnPolish = container.querySelector('#btn-dict-polish');
    if (btnPolish) {
      btnPolish.addEventListener('click', async () => {
        btnPolish.disabled = true;
        btnPolish.innerHTML = `<span>⏳</span><span>Restauration IA en cours...</span>`;
        const bodyEl = container.querySelector('#dict-match-body');
        bodyEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-blue);"><em>Restauration philologique et restructuration de la notice par Mistral 14B...</em></div>`;

        try {
          const res = await API.call('polish_dictionary_article', match.dict_id, match.title, match.raw_text || match.full_text, null, match.slug);
          if (res && res.success) {
            match.is_polished = true;
            match.full_text = res.text;
            match.polished_model = res.model;
            App.showToast('✨ Notice restaurée par IA avec succès !');
            this.render();
          } else {
            alert(`Erreur IA : ${res?.error || 'Erreur inconnue'}`);
            this.render();
          }
        } catch (e) {
          alert(`Erreur d'appel IA : ${e}`);
          this.render();
        }
      });
    }
  },

  async renderWikipedia(container, exactTitle = null) {
    container.innerHTML = `<div style="padding: 30px; color: var(--text-muted); text-align: center;">Chargement de l'article Wikipédia pour « ${this.currentTerm} »...</div>`;

    try {
      const data = await API.call('get_wikipedia_summary', this.currentTerm, exactTitle);
      if (!data || !data.found) {
        container.innerHTML = `
          <div style="padding: 40px; color: var(--text-muted); text-align: center;">
            <span style="font-size: 40px; display: block; margin-bottom: 10px;">🌐</span>
            Aucun article Wikipédia trouvé pour « <strong>${this.currentTerm}</strong> ».
          </div>
        `;
        return;
      }

      let candidatesHtml = '';
      if (data.candidates && data.candidates.length > 0) {
        candidatesHtml = `
          <div class="wiki-candidates-box">
            <div class="wiki-candidates-title">Articles connexes & Homonymes :</div>
            ${data.candidates.map(c => `<button class="wiki-cand-pill" data-title="${c.title}">${c.title}</button>`).join('')}
          </div>
        `;
      }

      container.innerHTML = `
        <div class="wiki-container">
          <div class="wiki-header-box">
            <div>
              <div class="wiki-title">${data.title}</div>
              ${data.description ? `<div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">${data.description}</div>` : ''}
            </div>
            <a href="${data.url}" target="_blank" class="wiki-link-btn" title="Ouvrir sur le web">Ouvrir l'article complet ↗</a>
          </div>

          ${data.thumbnail ? `<img src="${data.thumbnail}" class="wiki-thumbnail" alt="${data.title}">` : ''}

          <div class="wiki-extract">${(data.extract || '').replace(/\n\n/g, '<br><br>')}</div>

          ${candidatesHtml}
        </div>
      `;

      container.querySelectorAll('.wiki-cand-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          this.renderWikipedia(container, pill.dataset.title);
        });
      });

    } catch (e) {
      console.error('Erreur Wikipédia:', e);
      container.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur de connexion à Wikipédia.</div>`;
    }
  }
};
