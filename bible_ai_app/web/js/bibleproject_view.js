/**
 * BibleProject View & Media Controller
 * Gère le volet BibleProject (FR) dans le tiroir droit du lecteur biblique :
 * - Lecture fluide des vidéos YouTube (panoramas AT/NT, thèmes théologiques, études de mots)
 * - Visualiseur interactif Pan & Zoom pour les affiches / posters de structure littéraire HD
 * - Téléchargement direct des posters officiels en PDF haute résolution
 */

const BibleProjectView = {
  currentBook: 'GEN',
  currentChapter: 1,
  currentData: null,
  activeSubTab: 'overviews', // 'overviews' | 'posters' | 'themes'
  currentPlayingYtId: null,
  isLoading: false,

  // État du visualiseur de poster (Pan & Zoom)
  panzoom: {
    scale: 1,
    minScale: 0.2,
    maxScale: 5,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
  },

  init() {
    this.bindSubNav();
    this.bindPosterModal();
  },

  bindSubNav() {
    document.querySelectorAll('.bp-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.bp-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSubTab = btn.dataset.bpTab || 'overviews';
        this.renderLists();
      });
    });
  },

  /**
   * Charge et synchronise les médias pour le livre et chapitre biblique courant.
   */
  async load(bookCode, chapter = 1, force = false) {
    const normBook = bookCode || (typeof BibleReader !== 'undefined' ? BibleReader.currentBook : 'GEN') || 'GEN';
    const chNum = parseInt(chapter || (typeof BibleReader !== 'undefined' ? BibleReader.currentChapter : 1), 10) || 1;

    if (!force && this.currentBook === normBook && this.currentChapter === chNum && this.currentData) {
      return;
    }

    this.currentBook = normBook;
    this.currentChapter = chNum;
    this.isLoading = true;

    // Mise à jour badge
    const badge = document.getElementById('lbl-drawer-bp-passage');
    const frenchName = (typeof getFrenchBookName === 'function' ? getFrenchBookName(normBook) : null) || normBook;
    if (badge) {
      badge.textContent = `${frenchName} ${chNum}`;
    }

    try {
      const res = await API.getBibleProjectMedia(normBook, chNum);
      if (res && res.success) {
        this.currentData = res;
        this.renderLists();

        // Si aucune vidéo n'est encore en cours de lecture, charger automatiquement le premier panorama pertinent
        if (!this.currentPlayingYtId && res.current_videos && res.current_videos.length > 0) {
          const firstVid = res.current_videos[0];
          this.previewVideo(firstVid.yt_id, firstVid.title, firstVid.description);
        }
      }
    } catch (err) {
      console.error('[BibleProjectView] Erreur lors du chargement des médias:', err);
    } finally {
      this.isLoading = false;
    }
  },

  renderLists() {
    const root = document.getElementById('bp-media-lists-container');
    if (!root) return;

    if (!this.currentData) {
      root.innerHTML = `<div class="bp-empty-box"><p>Chargement des ressources BibleProject...</p></div>`;
      return;
    }

    if (this.activeSubTab === 'overviews') {
      this.renderOverviewsList(root);
    } else if (this.activeSubTab === 'posters') {
      this.renderPostersList(root);
    } else if (this.activeSubTab === 'themes') {
      this.renderThemesList(root);
    }
  },

  renderOverviewsList(root) {
    const videos = this.currentData.all_videos || [];
    if (videos.length === 0) {
      root.innerHTML = `
        <div class="bp-empty-box">
          <p>Aucun panorama vidéo spécifique répertorié pour ce livre.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="bp-section-title-row">
        <span class="bp-sec-title">Panoramas du livre (${this.currentData.book_name})</span>
        <span class="bp-sec-count">${videos.length} vidéo(s)</span>
      </div>
      <div class="bp-videos-grid">
    `;

    videos.forEach(v => {
      const isCurrentRange = this.currentChapter >= v.chapters[0] && this.currentChapter <= v.chapters[1];
      const isPlaying = this.currentPlayingYtId === v.yt_id;
      const thumbUrl = `https://img.youtube.com/vi/${v.yt_id}/mqdefault.jpg`;

      html += `
        <div class="bp-video-card ${isCurrentRange ? 'is-active-range' : ''} ${isPlaying ? 'is-playing' : ''}" data-yt-id="${v.yt_id}">
          <div class="bp-video-thumb-wrap" onclick="BibleProjectView.playVideo('${v.yt_id}', '${this.escapeHtml(v.title)}', '${this.escapeHtml(v.description)}')">
            <img src="${thumbUrl}" class="bp-video-thumb-img" alt="${this.escapeHtml(v.title)}" loading="lazy">
            <div class="bp-play-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <span class="bp-video-duration">${v.duration || 'Panorama'}</span>
            ${isCurrentRange ? `<span class="bp-cur-chap-badge">Chap. ${this.currentChapter}</span>` : ''}
          </div>
          <div class="bp-video-meta">
            <div class="bp-video-title" onclick="BibleProjectView.playVideo('${v.yt_id}', '${this.escapeHtml(v.title)}', '${this.escapeHtml(v.description)}')">${this.escapeHtml(v.title)}</div>
            <div class="bp-video-desc">${this.escapeHtml(v.description || '')}</div>
            <div class="bp-video-footer">
              <span class="bp-video-range-pill">Chapitres ${v.chapters[0]} à ${v.chapters[1]}</span>
              <button class="bp-btn-action-sm" onclick="BibleProjectView.playVideo('${v.yt_id}', '${this.escapeHtml(v.title)}', '${this.escapeHtml(v.description)}')">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>${isPlaying ? 'En cours' : 'Regarder'}</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    root.innerHTML = html;
  },

  renderPostersList(root) {
    const posters = this.currentData.all_posters || [];
    if (posters.length === 0) {
      root.innerHTML = `
        <div class="bp-empty-box">
          <p>Aucun poster haute définition répertorié pour ce livre.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="bp-section-title-row">
        <span class="bp-sec-title">Affiches &amp; Schémas de Structure Littéraire</span>
        <span class="bp-sec-count">${posters.length} affiche(s)</span>
      </div>
      <div class="bp-posters-grid">
    `;

    posters.forEach(p => {
      const isCurrentRange = this.currentChapter >= p.chapters[0] && this.currentChapter <= p.chapters[1];

      html += `
        <div class="bp-poster-card ${isCurrentRange ? 'is-active-range' : ''}">
          <div class="bp-poster-thumb-wrap" onclick="BibleProjectView.openPosterModal('${p.image_url}', '${p.pdf_url}', '${this.escapeHtml(p.title)}')">
            <img src="${p.image_url}" class="bp-poster-thumb-img" alt="${this.escapeHtml(p.title)}" loading="lazy" onerror="this.src='img/textures/vintage/fond_bible.jpg'">
            <div class="bp-poster-zoom-overlay">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              <span>Agrandir (Zoom HD)</span>
            </div>
          </div>
          <div class="bp-poster-meta">
            <div class="bp-poster-title">${this.escapeHtml(p.title)}</div>
            <div class="bp-poster-actions-row">
              <button type="button" class="bp-btn-view-poster" onclick="BibleProjectView.openPosterModal('${p.image_url}', '${p.pdf_url}', '${this.escapeHtml(p.title)}')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                <span>Visualiser</span>
              </button>
              <a href="${p.pdf_url}" target="_blank" class="bp-btn-pdf-download" title="Télécharger le PDF source">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>PDF</span>
              </a>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    root.innerHTML = html;
  },

  renderThemesList(root) {
    const themes = this.currentData.all_themes || [];
    const words = this.currentData.word_studies || [];

    let html = `
      <div class="bp-section-title-row">
        <span class="bp-sec-title">Thèmes Majeurs de la Théologie Biblique</span>
      </div>
      <div class="bp-themes-grid">
    `;

    themes.forEach(th => {
      const isRelated = (th.related_books || []).includes(this.currentBook);
      const thumbUrl = `https://img.youtube.com/vi/${th.yt_id}/mqdefault.jpg`;

      html += `
        <div class="bp-theme-card ${isRelated ? 'is-related-theme' : ''}">
          <div class="bp-theme-thumb-wrap" onclick="BibleProjectView.playVideo('${th.yt_id}', '${this.escapeHtml(th.title)}', '${this.escapeHtml(th.description)}')">
            <img src="${thumbUrl}" class="bp-theme-thumb-img" alt="${this.escapeHtml(th.title)}" loading="lazy">
            <div class="bp-play-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <span class="bp-video-duration">${th.duration || 'Thème'}</span>
            ${isRelated ? `<span class="bp-related-badge">Lié à ${this.currentBook}</span>` : ''}
          </div>
          <div class="bp-theme-meta">
            <div class="bp-theme-title" onclick="BibleProjectView.playVideo('${th.yt_id}', '${this.escapeHtml(th.title)}', '${this.escapeHtml(th.description)}')">${this.escapeHtml(th.title)}</div>
            <div class="bp-theme-desc">${this.escapeHtml(th.description || '')}</div>
          </div>
        </div>
      `;
    });

    html += `
      </div>
      <div class="bp-section-title-row" style="margin-top: 20px;">
        <span class="bp-sec-title">Études de Mots Clés (Hébreu &amp; Grec)</span>
      </div>
      <div class="bp-words-grid">
    `;

    words.forEach(w => {
      const thumbUrl = `https://img.youtube.com/vi/${w.yt_id}/mqdefault.jpg`;
      html += `
        <div class="bp-word-card" onclick="BibleProjectView.playVideo('${w.yt_id}', '${this.escapeHtml(w.title)}', '${this.escapeHtml(w.description)}')">
          <div class="bp-word-thumb">
            <img src="${thumbUrl}" alt="${this.escapeHtml(w.title)}" loading="lazy">
            <div class="bp-play-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          </div>
          <div class="bp-word-info">
            <div class="bp-word-title">${this.escapeHtml(w.title)}</div>
            <div class="bp-word-original">${this.escapeHtml(w.hebrew_greek || '')}</div>
            <div class="bp-word-desc">${this.escapeHtml(w.description || '')}</div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    root.innerHTML = html;
  },

  previewVideo(ytId, title, desc) {
    const placeholder = document.getElementById('bp-player-placeholder');
    const iframe = document.getElementById('bp-youtube-iframe');
    const infoBox = document.getElementById('bp-now-playing-info');
    const titleEl = document.getElementById('bp-now-playing-title');
    const descEl = document.getElementById('bp-now-playing-desc');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc || '';
    if (infoBox) infoBox.classList.remove('hidden');

    if (placeholder) {
      placeholder.innerHTML = `
        <div class="bp-placeholder-preview" style="background-image: url('https://img.youtube.com/vi/${ytId}/hqdefault.jpg')" onclick="BibleProjectView.playVideo('${ytId}', '${this.escapeHtml(title)}', '${this.escapeHtml(desc)}')">
          <div class="bp-preview-play-btn">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <span class="bp-preview-title">${this.escapeHtml(title)}</span>
        </div>
      `;
      placeholder.classList.remove('hidden');
    }
    if (iframe) {
      iframe.classList.add('hidden');
      iframe.src = '';
    }
  },

  playVideo(ytId, title, desc) {
    this.currentPlayingYtId = ytId;
    const placeholder = document.getElementById('bp-player-placeholder');
    const iframe = document.getElementById('bp-youtube-iframe');
    const infoBox = document.getElementById('bp-now-playing-info');
    const titleEl = document.getElementById('bp-now-playing-title');
    const descEl = document.getElementById('bp-now-playing-desc');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc || '';
    if (infoBox) infoBox.classList.remove('hidden');

    if (placeholder) placeholder.classList.add('hidden');
    if (iframe) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
      iframe.classList.remove('hidden');
    }

    // Mettre à jour l'état visuel dans les cartes
    this.renderLists();
  },

  /**
   * Visualiseur interactif Pan & Zoom pour les posters
   */
  bindPosterModal() {
    const modal = document.getElementById('bp-poster-modal');
    const closeBtn = document.getElementById('bp-poster-modal-close');
    const zoomInBtn = document.getElementById('bp-zoom-in');
    const zoomOutBtn = document.getElementById('bp-zoom-out');
    const zoomFitBtn = document.getElementById('bp-zoom-fit');
    const zoomResetBtn = document.getElementById('bp-zoom-reset');
    const viewport = document.getElementById('bp-poster-viewport');

    closeBtn?.addEventListener('click', () => this.closePosterModal());
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closePosterModal();
    });

    // Raccourci Échap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        this.closePosterModal();
      }
    });

    // Boutons de zoom
    zoomInBtn?.addEventListener('click', () => this.zoom(1.25));
    zoomOutBtn?.addEventListener('click', () => this.zoom(0.8));
    zoomFitBtn?.addEventListener('click', () => this.fitToScreen());
    zoomResetBtn?.addEventListener('click', () => this.resetZoom());

    // Molette de la souris pour le zoom interactif
    viewport?.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.zoom(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // Glisser-déplacer (Pan)
    viewport?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Clic gauche uniquement
      this.panzoom.isDragging = true;
      this.panzoom.startX = e.clientX - this.panzoom.translateX;
      this.panzoom.startY = e.clientY - this.panzoom.translateY;
      viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.panzoom.isDragging) return;
      this.panzoom.translateX = e.clientX - this.panzoom.startX;
      this.panzoom.translateY = e.clientY - this.panzoom.startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.panzoom.isDragging) {
        this.panzoom.isDragging = false;
        if (viewport) viewport.style.cursor = 'grab';
      }
    });

    // Double-clic pour alterner entre vue ajustée et zoom 100%
    viewport?.addEventListener('dblclick', () => {
      if (Math.abs(this.panzoom.scale - 1) < 0.1) {
        this.fitToScreen();
      } else {
        this.resetZoom();
      }
    });
  },

  openPosterModal(imageUrl, pdfUrl, title) {
    const modal = document.getElementById('bp-poster-modal');
    const titleEl = document.getElementById('bp-modal-poster-title');
    const dlBtn = document.getElementById('bp-poster-download-btn');
    const img = document.getElementById('bp-poster-highres-img');
    const loader = document.getElementById('bp-poster-loading');

    if (titleEl) titleEl.textContent = title || 'Structure littéraire';
    if (dlBtn) dlBtn.href = pdfUrl || '#';

    if (img) {
      if (loader) loader.classList.remove('hidden');
      img.src = imageUrl;
      img.onload = () => {
        if (loader) loader.classList.add('hidden');
        this.fitToScreen();
      };
      img.onerror = () => {
        if (loader) loader.classList.add('hidden');
        img.src = 'img/textures/vintage/fond_bible.jpg';
      };
    }

    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('bp-modal-open');
    }
  },

  closePosterModal() {
    const modal = document.getElementById('bp-poster-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('bp-modal-open');
    }
  },

  zoom(factor, clientX = null, clientY = null) {
    const newScale = Math.min(this.panzoom.maxScale, Math.max(this.panzoom.minScale, this.panzoom.scale * factor));
    this.panzoom.scale = newScale;
    this.applyTransform();
    this.updateZoomLabel();
  },

  fitToScreen() {
    const viewport = document.getElementById('bp-poster-viewport');
    const img = document.getElementById('bp-poster-highres-img');
    if (!viewport || !img || !img.naturalWidth) return;

    const vpWidth = viewport.clientWidth - 40;
    const vpHeight = viewport.clientHeight - 40;

    const scaleX = vpWidth / img.naturalWidth;
    const scaleY = vpHeight / img.naturalHeight;
    this.panzoom.scale = Math.min(scaleX, scaleY, 1.2);
    this.panzoom.translateX = 0;
    this.panzoom.translateY = 0;

    this.applyTransform();
    this.updateZoomLabel();
  },

  resetZoom() {
    this.panzoom.scale = 1;
    this.panzoom.translateX = 0;
    this.panzoom.translateY = 0;
    this.applyTransform();
    this.updateZoomLabel();
  },

  applyTransform() {
    const layer = document.getElementById('bp-poster-transform-layer');
    if (layer) {
      layer.style.transform = `translate(${this.panzoom.translateX}px, ${this.panzoom.translateY}px) scale(${this.panzoom.scale})`;
    }
  },

  updateZoomLabel() {
    const lbl = document.getElementById('bp-zoom-level-label');
    if (lbl) {
      lbl.textContent = `${Math.round(this.panzoom.scale * 100)}%`;
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
  }
};

window.BibleProjectView = BibleProjectView;
