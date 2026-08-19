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
    wikiBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Wikipédia</span>`;
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
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 10px auto; opacity: 0.5;"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
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
              ? `<span class="ai-polished-badge" style="display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>Notice restaurée par IA (${modelName})</span>` 
              : `<span style="font-size: 11px; color: #4338CA; font-weight: 600;">Restructurer et restaurer avec l'IA</span>`
            }
          </div>
          <button class="ai-polish-btn" id="btn-dict-polish" style="display: flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
            <span>${isPolished ? 'Re-générer' : "Améliorer avec l'IA (Mistral 14B)"}</span>
          </button>
        </div>
      `;
    }

    const textToRender = (match.full_text || match.preview || '')
      .replace(/^### (.*$)/gim, '<h3 style="margin: 14px 0 8px 0; color: var(--accent-blue); font-size: 17px; font-weight: 700;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="margin: 16px 0 10px 0; color: var(--accent-blue); font-size: 19px; font-weight: 700;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="margin: 18px 0 12px 0; color: var(--accent-blue); font-size: 22px; font-weight: 800;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); padding: 8px 14px; margin: 12px 0; background: var(--bg-subtle); color: var(--text-secondary); border-radius: 0 6px 6px 0; font-style: italic;">$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>')
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
        btnPolish.innerHTML = `<span class="synth-spinner" style="width:12px; height:12px; border-width:2px; vertical-align:middle; margin-right:4px;"></span><span>Restauration IA en cours...</span>`;
        const bodyEl = container.querySelector('#dict-match-body');
        bodyEl.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-blue);"><em>Restauration philologique et restructuration de la notice par Mistral 14B...</em></div>`;

        try {
          const res = await API.call('polish_dictionary_article', match.dict_id, match.title, match.raw_text || match.full_text, null, match.slug);
          if (res && res.success) {
            match.is_polished = true;
            match.full_text = res.text;
            match.polished_model = res.model;
            App.showToast('Notice restaurée par IA avec succès !');
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
    container.innerHTML = `<div style="padding: 30px; color: var(--text-muted); text-align: center;">Chargement de l'article Wikipédia pour « ${exactTitle || this.currentTerm} »...</div>`;

    try {
      const data = await API.call('get_wikipedia_summary', this.currentTerm, exactTitle);
      if (!data || (!data.found && (!data.candidates || data.candidates.length === 0))) {
        container.innerHTML = `
          <div style="padding: 40px; color: var(--text-muted); text-align: center;">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" style="display: block; margin: 0 auto 10px auto; opacity: 0.5;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Aucun article Wikipédia pertinent trouvé pour « <strong>${this.currentTerm}</strong> ».
            <div style="margin-top: 14px; display: flex; gap: 6px; justify-content: center;">
              <input type="text" id="dict-wiki-fallback-input" class="wiki-search-input" style="max-width: 220px;" placeholder="Autre recherche..." value="${this.currentTerm}">
              <button id="dict-wiki-fallback-submit" class="wiki-search-submit-btn">Chercher</button>
            </div>
          </div>
        `;
        const fbIn = container.querySelector('#dict-wiki-fallback-input');
        const fbBtn = container.querySelector('#dict-wiki-fallback-submit');
        const doSearch = () => {
          const val = fbIn?.value?.trim();
          if (val) {
            this.currentTerm = val;
            this.renderWikipedia(container);
          }
        };
        fbBtn?.addEventListener('click', doSearch);
        fbIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
        return;
      }

      // Candidates Navigation (Nuage de mots)
      const candidates = data.candidates || [];
      const currentTitle = data.title || exactTitle || this.currentTerm;

      let navHtml = `
        <div class="wiki-top-nav">
          <div class="wiki-search-row">
            <input type="text" class="wiki-search-input" id="dict-wiki-query-input" placeholder="Rechercher un autre sujet..." value="${data.search_query || this.currentTerm}">
            <button class="wiki-search-submit-btn" id="dict-wiki-query-submit">Chercher</button>
          </div>
          ${candidates.length > 1 ? `
            <div class="wiki-cloud-box">
              <div class="wiki-cloud-label">Articles connexes :</div>
              <div class="wiki-pills-bar">
                ${candidates.map(c => `
                  <button class="wiki-pill tier-${c.tier || 'md'} ${c.title.toLowerCase() === currentTitle.toLowerCase() ? 'active' : ''}" data-title="${c.title}" title="${c.snippet || c.title}">
                    ${c.title}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      container.innerHTML = `
        <div class="wiki-container">
          ${navHtml}

          <div class="wiki-header-box">
            <div>
              <div class="wiki-title">${data.title}</div>
              ${data.description ? `<div style="font-size: 12px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">${data.description}</div>` : ''}
            </div>
            <a href="${data.url}" target="_blank" class="wiki-link-btn" title="Ouvrir sur le web">Ouvrir l'article complet ↗</a>
          </div>

          ${data.thumbnail ? `<img src="${data.thumbnail}" class="wiki-thumbnail" alt="${data.title}">` : ''}

          <div class="wiki-extract">${(data.extract || '').replace(/\n\n/g, '<br><br>')}</div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="wiki-more-btn" id="btn-dict-wiki-more" data-expanded="false" style="display: flex; align-items: center; gap: 5px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span id="dict-wiki-more-label">Voir plus ▾</span>
            </button>
          </div>

          <div class="wiki-extended-box hidden" id="dict-wiki-extended-container"></div>
        </div>
      `;

      // Event handlers
      const qInput = container.querySelector('#dict-wiki-query-input');
      const qSubmit = container.querySelector('#dict-wiki-query-submit');
      const doNavSearch = () => {
        const val = qInput?.value?.trim();
        if (val) {
          this.currentTerm = val;
          this.renderWikipedia(container);
        }
      };
      qSubmit?.addEventListener('click', doNavSearch);
      qInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doNavSearch(); });

      container.querySelectorAll('.wiki-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          this.renderWikipedia(container, pill.dataset.title);
        });
      });

      const btnMore = container.querySelector('#btn-dict-wiki-more');
      const extContainer = container.querySelector('#dict-wiki-extended-container');
      const moreLabel = container.querySelector('#dict-wiki-more-label');

      if (btnMore && extContainer) {
        btnMore.addEventListener('click', async () => {
          const isExp = btnMore.dataset.expanded === 'true';
          if (isExp) {
            extContainer.classList.add('hidden');
            btnMore.dataset.expanded = 'false';
            moreLabel.textContent = 'Voir plus ▾';
          } else {
            if (!extContainer.innerHTML.trim()) {
              moreLabel.textContent = 'Chargement de la suite...';
              btnMore.disabled = true;
              try {
                const extData = await API.call('get_wikipedia_extended', data.title);
                if (extData && extData.found && extData.html) {
                  extContainer.innerHTML = extData.html;
                  extContainer.classList.remove('hidden');
                  btnMore.dataset.expanded = 'true';
                  moreLabel.textContent = 'Voir moins ▴';
                } else {
                  extContainer.innerHTML = `<div style="color: var(--text-muted); font-style: italic;">Pas de sections supplémentaires disponibles.</div>`;
                  extContainer.classList.remove('hidden');
                  btnMore.dataset.expanded = 'true';
                  moreLabel.textContent = 'Voir moins ▴';
                }
              } catch (e) {
                alert(`Erreur : ${e}`);
                moreLabel.textContent = 'Voir plus ▾';
              } finally {
                btnMore.disabled = false;
              }
            } else {
              extContainer.classList.remove('hidden');
              btnMore.dataset.expanded = 'true';
              moreLabel.textContent = 'Voir moins ▴';
            }
          }
        });
      }

    } catch (e) {
      console.error('Erreur Wikipédia:', e);
      container.innerHTML = `<div style="padding: 20px; color: var(--accent-red);">Erreur de connexion à Wikipédia.</div>`;
    }
  }
};
