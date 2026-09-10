/**
 * Drawer Pastoral Viewer Controller — Open Shema
 * Gère l'onglet « Pastorale » dans le volet droit du lecteur biblique.
 * 
 * Multi-sources unifié :
 * - Florent Varak : « Un pasteur vous répond » (ToutPourSaGloire.com)
 * - John Piper : « Ask Pastor John » (Desiring God)
 * 
 * 100% SVG purs (zéro émoji) & 100% adapté aux thèmes sombre et clair.
 * - Synchronisation dynamique avec le livre/chapitre/verset actif.
 * - Filtres par corpus / auteur (Tous / Florent Varak / John Piper).
 * - Lecteur audio officiel (SoundCloud) intégré.
 * - Question de l'auditeur & points clés d'argumentation.
 * - Moteur de recherche plein-texte FTS5 direct.
 */

const DrawerPastoralViewer = {
  currentBook: 'Gen',
  currentChapter: 1,
  currentVerse: 1,
  currentEpisodes: [],
  activeEpisode: null,
  activeFilter: 'all', // 'all', 'upvr', 'apj'
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
      const episodes = await API.getPastoralEpisodesForPassage(this.currentBook, this.currentChapter, this.currentVerse);
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
        <span>Recherche de « ${this.escapeHtml(query)} » dans les corpus pastoraux...</span>
      </div>
    `;

    try {
      const results = await API.searchPastoralEpisodes(query, 25);
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
            Vous pouvez rechercher parmi les corpus pastoraux de Florent Varak et John Piper via la barre de recherche ci-dessus.
          </p>
        </div>
      `;
      return;
    }

    const upvrCount = episodes.filter(e => e.is_upvr || e.author === 'Florent Varak').length;
    const apjCount = episodes.filter(e => !e.is_upvr && e.author !== 'Florent Varak').length;

    let filteredEpisodes = episodes;
    if (this.activeFilter === 'upvr') {
      filteredEpisodes = episodes.filter(e => e.is_upvr || e.author === 'Florent Varak');
    } else if (this.activeFilter === 'apj') {
      filteredEpisodes = episodes.filter(e => !e.is_upvr && e.author !== 'Florent Varak');
    }

    let filterBarHtml = '';
    if (upvrCount > 0 && apjCount > 0) {
      filterBarHtml = `
        <div class="pastoral-filter-bar">
          <button type="button" class="pastoral-filter-pill ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">
            Tous (${episodes.length})
          </button>
          <button type="button" class="pastoral-filter-pill ${this.activeFilter === 'upvr' ? 'active' : ''}" data-filter="upvr">
            ${this.upvrLogoSvg(11)} Florent Varak (${upvrCount})
          </button>
          <button type="button" class="pastoral-filter-pill ${this.activeFilter === 'apj' ? 'active' : ''}" data-filter="apj">
            ${this.apjLogoSvg(11)} John Piper (${apjCount})
          </button>
        </div>
      `;
    }

    let itemsHtml = '';
    filteredEpisodes.forEach((ep) => {
      const realIdx = episodes.indexOf(ep);
      const isUpvr = ep.is_upvr || ep.author === 'Florent Varak';
      const epNum = ep.episode_number;
      const epBadge = (epNum != null && epNum !== '') ? `Ép. #${epNum}` : 'Hors-série';
      const titleFr = ep.titre_fr || ep.titre || ep.original_title || 'Question pastorale';
      const typeQ = ep.type_question ? ep.type_question.toUpperCase() : (isUpvr ? 'PASTORAL' : 'APJ');
      const hasIllustr = ep.illustration?.has_illustration || !!ep.illustration?.titre;
      const appCount = (ep.pistes_applications || ep.applications_pastorales || []).length;
      const primPassages = ep.passages_primaires || (ep.verse_ref ? [ep.verse_ref] : []);
      const secPassages = ep.passages_secondaires || [];
      const hasAudio = !!ep.audio_url;
      const ptsCount = (ep.points_cles || []).length;

      itemsHtml += `
        <div class="drawer-pastoral-item ${isUpvr ? 'is-upvr-card' : 'is-apj-card'}" data-item-idx="${realIdx}">
          <div class="drawer-pastoral-item-top">
            <span class="clean-source-tag ${isUpvr ? 'is-upvr' : 'is-pastoral'}" style="display: inline-flex; align-items: center; gap: 4px;">
              ${isUpvr ? this.upvrLogoSvg(12) : this.apjLogoSvg(12)}
              <span>${isUpvr ? 'UPVR' : 'APJ'} • ${epBadge}</span>
            </span>
            <span class="clean-pastoral-type">${this.escapeHtml(typeQ)}</span>
            ${hasAudio ? `<span class="clean-pastoral-feat" style="background: rgba(255, 85, 0, 0.12); color: #ff5500;">Audio</span>` : ''}
            ${ptsCount > 0 ? `<span class="clean-pastoral-feat" style="background: rgba(230, 62, 9, 0.1); color: #d9480f;">${ptsCount} pts</span>` : ''}
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

    listEl.innerHTML = filterBarHtml + itemsHtml;

    // Gestionnaires de clic filtres
    listEl.querySelectorAll('.pastoral-filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeFilter = pill.dataset.filter || 'all';
        this.renderList(episodes, searchFilter);
      });
    });

    // Gestionnaires de clic cartes
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

    const isUpvr = ep.is_upvr || ep.author === 'Florent Varak';
    const sourceBrand = isUpvr ? 'ToutPourSaGloire' : 'Desiring God';

    if (extBtn) {
      if (ep.source_url) {
        extBtn.style.display = 'inline-flex';
        extBtn.innerHTML = `
          ${isUpvr ? this.upvrLogoSvg(13) : this.apjLogoSvg(13)}
          <span>${sourceBrand} ↗</span>
        `;
        extBtn.title = `Consulter l'article officiel sur ${sourceBrand}`;
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

    const titleFr = ep.titre_fr || ep.titre || ep.original_title;
    const origTitle = ep.original_title || '';
    const epNum = ep.episode_number;
    const epBadge = (epNum != null && epNum !== '') ? `Épisode #${epNum}` : 'Hors-série';
    const typeQ = ep.type_question || 'Pastorale';
    const datePub = ep.date_published || '';
    const sourceUrl = ep.source_url || '';
    const these = ep.these_centrale || '';
    const resume = ep.resume_analytique || '';
    const illustr = ep.illustration || {};
    const apps = ep.pistes_applications || ep.applications_pastorales || [];
    const ptsCles = ep.points_cles || [];
    const themes = ep.themes || [];
    const verseRef = ep.verse_ref || '';
    const primPassages = ep.passages_primaires || (verseRef ? [verseRef] : []);
    const secPassages = ep.passages_secondaires || [];
    const audioUrl = ep.audio_url || '';
    const mp3Url = ep.mp3_url || '';
    const duration = ep.duration || '';

    const questionAuditeurHtml = ep.question_auditeur ? `
      <div class="pastoral-question-callout">
        <div class="pastoral-question-header">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Question de l'auditeur</span>
        </div>
        <div class="pastoral-question-body">« ${this.escapeHtml(ep.question_auditeur)} »</div>
      </div>
    ` : '';

    const pointsClesHtml = ptsCles.length > 0 ? `
      <div class="pastoral-points-box">
        <div class="pastoral-points-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>Points clés de l'argumentation</span>
        </div>
        <ul class="pastoral-points-list">
          ${ptsCles.map((pt, i) => `
            <li class="pastoral-points-item">
              <span class="pastoral-point-badge">${i + 1}</span>
              <span>${this.escapeHtml(pt)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

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

    let audioButtonHtml = '';
    if (mp3Url) {
      audioButtonHtml = `
        <div class="pastoral-audio-native-player">
          <div class="pastoral-audio-player-meta">
            <span class="pastoral-audio-meta-left">
              ${this.audioIconSvg(14)}
              <span>Enregistrement audio officiel</span>
            </span>
            ${duration ? `<span class="pastoral-audio-duration-badge">${this.escapeHtml(duration)}</span>` : ''}
          </div>
          <audio controls preload="none" src="${this.escapeHtml(mp3Url)}"></audio>
          <div style="display: flex; align-items: center; justify-content: flex-end; margin-top: 6px;">
            ${sourceUrl ? `
              <a href="#" class="pastoral-audio-ext-link" data-ext-url="${this.escapeHtml(sourceUrl)}">
                <span>Article &amp; podcast sur ${sourceBrand} ↗</span>
              </a>
            ` : ''}
          </div>
        </div>
      `;
    } else if (audioUrl) {
      audioButtonHtml = `
        <div style="margin-top: 6px; margin-bottom: 8px;">
          <button type="button" class="pastoral-audio-btn" id="btn-drawer-audio-toggle">
            ${this.audioIconSvg(13)}
            <span>Écouter le podcast officiel</span>
          </button>
          <div id="drawer-audio-frame-wrap" class="pastoral-audio-frame-wrap" style="display: none; margin-top: 10px;">
            <iframe width="100%" height="120" scrolling="no" frameborder="no" allow="autoplay" src="${this.escapeHtml(audioUrl)}"></iframe>
          </div>
        </div>
      `;
    }

    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
            <span class="clean-source-tag ${isUpvr ? 'is-upvr' : 'is-pastoral'}" style="display: inline-flex; align-items: center; gap: 5px;">
              ${isUpvr ? this.upvrLogoSvg(13) : this.apjLogoSvg(13)}
              <span>${isUpvr ? 'Un pasteur vous répond' : 'Ask Pastor John'} • ${epBadge}</span>
            </span>
            <span class="clean-pastoral-type">${this.escapeHtml(typeQ)}</span>
            ${datePub ? `<span style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(this.formatFrenchDate(datePub))}</span>` : ''}
          </div>
          <h3 style="font-size: 16px; font-weight: 700; line-height: 1.35; color: var(--text-primary); margin: 0 0 4px 0;">
            ${this.escapeHtml(titleFr)}
          </h3>
          ${origTitle && origTitle !== titleFr && !isUpvr ? `<div style="font-size: 11.5px; font-style: italic; color: var(--text-muted);">Titre original : « ${this.escapeHtml(origTitle)} »</div>` : ''}
        </div>

        ${audioButtonHtml}
        ${questionAuditeurHtml}

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
          <div class="${isUpvr ? 'upvr-thesis-card' : 'apj-thesis-card'}">
            <div class="${isUpvr ? 'upvr-thesis-label' : 'apj-thesis-label'}">Thèse centrale &amp; Réponse pastorale</div>
            <div class="apj-thesis-text">${this.escapeHtml(these)}</div>
          </div>
        ` : ''}

        ${pointsClesHtml}

        ${resume ? `
          <div class="apj-modal-section" style="margin-top: 4px;">
            <div class="apj-sec-title">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>Développement pastoral &amp; exégétique</span>
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
          <span style="font-size: 11px; color: var(--text-muted);">
            ${isUpvr ? 'Florent Varak • ToutPourSaGloire.com' : 'John Piper • Desiring God'}
          </span>
          <button type="button" class="btn-secondary" id="btn-drawer-pastoral-open-study" style="font-size: 11px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Étudier dans Guide 360°</span>
          </button>
        </div>
      </div>
    `;

    // Écouteur toggle lecteur audio iframe (fallback)
    contentEl.querySelector('#btn-drawer-audio-toggle')?.addEventListener('click', () => {
      const wrap = contentEl.querySelector('#drawer-audio-frame-wrap');
      if (wrap) {
        const isHidden = wrap.style.display === 'none';
        wrap.style.display = isHidden ? 'block' : 'none';
      }
    });

    // Écouteur lien externe audio
    contentEl.querySelectorAll('.pastoral-audio-ext-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const u = link.dataset.extUrl;
        if (u && typeof API !== 'undefined' && API.openExternalUrl) {
          API.openExternalUrl(u);
        } else if (u) {
          window.open(u, '_blank');
        }
      });
    });

    // Écouteurs pour ouvrir les passages bibliques au clic
    contentEl.querySelectorAll('.drawer-pastoral-ref-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ref = btn.dataset.ref;
        if (!ref) return;
        if (typeof App !== 'undefined' && App.switchView) {
          App.switchView('bible');
        }
        if (typeof BibleReader !== 'undefined') {
          if (typeof BibleReader.parseAndNavigate === 'function') {
            BibleReader.parseAndNavigate(ref);
          } else if (typeof BibleReader.searchPassage === 'function') {
            BibleReader.searchPassage(ref);
          } else if (typeof BibleReader.navigateTo === 'function') {
            BibleReader.navigateTo(ref);
          }
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

  upvrLogoSvg(size = 13) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="border-radius: ${Math.round(size * 0.18)}px; vertical-align: middle; flex-shrink: 0; display: inline-block;"><rect width="24" height="24" rx="3.5" fill="#E63E09"/><g fill="#FFFFFF"><rect x="9.5" y="4.5" width="5" height="8.5" rx="2.5"/><path d="M7.5,10 C7.5,12.5 9.5,14.5 12,14.5 C14.5,14.5 16.5,12.5 16.5,10" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/><line x1="12" y1="14.5" x2="12" y2="18" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/><line x1="9" y1="18" x2="15" y2="18" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/><path d="M5,7.5 C4.2,8.8 4.2,11.2 5,12.5" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" opacity="0.9"/><path d="M19,7.5 C19.8,8.8 19.8,11.2 19,12.5" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" opacity="0.9"/></g></svg>`;
  },

  audioIconSvg(size = 13) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
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
