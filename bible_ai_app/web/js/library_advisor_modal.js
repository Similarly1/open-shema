/**
 * Open Shema - Contrôleur du Modal Conseiller de Lecture & Équilibrage Bibliographique.
 * 
 * RÈGLE STRICTE : 100% SVG vectoriel, aucun émoji.
 */

const LibraryAdvisorModal = {
  isOpen: false,
  isLoading: false,
  cachedAdvice: null,
  isDirty: false,
  STORAGE_KEY: 'open_shema_library_advisor_cache',

  // Icônes SVG vectorielles standardisées (100% SVG)
  icons: {
    compass: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    balance: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
    deepen: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
    bookstore: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><circle cx="12" cy="12" r="2"/></svg>`,
    external: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    author: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
  },

  markDirty() {
    this.isDirty = true;
    this.cachedAdvice = null;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {}
  },

  restoreFromStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.deepening_recommendations || parsed.balance_recommendations)) {
          this.cachedAdvice = parsed;
        }
      }
    } catch (e) {
      console.debug('Cache advisor non récupéré depuis localStorage', e);
    }
  },

  saveToStorage(data) {
    try {
      if (data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.debug('Erreur sauvegarde cache advisor dans localStorage', e);
    }
  },

  init() {
    // Restaurer le dernier conseil mémorisé depuis localStorage
    this.restoreFromStorage();

    // Bouton d'ouverture depuis la bibliothèque
    document.getElementById('btn-lib-advisor')?.addEventListener('click', () => {
      this.open();
    });

    // Boutons de fermeture
    document.getElementById('btn-close-advisor-modal')?.addEventListener('click', () => {
      this.close();
    });
    document.getElementById('btn-advisor-close-footer')?.addEventListener('click', () => {
      this.close();
    });

    // Fermeture par clic sur l'overlay
    document.getElementById('modal-library-advisor')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-library-advisor') {
        this.close();
      }
    });

    // Bouton d'actualisation explicite
    document.getElementById('btn-advisor-refresh')?.addEventListener('click', () => {
      this.loadAdvice(true);
    });

    // Échap pour fermer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Bouton de redirection vers la bibliothèque pour compléter les fiches
    document.getElementById('btn-advisor-go-library')?.addEventListener('click', () => {
      this.close();
      if (typeof App !== 'undefined' && App.switchView) {
        App.switchView('library');
      }
    });
  },

  async open() {
    const modal = document.getElementById('modal-library-advisor');
    if (!modal) return;

    this.isOpen = true;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // 1. Si nous avons déjà un conseil en mémoire ou en stockage local sans modification :
    // Affichage direct sans attente, sans spinner et sans appel API !
    if (this.cachedAdvice && !this.isDirty) {
      const loadingState = document.getElementById('advisor-loading-state');
      const contentWrapper = document.getElementById('advisor-content-wrapper');
      if (loadingState) loadingState.classList.add('hidden');
      if (contentWrapper) contentWrapper.classList.remove('hidden');
      this.render(this.cachedAdvice);
      return;
    }

    // 2. Sinon (premier chargement, ou bibliothèque modifiée, ou clic sur actualiser)
    await this.loadAdvice(false);
  },

  close() {
    const modal = document.getElementById('modal-library-advisor');
    if (!modal) return;

    this.isOpen = false;
    modal.classList.add('hidden');
    modal.style.display = 'none';
  },

  async loadAdvice(forceRefresh = false) {
    if (this.isLoading) return;
    this.isLoading = true;

    const loadingState = document.getElementById('advisor-loading-state');
    const contentWrapper = document.getElementById('advisor-content-wrapper');
    const refreshBtn = document.getElementById('btn-advisor-refresh');

    if (loadingState) {
      const titleEl = loadingState.querySelector('h4');
      const descEl = loadingState.querySelector('p');
      if (forceRefresh) {
        if (titleEl) titleEl.textContent = "Actualisation des recommandations...";
        if (descEl) descEl.textContent = "Réévaluation complète et consultation de l'assistant bibliographique.";
      } else {
        if (titleEl) titleEl.textContent = "Analyse de votre bibliothèque en cours...";
        if (descEl) descEl.textContent = "Évaluation de la répartition canonique, des thématiques et détection des angles morts.";
      }
      loadingState.classList.remove('hidden');
    }
    if (contentWrapper) contentWrapper.classList.add('hidden');
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = '0.6';
    }

    try {
      const data = await API.call('get_library_advice', { force_refresh: forceRefresh });
      this.cachedAdvice = data;
      this.isDirty = false;
      this.saveToStorage(data);
      this.render(data);
    } catch (e) {
      console.error('Erreur chargement conseils bibliothèque :', e);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Erreur lors de l'analyse : ${e}`);
      }
    } finally {
      this.isLoading = false;
      if (loadingState) loadingState.classList.add('hidden');
      if (contentWrapper) contentWrapper.classList.remove('hidden');
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = '1';
      }
    }
  },

  render(data) {
    if (!data) return;

    const profile = data.profile || {};

    // 0. Statut dans le sous-titre
    const subTitle = document.getElementById('advisor-subtitle');
    if (subTitle) {
      if (data.from_cache) {
        subTitle.innerHTML = `Diagnostic bibliographique et recommandations <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--text-secondary); margin-left: 8px;">${this.icons.clock} Mémorisé</span>`;
      } else {
        subTitle.innerHTML = `Diagnostic bibliographique et recommandations <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); margin-left: 8px;">${this.icons.check} Mis à jour</span>`;
      }
    }

    // 1. Diagnostic text
    const diagEl = document.getElementById('advisor-diagnostic-text');
    if (diagEl) {
      diagEl.textContent = data.diagnostic || "Analyse complétée.";
    }

    // 2. Barres de répartition canonique
    const barOt = document.getElementById('advisor-bar-ot');
    const barNt = document.getElementById('advisor-bar-nt');
    const otPct = profile.ot_percentage || 0;
    const ntPct = profile.nt_percentage || 0;

    if (barOt) barOt.style.width = `${otPct}%`;
    if (barNt) barNt.style.width = `${ntPct}%`;

    const countsEl = document.getElementById('advisor-canonical-counts');
    if (countsEl) {
      countsEl.textContent = `${profile.ot_count || 0} AT vs ${profile.nt_count || 0} NT`;
    }

    const otLeg = document.getElementById('advisor-ot-legend');
    if (otLeg) otLeg.textContent = `Ancien Testament (${otPct}%)`;

    const ntLeg = document.getElementById('advisor-nt-legend');
    if (ntLeg) ntLeg.textContent = `Nouveau Testament (${ntPct}%)`;

    // 3. Auteurs récurrents
    const authContainer = document.getElementById('advisor-top-authors');
    if (authContainer) {
      authContainer.innerHTML = '';
      const authors = profile.frequent_authors || [];
      if (authors.length === 0) {
        authContainer.innerHTML = `<span style="font-size: 12px; color: var(--text-muted);">Aucun auteur récurrent identifié.</span>`;
      } else {
        authors.forEach(a => {
          const chip = document.createElement('span');
          chip.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 11.5px;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-color);
            padding: 3px 8px;
            border-radius: 4px;
            color: var(--text-secondary);
          `;
          chip.innerHTML = `${this.icons.author} <span>${this.escapeHtml(a.author)} (${a.count})</span>`;
          authContainer.appendChild(chip);
        });
      }
    }

    // 3b. Profil herméneutique & Cadre ministériel
    const theolCard = document.getElementById('advisor-theological-card');
    const roleBadge = document.getElementById('advisor-role-badge');
    const theolDetails = document.getElementById('advisor-theological-details');
    if (theolDetails) {
      const tp = profile.theological_profile || {};
      if (roleBadge) {
        roleBadge.textContent = tp.user_role_label || 'Étude personnelle';
      }
      const levelLabel = tp.greek_hebrew_level === 'debutant' ? 'Débutant (translittéré)' : (tp.greek_hebrew_level === 'intermediaire' ? 'Intermédiaire' : 'Avancé');
      theolDetails.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span>Tradition / Sensibilité :</span>
          <strong style="color: var(--text-primary);">${this.escapeHtml(tp.tradition || 'Évangélique')}</strong>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span>Langues bibliques :</span>
          <span style="color: var(--text-primary);">${this.escapeHtml(levelLabel)}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span>Contexte :</span>
          <span style="color: var(--text-primary);">${this.escapeHtml(tp.country_culture || 'Suisse romande / France')}</span>
        </div>
      `;
    }

    // 3c. Flux RSS & Outils installés
    const blogBadge = document.getElementById('advisor-blog-badge');
    const blogDetails = document.getElementById('advisor-blogs-details');
    if (blogDetails) {
      const bs = profile.blog_status || {};
      const enabledCount = bs.enabled_sources_count ?? 2;
      const totalSources = bs.total_sources || 2;
      if (blogBadge) {
        blogBadge.textContent = `${enabledCount}/${totalSources} flux actif${enabledCount > 1 ? 's' : ''}`;
        if (enabledCount === 2) {
          blogBadge.style.background = 'rgba(16, 185, 129, 0.12)';
          blogBadge.style.color = '#10B981';
          blogBadge.style.borderColor = 'rgba(16, 185, 129, 0.25)';
        } else if (enabledCount === 1) {
          blogBadge.style.background = 'rgba(245, 158, 11, 0.12)';
          blogBadge.style.color = '#F59E0B';
          blogBadge.style.borderColor = 'rgba(245, 158, 11, 0.25)';
        } else {
          blogBadge.style.background = 'rgba(239, 68, 68, 0.12)';
          blogBadge.style.color = '#EF4444';
          blogBadge.style.borderColor = 'rgba(239, 68, 68, 0.25)';
        }
      }

      const biblesCount = (profile.installed_bibles || []).length;
      const commCount = (profile.installed_commentaries || []).length;
      const totalArticles = bs.total_articles || 0;
      const sourcesListStr = (bs.enabled_sources || []).map(s => this.escapeHtml(s)).join(', ') || 'Aucun flux activé';

      blogDetails.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span>Articles stockés :</span>
          <strong style="color: var(--text-primary);">${totalArticles} article${totalArticles > 1 ? 's' : ''}</strong>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.35;">
          ${sourcesListStr}
        </div>
        <div style="border-top: 1px dashed var(--border-color); margin-top: 4px; padding-top: 4px; display: flex; align-items: center; justify-content: space-between; font-size: 11.5px;">
          <span>Outils intégrés :</span>
          <span style="color: var(--accent-blue); font-weight: 500;">${biblesCount} Bible(s) • ${commCount} commentaire(s)</span>
        </div>
      `;
    }

    // 4. Alerte sur les livres incomplets
    const incompleteAlert = document.getElementById('advisor-incomplete-alert');
    const incompleteMsg = document.getElementById('advisor-incomplete-msg');
    const incompleteCount = profile.incomplete_books_count || 0;

    if (incompleteCount > 0 && incompleteAlert && incompleteMsg) {
      const sampleNames = (profile.incomplete_books || []).map(b => `« ${b.title} »`).slice(0, 2).join(', ');
      incompleteMsg.innerHTML = `<strong>${incompleteCount} ouvrage(s)</strong> ont des informations incomplètes (ex : ${this.escapeHtml(sampleNames)}). Renseignez leur auteur ou description pour affiner vos conseils.`;
      incompleteAlert.classList.remove('hidden');
    } else if (incompleteAlert) {
      incompleteAlert.classList.add('hidden');
    }

    // 5. Recommandations d'approfondissement
    const deepContainer = document.getElementById('advisor-deepening-container');
    if (deepContainer) {
      deepContainer.innerHTML = '';
      const deepening = data.deepening_recommendations || [];
      if (deepening.length === 0) {
        deepContainer.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); margin: 0;">Aucune recommandation d'approfondissement supplémentaire.</p>`;
      } else {
        deepening.forEach(rec => {
          deepContainer.appendChild(this.buildRecommendationCard(rec, false));
        });
      }
    }

    // 6. Recommandations d'équilibrage
    const balanceContainer = document.getElementById('advisor-balance-container');
    if (balanceContainer) {
      balanceContainer.innerHTML = '';
      const balance = data.balance_recommendations || [];
      if (balance.length === 0) {
        balanceContainer.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); margin: 0;">Votre bibliothèque présente un excellent équilibre global.</p>`;
      } else {
        balance.forEach(rec => {
          balanceContainer.appendChild(this.buildRecommendationCard(rec, true));
        });
      }
    }
  },

  buildRecommendationCard(rec, isBalance = false) {
    const card = document.createElement('div');
    card.className = 'advisor-book-card';

    const axisTitle = rec.axis_title || rec.title || "Axe de lecture recommandé";
    const rationale = rec.rationale || "";
    const authors = Array.isArray(rec.benchmark_authors) && rec.benchmark_authors.length > 0
      ? rec.benchmark_authors
      : (rec.author ? [rec.author] : []);
    const keywords = Array.isArray(rec.search_keywords) && rec.search_keywords.length > 0
      ? rec.search_keywords
      : authors.slice(0, 3);

    const gapBadge = isBalance && rec.target_gap ? `
      <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 4px;">
        ${this.icons.balance} ${this.escapeHtml(rec.target_gap)}
      </span>
    ` : '';

    const authorsLine = authors.length > 0 ? `
      <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent-blue, #3B82F6); font-weight: 500; margin-top: 2px;">
        ${this.icons.author}
        <span>Auteurs de repère : <strong>${this.escapeHtml(authors.join(', '))}</strong></span>
      </div>
    ` : '';

    // Tags / puces de recherche cliquables
    const chipsHtml = keywords.map(kw => `
      <button type="button" class="advisor-search-chip" data-keyword="${this.escapeHtml(kw)}" title="Rechercher « ${this.escapeHtml(kw)} » dans le catalogue Open Shema et les librairies e-books" style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: var(--accent-blue, #60A5FA); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.18s ease; font-family: inherit;">
        ${this.icons.search}
        <span>${this.escapeHtml(kw)}</span>
      </button>
    `).join('');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 220px;">
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 4px;">
            <strong style="font-size: 14px; color: var(--text-primary); font-weight: 600; line-height: 1.35;">${this.escapeHtml(axisTitle)}</strong>
            ${gapBadge}
          </div>
          ${authorsLine}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <button type="button" class="btn-ghost btn-sm btn-advisor-web" title="Rechercher cet axe sur Google Livres / Web" style="display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; height: 28px; padding: 0 10px; font-size: 12px;">
            ${this.icons.external}
            <span>Web</span>
          </button>
          <button type="button" class="btn-ghost btn-sm btn-advisor-copy" title="Copier l'intitulé et les mots-clés" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0;">
            ${this.icons.copy}
          </button>
        </div>
      </div>

      <div style="font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); border-top: 1px dashed var(--border-color); padding-top: 8px;">
        ${this.escapeHtml(rationale)}
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 6px;">
        <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 5px;">
          ${this.icons.bookstore} Lancer la recherche e-books :
        </span>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${chipsHtml}
        </div>
      </div>
    `;

    // Événements sur les chips de recherche : clic -> ouvre le catalogue unifié avec ce mot-clé !
    card.querySelectorAll('.advisor-search-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const kw = chip.dataset.keyword;
        this.close();
        setTimeout(() => {
          if (typeof OpenShemaStore !== 'undefined' && OpenShemaStore.open) {
            OpenShemaStore.open('all', kw);
          }
        }, 30);
      });
      chip.addEventListener('mouseenter', () => {
        chip.style.background = 'rgba(59, 130, 246, 0.22)';
        chip.style.borderColor = 'rgba(59, 130, 246, 0.6)';
        chip.style.transform = 'translateY(-1px)';
      });
      chip.addEventListener('mouseleave', () => {
        chip.style.background = 'rgba(59, 130, 246, 0.1)';
        chip.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        chip.style.transform = 'translateY(0)';
      });
    });

    // Action Web
    card.querySelector('.btn-advisor-web')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const firstKw = keywords[0] || axisTitle;
      const q = encodeURIComponent(`livre chrétien "${firstKw}"`);
      const url = `https://www.google.com/search?q=${q}`;
      window.open(url, '_blank');
    });

    // Action Copier
    const copyBtn = card.querySelector('.btn-advisor-copy');
    copyBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const refText = `${axisTitle} (Mots-clés : ${keywords.join(', ')})`;
      try {
        await navigator.clipboard.writeText(refText);
        copyBtn.innerHTML = LibraryAdvisorModal.icons.check;
        copyBtn.style.color = '#10B981';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Axe « ${axisTitle} » copié au presse-papier`);
        }
        setTimeout(() => {
          copyBtn.innerHTML = LibraryAdvisorModal.icons.copy;
          copyBtn.style.color = '';
        }, 1800);
      } catch (err) {
        console.warn('Erreur copie presse-papier :', err);
      }
    });

    return card;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  LibraryAdvisorModal.init();
});
