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
    clock: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
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
          deepContainer.appendChild(this.buildBookRecommendationCard(rec, false));
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
          balanceContainer.appendChild(this.buildBookRecommendationCard(rec, true));
        });
      }
    }
  },

  buildBookRecommendationCard(book, isBalance = false) {
    const card = document.createElement('div');
    card.className = 'advisor-book-card';

    const title = book.title || 'Ouvrage sans titre';
    const author = book.author || 'Auteur non renseigné';
    const publisher = book.publisher ? `<span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">(${this.escapeHtml(book.publisher)})</span>` : '';
    const rationale = book.rationale || '';
    const gapBadge = isBalance && book.target_gap ? `
      <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 4px;">
        ${this.icons.balance} ${this.escapeHtml(book.target_gap)}
      </span>
    ` : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 220px;">
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 4px;">
            <strong style="font-size: 13.5px; color: var(--text-primary); font-weight: 600; line-height: 1.35;">${this.escapeHtml(title)}</strong>
            ${gapBadge}
          </div>
          <div style="font-size: 12px; color: var(--accent-blue, #3B82F6); font-weight: 500;">
            ${this.escapeHtml(author)}${publisher}
          </div>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <button type="button" class="btn-secondary btn-sm btn-advisor-store" title="Rechercher en e-book dans les librairies partenaires Open Shema" style="display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; height: 28px; padding: 0 10px; font-size: 12px;">
            ${this.icons.bookstore}
            <span>E-book</span>
          </button>
          <button type="button" class="btn-ghost btn-sm btn-advisor-web" title="Rechercher sur Google Livres / Web" style="display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; height: 28px; padding: 0 10px; font-size: 12px;">
            ${this.icons.external}
            <span>Web</span>
          </button>
          <button type="button" class="btn-ghost btn-sm btn-advisor-copy" title="Copier la référence au presse-papier" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0;">
            ${this.icons.copy}
          </button>
        </div>
      </div>
      <div style="font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); border-top: 1px dashed var(--border-color); padding-top: 8px;">
        ${this.escapeHtml(rationale)}
      </div>
    `;

    // Action 1 : Recherche E-book dans OpenShemaStore
    card.querySelector('.btn-advisor-store')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
      if (typeof OpenShemaStore !== 'undefined' && OpenShemaStore.open) {
        OpenShemaStore.open('bookstores', `${title} ${author}`.trim());
      }
    });

    // Action 2 : Recherche Web (Google Livres)
    card.querySelector('.btn-advisor-web')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const q = encodeURIComponent(`livre "${title}" "${author}"`);
      const url = `https://www.google.com/search?q=${q}`;
      window.open(url, '_blank');
    });

    // Action 3 : Copier la référence
    const copyBtn = card.querySelector('.btn-advisor-copy');
    copyBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const refText = `${title} — ${author}`;
      try {
        await navigator.clipboard.writeText(refText);
        copyBtn.innerHTML = LibraryAdvisorModal.icons.check;
        copyBtn.style.color = '#10B981';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`« ${title} » copié au presse-papier`);
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
