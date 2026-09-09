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
  initMarc2DrawerInteractions();
  initMorphologyCardInteractions();
  initDisplayOptionsTabs();
  initIllustrationsReservoirInteractions();
  initEngineOptionsInteractions();
  initCommentariesInteractions();
  initInteractiveSimulators();
  initLightboxModal();
  initTerminalTabs();
  initMobileMenu();
  initMindmapShowcase();
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
    threshold: 0.01,
    rootMargin: '0px 0px 60px 0px'
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
  const featureCards = Array.from(document.querySelectorAll('.split-feature-card'));
  const visualSlides = Array.from(document.querySelectorAll('.sticky-visual-slide'));
  const mobileTabs = Array.from(document.querySelectorAll('.deep-dive-tab-pill'));
  const prevBtn = document.getElementById('deep-dive-prev-btn');
  const nextBtn = document.getElementById('deep-dive-next-btn');
  const currStepEl = document.getElementById('deep-dive-curr-step');

  if (!featureCards.length || !visualSlides.length) return;

  function setActiveSlide(slideIndex, isUserInitiated = false) {
    if (!slideIndex) return;
    
    featureCards.forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-slide-index') === slideIndex);
    });
    visualSlides.forEach(slide => {
      slide.classList.toggle('active', slide.getAttribute('data-slide-target') === slideIndex);
    });

    mobileTabs.forEach(tab => {
      const isActive = tab.getAttribute('data-tab-target') === slideIndex;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive && isUserInitiated && window.innerWidth <= 880) {
        tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    const numericIdx = parseInt(slideIndex, 10);
    if (currStepEl) {
      currStepEl.textContent = slideIndex;
    }
    if (prevBtn) {
      prevBtn.disabled = numericIdx <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = numericIdx >= featureCards.length;
    }
  }

  // Écouteurs de clics sur les onglets mobile
  mobileTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab-target');
      setActiveSlide(target, true);
    });
  });

  // Écouteurs de navigation Précédent / Suivant
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const activeCard = document.querySelector('.split-feature-card.active');
      const curr = activeCard ? parseInt(activeCard.getAttribute('data-slide-index'), 10) : 1;
      if (curr > 1) {
        setActiveSlide(String(curr - 1), true);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const activeCard = document.querySelector('.split-feature-card.active');
      const curr = activeCard ? parseInt(activeCard.getAttribute('data-slide-index'), 10) : 1;
      if (curr < featureCards.length) {
        setActiveSlide(String(curr + 1), true);
      }
    });
  }


  let ticking = false;
  function checkVisibleCard() {
    // Sur mobile, le défilement est contrôlé par les onglets et la pagination
    if (window.innerWidth <= 880) return;

    const triggerY = window.innerHeight * 0.45;
    let closestCard = null;
    let minDistance = Infinity;

    featureCards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.top <= triggerY && rect.bottom >= triggerY) {
        closestCard = card;
      } else {
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - triggerY);
        if (dist < minDistance) {
          minDistance = dist;
          if (!closestCard) closestCard = card;
        }
      }
    });

    if (closestCard) {
      const index = closestCard.getAttribute('data-slide-index');
      setActiveSlide(index, false);
    }
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        checkVisibleCard();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    checkVisibleCard();
  }, { passive: true });

  checkVisibleCard();
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

    let postureDesc = "Miroir critique exigeant et pastoral (stimule la réflexion et éprouve la solidité de l'argumentation théologique sans se substituer au prédicateur).";
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
   6. LIGHTBOX MODAL HAUTE DÉFINITION & NAVIGATION
   ========================================================================== */
function initLightboxModal() {
  const modal = document.getElementById('lightbox-modal');
  const closeBtn = document.getElementById('lightbox-close-btn');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const zoomBtn = document.getElementById('lightbox-zoom-btn');
  const zoomLabel = document.getElementById('lightbox-zoom-label');
  const prevBtn = document.getElementById('lightbox-prev-btn');
  const nextBtn = document.getElementById('lightbox-next-btn');
  const counterEl = document.getElementById('lightbox-counter');
  const stage = document.getElementById('lightbox-image-stage');

  const galleryCards = Array.from(document.querySelectorAll('.gallery-item-card'));
  const filterBtns = document.querySelectorAll('.gallery-filter-btn');

  if (!modal || !lightboxImg) return;

  let currentIndex = 0;
  let isZoomed = false;

  function setZoom(zoomed) {
    isZoomed = zoomed;
    if (isZoomed) {
      lightboxImg.classList.add('zoomed-native');
      if (zoomBtn) zoomBtn.classList.add('active');
      if (zoomLabel) zoomLabel.textContent = "Adapter à l'écran";
    } else {
      lightboxImg.classList.remove('zoomed-native');
      if (zoomBtn) zoomBtn.classList.remove('active');
      if (zoomLabel) zoomLabel.textContent = "Taille réelle 100%";
      if (stage) {
        stage.scrollLeft = 0;
        stage.scrollTop = 0;
      }
    }
  }

  function showImage(index) {
    if (index < 0) index = galleryCards.length - 1;
    if (index >= galleryCards.length) index = 0;
    currentIndex = index;

    const card = galleryCards[currentIndex];
    if (!card) return;

    const imgUrl = card.getAttribute('data-img-src') || card.querySelector('img')?.src;
    const title = card.getAttribute('data-title') || card.querySelector('.gallery-item-title')?.textContent;
    const desc = card.getAttribute('data-desc') || card.querySelector('.gallery-item-desc')?.textContent;

    // Reset zoom when navigating
    setZoom(false);

    lightboxImg.src = imgUrl || '';
    if (lightboxTitle) lightboxTitle.textContent = title || 'Aperçu Haute Définition';
    if (lightboxDesc) lightboxDesc.textContent = desc || '';
    if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${galleryCards.length}`;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Open on card click
  galleryCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      showImage(index);
    });
  });

  // Toggle Zoom on button or image click
  if (zoomBtn) {
    zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setZoom(!isZoomed);
    });
  }

  lightboxImg.addEventListener('click', (e) => {
    e.stopPropagation();
    setZoom(!isZoomed);
  });

  // Navigation Previous / Next
  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showImage(currentIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showImage(currentIndex + 1);
    });
  }

  // Close modal
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    setZoom(false);
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target === stage) {
      closeModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (e.key === 'ArrowRight') showImage(currentIndex + 1);
    if (e.key === 'z' || e.key === 'Z') setZoom(!isZoomed);
  });

  // Mobile Touch Swipe Navigation
  let touchStartX = 0;
  let touchStartY = 0;
  if (stage) {
    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      if (isZoomed) return; // Allow natural panning when zoomed
      if (e.changedTouches.length === 1) {
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        // Require horizontal swipe of at least 45px with predominantly horizontal movement
        if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
          if (diffX < 0) {
            showImage(currentIndex + 1); // Swipe left -> Next
          } else {
            showImage(currentIndex - 1); // Swipe right -> Prev
          }
        }
      }
    }, { passive: true });
  }

  // Category Filters
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
  const versionSelector = document.getElementById('canvas-version-selector');
  const versionCurrent = document.getElementById('canvas-version-current');
  const versionDropdown = document.getElementById('canvas-version-dropdown');
  const versionLabel = document.getElementById('canvas-version-label');
  const versesContainer = document.getElementById('hero-verses-container');
  const versionOpts = document.querySelectorAll('.version-opt');

  // Traductions 100% LIBRES DE DROITS pour Genèse 1 (Domaine public & Licences ouvertes)
  const translations = {
    'crampon': {
      label: "Néo-Crampon Libre",
      verses: [
        { num: 1, text: "Au Commencement Dieu créa le ciel et la terre." },
        { num: 2, text: "La terre était informe et vide ; les ténèbres couvraient l'abîme, et l'Esprit de Dieu se mouvait au-dessus des eaux." },
        { num: 3, text: "Dieu dit : « Que la lumière soit ! » et la lumière fut." },
        { num: 4, text: "Et Dieu vit que la lumière était bonne ; et Dieu sépara la lumière et les ténèbres." },
        { num: 5, text: "Dieu appela la lumière jour, et les ténèbres Nuit. Et il y eut un soir, et il y eut un matin ; ce fut le premier jour." },
        { num: 6, text: "Dieu dit : « Qu'il y ait un firmament entre les eaux, et qu'il sépare les eaux d'avec les eaux. »" },
        { num: 7, text: "Et Dieu fit le firmament, et il sépara les eaux qui sont au-dessous du firmament d'avec les eaux qui sont au-dessus du firmament. Et cela fut ainsi." },
        { num: 8, text: "Dieu appela le firmament Ciel. Et il y eut un soir et il y eut un matin ; ce fut le second jour." },
        { num: 9, text: "Dieu dit : « Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. » Et cela fut ainsi." },
        { num: 10, text: "Dieu appela le sec Terre, et il appela Mer l'amas des eaux. Et Dieu vit que cela était bon." },
        { num: 11, text: "Puis Dieu dit : « Que la terre fasse pousser du gazon, des herbes portant semence, des arbres à fruit produisant, selon leur espèce, du fruit ayant en soi sa semence, sur la terre. » Et cela fut ainsi." },
        { num: 12, text: "Et la terre fit sortir du gazon, des herbes portant semence selon leur espèce, et des arbres produisant, selon leur espèce, du fruit ayant en soi sa semence. Et Dieu vit que cela était bon." },
        { num: 13, text: "Et il y eut un soir, et il y eut un matin ; ce fut le troisième jour." },
        { num: 14, text: "Dieu dit : « Qu'il y ait des luminaires dans le firmament du ciel pour séparer le jour et la nuit ; qu'ils soient des signes, qu'ils marquent les époques, les jours et les années," },
        { num: 15, text: "et qu'ils servent de luminaires dans le firmament du ciel pour éclairer la terre. » Et cela fut ainsi." }
      ]
    },
    'lsg': {
      label: "Louis Segond 1910",
      verses: [
        { num: 1, text: "Au commencement, Dieu créa les cieux et la terre." },
        { num: 2, text: "La terre était informe et vide: il y avait des ténèbres à la surface de l'abîme, et l'esprit de Dieu se mouvait au-dessus des eaux." },
        { num: 3, text: "Dieu dit: Que la lumière soit! Et la lumière fut." },
        { num: 4, text: "Dieu vit que la lumière était bonne; et Dieu sépara la lumière d'avec les ténèbres." },
        { num: 5, text: "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin: ce fut le premier jour." },
        { num: 6, text: "Dieu dit: Qu'il y ait une étendue entre les eaux, et qu'elle sépare les eaux d'avec les eaux." },
        { num: 7, text: "Et Dieu fit l'étendue, et il sépara les eaux qui sont au-dessous de l'étendue d'avec les eaux qui sont au-dessus de l'étendue. Et cela fut ainsi." },
        { num: 8, text: "Dieu appela l'étendue ciel. Ainsi, il y eut un soir, et il y eut un matin: ce fut le second jour." },
        { num: 9, text: "Dieu dit: Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi." },
        { num: 10, text: "Dieu appela le sec terre, et il appela l'amas des eaux mers. Dieu vit que cela était bon." }
      ]
    },
    'ostervald': {
      label: "J.-F. Ostervald (1881)",
      verses: [
        { num: 1, text: "Au commencement, Dieu créa les cieux et la terre." },
        { num: 2, text: "Or la terre était informe et vide, et les ténèbres étaient à la surface de l'abîme, et l'Esprit de Dieu se mouvait sur les eaux." },
        { num: 3, text: "Et Dieu dit : Que la lumière soit ; et la lumière fut." },
        { num: 4, text: "Et Dieu vit que la lumière était bonne ; et Dieu sépara la lumière d'avec les ténèbres." },
        { num: 5, text: "Et Dieu nomma la lumière, Jour ; et il nomma les ténèbres, Nuit. Et il y eut un soir, et il y eut un matin ; ce fut le premier jour." },
        { num: 6, text: "Puis Dieu dit : Qu'il y ait une étendue entre les eaux, et qu'elle sépare les eaux d'avec les eaux." }
      ]
    },
    'oltramare': {
      label: "Hugues Oltramare (1874)",
      verses: [
        { num: 1, text: "Au commencement, Dieu créa les cieux et la terre." },
        { num: 2, text: "La terre était déserte et vide, les ténèbres couvraient l'abîme, et le souffle de Dieu planait sur les eaux." },
        { num: 3, text: "Dieu dit : Que la lumière soit ! et la lumière fut." },
        { num: 4, text: "Dieu vit que la lumière était bonne, et Dieu sépara la lumière des ténèbres." }
      ]
    },
    'darby': {
      label: "J.N. Darby (1885)",
      verses: [
        { num: 1, text: "Au commencement Dieu créa les cieux et la terre." },
        { num: 2, text: "Et la terre était désolation et vide, et il y avait des ténèbres sur la face de l'abîme ; et l'Esprit de Dieu planait sur la face des eaux." },
        { num: 3, text: "Et Dieu dit : Que la lumière soit. Et la lumière fut." },
        { num: 4, text: "Et Dieu vit la lumière, qu'elle était bonne ; et Dieu sépara la lumière d'avec les ténèbres." }
      ]
    },
    'sblgnt': {
      label: "Septante LXX (Grec)",
      verses: [
        { num: 1, text: "Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς τὸν οὐρανὸν καὶ τὴν γῆν." },
        { num: 2, text: "ἡ δὲ γῆ ἦν ἀόρατος καὶ ἀκατασκεύαστος, καὶ σκότος ἐπάνω τῆς ἀβύσσου, καὶ πνεῦμα θεοῦ ἐπεφέρετο ἐπάνω τοῦ ὕδατος." },
        { num: 3, text: "καὶ εἶπεν ὁ θεός· Γενηθήτω φῶς. καὶ ἐγένετο φῶς." },
        { num: 4, text: "καὶ εἶδεν ὁ θεὸς τὸ φῶς ὅτι καλόν· καὶ διεχώρισεν ὁ θεὸς ἀνὰ μέσον τοῦ φωτὸς καὶ ἀνὰ μέσον τοῦ σκότους." }
      ]
    }
  };

  // Bascule du menu déroulant de version
  if (versionCurrent && versionDropdown) {
    versionCurrent.addEventListener('click', (e) => {
      e.stopPropagation();
      versionDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      versionDropdown.classList.remove('open');
    });
  }

  // Choix d'une version
  versionOpts.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = opt.getAttribute('data-v');
      if (!key || !translations[key]) return;

      versionOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');

      if (versionLabel) versionLabel.textContent = translations[key].label;
      if (versionDropdown) versionDropdown.classList.remove('open');

      // Reconstruire les versets
      if (versesContainer) {
        const data = translations[key];
        let markup = '';
        data.verses.forEach(v => {
          const isHl = (v.num === 1) ? ' highlighted' : '';
          markup += `
            <span class="verse-unit${isHl}" data-verse="${v.num}">
              <sup class="verse-sup">${v.num}</sup><span class="verse-words">${v.text}</span>
            </span>
          `;
        });
        versesContainer.innerHTML = markup;
        attachVerseListeners();
      }
    });
  });

  // Sélection interactive des versets au clic
  function attachVerseListeners() {
    const units = document.querySelectorAll('.verse-unit');
    units.forEach(u => {
      u.addEventListener('click', () => {
        units.forEach(el => el.classList.remove('highlighted'));
        u.classList.add('highlighted');
      });
    });
  }

  attachVerseListeners();
}

function initMarc2DrawerInteractions() {
  const accHeads = document.querySelectorAll('.drawer-acc-head');
  const commentItems = document.querySelectorAll('.drawer-list-item[data-comment-id]');
  const popover = document.getElementById('popover-robertson');
  const popoverTag = document.getElementById('popover-tag');
  const popoverTitle = document.getElementById('popover-title');
  const popoverSubtitle = document.getElementById('popover-subtitle');
  const popoverBody = document.getElementById('popover-body');

  // Données exactes des 3 commentaires extraites des captures d'écran
  const commentsDatabase = {
    robertson: {
      tag: 'COMMENTAIRE',
      title: 'A.T. Robertson (Images verbales du NT)',
      subtitle: 'A.T. Robertson (Images verbales du NT)',
      body: "De nouveau à Capernaüm après quelques jours (παλιν εις Καφαρναουμ δι' ημερων). Après la première tournée en Galilée, lorsque Jésus est de retour dans la ville qui est maint..."
    },
    gaebelein: {
      tag: 'COMMENTAIRE',
      title: 'Bible annotée par A.C. Gaebelein',
      subtitle: 'Bible annotée par A.C. Gaebelein',
      body: "Chapitre 2 1. Le Serviteur à nouveau à Capharnaüm. La guérison du paralytique. ( Marc 2:1 . Matthieu 9:1 ; Luc 5:17 .) 2. Levi a appelé. Avec les Publicains et les Pécheurs..."
    },
    tgc: {
      tag: 'COMMENTAIRE',
      title: 'Commentaires The Gospel Coalition (TGC)',
      subtitle: 'Commentaires The Gospel Coalition (TGC)',
      body: "2:1–4 Cet épisode est une transition. Il s'agit du dernier d'une série de récits de guérisons et d'exorcismes, et le premier de cinq controverses avec les chefs religieux. ..."
    }
  };

  // Accordion Expand / Collapse (Un seul onglet ouvert à la fois)
  accHeads.forEach(head => {
    head.addEventListener('click', () => {
      const parentCard = head.closest('.drawer-acc-card');
      if (!parentCard) return;

      const isAlreadyOpen = parentCard.classList.contains('open');

      // Fermer tous les autres accordéons
      document.querySelectorAll('.drawer-acc-card').forEach(card => {
        card.classList.remove('open');
      });

      // Si l'accordéon cliqué n'était pas ouvert, on l'ouvre
      if (!isAlreadyOpen) {
        parentCard.classList.add('open');
      } else {
        if (popover) popover.classList.remove('show');
      }
    });
  });

  // Gestion interactive des 3 commentaires au survol et au clic
  if (commentItems.length && popover) {
    commentItems.forEach(item => {
      const updatePopover = () => {
        const commentId = item.getAttribute('data-comment-id');
        const data = commentsDatabase[commentId];
        if (data) {
          if (popoverTag) popoverTag.textContent = data.tag;
          if (popoverTitle) popoverTitle.textContent = data.title;
          if (popoverSubtitle) popoverSubtitle.textContent = data.subtitle;
          if (popoverBody) popoverBody.textContent = data.body;
        }

        commentItems.forEach(i => i.classList.remove('active-target'));
        item.classList.add('active-target');

        popover.classList.add('show');
      };

      item.addEventListener('mouseenter', updatePopover);

      item.addEventListener('mouseleave', (e) => {
        if (!e.relatedTarget || !popover.contains(e.relatedTarget)) {
          popover.classList.remove('show');
        }
      });

      // Support mobile / clic
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        updatePopover();
      });
    });

    popover.addEventListener('mouseleave', () => {
      popover.classList.remove('show');
    });

    document.addEventListener('click', (e) => {
      const isCommentItem = Array.from(commentItems).some(item => item.contains(e.target));
      if (!popover.contains(e.target) && !isCommentItem) {
        popover.classList.remove('show');
      }
    });
  }
}

/* ==========================================================================
   11. MORPHOLOGIE & BAILLY CARD INTERACTIONS (SLIDE 2 DEEP-DIVE)
   ========================================================================== */
function initMorphologyCardInteractions() {
  const audioBtn = document.getElementById('btn-pronounce-g919');
  const copyBtn = document.getElementById('btn-copy-g919');
  const copyBtnText = document.getElementById('copy-btn-text');
  const occurrencesBtn = document.getElementById('btn-occurrences-g919');
  const infoTriggers = document.querySelectorAll('.morpho-info-trigger');

  // 1. Audio Pronunciation (Lecture du vrai fichier audio MP3 de l'application)
  let currentAudio = null;
  if (audioBtn) {
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Si déjà en cours de lecture, on stoppe
      if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        audioBtn.classList.remove('speaking');
        const btnSpan = audioBtn.querySelector('span');
        if (btnSpan) btnSpan.textContent = "Prononciation";
        return;
      }

      audioBtn.classList.add('speaking');
      const btnSpan = audioBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = "Lecture...";

      const resetBtn = () => {
        audioBtn.classList.remove('speaking');
        if (btnSpan) btnSpan.textContent = "Prononciation";
        currentAudio = null;
      };

      try {
        const audio = new Audio('assets/audio/G919.mp3');
        currentAudio = audio;

        audio.onended = resetBtn;
        audio.onerror = () => {
          console.warn("Fichier MP3 non accessible, bascule SpeechSynthesis");
          if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance('Βαριησοῦς');
            u.lang = 'el-GR';
            u.onend = resetBtn;
            u.onerror = resetBtn;
            window.speechSynthesis.speak(u);
          } else {
            resetBtn();
          }
        };

        audio.play().catch(err => {
          console.warn("Lecture bloquée par le navigateur:", err);
          resetBtn();
        });
      } catch (err) {
        resetBtn();
      }
    });
  }

  // 2. Info tooltips mobile tap toggle
  infoTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = trigger.classList.contains('active');
      infoTriggers.forEach(t => t.classList.remove('active'));
      if (!isActive) trigger.classList.add('active');
    });
  });

  document.addEventListener('click', () => {
    infoTriggers.forEach(t => t.classList.remove('active'));
  });

  // 3. 1-Click Copy
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToCopy = "Strong G919: Βαριησοῦς (Bariêsous) - « Jésus » | Nom (Substantif) | Sens: Bar-Jésus « fils de Jésus », un certain faux prophète Ac 13:6";
      
      navigator.clipboard.writeText(textToCopy).then(() => {
        if (copyBtnText) copyBtnText.textContent = "Copié !";
        copyBtn.style.borderColor = "var(--accent-emerald)";
        copyBtn.style.color = "var(--accent-emerald)";

        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = "Copier";
          copyBtn.style.borderColor = "";
          copyBtn.style.color = "";
        }, 2000);
      }).catch(() => {});
    });
  }

  // 4. Occurrences Button
  if (occurrencesBtn) {
    occurrencesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      occurrencesBtn.style.transform = "scale(0.97)";
      setTimeout(() => {
        occurrencesBtn.style.transform = "";
      }, 150);
    });
  }
}

/* ==========================================================================
   12. DISPLAY OPTIONS TABS & INTERACTIVE MOCKUP (SLIDE 3 DEEP-DIVE)
   ========================================================================== */
function initDisplayOptionsTabs() {
  const tabs = document.querySelectorAll('.display-options-tabs .opt-tab');
  const panels = document.querySelectorAll('.display-tab-panel');
  const checkboxes = document.querySelectorAll('.opt-checkbox-item');
  const themeBtns = document.querySelectorAll('.ambiance-theme-btn');
  const optBtns = document.querySelectorAll('.opt-btn');

  // Éléments du passage biblique fixe en dessous (Jean 1:42-44)
  const livePassage = document.getElementById('display-live-passage');
  const passageTitle = document.getElementById('passage-title');
  const passageLettrine = document.getElementById('passage-lettrine');
  const passageV42Num = document.getElementById('passage-v42-num');
  const passageV43Num = document.getElementById('passage-v43-num');
  const passageV44Num = document.getElementById('passage-v44-num');
  const passageHighlightG = document.getElementById('passage-highlight-galilee');
  const passageHighlightB = document.getElementById('passage-highlight-bethsaida');
  const passageBracket = document.getElementById('passage-bracket');
  const passageNoteContainer = document.getElementById('passage-note-container');
  const passageMapGutter = document.getElementById('passage-map-gutter');
  const passageMapBadge = document.getElementById('passage-map-badge');
  const passageMapPopover = document.getElementById('passage-map-popover');
  const passageV42Wrap = document.getElementById('passage-v42-wrapper');
  const passageV43Wrap = document.getElementById('passage-v43-wrapper');
  const passageV44Wrap = document.getElementById('passage-v44-wrapper');

  // 1. Commutation d'onglets (Éléments, Typographie, Ambiance)
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab-target');
      if (!target) return;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      panels.forEach(p => p.classList.remove('active'));
      const activePanel = document.getElementById(`panel-${target}`);
      if (activePanel) activePanel.classList.add('active');
    });
  });

  // 2. Cases à cocher interactives synchronisées avec Jean 1:42-44
  checkboxes.forEach(item => {
    item.addEventListener('click', () => {
      const isChecked = item.classList.toggle('checked');
      const box = item.querySelector('.opt-check-box');
      if (box) {
        box.textContent = isChecked ? '✓' : '';
      }

      const opt = item.getAttribute('data-opt');
      if (!opt) return;

      if (opt === 'titres' && passageTitle) {
        passageTitle.classList.toggle('hidden', !isChecked);
      } else if (opt === 'versets') {
        if (passageV42Num) passageV42Num.classList.toggle('hidden', !isChecked);
        if (passageV43Num) passageV43Num.classList.toggle('hidden', !isChecked);
        if (passageV44Num) passageV44Num.classList.toggle('hidden', !isChecked);
      } else if (opt === 'lettrines' && passageLettrine) {
        passageLettrine.classList.toggle('plain', !isChecked);
      } else if (opt === 'cartes' && passageMapGutter) {
        passageMapGutter.classList.toggle('hidden', !isChecked);
      } else if (opt === 'surlignages') {
        if (passageHighlightG) passageHighlightG.classList.toggle('no-highlight', !isChecked);
        if (passageHighlightB) passageHighlightB.classList.toggle('no-highlight', !isChecked);
      } else if (opt === 'un-verset') {
        if (passageV42Wrap) passageV42Wrap.classList.toggle('one-per-line', isChecked);
        if (passageV43Wrap) passageV43Wrap.classList.toggle('one-per-line', isChecked);
        if (passageV44Wrap) passageV44Wrap.classList.toggle('one-per-line', isChecked);
      } else if (opt === 'immersion' && livePassage) {
        if (isChecked) {
          livePassage.style.filter = "sepia(0.25) contrast(1.05)";
        } else {
          livePassage.style.filter = "none";
        }
      }
    });
  });

  // 3. Pastille Carte Interactive (Hover & Click)
  if (passageMapBadge && passageMapPopover) {
    passageMapBadge.addEventListener('mouseenter', () => {
      passageMapPopover.classList.add('show');
    });
    passageMapBadge.addEventListener('mouseleave', (e) => {
      if (!e.relatedTarget || !passageMapPopover.contains(e.relatedTarget)) {
        passageMapPopover.classList.remove('show');
      }
    });
    passageMapPopover.addEventListener('mouseleave', () => {
      passageMapPopover.classList.remove('show');
    });
    passageMapBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      passageMapPopover.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!passageMapPopover.contains(e.target) && !passageMapBadge.contains(e.target)) {
        passageMapPopover.classList.remove('show');
      }
    });
  }

  // 4. Thèmes Ambiance (Auto, Blanc, Sépia, Nuit)
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      themeBtns.forEach(b => {
        b.classList.remove('active');
        const c = b.querySelector('.theme-circle');
        if (c && c.textContent === '✓') c.textContent = '';
      });

      btn.classList.add('active');
      const circle = btn.querySelector('.theme-circle');
      if (circle) circle.textContent = '✓';

      const theme = btn.getAttribute('data-theme');
      if (livePassage && theme) {
        livePassage.className = `display-live-passage-box theme-${theme}`;
      }
    });
  });

  // 5. Options Typographiques (Mots entre crochets, Notes d'Appel, Césures)
  let currentBracket = 'bracket';
  let currentNote = 'sup';
  let currentCesure = 'indent';

  function updateTypographyPassage() {
    if (passageBracket) {
      if (currentBracket === 'bracket') passageBracket.innerHTML = '[ Pierre ]';
      else if (currentBracket === 'italic') passageBracket.innerHTML = '<em>Pierre</em>';
      else if (currentBracket === 'plain') passageBracket.innerHTML = 'Pierre';
    }

    if (passageNoteContainer) {
      if (currentNote === 'sup') {
        passageNoteContainer.innerHTML = `<span class="note-call-badge" id="passage-note-badge" title="Afficher l'explication textuelle">n<div class="note-call-popover" id="note-popover-42"><div class="note-popover-header"><span class="note-popover-tag">EXPLICATION TEXTUELLE</span><span class="note-popover-verse">Verset 42</span></div><div class="note-popover-body">« c'est-à-dire, Pierre »</div></div></span>`;
      } else if (currentNote === 'inline') {
        passageNoteContainer.innerHTML = ` <span style="font-size: 0.78rem; color: #8C532B; font-style: italic; font-weight: normal;">(c'est-à-dire, Pierre)</span>`;
      } else if (currentNote === 'hidden') {
        passageNoteContainer.innerHTML = '';
      }
    }

    if (passageV44Wrap) {
      if (currentCesure === 'indent') {
        passageV44Wrap.style.paddingLeft = '12px';
      } else if (currentCesure === 'dash') {
        passageV44Wrap.style.paddingLeft = '0';
      } else {
        passageV44Wrap.style.paddingLeft = '0';
      }
    }
  }

  optBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const parentGroup = btn.closest('.opt-btn-group');
      if (parentGroup) {
        parentGroup.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
      }
      btn.classList.add('active');

      if (btn.hasAttribute('data-bracket')) {
        currentBracket = btn.getAttribute('data-bracket');
      } else if (btn.hasAttribute('data-note')) {
        currentNote = btn.getAttribute('data-note');
      } else if (btn.hasAttribute('data-cesure')) {
        currentCesure = btn.getAttribute('data-cesure');
      }

      updateTypographyPassage();
    });
  });
}

/* ==========================================================================
   13. RÉSERVOIR D'ILLUSTRATIONS & BANQUE HOMILÉTIQUE (SLIDE 5 DEEP-DIVE)
   ========================================================================== */
function initIllustrationsReservoirInteractions() {
  const searchInput = document.getElementById('ill-search-input');
  const catPills = document.querySelectorAll('.ill-cat-pill');
  const cardItems = document.querySelectorAll('.ill-card-item');

  // 1. Accordéon interactif pour toutes les cartes
  cardItems.forEach(card => {
    const head = card.querySelector('.ill-card-head');
    if (head) {
      head.addEventListener('click', () => {
        const isOpen = card.classList.contains('open');
        cardItems.forEach(c => c.classList.remove('open'));
        if (!isOpen) {
          card.classList.add('open');
        }
      });
    }

    // Gestion du bouton copier de chaque carte
    const copyBtn = card.querySelector('.ill-copy-btn-showcase');
    const quoteEl = card.querySelector('.ill-unfolded-quote');
    if (copyBtn && quoteEl) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = quoteEl.innerText.trim();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
        const orig = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Copié pour votre sermon !</span>
        `;
        copyBtn.style.background = '#ECFDF5';
        copyBtn.style.color = '#059669';
        copyBtn.style.borderColor = '#10B981';
        setTimeout(() => {
          copyBtn.innerHTML = orig;
          copyBtn.style.background = '';
          copyBtn.style.color = '';
          copyBtn.style.borderColor = '';
        }, 2200);
      });
    }
  });

  // 2. Filtres par catégorie
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const selectedCat = pill.getAttribute('data-cat') || 'all';
      cardItems.forEach(card => {
        const cardCat = card.getAttribute('data-cat');
        if (selectedCat === 'all' || cardCat === selectedCat) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // 3. Recherche filtrante
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      cardItems.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }
}

/* ==========================================================================
   14. OPTIONS DU MOTEUR D'ÉTUDE & RAG BGE-M3 (SLIDE 6 DEEP-DIVE)
   ========================================================================== */
function initEngineOptionsInteractions() {
  const track = document.getElementById('engine-slider-track');
  const steps = document.querySelectorAll('#engine-slider-steps span');
  const progress = document.getElementById('engine-slider-progress');
  const knob = document.getElementById('engine-slider-knob');
  const calloutTokens = document.getElementById('engine-callout-tokens');
  const calloutTime = document.getElementById('engine-callout-time');
  const calloutDesc = document.getElementById('engine-callout-desc');
  const checkboxRows = document.querySelectorAll('.engine-checkbox-row');
  const btnModify = document.getElementById('engine-btn-modify');

  const stepData = [
    {
      pct: 5,
      tokens: "~250 tokens / source",
      time: "≈ 10–25 s",
      desc: "Contexte ultra-léger et rapide — idéal pour requêtes ponctuelles et définitions simples."
    },
    {
      pct: 35,
      tokens: "~600 tokens / source",
      time: "≈ 45–90 s",
      desc: "Contexte équilibré — bon compromis vitesse / richesse doctrinale."
    },
    {
      pct: 68,
      tokens: "~1 200 tokens / source",
      time: "≈ 2–4 min",
      desc: "Analyse dense intégrant l'histoire du texte, les variantes manuscrites et les Pères de l'Église."
    },
    {
      pct: 98,
      tokens: "~2 500 tokens / source",
      time: "≈ 5–8 min",
      desc: "Exploration exhaustive des 4 corpus, synthèse multi-traditionnelle et garde-fous herméneutiques maximaux."
    }
  ];

  function applyStep(idx, snap = true) {
    const data = stepData[idx] || stepData[1];
    steps.forEach((s, i) => {
      s.classList.toggle('active', i === idx);
    });

    if (snap) {
      if (progress) progress.style.width = `${data.pct}%`;
      if (knob) knob.style.left = `${data.pct}%`;
    }

    if (calloutTokens) calloutTokens.textContent = data.tokens;
    if (calloutTime) calloutTime.textContent = data.time;
    if (calloutDesc) calloutDesc.textContent = data.desc;
  }

  // 1. Clic direct sur les labels
  steps.forEach(step => {
    step.addEventListener('click', () => {
      const idx = parseInt(step.getAttribute('data-step') || '1', 10);
      applyStep(idx, true);
    });
  });

  // 2. Glissement (Drag & Drop) du curseur sur la piste
  let isDragging = false;

  function handleDrag(clientX) {
    if (!track) return;
    const rect = track.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));

    const pct = ratio * 100;
    if (progress) progress.style.width = `${pct}%`;
    if (knob) knob.style.left = `${pct}%`;

    // Calcul du step le plus proche (0, 1, 2, 3)
    let closestIdx = 0;
    let minDiff = Infinity;
    stepData.forEach((s, idx) => {
      const diff = Math.abs(s.pct - pct);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    applyStep(closestIdx, false);
  }

  if (track) {
    track.addEventListener('mousedown', (e) => {
      isDragging = true;
      handleDrag(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      handleDrag(e.clientX);
    });

    window.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      if (track) {
        const rect = track.getBoundingClientRect();
        let ratio = (e.clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        const pct = ratio * 100;
        let closestIdx = 0;
        let minDiff = Infinity;
        stepData.forEach((s, idx) => {
          const diff = Math.abs(s.pct - pct);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
          }
        });
        applyStep(closestIdx, true);
      }
    });

    // Support tactile pour le glissement
    track.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        handleDrag(e.touches[0].clientX);
      }
    }, { passive: true });

        window.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length === 0) return;
      handleDrag(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const activeStep = document.querySelector('#engine-slider-steps span.active');
      const idx = activeStep ? parseInt(activeStep.getAttribute('data-step') || '1', 10) : 1;
      applyStep(idx, true);
    });
  }

  // 3. Checkboxes Toggle
  checkboxRows.forEach(row => {
    row.addEventListener('click', () => {
      const check = row.querySelector('.engine-check');
      if (check) {
        check.classList.toggle('checked');
        check.textContent = check.classList.contains('checked') ? '✓' : '';
      }
    });
  });

  // 4. Bouton Modifier inerte (aucun effet)
  if (btnModify) {
    btnModify.addEventListener('click', (e) => {
      e.preventDefault();
      // Inerte comme demandé
    });
  }
}

/* ==========================================================================
   15. COMMENTAIRES HISTORIQUES & CROISÉS (SLIDE 7 DEEP-DIVE)
   ========================================================================== */
function initCommentariesInteractions() {
  const tabBtns = document.querySelectorAll('.comm-tab-btn');
  const bookIcon = document.getElementById('comm-book-icon');
  const authorTitle = document.getElementById('comm-author-title');
  const authorSub = document.getElementById('comm-author-sub');
  const passageBadge = document.getElementById('comm-passage-badge');
  const bodyText = document.getElementById('comm-body-text');
  const btnCopy = document.getElementById('comm-btn-copy');
  const btnNote = document.getElementById('comm-btn-note');

  const commentariesData = {
    tgc: {
      iconClass: 'tgc',
      iconText: 'TGC',
      title: 'The Gospel Coalition (TGC)',
      sub: 'TGC Commentary (2021-2024)',
      passage: '📖 Jean 1:43–51 (Andreas Köstenberger)',
      html: `<p>La réponse sceptique de Nathanaël (v. 46) est surmontée par sa rencontre personnelle avec Jésus, qui révèle l'avoir vu sous le figuier avant l'appel de Philippe. Le figuier est un symbole messianique d'Israël (<span class="comm-ref-wrapper"><span class="comm-ref-pill">1 Rois 4.25</span><span class="comm-ref-popover"><span class="comm-pop-title">1 Rois 4:25 · OST</span><span class="comm-pop-desc">« Et Juda et Israël habitaient en sécurité, chacun sous sa vigne et sous son figuier, depuis Dan jusqu’à Béer-Shéba, tous les jours de Salomon. »</span><span class="comm-pop-link">Cliquer pour ouvrir →</span></span></span>) aux riches connotations eschatologiques (<span class="comm-ref-wrapper"><span class="comm-ref-pill">Michée 4.4</span><span class="comm-ref-popover"><span class="comm-pop-title">Michée 4:4 · OST</span><span class="comm-pop-desc">« Ils habiteront chacun sous sa vigne et sous son figuier, et il n’y aura personne qui les trouble ; car la bouche de l’Éternel a parlé. »</span><span class="comm-pop-link">Cliquer pour ouvrir →</span></span></span>).</p>`
    },
    godet: {
      iconClass: 'godet',
      iconText: 'BAG',
      title: 'Bible annotée (Godet & Neuchâtel)',
      sub: 'Frédéric Godet et collab. (1899)',
      passage: '📖 Jean 1:46 (Frédéric Godet)',
      html: `<p>Le rôle de Philippe dans la vocation de Nathanaël est semblable à celui d’André pour Pierre. Un flambeau allumé sert à en allumer un autre ; ainsi se propage la foi vivante. — Godet</p><p>C’est en chemin vers la Galilée (<span class="comm-ref-wrapper"><span class="comm-ref-pill light">v. 44</span><span class="comm-ref-popover"><span class="comm-pop-title">Jean 1:44 · OST</span><span class="comm-pop-desc">« Or, Philippe était de Bethsaïda, de la ville d’André et de Pierre. »</span><span class="comm-pop-link">Cliquer pour ouvrir →</span></span></span>) que Philippe trouve Nathanaël, alors que celui-ci cherchait la vérité.</p>`
    },
    robertson: {
      iconClass: 'robertson',
      iconText: 'ATR',
      title: 'Robertson (Images verbales NT)',
      sub: 'A.T. Robertson (1933)',
      passage: '📖 Jean 1:46 (A.T. Robertson)',
      html: `<p><strong>Peut-il venir de Nazareth quelque chose de bon ?</strong> (Ἐκ Ναζαρετ δυναται τι ἀγαθον ειναι ;). Littéralement : « Hors de Nazareth peut-il être quelque bien ? ».</p><p>Une nuance de mépris reflétant la rivalité entre villes voisines. Une sentence fausse prétendait qu’aucun prophète ne sort de Galilée (<span class="comm-ref-wrapper"><span class="comm-ref-pill light">Jn 7.52</span><span class="comm-ref-popover"><span class="comm-pop-title">Jean 7:52 · OST</span><span class="comm-pop-desc">« Ils lui répondirent : Es-tu aussi Galiléen ? Examine, et vois qu’aucun prophète n’est sorti de la Galilée. »</span><span class="comm-pop-link">Cliquer pour ouvrir →</span></span></span>).</p>`
    }
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const commKey = btn.getAttribute('data-comm') || 'tgc';
      const data = commentariesData[commKey] || commentariesData.tgc;

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (bookIcon) {
        bookIcon.className = `comm-book-icon ${data.iconClass}`;
        bookIcon.textContent = data.iconText;
      }
      if (authorTitle) authorTitle.textContent = data.title;
      if (authorSub) authorSub.textContent = data.sub;
      if (passageBadge) passageBadge.textContent = data.passage;
      if (bodyText) bodyText.innerHTML = data.html;
    });
  });

  if (btnCopy && bodyText) {
    btnCopy.addEventListener('click', () => {
      const textToCopy = bodyText.innerText;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).catch(() => {});
      }
      const orig = btnCopy.innerHTML;
      btnCopy.innerHTML = `✓ Copié !`;
      setTimeout(() => { btnCopy.innerHTML = orig; }, 2000);
    });
  }

  if (btnNote) {
    btnNote.addEventListener('click', () => {
      const orig = btnNote.innerHTML;
      btnNote.innerHTML = `✓ Note créée !`;
      setTimeout(() => { btnNote.innerHTML = orig; }, 2000);
    });
  }

  // Support du tap tactile / clic sur les renvois bibliques (infobulles)
  if (bodyText) {
    bodyText.addEventListener('click', (e) => {
      const pill = e.target.closest('.comm-ref-pill');
      if (pill) {
        e.stopPropagation();
        e.preventDefault();
        const wrapper = pill.closest('.comm-ref-wrapper');
        if (wrapper) {
          const wasOpen = wrapper.classList.contains('is-open');
          bodyText.querySelectorAll('.comm-ref-wrapper.is-open').forEach(w => w.classList.remove('is-open'));
          if (!wasOpen) {
            wrapper.classList.add('is-open');
          }
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.comm-ref-wrapper')) {
        bodyText.querySelectorAll('.comm-ref-wrapper.is-open').forEach(w => w.classList.remove('is-open'));
      }
    });
  }
}

/* ==========================================================================
   8. MOBILE NAVIGATION MENU
   ========================================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navLinks.classList.toggle('is-mobile-open');
    toggleBtn.textContent = isOpen ? '✕' : '☰';
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-mobile-open');
      toggleBtn.textContent = '☰';
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!toggleBtn.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('is-mobile-open');
      toggleBtn.textContent = '☰';
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ==========================================================================
   9. MINDMAP SHOWCASE INTERACTIONS (Épître aux Romains - Tony Buzan)
   ========================================================================== */
function initMindmapShowcase() {
  const stage = document.getElementById('mm-canvas-stage');
  const btnDark = document.getElementById('btn-mm-theme-dark');
  const btnPaper = document.getElementById('btn-mm-theme-paper');
  const btnPdf = document.getElementById('btn-mm-demo-pdf');
  const btnPng = document.getElementById('btn-mm-demo-png');
  const tooltip = document.getElementById('mm-floating-tooltip');
  const tooltipContent = document.getElementById('mm-tooltip-content');
  if (!stage) return;

  // Toggle Mode Papier Sépia / Mode Sombre
  if (btnDark && btnPaper) {
    btnPaper.addEventListener('click', () => {
      stage.classList.add('paper-mode');
      btnPaper.classList.add('active');
      btnDark.classList.remove('active');
    });

    btnDark.addEventListener('click', () => {
      stage.classList.remove('paper-mode');
      btnDark.classList.add('active');
      btnPaper.classList.remove('active');
    });
  }

  // Toast interactif réutilisable
  const showToast = (msg) => {
    let toast = document.getElementById('mm-toast-notice');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mm-toast-notice';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.95);color:#38bdf8;padding:12px 24px;border:1px solid rgba(56,189,248,0.4);border-radius:30px;font-size:0.88rem;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:9999;transition:opacity 0.3s ease;pointer-events:none;display:flex;align-items:center;gap:8px;';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> ${msg}`;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3200);
  };

  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      showToast("Démonstration : Export PDF vectoriel HD généré (prêt pour impression traceur/cours)");
    });
  }

  if (btnPng) {
    btnPng.addEventListener('click', () => {
      showToast("Démonstration : Image PNG transparente haute résolution prête pour vos diaporamas");
    });
  }

  // Gestion des Infobulles Flottantes (Stabilisées contre tout scintillement)
  let activeTooltipTarget = null;

  const showTooltip = (targetEl, html) => {
    if (!tooltip || !tooltipContent) return;
    if (activeTooltipTarget === targetEl) return;
    activeTooltipTarget = targetEl;

    const stageRect = stage.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    tooltipContent.innerHTML = html;

    const left = Math.round(targetRect.left - stageRect.left + (targetRect.width / 2));
    const top = Math.round(targetRect.top - stageRect.top - 8);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.display = 'block';

    requestAnimationFrame(() => {
      tooltip.classList.add('is-visible');
    });
  };

  const hideTooltip = () => {
    activeTooltipTarget = null;
    if (tooltip) {
      tooltip.classList.remove('is-visible');
      tooltip.style.display = 'none';
    }
  };

  // Dictionnaire Complet des Infobulles Exégétiques et Bibliques — Version Néo-Crampon Libre (NCL)
  const tooltipsData = {
    // 1. JUSTIFICATION
    'badge-verse-justif': {
      header: 'Verset (Néo-Crampon Libre)',
      ref: 'Romains 3:21-22 (Rm 3:21-5:21)',
      text: '« Mais maintenant, sans la Loi, a été manifestée une justice de Dieu à laquelle rendent témoignage la Loi et les Prophètes, justice de Dieu par la foi en Jésus-Christ pour tous ceux et à tous ceux qui croient ; il n’y a pas de distinction. »',
      hint: 'Cliquer pour ouvrir dans le lecteur biblique',
      toast: 'Lecteur biblique : Romains 3:21-5:21 (Néo-Crampon Libre)'
    },
    'badge-note-justif': {
      header: 'Note de branche',
      isNote: true,
      body: 'Révélation de la justice salvifique indépendamment des mérites légaux par l\'œuvre expiatoire du Christ (Sola Fide).',
      hint: 'Cliquer ou F4 pour modifier',
      toast: 'Éditeur : Note de branche JUSTIFICATION ouverte'
    },
    // 2. CONDAMNATION
    'badge-verse-condem': {
      header: 'Verset (Néo-Crampon Libre)',
      ref: 'Romains 1:18 ; 3:10 (Rm 1:18-3:20)',
      text: '« En effet, la colère de Dieu éclate du haut du ciel contre toute impiété et toute injustice des hommes, qui, par leur injustice, retiennent la vérité captive... selon qu’il est écrit : Il n’y a pas de juste, pas même un seul. »',
      hint: 'Cliquer pour ouvrir dans le lecteur biblique',
      toast: 'Lecteur biblique : Romains 1:18-3:20 (Néo-Crampon Libre)'
    },
    'badge-note-condem': {
      header: 'Note de branche',
      isNote: true,
      body: 'Diagnostic universel de l\'apostasie humaine : païens sans loi et juifs sous la Loi sont sans excuse devant la sainteté divine.',
      hint: 'Cliquer ou F4 pour modifier',
      toast: 'Éditeur : Note de branche CONDAMNATION ouverte'
    },
    // 3. LIBÉRATION
    'badge-verse-lib': {
      header: 'Verset (Néo-Crampon Libre)',
      ref: 'Romains 8:1-2 (Rm 6:1-8:39)',
      text: '« Il n’y a donc maintenant aucune condamnation pour ceux qui sont en Jésus-Christ. En effet, la loi de l’Esprit de la vie m’a affranchi en Jésus-Christ de la loi du péché et de la mort. »',
      hint: 'Cliquer pour ouvrir dans le lecteur biblique',
      toast: 'Lecteur biblique : Romains 6:1-8:39 (Néo-Crampon Libre)'
    },
    'badge-note-lib': {
      header: 'Note de branche',
      isNote: true,
      body: 'Sanctification trinitaire : union mystique par le baptême (Rm 6), affranchissement de la tyrannie légale (Rm 7), vie triomphante par l\'Esprit (Rm 8).',
      hint: 'Cliquer ou F4 pour modifier',
      toast: 'Éditeur : Note de branche LIBÉRATION ouverte'
    },
    // 4. ISRAËL
    'badge-verse-israel': {
      header: 'Verset (Néo-Crampon Libre)',
      ref: 'Romains 11:29, 33 (Rm 9:1-11:36)',
      text: '« Car les dons et la vocation de Dieu sont sans repentance. Ô profondeur inépuisable et de la sagesse et de la science de Dieu ! Que ses jugements sont insondables et ses voies incompréhensibles ! »',
      hint: 'Cliquer pour ouvrir dans le lecteur biblique',
      toast: 'Lecteur biblique : Romains 9:1-11:36 (Néo-Crampon Libre)'
    },
    'badge-note-israel': {
      header: 'Note de branche',
      isNote: true,
      body: 'Théodicée historique : la fidélité de Dieu envers ses alliances, l\'endurcissement partiel pour le salut des nations et la réintégration eschatologique.',
      hint: 'Cliquer ou F4 pour modifier',
      toast: 'Éditeur : Note de branche ISRAËL ouverte'
    },
    // 5. ÉTHIQUE
    'badge-verse-ethique': {
      header: 'Verset (Néo-Crampon Libre)',
      ref: 'Romains 12:1-2 (Rm 12:1-16:27)',
      text: '« Je vous exhorte donc, mes frères, par la miséricorde de Dieu, à offrir vos corps comme une hostie vivante, sainte, agréable à Dieu : c’est là le culte spirituel que vous lui devez. Et ne vous conformez pas au siècle présent, mais transformez-vous par le renouvellement de l’esprit... »',
      hint: 'Cliquer pour ouvrir dans le lecteur biblique',
      toast: 'Lecteur biblique : Romains 12:1-16:27 (Néo-Crampon Libre)'
    },
    'badge-note-ethique': {
      header: 'Note de branche',
      isNote: true,
      body: 'Orthopraxie évangélique : l\'éthique vécue comme offrande sacerdotale, gestion chrétienne de la cité, amour fraternel et communion sans jugement.',
      hint: 'Cliquer ou F4 pour modifier',
      toast: 'Éditeur : Note de branche ÉTHIQUE ouverte'
    },
    // 6. CONTEXTE CORINTHE 57
    'badge-note-contexte': {
      header: 'Note historique & exégétique',
      isNote: true,
      body: 'Rédigée pendant le séjour de Paul à Corinthe (chez Gaïus), transcrite par l\'amanuensis Tertius (Rm 16:22) et confiée à Phœbé diaconesse de Cenchrées.',
      hint: 'Cliquer ou F4 pour modifier',
      toast: 'Éditeur : Note historique de CONTEXTE ouverte'
    },
    // SOUS-BRANCHES CLÉS (NÉO-CRAMPON LIBRE)
    'badge-sub-foi': {
      header: 'Doctrine (Rm 3:28 • NCL)',
      ref: 'Romains 3:28',
      text: '« Car nous tenons pour certain que l’homme est justifié par la foi, à l’exclusion des œuvres de la Loi. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 3:28 (Néo-Crampon Libre)'
    },
    'badge-sub-abraham': {
      header: 'Typologie biblique (Rm 4:3 • NCL)',
      ref: 'Romains 4:3',
      text: '« En effet, que dit l’Écriture ? Abraham crut à Dieu, et cela lui fut imputé à justice. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 4:3 (Néo-Crampon Libre)'
    },
    'badge-sub-paix': {
      header: 'Fruit salvifique (Rm 5:1 • NCL)',
      ref: 'Romains 5:1',
      text: '« Étant donc justifiés par la foi, nous avons la paix avec Dieu par Notre-Seigneur Jésus-Christ. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 5:1 (Néo-Crampon Libre)'
    },
    'badge-sub-redaction': {
      header: 'Contexte géographique (Ac 20:2-3 • NCL)',
      ref: 'Actes 20:2-3',
      text: '« Il parcourut cette contrée, en adressant aux disciples de nombreuses exhortations, et se rendit en Grèce, où il passa trois mois. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Actes 20:2-3 (Néo-Crampon Libre)'
    },
    'badge-sub-espagne': {
      header: 'Vision missionnaire (Rm 15:24 • NCL)',
      ref: 'Romains 15:24',
      text: '« J’espère vous voir en passant, quand je me rendrai en Espagne, et y être accompagné par vous, après que j’aurai satisfait, en partie du moins, mon désir de me trouver parmi vous. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 15:24 (Néo-Crampon Libre)'
    },
    'badge-sub-paiens': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 1:19-20',
      text: '« En effet ses perfections invisibles, son éternelle puissance et sa divinité sont, depuis la création du monde, rendues visibles à l’intelligence par le moyen de ses œuvres. Ils sont donc inexcusables. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 1:18-32 (Néo-Crampon Libre)'
    },
    'badge-sub-juifs': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 2:1',
      text: '« Ainsi, qui que tu sois, ô homme, toi qui juges, tu es inexcusable ; car, en jugeant les autres, tu te condamnes toi-même, puisque tu fais les mêmes choses, toi qui juges. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 2:1-3:8 (Néo-Crampon Libre)'
    },
    'badge-sub-verdict': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 3:9',
      text: '« Eh bien donc ? Avons-nous quelque supériorité ? Non, aucune ; car nous venons de prouver que tous, Juifs et Grecs sont sous le péché. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 3:9-20 (Néo-Crampon Libre)'
    },
    'badge-sub-bapteme': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 6:3-4',
      text: '« Ne savez-vous pas que nous tous qui avons été baptisés en Jésus-Christ, c’est en sa mort que nous avons été baptisés ? Nous avons donc été ensevelis avec lui par le baptême en sa mort... »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 6 (Néo-Crampon Libre)'
    },
    'badge-sub-loi': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 7:6',
      text: '« Mais maintenant nous avons été dégagés de la Loi, étant morts à la Loi, sous l’autorité de laquelle nous étions tenus, de sorte que nous servons Dieu dans un esprit nouveau, et non selon une lettre surannée. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 7 (Néo-Crampon Libre)'
    },
    'badge-sub-esprit': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 8:14-16',
      text: '« Car tous ceux qui sont conduits par l’Esprit de Dieu sont fils de Dieu. En effet, vous n’avez pas reçu un Esprit de servitude, pour être encore dans la crainte ; mais vous avez reçu un Esprit d’adoption, en qui nous crions : Abba ! Père ! »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 8 (Néo-Crampon Libre)'
    },
    'badge-sub-election': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 9:15-16',
      text: '« Car il dit à Moïse : Je ferai miséricorde à qui je veux faire miséricorde, et j’aurai compassion de qui je veux avoir compassion. Ainsi donc l’élection ne dépend ni de la volonté, ni des efforts, mais de Dieu qui fait miséricorde. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 9 (Néo-Crampon Libre)'
    },
    'badge-sub-trebuchement': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 10:9-10',
      text: '« Si tu confesses de ta bouche Jésus comme Seigneur, et si tu crois dans ton cœur que Dieu l’a ressuscité des morts tu seras sauvé. Car c’est en croyant de cœur qu’on parvient à la justice, et c’est en confessant de bouche qu’on parvient au salut. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 10 (Néo-Crampon Libre)'
    },
    'badge-sub-restauration': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 11:25-26',
      text: '« Car je ne veux pas, frères, que vous ignoriez ce mystère... c’est qu’une partie d’Israël est tombée dans l’aveuglement jusqu’à ce que la masse des Gentils soit entrée. Et ainsi tout Israël sera sauvé. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 11 (Néo-Crampon Libre)'
    },
    'badge-sub-consecration': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 12:2',
      text: '« Et ne vous conformez pas au siècle présent, mais transformez-vous par le renouvellement de l’esprit, afin que vous éprouviez quelle est la volonté de Dieu, ce qui est bon, ce qui lui est agréable, ce qui est parfait. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 12 (Néo-Crampon Libre)'
    },
    'badge-sub-cite': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 13:1',
      text: '« Que toute âme soit soumise aux autorités supérieures ; car il n’y a pas d’autorité qui ne vienne de Dieu, et celles qui existent ont été instituées par lui. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 13 (Néo-Crampon Libre)'
    },
    'badge-sub-unite': {
      header: 'Passage exégétique (Néo-Crampon Libre)',
      ref: 'Romains 14:1 ; 15:7',
      text: '« Quant à celui qui est faible dans la foi, accueillez-le sans discuter ses opinions. Accueillez-vous donc les uns les autres, comme le Christ vous a accueillis, pour la gloire de Dieu. »',
      hint: 'Cliquer pour ouvrir le verset',
      toast: 'Lecteur biblique : Romains 14-16 (Néo-Crampon Libre)'
    }
  };

  // Câblage de toutes les infobulles
  Object.keys(tooltipsData).forEach(badgeId => {
    const el = document.getElementById(badgeId);
    if (!el) return;
    const item = tooltipsData[badgeId];

    let html = '';
    if (item.isNote) {
      const noteSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
      html = `
        <div class="mm-tooltip-header">${noteSvg}<span>${item.header}</span></div>
        <div class="mm-tooltip-body">${item.body}</div>
        <div class="mm-tooltip-hint">${item.hint}</div>
      `;
    } else {
      const bibleSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
      html = `
        <div class="mm-tooltip-header">${bibleSvg}<span>${item.header}</span></div>
        <div class="mm-tooltip-ref">${item.ref}</div>
        <div class="mm-tooltip-verse-text">${item.text}</div>
        <div class="mm-tooltip-hint">${item.hint}</div>
      `;
    }

    el.addEventListener('mouseenter', () => showTooltip(el, html));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.toast) showToast(item.toast);
    });
  });

  // Sélection Universelle au Clic sur N'IMPORTE QUELLE Capsule (Captures 3 & 4)
  const selectableNodeIds = [
    'mm-node-root',
    'mm-node-contexte',
    'mm-node-justification',
    'mm-node-israel',
    'mm-node-condamnation',
    'mm-node-liberation',
    'mm-node-ethique'
  ];

  const nodeOffsets = {
    'mm-node-root': { dx: 0, dy: 0 },
    'mm-node-contexte': { dx: 0, dy: 0 },
    'mm-node-justification': { dx: 0, dy: 0 },
    'mm-node-israel': { dx: 0, dy: 0 },
    'mm-node-condamnation': { dx: 0, dy: 0 },
    'mm-node-liberation': { dx: 0, dy: 0 },
    'mm-node-ethique': { dx: 0, dy: 0 }
  };

  const defaultCurvePaths = {
    'curve-justif': 'M 660 285 C 640 285, 620 285, 595 285',
    'curve-contexte': 'M 680 259 C 635 180, 595 110, 555 95',
    'curve-israel': 'M 680 311 C 635 385, 605 450, 575 473',
    'curve-condem': 'M 800 259 C 835 180, 865 110, 895 95',
    'curve-lib': 'M 820 285 C 845 285, 870 285, 895 285',
    'curve-ethique': 'M 800 311 C 835 385, 865 450, 895 473',
    'curve-relation': 'M 595 261 C 655 180, 770 115, 895 95'
  };

  const svgArt = stage.querySelector('.mindmap-svg-art');

  const getSVGCoordinates = (e) => {
    if (!svgArt) return { x: e.clientX, y: e.clientY };
    const pt = svgArt.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgArt.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: e.clientX, y: e.clientY };
  };

  const getBezierPoint = (t, p0, p1, p2, p3) => {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  };

  const updateMindmapCurves = () => {
    const isDefault = Object.values(nodeOffsets).every(o => o.dx === 0 && o.dy === 0);
    if (isDefault) {
      Object.keys(defaultCurvePaths).forEach(cid => {
        const el = document.getElementById(cid);
        if (el) el.setAttribute('d', defaultCurvePaths[cid]);
      });
      const badgeRel = document.getElementById('badge-relation');
      if (badgeRel) badgeRel.setAttribute('transform', 'translate(655, 142)');
      return;
    }

    const root = nodeOffsets['mm-node-root'] || { dx: 0, dy: 0 };
    const justif = nodeOffsets['mm-node-justification'] || { dx: 0, dy: 0 };
    const ctx = nodeOffsets['mm-node-contexte'] || { dx: 0, dy: 0 };
    const isr = nodeOffsets['mm-node-israel'] || { dx: 0, dy: 0 };
    const cnd = nodeOffsets['mm-node-condamnation'] || { dx: 0, dy: 0 };
    const lib = nodeOffsets['mm-node-liberation'] || { dx: 0, dy: 0 };
    const eth = nodeOffsets['mm-node-ethique'] || { dx: 0, dy: 0 };

    // 1. Vers Justification (Gauche Centre)
    const curveJustif = document.getElementById('curve-justif');
    if (curveJustif) {
      const sx = 660 + root.dx;
      const sy = 285 + root.dy;
      const ex = 595 + justif.dx;
      const ey = 285 + justif.dy;
      const cx1 = sx - (sx - ex) * 0.35;
      const cy1 = sy;
      const cx2 = ex + (sx - ex) * 0.35;
      const cy2 = ey;
      curveJustif.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }

    // 2. Vers Contexte Corinthe 57 (Gauche Haut)
    const curveCtx = document.getElementById('curve-contexte');
    if (curveCtx) {
      const sx = 680 + root.dx;
      const sy = 259 + root.dy;
      const ex = 555 + ctx.dx;
      const ey = 95 + ctx.dy;
      const cx1 = sx - (sx - ex) * 0.35;
      const cy1 = sy - (sy - ey) * 0.45;
      const cx2 = ex + (sx - ex) * 0.35;
      const cy2 = ey + (sy - ey) * 0.20;
      curveCtx.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }

    // 3. Vers Israël (Gauche Bas)
    const curveIsr = document.getElementById('curve-israel');
    if (curveIsr) {
      const sx = 680 + root.dx;
      const sy = 311 + root.dy;
      const ex = 575 + isr.dx;
      const ey = 473 + isr.dy;
      const cx1 = sx - (sx - ex) * 0.42;
      const cy1 = sy + (ey - sy) * 0.45;
      const cx2 = ex + (sx - ex) * 0.28;
      const cy2 = ey - (ey - sy) * 0.14;
      curveIsr.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }

    // 4. Vers Condamnation (Droite Haut)
    const curveCnd = document.getElementById('curve-condem');
    if (curveCnd) {
      const sx = 800 + root.dx;
      const sy = 259 + root.dy;
      const ex = 895 + cnd.dx;
      const ey = 95 + cnd.dy;
      const cx1 = sx + (ex - sx) * 0.37;
      const cy1 = sy - (sy - ey) * 0.48;
      const cx2 = ex - (ex - sx) * 0.31;
      const cy2 = ey + (sy - ey) * 0.09;
      curveCnd.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }

    // 5. Vers Libération (Droite Centre)
    const curveLib = document.getElementById('curve-lib');
    if (curveLib) {
      const sx = 820 + root.dx;
      const sy = 285 + root.dy;
      const ex = 895 + lib.dx;
      const ey = 285 + lib.dy;
      const cx1 = sx + (ex - sx) * 0.35;
      const cy1 = sy;
      const cx2 = ex - (ex - sx) * 0.35;
      const cy2 = ey;
      curveLib.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }

    // 6. Vers Éthique (Droite Bas)
    const curveEth = document.getElementById('curve-ethique');
    if (curveEth) {
      const sx = 800 + root.dx;
      const sy = 311 + root.dy;
      const ex = 895 + eth.dx;
      const ey = 473 + eth.dy;
      const cx1 = sx + (ex - sx) * 0.37;
      const cy1 = sy + (ey - sy) * 0.45;
      const cx2 = ex - (ex - sx) * 0.31;
      const cy2 = ey - (ey - sy) * 0.14;
      curveEth.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    }

    // 7. Relation Justification -> Condamnation + Badge
    const curveRel = document.getElementById('curve-relation');
    const badgeRel = document.getElementById('badge-relation');
    if (curveRel) {
      const sx = 595 + justif.dx;
      const sy = 261 + justif.dy;
      const ex = 895 + cnd.dx;
      const ey = 95 + cnd.dy;
      const cx1 = sx + (ex - sx) * 0.20;
      const cy1 = sy - (sy - ey) * 0.49;
      const cx2 = ex - (ex - sx) * 0.42;
      const cy2 = ey + (sy - ey) * 0.12;
      curveRel.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);

      if (badgeRel) {
        const bx = getBezierPoint(0.42, sx, cx1, cx2, ex);
        const by = getBezierPoint(0.42, sy, cy1, cy2, ey);
        badgeRel.setAttribute('transform', `translate(${(bx - 85).toFixed(1)}, ${(by - 11).toFixed(1)})`);
      }
    }
  };

  const selectNode = (selectedEl) => {
    selectableNodeIds.forEach(id => {
      const node = document.getElementById(id);
      if (node) node.classList.remove('is-selected');
    });
    if (selectedEl) {
      selectedEl.classList.add('is-selected');
    }
  };

  // Drag & Drop interactif des capsules sélectionnées
  let activeDragNode = null;
  let dragStartCoords = { x: 0, y: 0 };
  let nodeStartOffset = { dx: 0, dy: 0 };
  let hasMoved = false;

  const onPointerDown = (e, nodeId) => {
    // Ne pas déclencher le drag sur les boutons d'actions, infobulles ou textes de sous-branches
    if (e.target.closest('.mm-action-btn, .mm-scripture-pill, .mm-note-pill, .mm-leaf-text, .mm-sub-node')) return;

    const el = document.getElementById(nodeId);
    if (!el) return;

    selectNode(el);

    activeDragNode = el;
    hasMoved = false;
    dragStartCoords = getSVGCoordinates(e);
    nodeStartOffset = { ...(nodeOffsets[nodeId] || { dx: 0, dy: 0 }) };
  };

  const onPointerMove = (e) => {
    if (!activeDragNode) return;
    const currentCoords = getSVGCoordinates(e);
    const deltaX = currentCoords.x - dragStartCoords.x;
    const deltaY = currentCoords.y - dragStartCoords.y;

    if (!hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      hasMoved = true;
      activeDragNode.classList.add('is-dragging');
      stage.classList.add('is-dragging');
    }

    if (hasMoved) {
      const nodeId = activeDragNode.id;
      const newDx = Math.round(nodeStartOffset.dx + deltaX);
      const newDy = Math.round(nodeStartOffset.dy + deltaY);
      nodeOffsets[nodeId] = { dx: newDx, dy: newDy };
      activeDragNode.setAttribute('transform', `translate(${newDx}, ${newDy})`);
      updateMindmapCurves();
    }
  };

  const onPointerUp = (e) => {
    if (!activeDragNode) return;
    const wasDragging = hasMoved;
    activeDragNode.classList.remove('is-dragging');
    stage.classList.remove('is-dragging');
    activeDragNode = null;
    hasMoved = false;

    if (wasDragging) {
      const clickBlocker = (clickEvent) => {
        clickEvent.stopPropagation();
        window.removeEventListener('click', clickBlocker, true);
      };
      window.addEventListener('click', clickBlocker, true);
    }
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Écouteur de sélection et de drag sur chaque capsule
  selectableNodeIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => onPointerDown(e, id));
    el.addEventListener('click', (e) => {
      if (e.target.closest('.mm-action-btn, .mm-scripture-pill, .mm-note-pill')) return;
      selectNode(el);
    });
  });

  // Bouton de réinitialisation de la disposition
  const btnResetPos = document.getElementById('btn-mm-reset-pos');
  if (btnResetPos) {
    btnResetPos.addEventListener('click', () => {
      selectableNodeIds.forEach(id => {
        nodeOffsets[id] = { dx: 0, dy: 0 };
        const el = document.getElementById(id);
        if (el) {
          el.removeAttribute('transform');
        }
      });
      updateMindmapCurves();
      showToast('Disposition réinitialisée : positions d\'origine restaurées');
    });
  }

  // Sélection initiale : ROMAINS (mot central)
  const rootNode = document.getElementById('mm-node-root');
  if (rootNode) {
    selectNode(rootNode);
  }

  // Écouteurs pour tous les boutons d'action '+' (Ajouter une branche / sous-branche)
  document.querySelectorAll('.mm-action-btn:not(.danger)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentNode = btn.closest('.mm-branch-node, .mm-node-root-group');
      const titleEl = parentNode ? parentNode.querySelector('.mm-node-title, .mm-root-title, .mm-node-text') : null;
      const title = titleEl ? titleEl.textContent.trim() : 'cette branche';
      showToast(`Nouvelle sous-branche ajoutée sous « ${title} »`);
    });
  });

  // Écouteurs pour tous les boutons d'action '×' (Supprimer)
  document.querySelectorAll('.mm-action-btn.danger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentNode = btn.closest('.mm-branch-node, .mm-node-root-group');
      const titleEl = parentNode ? parentNode.querySelector('.mm-node-title, .mm-root-title, .mm-node-text') : null;
      const title = titleEl ? titleEl.textContent.trim() : 'cette branche';
      showToast(`Branche « ${title} » supprimée de la démonstration`);
    });
  });
}


