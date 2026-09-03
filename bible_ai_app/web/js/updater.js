/**
 * Open Shema — Contrôleur Client des Mises à Jour In-App
 * Gère la vérification en arrière-plan, le bouton discret dans la barre de titre,
 * la progression non bloquante et la bascule au redémarrage.
 * Zéro émoji, 100% SVG vectoriel.
 */

const AppUpdater = {
  state: {
    isChecking: false,
    isDownloading: false,
    isReadyToRestart: false,
    updateInfo: null,
    pollTimer: null
  },

  init() {
    this.bindEvents();
    this.loadSettings();

    // Vérification automatique au démarrage selon la fréquence configurée
    setTimeout(() => {
      this.checkUpdates(false);
    }, 2500);
  },

  bindEvents() {
    // 1. Clic sur le bouton de la barre supérieure
    const topbarBtn = document.getElementById('topbar-update-btn');
    if (topbarBtn) {
      topbarBtn.addEventListener('click', () => {
        if (this.state.isReadyToRestart) {
          this.applyRestart();
        } else if (!this.state.isDownloading) {
          this.startUpdate();
        }
      });
    }

    // 2. Bouton "Rechercher des mises à jour" dans les Paramètres
    const btnCheckNow = document.getElementById('btn-check-updates-now');
    if (btnCheckNow) {
      btnCheckNow.addEventListener('click', () => {
        this.checkUpdates(true);
      });
    }

    // 3. Bouton d'action dans la carte Paramètres
    const btnAction = document.getElementById('btn-start-update-action');
    if (btnAction) {
      btnAction.addEventListener('click', () => {
        if (this.state.isReadyToRestart) {
          this.applyRestart();
        } else if (!this.state.isDownloading) {
          this.startUpdate();
        }
      });
    }

    // 4. Radio fréquence de mise à jour
    document.querySelectorAll('input[name="opt-update-frequency"]').forEach(r => {
      r.addEventListener('change', async (e) => {
        const val = e.target.value;
        if (window.pywebview?.api?.save_update_settings) {
          try {
            await window.pywebview.api.save_update_settings(val);
          } catch (err) {
            console.error("Erreur sauvegarde fréquence mise à jour:", err);
          }
        }
      });
    });
  },

  async loadSettings() {
    if (!window.pywebview?.api?.get_update_settings) return;
    try {
      const res = await window.pywebview.api.get_update_settings();
      if (res) {
        // Fréquence radio
        const freq = res.update_frequency || 'startup';
        const radio = document.querySelector(`input[name="opt-update-frequency"][value="${freq}"]`);
        if (radio) radio.checked = true;

        // Badge version
        const badge = document.getElementById('lbl-update-status-badge');
        if (badge && res.current_version) {
          badge.textContent = `Version ${res.current_version}`;
        }

        // Dernière vérification
        this.renderLastCheckTime(res.last_update_check);
      }
    } catch (e) {
      console.warn("Impossible de charger les paramètres de mise à jour:", e);
    }
  },

  renderLastCheckTime(timestamp) {
    const el = document.getElementById('lbl-last-check-time');
    if (!el) return;
    if (!timestamp || timestamp <= 0) {
      el.textContent = "Dernière vérification : Jamais";
      return;
    }
    const d = new Date(timestamp * 1000);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    el.textContent = `Dernière vérification : ${dateStr} à ${timeStr}`;
  },

  async checkUpdates(force = false) {
    if (this.state.isChecking || this.state.isDownloading) return;
    if (!window.pywebview?.api?.check_for_updates) return;

    this.state.isChecking = true;
    this.setCheckButtonState(true);

    try {
      const res = await window.pywebview.api.check_for_updates(force);
      this.state.isChecking = false;
      this.setCheckButtonState(false);

      if (res && res.last_check) {
        this.renderLastCheckTime(res.last_check);
      } else {
        this.renderLastCheckTime(Math.floor(Date.now() / 1000));
      }

      if (res && res.update_available) {
        this.state.updateInfo = res;
        this.showUpdateAvailable(res);
      } else {
        this.hideUpdateAvailable();
        if (force) {
          const desc = document.getElementById('lbl-update-status-desc');
          if (desc) {
            desc.textContent = "Vous disposez actuellement de la version la plus récente d'Open Shema.";
          }
        }
      }
    } catch (err) {
      this.state.isChecking = false;
      this.setCheckButtonState(false);
      console.warn("Erreur vérification mise à jour:", err);
    }
  },

  setCheckButtonState(isBusy) {
    const btn = document.getElementById('btn-check-updates-now');
    const textEl = document.getElementById('lbl-check-updates-btn-text');
    const spinIcon = document.getElementById('icon-check-updates-spin');
    if (btn) btn.disabled = isBusy;
    if (textEl) {
      textEl.textContent = isBusy ? "Vérification en cours..." : "Rechercher des mises à jour";
    }
    if (spinIcon) {
      spinIcon.classList.toggle('spin-icon', isBusy);
    }
  },

  showUpdateAvailable(info) {
    const latest = info.latest_version || 'v1.0.1';

    // 1. Bouton Topbar
    const topbarBtn = document.getElementById('topbar-update-btn');
    const topbarText = document.getElementById('topbar-update-text');
    if (topbarBtn && topbarText) {
      topbarText.textContent = `Mettre à jour (${latest})`;
      topbarBtn.classList.remove('hidden', 'downloading', 'ready-restart');
      topbarBtn.title = `Une nouvelle version (${latest}) est disponible. Cliquez pour lancer le téléchargement en arrière-plan.`;
    }

    // 2. Carte dans Paramètres
    const card = document.getElementById('update-available-card');
    const titleEl = document.getElementById('lbl-update-available-title');
    const metaEl = document.getElementById('lbl-update-available-meta');
    const notesEl = document.getElementById('lbl-update-release-notes');

    if (card) card.classList.remove('hidden');
    if (titleEl) titleEl.textContent = `Nouvelle version ${latest} disponible`;
    if (metaEl) {
      const sizeStr = info.download_size_str || '~300 Mo';
      metaEl.textContent = `Taille de la mise à jour : ${sizeStr}`;
    }
    if (notesEl) {
      notesEl.textContent = info.release_notes || "Mise à jour d'optimisations et de fonctionnalités.";
    }
  },

  hideUpdateAvailable() {
    if (!this.state.isDownloading && !this.state.isReadyToRestart) {
      const topbarBtn = document.getElementById('topbar-update-btn');
      if (topbarBtn) topbarBtn.classList.add('hidden');

      const card = document.getElementById('update-available-card');
      if (card) card.classList.add('hidden');
    }
  },

  async startUpdate() {
    if (this.state.isDownloading || this.state.isReadyToRestart) return;
    if (!window.pywebview?.api?.start_background_update) return;

    this.state.isDownloading = true;

    // Mise à jour de l'apparence du bouton Topbar
    const topbarBtn = document.getElementById('topbar-update-btn');
    const topbarText = document.getElementById('topbar-update-text');
    const spinner = document.getElementById('topbar-update-spinner');
    const icon = document.getElementById('topbar-update-icon');

    if (topbarBtn) topbarBtn.classList.add('downloading');
    if (topbarText) topbarText.textContent = "Téléchargement 1%";
    if (spinner) spinner.classList.remove('hidden');
    if (icon) icon.classList.add('hidden');

    // Mise à jour de la carte Paramètres
    const btnAction = document.getElementById('btn-start-update-action');
    const textAction = document.getElementById('lbl-start-update-action-text');
    const pBox = document.getElementById('update-settings-progress-box');

    if (btnAction) btnAction.disabled = true;
    if (textAction) textAction.textContent = "Téléchargement en cours...";
    if (pBox) pBox.classList.remove('hidden');

    try {
      const res = await window.pywebview.api.start_background_update();
      if (!res || !res.success) {
        this.onError(res?.error || "Échec de l'initialisation du téléchargement.");
        return;
      }
      this.pollProgressLoop();
    } catch (err) {
      this.onError(String(err));
    }
  },

  async pollProgressLoop() {
    if (!this.state.isDownloading) return;

    try {
      if (window.pywebview?.api?.get_update_progress) {
        const p = await window.pywebview.api.get_update_progress();
        if (p) {
          this.onProgress(p);

          if (p.status === 'ready_to_restart') {
            this.state.isDownloading = false;
            this.state.isReadyToRestart = true;
            this.onReadyToRestart();
            return;
          } else if (p.status === 'error') {
            this.state.isDownloading = false;
            this.onError(p.error || "Une erreur est survenue pendant le téléchargement.");
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Erreur polling mise à jour:", e);
    }

    if (this.state.isDownloading) {
      setTimeout(() => this.pollProgressLoop(), 150);
    }
  },

  onProgress(p) {
    const percent = Math.round(p.percent || 0);

    // Topbar
    const topbarText = document.getElementById('topbar-update-text');
    const topbarBar = document.getElementById('topbar-update-progress-bar');
    if (topbarText) {
      if (percent >= 90) {
        topbarText.textContent = "Préparation des fichiers...";
      } else {
        topbarText.textContent = `Téléchargement ${percent}%`;
      }
    }
    if (topbarBar) {
      topbarBar.style.width = `${percent}%`;
    }

    // Paramètres
    const lblStatus = document.getElementById('lbl-update-progress-status');
    const lblPercent = document.getElementById('lbl-update-progress-percent');
    const barProgress = document.getElementById('bar-update-settings-progress');

    if (lblPercent) lblPercent.textContent = `${percent}%`;
    if (barProgress) barProgress.style.width = `${percent}%`;
    if (lblStatus) {
      if (p.speed_str) {
        lblStatus.textContent = `Téléchargement : ${p.downloaded_str || ''} / ${p.total_str || ''} (${p.speed_str})`;
      } else {
        lblStatus.textContent = percent >= 90 ? "Extraction et préparation..." : "Téléchargement en cours...";
      }
    }
  },

  onReadyToRestart() {
    // 1. Bouton Topbar
    const topbarBtn = document.getElementById('topbar-update-btn');
    const topbarText = document.getElementById('topbar-update-text');
    const spinner = document.getElementById('topbar-update-spinner');
    const icon = document.getElementById('topbar-update-icon');
    const topbarBar = document.getElementById('topbar-update-progress-bar');

    if (topbarBar) topbarBar.style.width = '100%';
    if (spinner) spinner.classList.add('hidden');
    if (icon) {
      icon.classList.remove('hidden');
      icon.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>`;
    }
    if (topbarText) {
      topbarText.textContent = "Redémarrer Open Shema";
    }
    if (topbarBtn) {
      topbarBtn.classList.remove('downloading');
      topbarBtn.classList.add('ready-restart');
      topbarBtn.title = "La mise à jour est prête. Cliquez ici pour redémarrer et appliquer la nouvelle version.";
    }

    // 2. Paramètres
    const btnAction = document.getElementById('btn-start-update-action');
    const textAction = document.getElementById('lbl-start-update-action-text');
    const iconAction = document.getElementById('icon-start-update-btn');
    const lblStatus = document.getElementById('lbl-update-progress-status');

    if (btnAction) {
      btnAction.disabled = false;
      btnAction.classList.add('btn-success');
    }
    if (textAction) textAction.textContent = "Redémarrer pour appliquer";
    if (iconAction) {
      iconAction.innerHTML = `<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path>`;
    }
    if (lblStatus) {
      lblStatus.textContent = "Mise à jour prête. Redémarrez le logiciel pour finaliser.";
    }

    // Toast de notification si le gestionnaire est présent
    if (window.NotificationManager?.notify) {
      window.NotificationManager.notify({
        title: "Mise à jour prête",
        message: "La nouvelle version d'Open Shema a été téléchargée. Cliquez sur Redémarrer pour l'appliquer.",
        type: "info"
      });
    }
  },

  onError(message) {
    this.state.isDownloading = false;
    const topbarBtn = document.getElementById('topbar-update-btn');
    if (topbarBtn) topbarBtn.classList.remove('downloading');

    const spinner = document.getElementById('topbar-update-spinner');
    if (spinner) spinner.classList.add('hidden');

    const icon = document.getElementById('topbar-update-icon');
    if (icon) icon.classList.remove('hidden');

    const btnAction = document.getElementById('btn-start-update-action');
    if (btnAction) btnAction.disabled = false;

    const lblStatus = document.getElementById('lbl-update-progress-status');
    if (lblStatus) lblStatus.textContent = `Erreur : ${message}`;

    console.error("Erreur mise à jour:", message);
  },

  async applyRestart() {
    const topbarBtn = document.getElementById('topbar-update-btn');
    const topbarText = document.getElementById('topbar-update-text');
    const btnAction = document.getElementById('btn-start-update-action');
    const textAction = document.getElementById('lbl-start-update-action-text');

    if (topbarBtn) topbarBtn.disabled = true;
    if (topbarText) topbarText.textContent = "Redémarrage en cours...";
    if (btnAction) btnAction.disabled = true;
    if (textAction) textAction.textContent = "Redémarrage en cours...";

    try {
      if (window.pywebview?.api?.apply_update_and_restart) {
        await window.pywebview.api.apply_update_and_restart();
      }
    } catch (e) {
      console.error("Erreur lors de la demande de redémarrage:", e);
    }
  }
};

// Initialisation dès que le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AppUpdater.init());
} else {
  AppUpdater.init();
}
