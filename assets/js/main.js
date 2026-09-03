/**
 * OPEN SHEMA (שְׁמַע) - MAIN CLIENT-SIDE JAVASCRIPT
 * Interactions, Scroll-driven animations, Interactive Simulators & Lightbox
 */

document.addEventListener('DOMContentLoaded', () => {
  initPagePreloader();
  initThemeToggle();
  initScrollProgress();
  initScrollAnimations();
  initHeroMockupInteractions();
  initStickySplitScroll();
  initInteractiveSimulators();
  initLightboxModal();
  initTerminalTabs();
  initMobileMenu();
});

/* ==========================================================================
   0. PAGE PRELOADER (SMOOTH ENTRANCE & NO FONT FLICKER)
   ========================================================================== */
function initPagePreloader() {
  const preloader = document.getElementById('page-preloader');
  if (!preloader) return;

  const hide = () => {
    preloader.classList.add('fade-out');
    setTimeout(() => {
      preloader.style.display = 'none';
    }, 400);
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      setTimeout(hide, 180);
    });
  } else {
    window.addEventListener('load', () => {
      setTimeout(hide, 200);
    });
  }

  // Sécurité maximale anti-blocage (2.5s)
  setTimeout(hide, 2500);
}

/* ==========================================================================
   1. THEME SWITCHER (DARK / LIGHT) WITH LOCALSTORAGE PERSISTENCE
   ========================================================================== */
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;

  const currentTheme = localStorage.getItem('openshema-theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme);

  toggleBtn.addEventListener('click', () => {
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', activeTheme);
    localStorage.setItem('openshema-theme', activeTheme);
    updateThemeIcon(activeTheme);
  });
}

function updateThemeIcon(theme) {
  const iconHolder = document.getElementById('theme-icon-holder');
  if (!iconHolder) return;
  if (theme === 'light') {
    // Show Moon icon for switching to dark
    iconHolder.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>`;
    iconHolder.setAttribute('title', 'Passer en mode sombre');
  } else {
    // Show Sun icon for switching to light
    iconHolder.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>`;
    iconHolder.setAttribute('title', 'Passer en mode papier clair');
  }
}

/* ==========================================================================
   2. SCROLL PROGRESS BAR
   ========================================================================== */
function initScrollProgress() {
  const progressBar = document.getElementById('scroll-progress');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    progressBar.style.width = scrolled + '%';
  }, { passive: true });
}

/* ==========================================================================
   3. SCROLL REVEAL (INTERSECTION OBSERVER)
   ========================================================================== */
function initScrollAnimations() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (!revealElements.length) return;

  const observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => observer.observe(el));
}

/* ==========================================================================
   4. STICKY SPLIT-SCROLL INTERACTION
   ========================================================================== */
function initStickySplitScroll() {
  const featureCards = document.querySelectorAll('.split-feature-card');
  const visualSlides = document.querySelectorAll('.sticky-visual-slide');

  if (!featureCards.length || !visualSlides.length) return;

  const observerOptions = {
    threshold: 0.5,
    rootMargin: '-100px 0px -100px 0px'
  };

  const splitObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const slideIndex = entry.target.getAttribute('data-slide-index');
        
        // Update cards active state
        featureCards.forEach(c => c.classList.remove('active'));
        entry.target.classList.add('active');

        // Update visual slides
        visualSlides.forEach(slide => {
          if (slide.getAttribute('data-slide-target') === slideIndex) {
            slide.classList.add('active');
          } else {
            slide.classList.remove('active');
          }
        });
      }
    });
  }, observerOptions);

  featureCards.forEach(card => splitObserver.observe(card));
}

/* ==========================================================================
   5. INTERACTIVE LIVE SIMULATORS
   ========================================================================== */
function initInteractiveSimulators() {
  // Tab switching inside simulator
  const simTabBtns = document.querySelectorAll('.sim-tab-btn');
  const simPanels = document.querySelectorAll('.simulator-panel');

  simTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-sim-target');
      
      simTabBtns.forEach(b => b.classList.remove('active'));
      simPanels.forEach(p => p.style.display = 'none');

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.style.display = 'grid';
    });
  });

  // Simulator 1: Interlinear Greek/Hebrew Hover
  const greekWords = document.querySelectorAll('.sim-greek-word');
  const morphTarget = document.getElementById('sim-morph-preview');

  const greekData = {
    'logos': {
      lemma: 'λόγος, ου (ὁ)',
      translit: 'logos',
      strong: 'G3056',
      parse: 'Nom masculin singulier nominatif',
      bailly: 'Bailly : 1. Parole, discours ; 2. Raison, pensée exprimée ; 3. Compte, relation ; 4. Dans le NT (Jean), le Verbe éternel, la Parole divine incarnée.',
      calmet: 'Dom Calmet (1728) : Le Verbe divin, la seconde personne de la Sainte Trinité, par qui toutes choses ont été créées.',
      vulgate: 'Verbum (Latin)'
    },
    'theos': {
      lemma: 'θεός, οῦ (ὁ)',
      translit: 'theos',
      strong: 'G2316',
      parse: 'Nom masculin singulier nominatif',
      bailly: 'Bailly : Dieu, la divinité, l\'Être suprême créateur et ordonnateur de l\'univers.',
      calmet: 'Dom Calmet : Nom sacré appliqué au vrai Dieu, Père, Fils et Saint-Esprit.',
      vulgate: 'Deus'
    },
    'arche': {
      lemma: 'ἀρχή, ῆς (ἡ)',
      translit: 'archē',
      strong: 'G746',
      parse: 'Nom féminin singulier datif',
      bailly: 'Bailly : 1. Commencement, principe originaire ; 2. Origine première, cause ; 3. Autorité, magistrature.',
      calmet: 'Dom Calmet : Le commencement des temps ou l\'éternité antérieure à la création du monde.',
      vulgate: 'Principio'
    },
    'shema': {
      lemma: 'שָׁמַע (shama)',
      translit: 'šāmaʿ',
      strong: 'H8085',
      parse: 'Verbe Qal impératif masculin singulier',
      bailly: 'Lexique Hébreu : Écouter avec attention, entendre, obéir, comprendre, prêter l\'oreille.',
      calmet: 'Dom Calmet : "Écoute, Israël" — la plus sainte formule d\'adhésion au Dieu unique dans la Loi de Moïse.',
      vulgate: 'Audi Israel'
    }
  };

  greekWords.forEach(word => {
    word.addEventListener('mouseenter', () => {
      const key = word.getAttribute('data-word-key');
      const info = greekData[key];
      if (!info || !morphTarget) return;

      morphTarget.innerHTML = `
        <div style="animation: fadeIn 0.2s ease;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <span style="font-size: 1.3rem; font-weight: 700; color: var(--text-main);">${info.lemma}</span>
              <span style="font-size: 0.9rem; color: var(--text-muted); margin-left: 8px;">/${info.translit}/</span>
            </div>
            <span class="strong-badge">${info.strong}</span>
          </div>
          <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-cyan); margin-bottom: 12px;">
            ${info.parse} • Vulgate : ${info.vulgate}
          </div>
          <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-bottom: 10px; font-size: 0.85rem; line-height: 1.5; display: flex; align-items: flex-start; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
            <strong style="color: var(--accent-gold);">${info.bailly}</strong>
          </div>
          <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle); font-size: 0.825rem; color: var(--text-secondary); line-height: 1.5; display: flex; align-items: flex-start; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0; opacity: 0.8;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            <em>${info.calmet}</em>
          </div>
        </div>
      `;
    });
  });

  // Simulator 2: Theological Profile & Passport Generator
  const roleSelect = document.getElementById('sim-user-role');
  const postureSelect = document.getElementById('sim-ai-posture');
  const greekSelect = document.getElementById('sim-greek-level');
  const passportOutput = document.getElementById('sim-passport-output');

  function updatePassport() {
    if (!roleSelect || !postureSelect || !greekSelect || !passportOutput) return;

    const role = roleSelect.value;
    const posture = postureSelect.value;
    const greek = greekSelect.value;

    let roleText = "Prédication & Ministère pastoral";
    if (role === 'academique') roleText = "Recherche académique & exégétique rigoureuse";
    if (role === 'enseignement') roleText = "Enseignement biblique & groupes d'étude";
    if (role === 'perso') roleText = "Étude personnelle & méditation";

    let postureDesc = "Sparring-partner exigeant et pastoral (challenge les conclusions pour tester la solidité de l'argumentation théologique).";
    if (posture === 'academique') postureDesc = "Scientifique, neutre, axé sur la critique textuelle et le contexte historique comparatif.";
    if (posture === 'pedagogique') postureDesc = "Pédagogique, didactique, vulgarisation claire et plans mémorisables.";
    if (posture === 'pastoral') postureDesc = "Bienveillant, encourageant, orienté vers la transformation du cœur.";

    let greekDesc = "Intermédiaire (lemmes, codes Strong, temps des verbes et nuances sémantiques).";
    if (greek === 'avance') greekDesc = "Avancé (syntaxe poussée, critique textuelle des variantes, modes & voix rares).";
    if (greek === 'debutant') greekDesc = "Débutant (traductions dynamiques, explications imagées sans jargon technique).";

    passportOutput.innerHTML = `
      <div style="animation: fadeIn 0.25s ease;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
          <span style="font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem;">PASSEPORT HERMÉNEUTIQUE ACTIF</span>
          <span class="badge badge-glow-cyan" style="font-size: 0.7rem;">Inclus dans le System Prompt</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
          <strong>Objectif utilisateur :</strong> ${roleText}
        </p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
          <strong>Posture de l'assistant :</strong> ${postureDesc}
        </p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
          <strong>Niveau langues originales :</strong> ${greekDesc}
        </p>
        <div style="margin-top: 12px; padding: 10px; background: rgba(56, 189, 248, 0.08); border-radius: 6px; border: 1px dashed rgba(56, 189, 248, 0.3); font-size: 0.8rem; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <em>L'IA adaptera chacune de ses réponses, ses citations et ses propositions à ce passeport unique.</em>
        </div>
      </div>
    `;
  }

  if (roleSelect && postureSelect && greekSelect) {
    roleSelect.addEventListener('change', updatePassport);
    postureSelect.addEventListener('change', updatePassport);
    greekSelect.addEventListener('change', updatePassport);
  }
}

/* ==========================================================================
   6. LIGHTBOX MODAL FOR SCREENSHOTS
   ========================================================================== */
function initLightboxModal() {
  const modal = document.getElementById('lightbox-modal');
  const closeBtn = document.getElementById('lightbox-close-btn');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const galleryCards = document.querySelectorAll('.gallery-item-card');
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');

  if (!modal) return;

  // Open Lightbox
  galleryCards.forEach(card => {
    card.addEventListener('click', () => {
      const imgUrl = card.getAttribute('data-img-src') || card.querySelector('img')?.src;
      const title = card.getAttribute('data-title') || card.querySelector('.gallery-item-title')?.textContent;
      const desc = card.getAttribute('data-desc') || card.querySelector('.gallery-item-desc')?.textContent;

      if (lightboxImg) lightboxImg.src = imgUrl;
      if (lightboxTitle) lightboxTitle.textContent = title;
      if (lightboxDesc) lightboxDesc.textContent = desc;

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  // Close Lightbox
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Gallery Category Filter
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-filter');
      
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      galleryCards.forEach(card => {
        const itemCat = card.getAttribute('data-category');
        if (category === 'all' || itemCat === category) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   7. TERMINAL TABS & 1-CLICK COPY
   ========================================================================== */
function initTerminalTabs() {
  const tabs = document.querySelectorAll('.term-tab');
  const termPanels = document.querySelectorAll('.term-content-panel');
  const copyBtn = document.getElementById('copy-terminal-btn');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-term-target');
      
      tabs.forEach(t => t.classList.remove('active'));
      termPanels.forEach(p => p.style.display = 'none');

      tab.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.style.display = 'block';
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const activePanel = document.querySelector('.term-content-panel:not([style*="display: none"])');
      const codeToCopy = activePanel ? activePanel.getAttribute('data-raw-cmd') : 'git clone https://github.com/Similarly1/open-shema.git';
      
      navigator.clipboard.writeText(codeToCopy).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg> Copié !
        `;
        copyBtn.style.background = 'var(--accent-emerald)';
        copyBtn.style.color = '#FFFFFF';

        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.style.background = '';
          copyBtn.style.color = '';
        }, 2000);
      });
    });
  }
}

/* ==========================================================================
   9. HERO MOCKUP HIGH-FIDELITY INTERACTIONS
   ========================================================================== */
function initHeroMockupInteractions() {
  const versionPills = document.querySelectorAll('.hero-version-pill');
  const readerPassage = document.getElementById('hero-reader-passage');
  const drawerCardMorph = document.getElementById('hero-drawer-morph');
  const drawerCardAi = document.getElementById('hero-drawer-ai');
  const strongBadge = document.getElementById('hero-strong-badge');

  // Translation database for Jean 1:1-4
  const translations = {
    's21': `
      <div class="mockup-verse">
        <span class="verse-num">1</span>
        Au commencement était la <span class="verse-word-highlight hero-interactive-word" data-word="logos">Parole</span> 
        (<span class="verse-word-greek hero-interactive-word" data-word="logos">λόγος</span>), et la Parole était avec Dieu (<span class="verse-word-greek hero-interactive-word" data-word="theos">θεός</span>), 
        et la Parole était Dieu.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">2</span>
        Elle était au commencement avec Dieu.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">3</span>
        Toutes choses ont été faites par elle, et rien de ce qui a été fait n'a été fait sans elle.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">4</span>
        En elle était la <span class="verse-word-greek hero-interactive-word" data-word="zoe">vie</span> (ζωή), et la vie était la <span class="verse-word-greek hero-interactive-word" data-word="phos">lumière</span> (φῶς) des hommes.
      </div>
    `,
    'lsg': `
      <div class="mockup-verse">
        <span class="verse-num">1</span>
        Au commencement <span class="strong-badge" style="font-size:0.65rem">G1722</span> était la <span class="verse-word-highlight hero-interactive-word" data-word="logos">Parole</span> <span class="strong-badge" style="font-size:0.65rem">G3056</span>, et la Parole était avec Dieu <span class="strong-badge" style="font-size:0.65rem">G2316</span>, et la Parole était Dieu.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">2</span>
        Elle était au commencement avec Dieu.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">3</span>
        Toutes choses ont été faites par elle, et rien de ce qui a été fait n'a été fait sans elle.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">4</span>
        En elle était la <span class="hero-interactive-word" data-word="zoe" style="border-bottom:1px dashed var(--accent-cyan)">vie</span>, et la vie était la <span class="hero-interactive-word" data-word="phos" style="border-bottom:1px dashed var(--accent-cyan)">lumière</span> des hommes.
      </div>
    `,
    'sblgnt': `
      <div class="mockup-verse greek-text" style="font-size: 1.25rem;">
        <span class="verse-num">1</span>
        Ἐν <span class="verse-word-greek hero-interactive-word" data-word="arche">ἀρχῇ</span> ἦν ὁ <span class="verse-word-highlight hero-interactive-word" data-word="logos">λόγος</span>, καὶ ὁ λόγος ἦν πρὸς τὸν <span class="verse-word-greek hero-interactive-word" data-word="theos">θεόν</span>, καὶ θεὸς ἦν ὁ λόγος.
      </div>
      <div class="mockup-verse greek-text" style="font-size: 1.25rem;">
        <span class="verse-num">2</span>
        οὗτος ἦν ἐν ἀρχῇ πρὸς τὸν θεόν.
      </div>
      <div class="mockup-verse greek-text" style="font-size: 1.25rem;">
        <span class="verse-num">3</span>
        πάντα δι’ αὐτοῦ ἐγένετο, καὶ χωρὶς αὐτοῦ ἐγένετο οὐδὲ ἕν ὃ γέγονεν.
      </div>
      <div class="mockup-verse greek-text" style="font-size: 1.25rem;">
        <span class="verse-num">4</span>
        ἐν αὐτῷ <span class="verse-word-greek hero-interactive-word" data-word="zoe">ζωὴ</span> ἦν, καὶ ἡ ζωὴ ἦν τὸ <span class="verse-word-greek hero-interactive-word" data-word="phos">φῶς</span> τῶν ἀνθρώπων.
      </div>
    `,
    'pv': `
      <div class="mockup-verse">
        <span class="verse-num">1</span>
        Au commencement de toutes choses, la <span class="verse-word-highlight hero-interactive-word" data-word="logos">Parole</span> existait déjà. Elle était avec Dieu, et elle était elle-même Dieu.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">2</span>
        Dès le principe, elle était auprès de Dieu.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">3</span>
        Tout a été créé par elle ; rien de ce qui existe n'a été fait sans elle.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">4</span>
        En elle résidait la vie véritable, et cette vie était la lumière qui éclaire tous les êtres humains.
      </div>
    `,
    'chouraqui': `
      <div class="mockup-verse">
        <span class="verse-num">1</span>
        En entête était le <span class="verse-word-highlight hero-interactive-word" data-word="logos">Verbe</span>, et le Verbe était auprès d’Elohîms, et le Verbe était Elohîms.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">2</span>
        Lui-même était en entête auprès d’Elohîms.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">3</span>
        Tout a été par lui, et hors de lui rien n’a été de ce qui est.
      </div>
      <div class="mockup-verse">
        <span class="verse-num">4</span>
        En lui était la vie, et la vie était la lumière des hommes.
      </div>
    `
  };

  const wordDetails = {
    'logos': {
      strong: 'G3056',
      title: 'Lemme : λόγος, ου (ὁ)',
      bailly: 'Dictionnaire Bailly : 1. Parole proférée, discours ; 2. Raison, principe d\'ordre ; 3. Dans l\'Évangile de Jean : le Verbe créateur et éternel incarné en Jésus-Christ.',
      ai: '« Jean s\'adresse simultanément à l\'esprit grec (logos comme principe rationnel du cosmos) et à la théologie juive (Dabar Yahvé, la parole vivante et créatrice). »'
    },
    'theos': {
      strong: 'G2316',
      title: 'Lemme : θεός, οῦ (ὁ)',
      bailly: 'Dictionnaire Bailly : Dieu, la divinité suprême, l\'Être éternel créateur de l\'univers.',
      ai: '« En Jean 1:1c (καὶ θεὸς ἦν ὁ λόγος), l\'absence d\'article devant θεός souligne la nature divine qualitative du Verbe sans le confondre avec la personne du Père. »'
    },
    'arche': {
      strong: 'G746',
      title: 'Lemme : ἀρχή, ῆς (ἡ)',
      bailly: 'Dictionnaire Bailly : 1. Commencement temporel ; 2. Principe premier, origine causale ; 3. Autorité suprême.',
      ai: '« Écho direct à Béréshit (Genèse 1:1). Jean situe le Verbe au-delà de la création dans l\'éternité préexistante. »'
    },
    'zoe': {
      strong: 'G2222',
      title: 'Lemme : ζωή, ῆς (ἡ)',
      bailly: 'Dictionnaire Bailly : La vie au sens absolu, la force vitale spirituelle (distinct de bios, la simple vie biologique).',
      ai: '« Dans le corpus johannique, la Zoê désigne la vie éternelle et incréée communiquée aux croyants par le Christ. »'
    },
    'phos': {
      strong: 'G5457',
      title: 'Lemme : φῶς, φωτός (τό)',
      bailly: 'Dictionnaire Bailly : Lumière, clarté, illumination spirituelle qui dissipe les ténèbres.',
      ai: '« Thème majeur chez Jean : la lumière qui luit dans les ténèbres sans que les ténèbres n\'aient pu la submerger (katelaben). »'
    }
  };

  function bindInteractiveWords() {
    const words = document.querySelectorAll('.hero-interactive-word');
    words.forEach(w => {
      w.addEventListener('mouseenter', () => {
        const key = w.getAttribute('data-word');
        const d = wordDetails[key];
        if (!d) return;

        if (strongBadge) strongBadge.textContent = d.strong;
        if (drawerCardMorph) {
          drawerCardMorph.innerHTML = `
            <div class="drawer-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
              ${d.title}
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
              <strong>${d.bailly}</strong>
            </p>
          `;
        }
        if (drawerCardAi) {
          drawerCardAi.innerHTML = `
            <div class="drawer-card-header" style="color: var(--accent-gold);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path><path d="M12 6v6l4 2"></path></svg>
              Assistant IA (Sparring-Partner)
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
              <em>${d.ai}</em>
            </p>
          `;
        }
      });
    });
  }

  versionPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const vKey = pill.getAttribute('data-version-key');
      versionPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      if (readerPassage && translations[vKey]) {
        readerPassage.innerHTML = translations[vKey];
        bindInteractiveWords();
      }
    });
  });

  // Sidebar mock items switching preview
  const sidebarItems = document.querySelectorAll('.hero-sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  bindInteractiveWords();
}

// Fade in animation helper
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(styleTag);

