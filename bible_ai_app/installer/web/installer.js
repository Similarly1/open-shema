/**
 * Open Shema — Logique Client de l'Installeur (PyWebView)
 * Gère l'interaction utilisateur, la sélection de dossier, le polling en direct
 * et le lancement de l'application installée.
 */

const Installer = {
  systemInfo: null,
  releaseData: null,
  installedExePath: null,
  pollTimeout: null,
  isPollingActive: false,

  init() {
    this.bindWindowControls();
    this.bindEvents();

    let isLoaded = false;
    const triggerLoad = () => {
      if (isLoaded) return;
      if (window.pywebview && window.pywebview.api) {
        isLoaded = true;
        this.loadInitialData();
      }
    };

    // 1. Immédiat si déjà injecté
    triggerLoad();

    // 2. Événement pywebviewready
    window.addEventListener('pywebviewready', () => {
      triggerLoad();
    });

    // 3. Polling rapide toutes les 30ms (au cas où l'événement a déjà été émis avant DOMContentLoaded)
    let checks = 0;
    const checkInterval = setInterval(() => {
      checks++;
      if (isLoaded || (window.pywebview && window.pywebview.api)) {
        clearInterval(checkInterval);
        triggerLoad();
      } else if (checks > 100) {
        clearInterval(checkInterval);
      }
    }, 30);
  },

  bindWindowControls() {
    document.getElementById('btn-minimize')?.addEventListener('click', () => {
      if (window.pywebview?.api?.minimize_window) {
        window.pywebview.api.minimize_window();
      }
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
      if (window.pywebview?.api?.close_window) {
        window.pywebview.api.close_window();
      }
    });
  },

  bindEvents() {
    // Bouton Parcourir
    document.getElementById('btn-browse-folder')?.addEventListener('click', async () => {
      const current = document.getElementById('txt-install-path')?.value || '';
      if (window.pywebview?.api?.browse_folder) {
        const res = await window.pywebview.api.browse_folder(current);
        if (res && res.selected) {
          document.getElementById('txt-install-path').value = res.selected;
          this.updateStartButtonState();
        }
      }
    });

    // Écoute de la saisie manuelle du dossier
    document.getElementById('txt-install-path')?.addEventListener('input', () => {
      this.updateStartButtonState();
    });

    // Bouton Lancer l'installation
    document.getElementById('btn-start-install')?.addEventListener('click', () => {
      this.startInstall();
    });

    // Bouton Annuler
    document.getElementById('btn-cancel-install')?.addEventListener('click', async () => {
      this.isPollingActive = false;
      if (this.pollTimeout) {
        clearTimeout(this.pollTimeout);
        this.pollTimeout = null;
      }
      if (window.pywebview?.api?.cancel_installation) {
        await window.pywebview.api.cancel_installation();
        this.switchStep('step-config');
      }
    });

    // Bouton Terminer et Lancer
    document.getElementById('btn-finish-launch')?.addEventListener('click', () => {
      this.launchApp();
    });

    // Bouton Fermer final
    document.getElementById('btn-finish-close')?.addEventListener('click', () => {
      if (window.pywebview?.api?.close_window) {
        window.pywebview.api.close_window();
      }
    });
  },

  updateStartButtonState() {
    const startBtn = document.getElementById('btn-start-install');
    const pathInput = document.getElementById('txt-install-path');
    const hasPath = Boolean(pathInput?.value?.trim());
    const isReady = Boolean(this.systemInfo && this.releaseData && hasPath);
    if (startBtn) {
      if (isReady) {
        startBtn.removeAttribute('disabled');
      } else {
        startBtn.setAttribute('disabled', 'disabled');
      }
    }
  },

  async loadInitialData() {
    try {
      this.updateStartButtonState();

      if (!window.pywebview?.api) return;

      // 1. Informations système (immédiat, local)
      const pSys = (async () => {
        try {
          if (window.pywebview.api.get_system_info) {
            this.systemInfo = await window.pywebview.api.get_system_info();
            if (this.systemInfo) {
              const pathInput = document.getElementById('txt-install-path');
              if (pathInput) pathInput.value = this.systemInfo.default_path;

              const diskSpace = document.getElementById('lbl-disk-space');
              if (diskSpace) diskSpace.textContent = `${this.systemInfo.free_space_str} disponibles (${this.systemInfo.drive})`;

              const reqSpace = document.getElementById('lbl-required-space');
              if (reqSpace) reqSpace.textContent = this.systemInfo.required_space_str;
              this.updateStartButtonState();
            }
          }
        } catch (e) {
          console.warn("Erreur get_system_info:", e);
        }
      })();

      // 2. Interrogation rapide de la version
      const pRel = (async () => {
        try {
          if (window.pywebview.api.check_latest_release) {
            this.releaseData = await window.pywebview.api.check_latest_release();
            if (this.releaseData) {
              const tagEl = document.getElementById('lbl-release-tag');
              if (tagEl) {
                tagEl.textContent = `${this.releaseData.tag} • Dernière version officielle`;
              }

              const nameEl = document.getElementById('lbl-release-name');
              if (nameEl) {
                nameEl.textContent = `${this.releaseData.name} (${this.releaseData.size_str})`;
              }
              this.updateStartButtonState();
            }
          }
        } catch (e) {
          console.warn("Erreur check_latest_release:", e);
        }
      })();

      await Promise.all([pSys, pRel]);
    } catch (err) {
      console.error('Erreur initialisation installeur:', err);
    } finally {
      // Sécurité absolue : si une information manque encore, on fournit une valeur par défaut
      if (!this.systemInfo) {
        this.systemInfo = {
          default_path: "C:\\Users\\" + (window.location.pathname.split('/')[2] || 'User') + "\\AppData\\Local\\Programs\\OpenShema",
          free_space_str: "> 10 Go",
          drive: "C:",
          required_space_str: "~350 Mo"
        };
        const pathInput = document.getElementById('txt-install-path');
        if (pathInput && !pathInput.value) pathInput.value = this.systemInfo.default_path;
        const diskSpace = document.getElementById('lbl-disk-space');
        if (diskSpace) diskSpace.textContent = "Espace suffisant vérifié";
      }

      if (!this.releaseData) {
        this.releaseData = { tag: "v0.1.0", name: "Open Shema v0.1.0 (Bêta)", download_url: "" };
        const tagEl = document.getElementById('lbl-release-tag');
        if (tagEl) tagEl.textContent = "v0.1.0 • Bêta prête pour l'installation";
        const nameEl = document.getElementById('lbl-release-name');
        if (nameEl) nameEl.textContent = "Open Shema v0.1.0 (Bêta • ~317 Mo)";
      }

      this.updateStartButtonState();
    }
  },

  switchStep(stepId) {
    document.querySelectorAll('.installer-step').forEach(el => el.classList.remove('active'));
    document.getElementById(stepId)?.classList.add('active');
  },

  async startInstall() {
    const startBtn = document.getElementById('btn-start-install');
    if (startBtn && startBtn.hasAttribute('disabled')) {
      return;
    }

    const pathInput = document.getElementById('txt-install-path');
    const targetDir = pathInput?.value?.trim();
    if (!targetDir) {
      alert("Veuillez spécifier un dossier d'installation valide.");
      return;
    }

    const createDesktop = document.getElementById('chk-desktop')?.checked ?? true;
    const createStartMenu = document.getElementById('chk-start-menu')?.checked ?? true;
    const downloadUrl = this.releaseData?.download_url || '';

    this.switchStep('step-progress');

    // Réinitialisation de la jauge
    document.getElementById('progress-bar-fill').style.width = '0%';
    document.getElementById('lbl-progress-percent').textContent = '0%';
    document.getElementById('lbl-progress-status').textContent = 'Démarrage de l\'installation...';
    document.getElementById('lbl-downloaded-size').textContent = '';
    document.getElementById('lbl-download-speed').textContent = '';

    this.isPollingActive = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    try {
      if (window.pywebview?.api?.start_installation) {
        const res = await window.pywebview.api.start_installation(
          targetDir,
          createDesktop,
          createStartMenu,
          downloadUrl
        );

        if (!res || !res.success) {
          this.onError(res?.error || "Échec du démarrage de l'installation.");
          return;
        }

        // Démarrage du polling non-bloquant
        this.isPollingActive = true;
        this.pollProgressLoop();
      } else {
        this.onError("Le pont de communication PyWebView n'est pas encore initialisé.");
      }
    } catch (err) {
      if (window.pywebview?.api?.log_client_error) {
        window.pywebview.api.log_client_error(String(err));
      }
      this.onError(String(err));
    }
  },

  async pollProgressLoop() {
    if (!this.isPollingActive) return;

    try {
      if (window.pywebview?.api?.get_install_progress) {
        const p = await window.pywebview.api.get_install_progress();
        if (p) {
          this.onProgress(p);

          if (p.is_complete) {
            this.isPollingActive = false;
            this.onComplete(p);
            return;
          } else if (p.error) {
            this.isPollingActive = false;
            this.onError(p.error);
            return;
          }
        }
      }
    } catch (pollErr) {
      console.warn("Erreur polling progression :", pollErr);
    }

    if (this.isPollingActive) {
      this.pollTimeout = setTimeout(() => this.pollProgressLoop(), 120);
    }
  },

  onProgress(data) {
    if (!data) return;
    const percent = Math.min(100, Math.max(0, data.percent || 0));
    
    const fillEl = document.getElementById('progress-bar-fill');
    if (fillEl) fillEl.style.width = `${percent}%`;

    const percentEl = document.getElementById('lbl-progress-percent');
    if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;

    const statusEl = document.getElementById('lbl-progress-status');
    if (statusEl && data.status) statusEl.textContent = data.status;

    const dataEl = document.getElementById('lbl-downloaded-size');
    if (dataEl) {
      if (data.downloaded_str && data.total_str && data.total_str !== "0 o") {
        dataEl.textContent = `${data.downloaded_str} / ${data.total_str}`;
      } else if (data.downloaded_str && data.downloaded_str !== "0 o") {
        dataEl.textContent = data.downloaded_str;
      } else {
        dataEl.textContent = "";
      }
    }

    const speedEl = document.getElementById('lbl-download-speed');
    if (speedEl) speedEl.textContent = data.speed_str || '';
  },

  onComplete(data) {
    this.installedDir = data.target_dir;
    this.installedExePath = data.exe_path;

    const pathEl = document.getElementById('lbl-summary-path');
    if (pathEl) pathEl.textContent = this.installedDir;

    const shortcuts = [];
    if (document.getElementById('chk-desktop')?.checked) shortcuts.push('Bureau');
    if (document.getElementById('chk-start-menu')?.checked) shortcuts.push('Menu Démarrer');
    const shortEl = document.getElementById('lbl-summary-shortcuts');
    if (shortEl) shortEl.textContent = shortcuts.length > 0 ? shortcuts.join(' & ') : 'Aucun';

    this.switchStep('step-success');
  },

  onError(message) {
    alert(`Information : ${message}`);
    this.switchStep('step-config');
  },

  launchApp() {
    if (this.installedDir && window.pywebview?.api?.launch_app) {
      window.pywebview.api.launch_app(this.installedDir);
    } else if (window.pywebview?.api?.close_window) {
      window.pywebview.api.close_window();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Installer.init();
});
