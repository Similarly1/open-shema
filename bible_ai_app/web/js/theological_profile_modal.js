/**
 * Theological Profile & Onboarding Wizard Controller
 * Gere le questionnaire en 4 etapes pour le profil ministeriel, l ancrage ecclesial et la synthese IA.
 */

const TheologicalProfileModal = {
  currentStep: 1,
  totalSteps: 4,
  profileData: {},
  isSaving: false,

  init() {
    this.bindEvents();
    this.checkInitialOnboarding();
  },

  async checkInitialOnboarding() {
    try {
      const profile = await API.call('get_theological_profile');
      if (profile && profile.onboarding_completed === false) {
        setTimeout(() => {
          this.open();
        }, 1200);
      }
    } catch (e) {
      console.warn('Verification profil initial :', e);
    }
  },

  bindEvents() {
    document.getElementById('btn-close-profile-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-profile-skip')?.addEventListener('click', () => this.close());

    document.getElementById('btn-profile-prev')?.addEventListener('click', () => this.prevStep());
    document.getElementById('btn-profile-next')?.addEventListener('click', () => this.nextStep());
    document.getElementById('btn-profile-submit')?.addEventListener('click', () => this.submitProfile());

    document.querySelectorAll('.profile-option-card').forEach(card => {
      card.addEventListener('click', () => {
        const group = card.getAttribute('data-group');
        if (group) {
          document.querySelectorAll('.profile-option-card[data-group="' + group + '"]').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });
    });

    document.querySelectorAll('.profile-bible-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
      });
    });
  },

  async open() {
    const modal = document.getElementById('modal-theological-profile');
    if (!modal) return;

    this.currentStep = 1;
    this.updateStepView();

    try {
      this.profileData = await API.call('get_theological_profile') || {};
      this.populateForm(this.profileData);
    } catch (e) {
      console.error('Erreur chargement profil existant :', e);
    }

    modal.classList.remove('hidden');
  },

  close() {
    const modal = document.getElementById('modal-theological-profile');
    if (modal) modal.classList.add('hidden');
  },

  populateForm(data) {
    const role = data.user_role || 'predication';
    document.querySelectorAll('.profile-option-card[data-group="user_role"]').forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-value') === role);
    });

    const bibles = data.preferred_bibles || ['LSG1910', 'NBS'];
    document.querySelectorAll('.profile-bible-chip').forEach(chip => {
      chip.classList.toggle('selected', bibles.includes(chip.getAttribute('data-val')));
    });

    const level = data.greek_hebrew_level || 'intermediaire';
    document.querySelectorAll('.profile-option-card[data-group="greek_hebrew_level"]').forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-value') === level);
    });

    const posture = data.ai_posture || 'pastoral_sparring';
    document.querySelectorAll('.profile-option-card[data-group="ai_posture"]').forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-value') === posture);
    });

    const countryEl = document.getElementById('profile-input-country');
    if (countryEl) countryEl.value = data.country_culture || 'France (Metropole & Outre-mer)';

    const notesEl = document.getElementById('profile-input-cultural-notes');
    if (notesEl) notesEl.value = data.cultural_notes || '';

    const tradEl = document.getElementById('profile-input-tradition');
    if (tradEl) tradEl.value = data.tradition || 'Evangelique / Reformee';

    const confEl = document.getElementById('profile-input-confession');
    if (confEl) confEl.value = data.church_confession_raw || '';
  },

  collectFormData() {
    const selectedRole = document.querySelector('.profile-option-card[data-group="user_role"].selected')?.getAttribute('data-value') || 'predication';
    
    const selectedBibles = [];
    document.querySelectorAll('.profile-bible-chip.selected').forEach(ch => {
      const v = ch.getAttribute('data-val');
      if (v) selectedBibles.push(v);
    });

    const selectedLevel = document.querySelector('.profile-option-card[data-group="greek_hebrew_level"].selected')?.getAttribute('data-value') || 'intermediaire';
    const selectedPosture = document.querySelector('.profile-option-card[data-group="ai_posture"].selected')?.getAttribute('data-value') || 'pastoral_sparring';

    const country = document.getElementById('profile-input-country')?.value || 'France (Metropole & Outre-mer)';
    const culturalNotes = document.getElementById('profile-input-cultural-notes')?.value.trim() || '';
    const tradition = document.getElementById('profile-input-tradition')?.value || 'Evangelique / Reformee';
    const confessionRaw = document.getElementById('profile-input-confession')?.value.trim() || '';

    return {
      user_role: selectedRole,
      preferred_bibles: selectedBibles.length > 0 ? selectedBibles : ['LSG1910'],
      greek_hebrew_level: selectedLevel,
      ai_posture: selectedPosture,
      country_culture: country,
      cultural_notes: culturalNotes,
      tradition: tradition,
      church_confession_raw: confessionRaw,
      onboarding_completed: true
    };
  },

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateStepView();
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepView();
    }
  },

  updateStepView() {
    document.querySelectorAll('.profile-wizard-step').forEach(stepEl => {
      const stepNum = parseInt(stepEl.getAttribute('data-step'), 10);
      stepEl.classList.toggle('active', stepNum === this.currentStep);
    });

    document.querySelectorAll('.profile-step-dot').forEach(dot => {
      const stepNum = parseInt(dot.getAttribute('data-step'), 10);
      dot.classList.toggle('active', stepNum === this.currentStep);
      dot.classList.toggle('completed', stepNum < this.currentStep);
    });

    const btnPrev = document.getElementById('btn-profile-prev');
    const btnNext = document.getElementById('btn-profile-next');
    const btnSubmit = document.getElementById('btn-profile-submit');

    if (btnPrev) btnPrev.classList.toggle('hidden', this.currentStep === 1);
    if (btnNext) btnNext.classList.toggle('hidden', this.currentStep === this.totalSteps);
    if (btnSubmit) btnSubmit.classList.toggle('hidden', this.currentStep !== this.totalSteps);

    const stepLabels = [
      "\u00c9tape 1 sur 4 : Minist\u00e8re & Cadre d'utilisation",
      "\u00c9tape 2 sur 4 : Pr\u00e9f\u00e9rences Textuelles & Langues",
      "\u00c9tape 3 sur 4 : Posture & Ton de l'Assistant",
      "\u00c9tape 4 sur 4 : Mon \u00c9glise, Pays & Confession de foi"
    ];
    const subTitleEl = document.getElementById('profile-modal-subtitle');
    if (subTitleEl) subTitleEl.textContent = stepLabels[this.currentStep - 1] || '';
  },

  async submitProfile() {
    if (this.isSaving) return;
    this.isSaving = true;

    const data = this.collectFormData();
    const loadingOverlay = document.getElementById('profile-loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
      const result = await API.call('save_theological_profile', data, true);
      if (result && result.success) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Profil th\u00e9ologique et alignement IA enregistr\u00e9s avec succ\u00e8s !');
        }
        
        if (typeof SettingsView !== 'undefined' && SettingsView.loadTheologicalProfileCard) {
          SettingsView.loadTheologicalProfileCard();
        }

        this.close();
      } else {
        alert('Erreur lors de l\'enregistrement du profil.');
      }
    } catch (e) {
      console.error('Erreur sauvegarde profil :', e);
      alert('Erreur : ' + (e?.message || e));
    } finally {
      this.isSaving = false;
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  }
};

window.TheologicalProfileModal = TheologicalProfileModal;