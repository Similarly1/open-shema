/**
 * Report Typo / Erreur Modal Controller
 * Permet aux utilisateurs de signaler une coquille ou une faute sur un article ou un chapitre.
 */
const ReportTypoModal = {
  initialized: false,
  currentContext: {
    bookTitle: '',
    entryTitle: '',
    selectedText: ''
  },

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
  },

  bindEvents() {
    const modal = document.getElementById('modal-report-typo');
    if (!modal) return;

    // Fermer la modale
    document.getElementById('btn-close-report-typo-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-report-typo')?.addEventListener('click', () => this.close());

    // Clic en dehors
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Échap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.close();
      }
    });

    // Formulaire de soumission
    const form = document.getElementById('form-report-typo');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitReport();
    });
  },

  open(context = {}) {
    this.init();
    const modal = document.getElementById('modal-report-typo');
    if (!modal) return;

    // Capturer la sélection utilisateur si présente
    let selText = context.selectedText || '';
    if (!selText) {
      try {
        selText = window.getSelection()?.toString().trim() || '';
      } catch (e) {}
    }

    this.currentContext = {
      bookTitle: context.bookTitle || 'Ouvrage Open Shema',
      entryTitle: context.entryTitle || 'Article courant',
      selectedText: selText
    };

    // Remplir les champs de la modale
    const targetBookEl = document.getElementById('report-typo-book');
    const targetEntryEl = document.getElementById('report-typo-entry');
    const extractInput = document.getElementById('report-typo-extract');
    const commentInput = document.getElementById('report-typo-comment');
    const emailInput = document.getElementById('report-typo-email');
    const btnSubmit = document.getElementById('btn-submit-report-typo');

    if (targetBookEl) targetBookEl.textContent = this.currentContext.bookTitle;
    if (targetEntryEl) targetEntryEl.textContent = this.currentContext.entryTitle;
    if (extractInput) extractInput.value = this.currentContext.selectedText;
    if (commentInput) commentInput.value = '';
    
    // Restaurer l'email précédent si sauvegardé
    if (emailInput) {
      try {
        emailInput.value = localStorage.getItem('user_feedback_email') || '';
      } catch (e) {}
    }

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        <span>Envoyer le signalement</span>
      `;
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
      if (commentInput) commentInput.focus();
    }, 100);
  },

  close() {
    const modal = document.getElementById('modal-report-typo');
    if (modal) modal.classList.add('hidden');
  },

  async submitReport() {
    const comment = document.getElementById('report-typo-comment')?.value.trim();
    const extract = document.getElementById('report-typo-extract')?.value.trim();
    const email = document.getElementById('report-typo-email')?.value.trim();
    const btnSubmit = document.getElementById('btn-submit-report-typo');

    if (!comment) {
      App.showToast('Veuillez décrire brièvement la coquille ou correction.', 'warning');
      return;
    }

    if (email) {
      try {
        localStorage.setItem('user_feedback_email', email);
      } catch (e) {}
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `
        <span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 6px;">⏳</span>
        <span>Transmission...</span>
      `;
    }

    try {
      const res = await API.call('report_typo', this.currentContext.bookTitle, this.currentContext.entryTitle, extract, comment, email);
      if (res && res.success) {
        App.showToast('Merci ! Votre signalement de coquille a été transmis avec succès.', 'success');
        this.close();
      } else {
        App.showToast('Erreur lors de la transmission : ' + (res?.error || 'Erreur réseau'), 'error');
      }
    } catch (e) {
      App.showToast('Erreur lors de l\'envoi du signalement : ' + e, 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          <span>Envoyer le signalement</span>
        `;
      }
    }
  }
};
