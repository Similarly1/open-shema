/**
 * OPEN SHEMA (שְׁמַע) - MAIN CLIENT-SIDE JAVASCRIPT
 * Interactions, Scroll-driven animations, Interactive Simulators & Lightbox
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initScrollProgress();
  initScrollAnimations();
  initStickySplitScroll();
  initInteractiveSimulators();
  initLightboxModal();
  initTerminalTabs();
  initMobileMenu();
});

/* ==========================================================================
   1. THEME SWITCHER (DARK / LIGHT) WITH LOCALSTORAGE PERSISTENCE
   ========================================================================== */
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;

  const currentTheme = localStorage.getItem('openshema-theme') || 'dark';
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
          <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle); margin-bottom: 10px; font-size: 0.85rem; line-height: 1.5;">
            <strong style="color: var(--accent-gold);">📖 ${info.bailly}</strong>
          </div>
          <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle); font-size: 0.825rem; color: var(--text-secondary); line-height: 1.5;">
            🏛️ <em>${info.calmet}</em>
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
          <strong>🎯 Objectif utilisateur :</strong> ${roleText}
        </p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
          <strong>🧠 Posture de l'assistant :</strong> ${postureDesc}
        </p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">
          <strong>🔤 Niveau langues originales :</strong> ${greekDesc}
        </p>
        <div style="margin-top: 12px; padding: 10px; background: rgba(56, 189, 248, 0.08); border-radius: 6px; border: 1px dashed rgba(56, 189, 248, 0.3); font-size: 0.8rem; color: var(--accent-cyan);">
          💡 <em>L'IA adaptera chacune de ses réponses, ses citations de commentaires et ses propositions de plan à ce passeport unique.</em>
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
      const codeToCopy = activePanel ? activePanel.getAttribute('data-raw-cmd') : 'git clone https://github.com/Similarly1/free-logos-ai.git';
      
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
   8. MOBILE MENU TOGGLE
   ========================================================================== */
function initMobileMenu() {
  const mobileBtn = document.getElementById('mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      const isVisible = navLinks.style.display === 'flex';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '72px';
        navLinks.style.left = '0';
        navLinks.style.width = '100%';
        navLinks.style.background = 'var(--bg-surface-elevated)';
        navLinks.style.padding = '24px';
        navLinks.style.borderBottom = '1px solid var(--border-color)';
      }
    });
  }
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
