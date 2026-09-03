/**
 * Open Shema — First-Run Onboarding Wizard
 * 
 * Expérience d'accueil au premier lancement d'Open Shema.
 * RÈGLE STRICTE : 100% icônes SVG vectorielles, aucun émoji Unicode.
 * Mode Clair par défaut.
 */

const FirstRunWizard = {
  catalogUrl: 'https://raw.githubusercontent.com/Similarly1/open-shema-data/main/catalog.json',
  currentStep: 1,
  totalSteps: 4,
  catalogData: null,
  activeFilter: 'all',
  
  // Choix utilisateur
  libraryMode: 'essential', // 'essential' | 'custom'
  selectedModules: new Set(['bible-lsg-1910']),
  aiProvider: 'gemini',     // 'gemini' | 'mistral' | 'infomaniak' | 'disabled'
  geminiKey: '',
  mistralKey: '',
  infomaniakToken: '',
  infomaniakProductId: '',
  selectedTheme: 'light',
  selectedPalette: 'light-default',

  // Icônes SVG standardisées Open Shema (100% vectoriel, 0 émoji)
  svg: {
    logo: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    book: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    cpu: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    shieldSwiss: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
    slashCircle: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    download: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
    external: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    layers: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`
  },

  async init() {
    try {
      if (window.pywebview && window.pywebview.api && window.pywebview.api.is_first_run) {
        const res = await window.pywebview.api.is_first_run();
        if (res && res.is_first_run) {
          this.show();
        }
      }
    } catch (e) {
      console.warn("[FirstRunWizard] Erreur vérification is_first_run :", e);
    }
  },

  async show() {
    const splash = document.getElementById('app-splash-loader');
    if (splash) {
      splash.style.display = 'none';
      splash.classList.add('fade-out');
    }
    let overlay = document.getElementById('first-run-wizard-overlay');
    if (!overlay) {
      this.renderOverlayHtml();
      overlay = document.getElementById('first-run-wizard-overlay');
    }
    overlay.classList.remove('hidden');
    this.goToStep(1);
    this.fetchCatalog();
  },

  hide() {
    const overlay = document.getElementById('first-run-wizard-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  },

  async fetchCatalog() {
    try {
      // 1. Essayer via l'API pywebview native avec repli cache local immédiat
      if (window.pywebview && window.pywebview.api && window.pywebview.api.get_official_catalog) {
        const cat = await window.pywebview.api.get_official_catalog();
        if (cat && cat.modules && cat.modules.length > 0) {
          this.catalogData = cat;
          this.renderModulesGrid();
          return;
        }
      }

      // 2. Repli direct avec timeout rapide (2.5s) pour ne jamais geler l'interface
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const resp = await fetch(this.catalogUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        this.catalogData = await resp.json();
        this.renderModulesGrid();
      }
    } catch (e) {
      console.warn("[FirstRunWizard] Catalogue distant non disponible, utilisation des modules embarqués :", e);
    }
  },

  renderOverlayHtml() {
    const html = `
      <div id="first-run-wizard-overlay" class="first-run-wizard-overlay">
        <div class="frw-background-mesh"></div>
        <div class="frw-container">
          
          <!-- Header -->
          <div class="frw-header">
            <div class="frw-brand">
              <div class="frw-brand-logo"><img src="img/logo.svg" alt="Open Shema" /></div>
              <div class="frw-brand-title">Open Shema</div>
              <div class="frw-brand-badge">Initialisation</div>
            </div>
            <div class="frw-stepper">
              <div class="frw-step-pill active" id="frw-pill-1"><span class="frw-step-pill-num">1</span> Bibliothèque</div>
              <div class="frw-step-pill" id="frw-pill-2"><span class="frw-step-pill-num">2</span> IA</div>
              <div class="frw-step-pill" id="frw-pill-3"><span class="frw-step-pill-num">3</span> Préférences</div>
              <div class="frw-step-pill" id="frw-pill-4"><span class="frw-step-pill-num">4</span> Déploiement</div>
            </div>
          </div>

          <!-- Body -->
          <div class="frw-body">
            
            <!-- Étape 1 : Bibliothèque -->
            <div class="frw-step-content active" id="frw-step-1">
              <div class="frw-title">Composez votre bibliothèque d'étude</div>
              <div class="frw-subtitle">Sélectionnez les textes bibliques et ressources initiales à installer depuis le catalogue libre Open Shema.</div>

              <div class="frw-grid-3">
                <div class="frw-card selected" id="frw-opt-essential" onclick="FirstRunWizard.selectLibraryMode('essential')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.book}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Pack Essentiel</div>
                  <div class="frw-card-desc">Bible Louis Segond 1910 avec Strongs (Hébreu & Grec). Prêt en 5 secondes.</div>
                  <div class="frw-card-tag frw-tag-amber">~20 Mo</div>
                </div>

                <div class="frw-card" id="frw-opt-custom" onclick="FirstRunWizard.selectLibraryMode('custom')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.layers}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Sur-Mesure</div>
                  <div class="frw-card-desc">Choisissez précisément chaque version, commentaire et dictionnaire à télécharger.</div>
                  <div class="frw-card-tag frw-tag-blue">Catalogue</div>
                </div>

                <div class="frw-card" id="frw-opt-empty" onclick="FirstRunWizard.selectLibraryMode('empty')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.sparkle}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Démarrer Vierge</div>
                  <div class="frw-card-desc">Aucun téléchargement initial. Vous importerez vos propres fichiers ou explorerez le Store.</div>
                  <div class="frw-card-tag frw-tag-gray">0 Mo</div>
                </div>
              </div>

              <!-- Navigateur de catalogue sobre en grille -->
              <div id="frw-custom-browser" class="frw-catalog-browser" style="display: none;">
                <div class="frw-catalog-header">
                  <div class="frw-filter-tabs">
                    <button class="frw-filter-btn active" onclick="FirstRunWizard.filterCategory('all', this)">Tous</button>
                    <button class="frw-filter-btn" onclick="FirstRunWizard.filterCategory('bibles', this)">Bibles</button>
                    <button class="frw-filter-btn" onclick="FirstRunWizard.filterCategory('dictionaries', this)">Dictionnaires</button>
                    <button class="frw-filter-btn" onclick="FirstRunWizard.filterCategory('commentaries', this)">Commentaires</button>
                    <button class="frw-filter-btn" onclick="FirstRunWizard.filterCategory('theology', this)">Théologie</button>
                  </div>
                  <div class="frw-quick-actions">
                    <button class="frw-text-btn" onclick="FirstRunWizard.selectAll(true)">Tout cocher</button>
                    <span style="color: #cbd5e1;">|</span>
                    <button class="frw-text-btn" onclick="FirstRunWizard.selectAll(false)">Tout décocher</button>
                  </div>
                </div>
                <div class="frw-modules-grid" id="frw-modules-grid">
                  <div style="padding: 16px; text-align: center; color: #94a3b8;">Chargement du catalogue...</div>
                </div>
              </div>
            </div>

            <!-- Étape 2 : Intelligence Artificielle -->
            <div class="frw-step-content" id="frw-step-2">
              <div class="frw-title">Assistance & Exégèse IA</div>
              <div class="frw-subtitle">Renseignez vos clés d'accès ou choisissez de configurer l'IA ultérieurement.</div>

              <!-- Bannière pédagogique de synergie -->
              <div class="frw-info-banner">
                <div class="frw-info-banner-icon">${this.svg.info}</div>
                <div>
                  <strong>Une architecture multi-moteurs complémentaire :</strong>
                  Les 3 modèles s'associent pour une étude optimale — <strong>Gemini</strong> (synthèses rapides et vue globale), <strong>Mistral</strong> (précision littéraire et style soigné), et <strong>Infomaniak</strong> (souveraineté suisse et vie privée). Vous pouvez renseigner un ou plusieurs accès dès maintenant ou les ajuster plus tard dans les Paramètres.
                </div>
              </div>

              <div class="frw-grid-3">
                <!-- Gemini -->
                <div class="frw-card selected" id="frw-ai-gemini" onclick="FirstRunWizard.selectAiProvider('gemini')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.sparkle}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Google Gemini</div>
                  <div class="frw-card-desc">Modèles rapides et structurés (Gemini 2.5 Flash / Pro). Synthèses comparatives.</div>
                  <div class="frw-card-tag frw-tag-green">Plan Gratuit disponible</div>
                </div>

                <!-- Mistral -->
                <div class="frw-card" id="frw-ai-mistral" onclick="FirstRunWizard.selectAiProvider('mistral')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.cpu}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Mistral AI</div>
                  <div class="frw-card-desc">Modèles français de pointe (Mistral Small / Large). Grande finesse exégétique.</div>
                  <div class="frw-card-tag frw-tag-green">Plan Gratuit disponible</div>
                </div>

                <!-- Infomaniak -->
                <div class="frw-card" id="frw-ai-infomaniak" onclick="FirstRunWizard.selectAiProvider('infomaniak')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.shieldSwiss}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Infomaniak AI</div>
                  <div class="frw-card-desc">Cloud souverain suisse hébergé sur énergie renouvelable. Zéro réutilisation de données.</div>
                  <div class="frw-card-tag frw-tag-amber">Souverain / Payant</div>
                </div>
              </div>

              <!-- Option Désactiver l'IA / Choisir plus tard -->
              <div class="frw-card" id="frw-ai-disabled" onclick="FirstRunWizard.selectAiProvider('disabled')" style="margin-bottom: 14px;">
                <div class="frw-card-header">
                  <div class="frw-card-icon">${this.svg.slashCircle}</div>
                  <div class="frw-card-radio"></div>
                </div>
                <div class="frw-card-title">Désactiver totalement l'IA / Choisir plus tard</div>
                <div class="frw-card-desc">Masque l'ensemble des modules IA. Vous pourrez à tout moment activer ou combiner vos clés dans Paramètres > Intelligence Artificielle.</div>
                <div class="frw-card-tag frw-tag-gray">Étude Traditionnelle</div>
              </div>

              <!-- Champs de saisie selon le choix IA -->
              <div id="frw-ai-fields-container">
                <!-- Gemini field -->
                <div class="frw-form-group" id="frw-group-gemini">
                  <label class="frw-label">Clé API Google AI Studio (Optionnelle pour démarrer)</label>
                  <input type="password" id="frw-input-gemini-key" class="frw-input" placeholder="AIzaSy..." />
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" class="frw-help-link">
                    ${this.svg.external} Obtenir une clé API gratuite sur Google AI Studio
                  </a>
                </div>

                <!-- Mistral field -->
                <div class="frw-form-group" id="frw-group-mistral" style="display: none;">
                  <label class="frw-label">Clé API Mistral Console (Optionnelle pour démarrer)</label>
                  <input type="password" id="frw-input-mistral-key" class="frw-input" placeholder="Votre clé secrète Mistral..." />
                  <a href="https://console.mistral.ai/api-keys/" target="_blank" class="frw-help-link">
                    ${this.svg.external} Obtenir une clé API sur la console Mistral
                  </a>
                </div>

                <!-- Infomaniak fields -->
                <div class="frw-form-group" id="frw-group-infomaniak" style="display: none;">
                  <label class="frw-label">Token API Infomaniak AI Tools</label>
                  <input type="password" id="frw-input-infomaniak-token" class="frw-input" placeholder="Token d'accès API..." style="margin-bottom: 10px;" />
                  <label class="frw-label">Product ID Infomaniak (Propre à votre compte)</label>
                  <input type="text" id="frw-input-infomaniak-product-id" class="frw-input" placeholder="Exemple : 251" />
                </div>
              </div>
            </div>

            <!-- Étape 3 : Préférences Visuelles -->
            <div class="frw-step-content" id="frw-step-3">
              <div class="frw-title">Préférences d'affichage</div>
              <div class="frw-subtitle">Personnalisez votre confort visuel pour vos sessions de lecture biblique.</div>

              <div class="frw-grid-2">
                <div class="frw-card selected" id="frw-theme-light" onclick="FirstRunWizard.selectTheme('light')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.sun}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Thème Clair (Par défaut)</div>
                  <div class="frw-card-desc">Contraste soigné, fond blanc pur / papier doux, idéal pour la lecture de jour et l'étude.</div>
                  <div class="frw-card-tag frw-tag-amber">Recommandé</div>
                </div>

                <div class="frw-card" id="frw-theme-dark" onclick="FirstRunWizard.selectTheme('dark')">
                  <div class="frw-card-header">
                    <div class="frw-card-icon">${this.svg.moon}</div>
                    <div class="frw-card-radio"></div>
                  </div>
                  <div class="frw-card-title">Thème Sombre</div>
                  <div class="frw-card-desc">Nuances d'ardoise et de nuit profonde, reposant pour les yeux en environnement sombre.</div>
                  <div class="frw-card-tag frw-tag-gray">Nuit</div>
                </div>
              </div>

              <div class="frw-form-group">
                <label class="frw-label">Ambiance de palette de couleurs :</label>
                <div class="frw-palette-options">
                  <div class="frw-palette-pill selected" id="frw-pal-default" onclick="FirstRunWizard.selectPalette('light-default', this)">Standard</div>
                  <div class="frw-palette-pill" id="frw-pal-amber" onclick="FirstRunWizard.selectPalette('light-amber', this)">Ambre Chaud</div>
                  <div class="frw-palette-pill" id="frw-pal-sepia" onclick="FirstRunWizard.selectPalette('sepia', this)">Sépia Doux</div>
                  <div class="frw-palette-pill" id="frw-pal-slate" onclick="FirstRunWizard.selectPalette('dark-slate', this)">Ardoise</div>
                </div>
              </div>
            </div>

            <!-- Étape 4 : Déploiement & Téléchargement -->
            <div class="frw-step-content" id="frw-step-4">
              <div class="frw-title">Déploiement en cours...</div>
              <div class="frw-subtitle">Open Shema prépare votre bibliothèque locale pour une utilisation fluide et instantanée.</div>

              <div class="frw-download-box">
                <div class="frw-download-icon-wrap">${this.svg.download}</div>
                <div style="font-size: 1.05rem; font-weight: 700; color: #0f172a;" id="frw-deploy-status">Initialisation du téléchargement...</div>
                <div class="frw-progress-bar-wrap">
                  <div class="frw-progress-bar-fill" id="frw-deploy-progress-fill"></div>
                </div>
                <div class="frw-progress-detail">
                  <span id="frw-deploy-detail-text">Vérification des modules...</span>
                  <span id="frw-deploy-percent-text">0%</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div class="frw-footer">
            <button class="frw-btn frw-btn-secondary" id="frw-btn-prev" onclick="FirstRunWizard.prevStep()" style="visibility: hidden;">
              ${this.svg.arrowLeft} Précédent
            </button>
            <button class="frw-btn frw-btn-primary" id="frw-btn-next" onclick="FirstRunWizard.nextStep()">
              Continuer ${this.svg.arrowRight}
            </button>
          </div>

        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  },

  selectLibraryMode(mode) {
    this.libraryMode = mode;
    document.getElementById('frw-opt-essential')?.classList.toggle('selected', mode === 'essential');
    document.getElementById('frw-opt-custom')?.classList.toggle('selected', mode === 'custom');
    document.getElementById('frw-opt-empty')?.classList.toggle('selected', mode === 'empty');
    
    const browser = document.getElementById('frw-custom-browser');
    if (browser) {
      browser.style.display = (mode === 'custom') ? 'block' : 'none';
    }
  },

  filterCategory(cat, btnEl) {
    this.activeFilter = cat;
    document.querySelectorAll('.frw-filter-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    this.renderModulesGrid();
  },

  selectAll(check) {
    if (!this.catalogData || !this.catalogData.modules) return;
    this.catalogData.modules.forEach(m => {
      if (check) {
        this.selectedModules.add(m.id);
      } else {
        this.selectedModules.delete(m.id);
      }
    });
    this.renderModulesGrid();
  },

  toggleModule(modId) {
    if (this.selectedModules.has(modId)) {
      this.selectedModules.delete(modId);
    } else {
      this.selectedModules.add(modId);
    }
    this.renderModulesGrid();
  },

  renderModulesGrid() {
    const gridEl = document.getElementById('frw-modules-grid');
    if (!gridEl || !this.catalogData || !this.catalogData.modules) return;

    const modules = this.catalogData.modules.filter(m => {
      if (this.activeFilter === 'all') return true;
      return m.category === this.activeFilter || m.type === this.activeFilter;
    });

    if (modules.length === 0) {
      gridEl.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: #94a3b8;">Aucun module dans cette catégorie.</div>`;
      return;
    }

    let html = '';
    modules.forEach((mod) => {
      const isChecked = this.selectedModules.has(mod.id);
      const sizeMb = (mod.size_bytes / (1024 * 1024)).toFixed(1);
      const badgeText = mod.abbreviation || mod.type.substring(0, 3).toUpperCase();
      const tooltipText = (mod.description || mod.title).replace(/"/g, '&quot;');

      html += `
        <div class="frw-module-tile ${isChecked ? 'checked' : ''}" title="${tooltipText}" onclick="FirstRunWizard.toggleModule('${mod.id}')">
          <input type="checkbox" class="frw-module-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); FirstRunWizard.toggleModule('${mod.id}')" />
          <span class="frw-module-badge">${badgeText}</span>
          <div class="frw-module-tile-info">
            <div class="frw-module-tile-title">${mod.title}</div>
          </div>
          <span class="frw-module-tile-size">${sizeMb}M</span>
        </div>
      `;
    });

    gridEl.innerHTML = html;
  },

  selectAiProvider(provider) {
    this.aiProvider = provider;
    ['gemini', 'mistral', 'infomaniak', 'disabled'].forEach((p) => {
      document.getElementById(`frw-ai-${p}`)?.classList.toggle('selected', p === provider);
    });

    const groupGemini = document.getElementById('frw-group-gemini');
    const groupMistral = document.getElementById('frw-group-mistral');
    const groupInfomaniak = document.getElementById('frw-group-infomaniak');

    if (groupGemini) groupGemini.style.display = (provider === 'gemini') ? 'block' : 'none';
    if (groupMistral) groupMistral.style.display = (provider === 'mistral') ? 'block' : 'none';
    if (groupInfomaniak) groupInfomaniak.style.display = (provider === 'infomaniak') ? 'block' : 'none';
  },

  selectTheme(theme) {
    this.selectedTheme = theme;
    document.getElementById('frw-theme-light')?.classList.toggle('selected', theme === 'light');
    document.getElementById('frw-theme-dark')?.classList.toggle('selected', theme === 'dark');
  },

  selectPalette(palette, el) {
    this.selectedPalette = palette;
    document.querySelectorAll('.frw-palette-pill').forEach(p => p.classList.remove('selected'));
    if (el) el.classList.add('selected');
  },

  goToStep(step) {
    this.currentStep = step;

    for (let i = 1; i <= this.totalSteps; i++) {
      const view = document.getElementById(`frw-step-${i}`);
      const pill = document.getElementById(`frw-pill-${i}`);
      if (view) view.classList.toggle('active', i === step);
      if (pill) {
        pill.classList.toggle('active', i === step);
        pill.classList.toggle('completed', i < step);
      }
    }

    const prevBtn = document.getElementById('frw-btn-prev');
    const nextBtn = document.getElementById('frw-btn-next');
    if (prevBtn) prevBtn.style.visibility = (step > 1 && step < 4) ? 'visible' : 'hidden';

    if (nextBtn) {
      if (step === 3) {
        nextBtn.innerHTML = `Lancer l'installation ${this.svg.arrowRight}`;
      } else if (step === 4) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.innerHTML = `Continuer ${this.svg.arrowRight}`;
        nextBtn.style.display = 'inline-flex';
      }
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.goToStep(this.currentStep - 1);
    }
  },

  nextStep() {
    if (this.currentStep === 1) {
      this.goToStep(2);
    } else if (this.currentStep === 2) {
      this.geminiKey = document.getElementById('frw-input-gemini-key')?.value.trim() || '';
      this.mistralKey = document.getElementById('frw-input-mistral-key')?.value.trim() || '';
      this.infomaniakToken = document.getElementById('frw-input-infomaniak-token')?.value.trim() || '';
      this.infomaniakProductId = document.getElementById('frw-input-infomaniak-product-id')?.value.trim() || '';
      this.goToStep(3);
    } else if (this.currentStep === 3) {
      this.goToStep(4);
      this.startDeployment();
    } else if (this.currentStep === 4) {
      this.startDeployment();
    }
  },

  async startDeployment() {
    const statusEl = document.getElementById('frw-deploy-status');
    const fillEl = document.getElementById('frw-deploy-progress-fill');
    const detailEl = document.getElementById('frw-deploy-detail-text');
    const percentEl = document.getElementById('frw-deploy-percent-text');

    // Déterminer la liste des modules à installer
    let modulesToInstall = [];
    
    if (this.libraryMode === 'essential') {
      if (this.catalogData && this.catalogData.modules) {
        const lsgMod = this.catalogData.modules.find(m => m.id === 'bible-lsg-1910') || this.catalogData.modules[0];
        if (lsgMod) modulesToInstall.push(lsgMod);
      }
      // Fallback de sécurité si le catalogue n'a pas pu être chargé
      if (modulesToInstall.length === 0) {
        modulesToInstall.push({
          id: 'bible-lsg-1910',
          type: 'bible',
          abbreviation: 'LSG',
          title: 'Louis Segond 1910 (avec Strongs)',
          download_url: 'https://raw.githubusercontent.com/Similarly1/open-shema-data/main/data/bibles/bible_lsg1910.sqlite'
        });
      }
    } else if (this.libraryMode === 'custom') {
      if (this.catalogData && this.catalogData.modules) {
        this.selectedModules.forEach(id => {
          const mod = this.catalogData.modules.find(m => m.id === id);
          if (mod) modulesToInstall.push(mod);
        });
      }
    } else if (this.libraryMode === 'empty') {
      // Démarrer Vierge : aucun module à télécharger
      modulesToInstall = [];
    }

    if (modulesToInstall.length === 0) {
      if (statusEl) statusEl.textContent = "Finalisation de la configuration...";
      if (fillEl) {
        fillEl.style.backgroundColor = "";
        fillEl.style.width = "40%";
      }
      if (percentEl) percentEl.textContent = "40%";
      if (detailEl) detailEl.textContent = "Initialisation des préférences...";
    } else {
      if (statusEl) statusEl.textContent = "Préparation des ressources...";
      if (fillEl) {
        fillEl.style.backgroundColor = "";
        fillEl.style.width = "10%";
      }
      if (percentEl) percentEl.textContent = "10%";
      if (detailEl) detailEl.textContent = "Téléchargement des modules sélectionnés...";
    }
    
    const nextBtn = document.getElementById('frw-btn-next');
    if (nextBtn) nextBtn.style.display = 'none';

    // Suivi de progression dynamique en temps réel via TaskManager (toutes les 100ms)
    let progressTimer = null;
    if (modulesToInstall.length > 0 && window.pywebview && window.pywebview.api && window.pywebview.api.get_background_tasks) {
      progressTimer = setInterval(async () => {
        try {
          const tasks = await window.pywebview.api.get_background_tasks();
          const task = tasks.find(t => t.id === 'onboarding_download');
          if (task) {
            const p = Math.min(100, Math.max(0, task.progress || 0));
            // Mappe la phase d'installation sur 10% -> 75%
            const mapped = Math.round(10 + (p * 0.65));
            if (fillEl) fillEl.style.width = `${mapped}%`;
            if (percentEl) percentEl.textContent = `${mapped}%`;
            if (detailEl && task.detail) detailEl.textContent = task.detail;
          }
        } catch (_) {}
      }, 100);
    }

    try {
      if (modulesToInstall.length > 0 && window.pywebview && window.pywebview.api && window.pywebview.api.download_onboarding_modules) {
        const dlRes = await window.pywebview.api.download_onboarding_modules(modulesToInstall);
        if (dlRes && !dlRes.success) {
          throw new Error(dlRes.error || "Erreur inconnue lors de l'installation");
        }
      }

      if (progressTimer) clearInterval(progressTimer);

      if (fillEl) fillEl.style.width = "85%";
      if (percentEl) percentEl.textContent = "85%";
      if (detailEl) detailEl.textContent = "Configuration des préférences et du sanctuaire...";

      const configPayload = {
        theme: this.selectedTheme,
        theme_palette: this.selectedPalette,
        enable_ai: this.aiProvider !== 'disabled',
        gemini_api_key: this.geminiKey,
        mistral_api_key: this.mistralKey,
        infomaniak_token: this.infomaniakToken,
        infomaniak_product_id: this.infomaniakProductId || "251"
      };

      if (window.pywebview && window.pywebview.api && window.pywebview.api.complete_first_run) {
        await window.pywebview.api.complete_first_run(configPayload);
      }

      if (fillEl) fillEl.style.width = "100%";
      if (percentEl) percentEl.textContent = "100%";
      if (statusEl) statusEl.textContent = "Votre sanctuaire d'étude est prêt !";
      if (detailEl) detailEl.textContent = "Ouverture d'Open Shema...";

      setTimeout(() => {
        this.hide();
        // Rechargement immédiat et propre de l'application pour charger Genèse 1 et tous les modules
        if (window.location && typeof window.location.reload === 'function') {
          window.location.reload();
        } else if (typeof App !== 'undefined' && App.init) {
          App.init();
        }
      }, 600);

    } catch (e) {
      if (progressTimer) clearInterval(progressTimer);
      console.error("[FirstRunWizard] Erreur durant le déploiement :", e);
      if (statusEl) statusEl.textContent = "Erreur de déploiement";
      if (detailEl) detailEl.textContent = e.message || String(e);
      if (fillEl) {
        fillEl.style.backgroundColor = "#ef4444";
        fillEl.style.width = "100%";
      }
      if (percentEl) percentEl.textContent = "Erreur";
      
      if (nextBtn) {
        nextBtn.innerHTML = `Réessayer ${this.svg.arrowRight}`;
        nextBtn.style.display = 'inline-flex';
      }
    }
  }
};

window.FirstRunWizard = FirstRunWizard;
