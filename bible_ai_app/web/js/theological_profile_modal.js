/**
 * Theological Profile & Onboarding Wizard Controller
 * Gere le questionnaire en 4 etapes pour le profil ministeriel, l ancrage ecclesial et la synthese IA.
 */

const TheologicalProfileModal = {
  currentStep: 1,
  totalSteps: 4,
  profileData: {},
  isSaving: false,
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
  },

  async checkOnboardingForAIView() {
    try {
      const profile = await API.call('get_theological_profile');
      if (profile && profile.onboarding_completed === false) {
        this.open();
        return true;
      }
    } catch (e) {
      console.warn('Verification profil initial IA :', e);
    }
    return false;
  },

  bindEvents() {
    const modal = document.getElementById('modal-theological-profile');
    if (!modal) return;

    document.getElementById('btn-close-profile-modal')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.close();
    });
    document.getElementById('btn-profile-skip')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.close();
    });

    document.getElementById('btn-profile-prev')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.prevStep();
    });
    document.getElementById('btn-profile-next')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.nextStep();
    });
    document.getElementById('btn-profile-submit')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitProfile();
    });

    // Delegation d'evenements robuste sur tout le conteneur
    modal.addEventListener('click', (e) => {
      // 1. Clic sur une carte d'option (Role, Niveau, Posture)
      const card = e.target.closest('.profile-option-card');
      if (card) {
        const group = card.getAttribute('data-group');
        if (group) {
          modal.querySelectorAll('.profile-option-card[data-group="' + group + '"]').forEach(c => {
            c.classList.remove('selected');
          });
          card.classList.add('selected');
        }
        return;
      }

      // 2. Clic sur une puce Bible (Selection multiple)
      const chip = e.target.closest('.profile-bible-chip');
      if (chip) {
        chip.classList.toggle('selected');
        return;
      }

      // 3. Clic sur un point d'etape
      const dot = e.target.closest('.profile-step-dot');
      if (dot) {
        const stepNum = parseInt(dot.getAttribute('data-step'), 10);
        if (stepNum && stepNum >= 1 && stepNum <= this.totalSteps) {
          this.currentStep = stepNum;
          this.updateStepView();
        }
      }
    });
  },

  async open() {
    this.init();

    const modal = document.getElementById('modal-theological-profile');
    if (!modal) return;

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

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

  playSuccessSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Accord majeur lumineux & zen : Do5 (523Hz) -> Mi5 (659Hz) -> Sol5 (784Hz) -> Do6 (1046Hz)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.14, now + i * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.7);
      });
    } catch (err) {
      console.debug('Audio not available:', err);
    }
  },

  async submitProfile() {
    if (this.isSaving) return;
    this.isSaving = true;

    const data = this.collectFormData();
    const loadingOverlay = document.getElementById('profile-loading-overlay');
    const loadingContent = document.getElementById('profile-overlay-loading-content');
    const successContent = document.getElementById('profile-overlay-success-content');

    if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
      if (loadingContent) loadingContent.style.display = 'flex';
      if (successContent) successContent.classList.add('hidden');
    }

    try {
      const result = await API.call('save_theological_profile', data, true);
      if (result && result.success) {
        // 1. Déclencher le son de succès harmonieux
        this.playSuccessSound();

        // 2. Afficher le vu vert animé
        if (loadingContent) loadingContent.style.display = 'none';
        if (successContent) successContent.classList.remove('hidden');

        // 3. Mettre à jour les vues
        if (typeof SettingsView !== 'undefined' && SettingsView.loadTheologicalProfileCard) {
          SettingsView.loadTheologicalProfileCard();
        }

        if (typeof AIStudyView !== 'undefined' && AIStudyView.loadTheologicalProfileBadge) {
          AIStudyView.loadTheologicalProfileBadge();
        }

        // 4. Laisser l'animation du vu vert et le son se jouer
        await new Promise(r => setTimeout(r, 1400));

        this.close();

        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Profil théologique et alignement IA enregistrés avec succès !');
        }
      } else {
        alert('Erreur lors de l\'enregistrement du profil.');
      }
    } catch (e) {
      console.error('Erreur sauvegarde profil :', e);
      alert('Erreur : ' + (e?.message || e));
    } finally {
      this.isSaving = false;
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      if (loadingContent) loadingContent.style.display = 'flex';
      if (successContent) successContent.classList.add('hidden');
    }
  }
};

window.TheologicalProfileModal = TheologicalProfileModal;