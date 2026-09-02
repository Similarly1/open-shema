/**
 * Open Shema — Logique Client de l'Installeur (PyWebView)
 * Gère l'interaction utilisateur, la sélection de dossier, le suivi en direct
 * et le lancement de l'application installée.
 */

const Installer = {
  systemInfo: null,
  releaseData: null,
  installedExePath: null,
  installedDir: null,

  async init() {
    this.bindWindowControls();
    this.bindEvents();

    // Attendre que le pont pywebview soit prêt
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
        }
      }
    });

    // Bouton Lancer l'installation
    document.getElementById('btn-start-install')?.addEventListener('click', () => {
      this.startInstall();
    });

    // Bouton Annuler
    document.getElementById('btn-cancel-install')?.addEventListener('click', async () => {
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
      if (document.getElementById('chk-launch-now')?.checked) {
        this.launchApp();
      } else if (window.pywebview?.api?.close_window) {
        window.pywebview.api.close_window();
      }
    });
  },

  async loadInitialData() {
    try {
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
    }
  },

  switchStep(stepId) {
    document.querySelectorAll('.installer-step').forEach(el => el.classList.remove('active'));
    document.getElementById(stepId)?.classList.add('active');
  },

  async startInstall() {
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
    document.getElementById('lbl-progress-status').textContent = 'Initialisation...';
    document.getElementById('lbl-downloaded-size').textContent = '0 Mo';
    document.getElementById('lbl-download-speed').textContent = '';

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
        }
      }
    } catch (err) {
      this.onError(String(err));
    }
  },

  // Callback appelé depuis Python lors du suivi du téléchargement et extraction
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
    if (dataEl && data.downloaded_str) {
      dataEl.textContent = `${data.downloaded_str} / ${data.total_str || '?'}`;
    }

    const speedEl = document.getElementById('lbl-download-speed');
    if (speedEl) speedEl.textContent = data.speed_str || '';
  },

  // Callback appelé depuis Python à la fin réussie
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

  // Callback appelé en cas d'erreur
  onError(message) {
    alert(`Erreur d'installation : ${message}`);
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

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  Installer.init();
});
