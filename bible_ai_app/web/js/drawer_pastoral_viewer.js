/**
 * Drawer Pastoral Viewer Controller — Open Shema
 * Gère l'onglet « Pastorale » dans le volet droit du lecteur biblique.
 * 
 * 100% SVG purs (zéro émoji) & 100% adapté aux thèmes sombre et clair.
 * - Synchronisation dynamique avec le livre/chapitre/verset actif.
 * - Liste des questions pastorales avec puces, badges et thèses.
 * - Vue lecteur immersif intégré dans le tiroir.
 * - Moteur de recherche plein-texte FTS5 direct.
 */

const DrawerPastoralViewer = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentVerse: 1,
  currentEpisodes: [],
  activeEpisode: null,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Bouton de retour vers la liste depuis le lecteur
    document.getElementById('btn-drawer-pastoral-back')?.addEventListener('click', () => {
      this.showListView();
    });

    // Recherche
    const searchInput = document.getElementById('drawer-pastoral-search-input');
    const searchBtn = document.getElementById('btn-drawer-pastoral-search');

    const doSearch = () => {
      const q = searchInput?.value?.trim();
      if (q) {
        this.search(q);
      } else {
        this.load(this.currentBook, this.currentChapter, this.currentVerse);
      }
    };

    searchBtn?.addEventListener('click', doSearch);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
  },

  showListView() {
    const listView = document.getElementById('drawer-pastoral-list-view');
    const readerView = document.getElementById('drawer-pastoral-reader-view');
    if (listView && readerView) {
      listView.classList.remove('hidden');
      readerView.classList.add('hidden');
    }
  },

  showReaderView() {
    const listView = document.getElementById('drawer-pastoral-list-view');
    const readerView = document.getElementById('drawer-pastoral-reader-view');
    if (listView && readerView) {
      listView.classList.add('hidden');
      readerView.classList.remove('hidden');
    }
  },

  updateBadge(bookCode, chapter, verse = 1) {
    this.currentBook = bookCode || this.currentBook;
    this.currentChapter = parseInt(chapter, 10) || this.currentChapter;
    this.currentVerse = parseInt(verse, 10) || 1;

    const bName = typeof getFrenchBookName === 'function' ? getFrenchBookName(this.currentBook) : this.currentBook;
    const badgeEl = document.getElementById('lbl-drawer-pastoral-passage');
    if (badgeEl) {
      badgeEl.textContent = `${bName} ${this.currentChapter}:${this.currentVerse}`;
    }
  },

  async load(bookCode, chapter, verse = 1) {
    this.init();
    this.showListView();
    this.updateBadge(bookCode, chapter, verse);

    const listEl = document.getElementById('drawer-pastoral-list');
    const countEl = document.getElementById('lbl-drawer-pastoral-count');
    if (!listEl) return;

    listEl.innerHTML = `
      <div style="padding: 30px 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
        <div class="spinner-sm" style="margin: 0 auto 10px auto;"></div>
        <span>Recherche des questions pastorales...</span>
      </div>
    `;

    try {
      const episodes = await API.getAPJEpisodesForPassage(this.currentBook, this.currentChapter, this.currentVerse);
      this.currentEpisodes = episodes || [];

      if (countEl) {
        countEl.textContent = this.currentEpisodes.length;
      }

      this.renderList(this.currentEpisodes);
    } catch (err) {
      console.error('[DrawerPastoralViewer] Erreur chargement:', err);
      listEl.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">
          Erreur de connexion lors de la récupération des questions pastorales.
        </div>
      `;
    }
  },

  async search(query) {
    this.init();
    this.showListView();

    const listEl = document.getElementById('drawer-pastoral-list');
    const countEl = document.getElementById('lbl-drawer-pastoral-count');
    if (!listEl || !query) return;

    listEl.innerHTML = `
      <div style="padding: 30px 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
        <div class="spinner-sm" style="margin: 0 auto 10px auto;"></div>
        <span>Recherche de « ${this.escapeHtml(query)} » dans les 1 000 épisodes...</span>
      </div>
    `;

    try {
      const results = await API.searchAPJEpisodes(query, 25);
      this.currentEpisodes = results || [];

      if (countEl) {
        countEl.textContent = this.currentEpisodes.length;
      }

      this.renderList(this.currentEpisodes, query);
    } catch (err) {
      console.error('[DrawerPastoralViewer] Erreur recherche:', err);
      listEl.innerHTML = `<div style="padding: 20px; color: #ef4444; font-size: 12px;">Erreur lors de la recherche.</div>`;
    }
  },

  renderList(episodes, searchFilter = '') {
    const listEl = document.getElementById('drawer-pastoral-list');
    if (!listEl) return;

    if (!episodes || episodes.length === 0) {
      const bName = typeof getFrenchBookName === 'function' ? getFrenchBookName(this.currentBook) : this.currentBook;
      listEl.innerHTML = `
        <div style="padding: 28px 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" style="margin: 0 auto 10px auto; opacity: 0.5; display: block;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <path d="M8 10h.01"></path>
            <path d="M12 10h.01"></path>
            <path d="M16 10h.01"></path>
          </svg>
          <p style="margin: 0 0 8px 0; color: var(--text-primary); font-weight: 600;">
            ${searchFilter ? `Aucun épisode trouvé pour « ${this.escapeHtml(searchFilter)} »` : `Aucune question pastorale directe sur ${bName} ${this.currentChapter}:${this.currentVerse}`}
          </p>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin: 0 0 14px 0;">
            Vous pouvez rechercher parmi les 1 000 épisodes pastoraux de John Piper via la barre de recherche ci-dessus.
          </p>
        </div>
      `;
      return;
    }

    let html = '';
    episodes.forEach((ep, idx) => {
      const epNum = ep.episode_number;
      const epBadge = (epNum != null && epNum !== '') ? `Ép. #${epNum}` : 'Hors-série';
      const titleFr = ep.titre_fr || ep.original_title || 'Question pastorale';
      const typeQ = ep.type_question ? ep.type_question.toUpperCase() : 'PASTORAL';
      const hasIllustr = ep.illustration?.has_illustration || !!ep.illustration?.titre;
      const appCount = (ep.pistes_applications || []).length;
      const primPassages = ep.passages_primaires || (ep.verse_ref ? [ep.verse_ref] : []);
      const secPassages = ep.passages_secondaires || [];

      html += `
        <div class="drawer-pastoral-item" data-item-idx="${idx}">
          <div class="drawer-pastoral-item-top">
            <span class="clean-source-tag is-pastoral" style="display: inline-flex; align-items: center; gap: 4px;">${this.apjLogoSvg(12)} <span>${epBadge}</span></span>
            <span class="clean-pastoral-type">${this.escapeHtml(typeQ)}</span>
            ${hasIllustr ? `<span class="clean-pastoral-feat has-analogy" title="Contient une analogie">Analogie</span>` : ''}
            ${appCount > 0 ? `<span class="clean-pastoral-feat has-apps" title="${appCount} applications">${appCount} app.</span>` : ''}
          </div>
          <div class="drawer-pastoral-item-title">${this.escapeHtml(titleFr)}</div>
          ${(primPassages.length > 0 || secPassages.length > 0) ? `
            <div class="drawer-pastoral-item-refs">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              ${primPassages.map(p => `<span class="drawer-pastoral-ref-pill primary">${this.escapeHtml(p)}</span>`).join('')}
              ${secPassages.slice(0, 2).map(p => `<span class="drawer-pastoral-ref-pill secondary">${this.escapeHtml(p)}</span>`).join('')}
              ${secPassages.length > 2 ? `<span class="drawer-pastoral-ref-pill more">+${secPassages.length - 2}</span>` : ''}
            </div>
          ` : ''}
          ${ep.these_centrale ? `<div class="drawer-pastoral-item-thesis">${this.escapeHtml(ep.these_centrale)}</div>` : ''}
        </div>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.drawer-pastoral-item').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.itemIdx, 10);
        const ep = episodes[idx];
        if (ep) {
          this.openEpisode(ep);
        }
      });
    });
  },

  openEpisode(ep) {
    this.activeEpisode = ep;
    this.showReaderView();

    const contentEl = document.getElementById('drawer-pastoral-reader-content');
    const extBtn = document.getElementById('btn-drawer-pastoral-ext');
    if (!contentEl) return;

    if (extBtn) {
      if (ep.source_url) {
        extBtn.style.display = 'inline-flex';
        extBtn.onclick = (e) => {
          e.preventDefault();
          if (typeof API !== 'undefined' && API.openExternalUrl) {
            API.openExternalUrl(ep.source_url);
          } else {
            window.open(ep.source_url, '_blank');
          }
        };
      } else {
        extBtn.style.display = 'none';
      }
    }

    const titleFr = ep.titre_fr || ep.original_title;
    const origTitle = ep.original_title || '';
    const epNum = ep.episode_number;
    const epBadge = (epNum != null && epNum !== '') ? `Ép. #${epNum}` : 'Hors-série';
    const typeQ = ep.type_question || 'Pastorale';
    const datePub = ep.date_published || '';
    const these = ep.these_centrale || '';
    const resume = ep.resume_analytique || '';
    const illustr = ep.illustration || {};
    const apps = ep.pistes_applications || [];
    const themes = ep.themes || [];
    const verseRef = ep.verse_ref || '';
    const primPassages = ep.passages_primaires || (verseRef ? [verseRef] : []);
    const secPassages = ep.passages_secondaires || [];

    const appsHtml = apps.length > 0 ? `
      <div class="apj-modal-section" style="margin-top: 14px;">
        <div class="apj-sec-title">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Pistes d'application concrètes</span>
        </div>
        <ul class="apj-apps-list">
          ${apps.map(a => `
            <li>
              <span class="apj-bullet">•</span>
              <span>${this.escapeHtml(a)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

    const illustrHtml = (illustr.titre || illustr.resume) ? `
      <div class="apj-modal-section apj-illustr-box" style="margin-top: 14px;">
        <div class="apj-sec-title apj-sec-illustr">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Illustration &amp; Analogie : ${this.escapeHtml(illustr.titre || 'Analogie')}</span>
        </div>
        <div class="apj-sec-content">${this.escapeHtml(illustr.resume || '')}</div>
      </div>
    ` : '';

    const themesHtml = themes.length > 0 ? `
      <div class="apj-themes-bar" style="margin-top: 14px;">
        ${themes.map(t => `<span class="apj-theme-pill">${this.escapeHtml(t)}</span>`).join('')}
      </div>
    ` : '';

    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
            <span class="clean-source-tag is-pastoral" style="display: inline-flex; align-items: center; gap: 5px;">${this.apjLogoSvg(13)} <span>${epBadge}</span></span>
            <span class="clean-pastoral-type">${this.escapeHtml(typeQ)}</span>
            ${datePub ? `<span style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(this.formatFrenchDate(datePub))}</span>` : ''}
          </div>
          <h3 style="font-size: 16px; font-weight: 700; line-height: 1.35; color: var(--text-primary); margin: 0 0 4px 0;">
            ${this.escapeHtml(titleFr)}
          </h3>
          ${origTitle && origTitle !== titleFr ? `<div style="font-size: 11.5px; font-style: italic; color: var(--text-muted);">Titre original : « ${this.escapeHtml(origTitle)} »</div>` : ''}
        </div>

        ${(primPassages.length > 0 || secPassages.length > 0) ? `
          <div class="drawer-pastoral-scriptures-box">
            <div class="drawer-pastoral-scriptures-header">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <span>Textes bibliques de référence</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${primPassages.length > 0 ? `
                <div class="drawer-pastoral-ref-group">
                  <span class="drawer-pastoral-ref-label">Texte(s) clé(s) :</span>
                  <div class="drawer-pastoral-ref-list">
                    ${primPassages.map(p => `
                      <button type="button" class="drawer-pastoral-ref-btn is-primary" data-ref="${this.escapeHtml(p)}" title="Ouvrir ${this.escapeHtml(p)} dans le lecteur biblique">
                        <span>${this.escapeHtml(p)}</span>
                        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              ${secPassages.length > 0 ? `
                <div class="drawer-pastoral-ref-group">
                  <span class="drawer-pastoral-ref-label">Passages d'appui :</span>
                  <div class="drawer-pastoral-ref-list">
                    ${secPassages.map(p => `
                      <button type="button" class="drawer-pastoral-ref-btn is-secondary" data-ref="${this.escapeHtml(p)}" title="Ouvrir ${this.escapeHtml(p)} dans le lecteur biblique">
                        <span>${this.escapeHtml(p)}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${these ? `
          <div class="apj-thesis-card">
            <div class="apj-thesis-label">Thèse centrale &amp; Réponse pastorale</div>
            <div class="apj-thesis-text">${this.escapeHtml(these)}</div>
          </div>
        ` : ''}

        ${resume ? `
          <div class="apj-modal-section" style="margin-top: 4px;">
            <div class="apj-sec-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>Développement pastoral &amp; théologique</span>
            </div>
            <div class="apj-sec-content">
              ${this.escapeHtml(resume).replace(/\n/g, '<br>')}
            </div>
          </div>
        ` : ''}

        ${illustrHtml}
        ${appsHtml}
        ${themesHtml}

        <div style="margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: var(--text-muted);">John Piper • Desiring God</span>
          <button type="button" class="btn-secondary" id="btn-drawer-pastoral-open-study" style="font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Étudier dans Guide 360°</span>
          </button>
        </div>
      </div>
    `;

    // Écouteurs pour ouvrir les passages bibliques au clic
    contentEl.querySelectorAll('.drawer-pastoral-ref-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = btn.dataset.ref;
        if (!ref) return;
        if (typeof BibleReader !== 'undefined' && BibleReader.parseAndNavigate) {
          BibleReader.parseAndNavigate(ref);
        }
      });
    });

    contentEl.querySelector('#btn-drawer-pastoral-open-study')?.addEventListener('click', () => {
      const bestRef = (primPassages && primPassages[0]) || verseRef || `${this.currentBook} ${this.currentChapter}:${this.currentVerse}`;
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('passage-study');
        setTimeout(() => {
          if (typeof PassageStudyView !== 'undefined') {
            if (PassageStudyView.loadPassage) {
              PassageStudyView.loadPassage(bestRef);
            }
            if (PassageStudyView.switchTab) {
              PassageStudyView.switchTab('pastoral');
            }
          }
        }, 120);
      }
    });
  },

  formatFrenchDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const cleanStr = dateStr.trim();
    try {
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}

    const months = {
      jan: 'janvier', feb: 'février', mar: 'mars', apr: 'avril', may: 'mai', jun: 'juin',
      jul: 'juillet', aug: 'août', sep: 'septembre', oct: 'octobre', nov: 'novembre', dec: 'décembre'
    };
    const m = cleanStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (m) return `${parseInt(m[1], 10)} ${months[m[2].toLowerCase()] || m[2]} ${m[3]}`;
    const m2 = cleanStr.match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
    if (m2) return `${parseInt(m2[2], 10)} ${months[m2[1].toLowerCase()] || m2[1]} ${m2[3]}`;
    return cleanStr;
  },

  apjLogoSvg(size = 13) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="border-radius: ${Math.round(size * 0.18)}px; vertical-align: middle; flex-shrink: 0; display: inline-block;" xml:space="preserve"><rect width="24" height="24" rx="3.5" fill="#C6000E"/><polygon fill="#000000" points="4.6,4.6 19.4,4.6 19.4,19.4 16.6,19.4 16.6,22.3 12,19.4 4.6,19.4"/><path fill="#FFFFFF" d="M10.3,9.5l-2-2.1L7.5,8.3l2,2H7.4v1h3.9V7.4h-1V9.5L10.3,9.5L10.3,9.5z M13.7,9.5l2-2.1l0.9,0.9l-2.1,2h2.1v1 h-3.9V7.4h1V9.5L13.7,9.5L13.7,9.5z M10.3,14.5l-2,2l-0.9-0.9l2-2H7.4v-1h3.9v3.9h-1V14.5L10.3,14.5L10.3,14.5z M13.7,14.5l2,2 l0.9-0.9l-2.1-2h2.1v-1h-3.9v3.9h1V14.5L13.7,14.5L13.7,14.5z"/></svg>`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.DrawerPastoralViewer = DrawerPastoralViewer;
