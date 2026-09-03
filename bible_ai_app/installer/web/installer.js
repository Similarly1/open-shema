/**
 * Open Shema — Logique Client de l'Installeur (PyWebView)
 * Gère l'interaction utilisateur, la sélection de dossier, le polling en direct
 * et le lancement de l'application installée.
 */

const Installer = {
  systemInfo: null,
  releaseData: null,
  installedExePath: null,
  installedDir: null,
  progressInterval: null,

  async init() {
    this.bindWindowControls();
    this.bindEvents();

    if (window.pywebview && window.pywebview.api) {
      await this.loadInitialData();
    } else {
      window.addEventListener('pywebviewready', async () => {
        await this.loadInitialData();
      });
    }
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
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
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

      // 1. Informations système (chemin par défaut et espace libre)
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

      // 2. Interrogation de la release GitHub
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
        }
      }
    } catch (err) {
      console.error('Erreur initialisation installeur:', err);
    } finally {
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
    document.getElementById('lbl-progress-status').textContent = 'Démarrage...';
    document.getElementById('lbl-downloaded-size').textContent = '0 Mo';
    document.getElementById('lbl-download-speed').textContent = '';

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
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

        // Polling régulier de l'état de progression (100% robuste, zéro blocage)
        this.progressInterval = setInterval(async () => {
          try {
            if (!window.pywebview?.api?.get_install_progress) return;
            const p = await window.pywebview.api.get_install_progress();
            if (!p) return;

            this.onProgress(p);

            if (p.is_complete) {
              clearInterval(this.progressInterval);
              this.progressInterval = null;
              this.onComplete(p);
            } else if (p.error) {
              clearInterval(this.progressInterval);
              this.progressInterval = null;
              this.onError(p.error);
            }
          } catch (pollErr) {
            console.warn("Erreur polling progression :", pollErr);
          }
        }, 120);
      }
    } catch (err) {
      this.onError(String(err));
    }
  },

  onProgress(data) {
    if (!data) return;
    const percent = data.percent || 0;
    
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
