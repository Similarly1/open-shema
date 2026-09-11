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

    const startRoutine = () => {
      this.loadSettings();
      // Vérification automatique au démarrage selon la fréquence configurée (défaut : à chaque ouverture)
      setTimeout(() => {
        this.checkUpdates(false);
      }, 1500);
    };

    if (window.API && typeof window.API.onReady === 'function') {
      window.API.onReady(startRoutine);
    } else if (window.pywebview?.api) {
      startRoutine();
    } else {
      window.addEventListener('pywebviewready', startRoutine, { once: true });
      setTimeout(startRoutine, 2500);
    }
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
        // Fréquence radio (défaut 'startup')
        const freq = res.update_frequency || 'startup';
        const radio = document.querySelector(`input[name="opt-update-frequency"][value="${freq}"]`);
        if (radio) {
          radio.checked = true;
        } else {
          const defRadio = document.querySelector('input[name="opt-update-frequency"][value="startup"]');
          if (defRadio) defRadio.checked = true;
        }

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

      if (res && res.is_store) {
        this.renderStoreMode(res);
        return;
      }

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

  renderStoreMode(res) {
    this.hideUpdateAvailable();
    const badge = document.getElementById('lbl-update-status-badge');
    if (badge) {
      badge.textContent = `Version Store (${res?.current_version || '0.3.0'})`;
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
      badge.style.color = '#34d399';
    }
    const desc = document.getElementById('lbl-update-status-desc');
    if (desc) {
      desc.textContent = "Cette version d'Open Shema est distribuée via le Microsoft Store. Vos mises à jour sont vérifiées, signées et déployées automatiquement par Windows.";
    }
    const btnCheckNow = document.getElementById('btn-check-updates-now');
    if (btnCheckNow) {
      btnCheckNow.style.display = 'none';
    }
    const lastCheck = document.getElementById('lbl-last-check-time');
    if (lastCheck) {
      lastCheck.textContent = "Gestion transparente par Windows Store";
    }
    const topbarBtn = document.getElementById('topbar-update-btn');
    if (topbarBtn) {
      topbarBtn.classList.add('hidden');
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
      notesEl.innerHTML = this.renderMarkdown(info.release_notes || "Mise à jour d'optimisations et de fonctionnalités.");
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

  renderMarkdown(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return '<p style="color: var(--text-muted, #94a3b8); font-style: italic; margin: 0;">Aucune note de version fournie.</p>';
    }

    // Échapper les balises HTML brutes pour la sécurité
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = safe.split(/\r?\n/);
    let html = '';
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Ligne vide
      if (!line) {
        closeLists();
        continue;
      }

      // Séparateurs horizontaux (--- ou ***)
      if (/^(\-{3,}|\*{3,})$/.test(line)) {
        closeLists();
        html += '<hr style="border: none; border-top: 1px solid var(--border-color, rgba(255,255,255,0.12)); margin: 12px 0;">';
        continue;
      }

      // Titres H1 à H4
      const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        closeLists();
        const level = hMatch[1].length;
        const title = this.formatInline(hMatch[2]);
        const fontSize = level === 1 ? '14px' : level === 2 ? '13px' : '12.5px';
        const marginTop = i === 0 ? '2px' : '12px';
        html += `<h${level + 1} style="font-size: ${fontSize}; font-weight: 700; color: var(--accent-primary, #0284c7); margin: ${marginTop} 0 6px 0; letter-spacing: -0.1px;">${title}</h${level + 1}>`;
        continue;
      }

      // Liste à puces (- item, * item, + item)
      const ulMatch = line.match(/^[-*+]\s+(.+)$/);
      if (ulMatch) {
        if (inOl) { html += '</ol>'; inOl = false; }
        if (!inUl) {
          html += '<ul style="margin: 4px 0 8px 18px; padding: 0; list-style-type: disc;">';
          inUl = true;
        }
        const itemContent = this.formatInline(ulMatch[1]);
        html += `<li style="margin-bottom: 5px; line-height: 1.5; color: var(--text-primary);">${itemContent}</li>`;
        continue;
      }

      // Liste numérotée (1. item)
      const olMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
      if (olMatch) {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (!inOl) {
          html += '<ol style="margin: 4px 0 8px 18px; padding: 0;">';
          inOl = true;
        }
        const itemContent = this.formatInline(olMatch[2]);
        html += `<li style="margin-bottom: 5px; line-height: 1.5; color: var(--text-primary);">${itemContent}</li>`;
        continue;
      }

      // Citations (> quote)
      const qMatch = line.match(/^&gt;\s*(.+)$/);
      if (qMatch) {
        closeLists();
        const qContent = this.formatInline(qMatch[1]);
        html += `<blockquote style="margin: 8px 0; padding: 6px 12px; border-left: 3px solid var(--accent-primary, #0284c7); background: var(--bg-subtle, rgba(255,255,255,0.03)); color: var(--text-secondary); font-style: italic; border-radius: 0 4px 4px 0;">${qContent}</blockquote>`;
        continue;
      }

      // Paragraphe standard
      closeLists();
      html += `<p style="margin: 0 0 8px 0; line-height: 1.55; color: var(--text-primary);">${this.formatInline(line)}</p>`;
    }

    closeLists();
    return html;
  },

  formatInline(str) {
    if (!str) return '';
    return str
      // Liens [texte](url)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary, #0284c7); text-decoration: underline; text-underline-offset: 2px;">$1</a>')
      // Gras **texte** ou __texte__
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>')
      .replace(/__([^_]+)__/g, '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>')
      // Italique *texte* ou _texte_
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
      // Code inline `code`
      .replace(/`([^`]+)`/g, '<code style="background: var(--bg-subtle, rgba(255,255,255,0.08)); padding: 1.5px 5px; border-radius: 3px; font-family: monospace; font-size: 11px; color: var(--accent-gold, #f59e0b); border: 1px solid var(--border-color, rgba(255,255,255,0.1));">$1</code>');
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
