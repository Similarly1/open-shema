/**
 * Maps View Module (Cartes Bibliques Interactives)
 * Gère le moteur cartographique Leaflet, les tuiles historiques, les marqueurs de lieux bibliques,
 * les itinéraires majeurs et les interactions bidirectionnelles avec le lecteur biblique.
 */

const MapsView = {
  map: null,
  markersLayer: null,
  itineraryLayer: null,
  tileLayers: {},
  currentTileLayer: null,
  activePlaces: [],
  selectedPlace: null,
  activeItineraryId: null,
  itinerariesList: [],
  isInitialized: false,

  // Coordonnées de base : Jérusalem & Levant
  DEFAULT_CENTER: [31.7683, 35.2137],
  DEFAULT_ZOOM: 7,

  init() {
    this.bindEvents();
  },

  onViewActivated() {
    if (!this.isInitialized) {
      this.initMap();
      this.loadItineraries();
      this.loadPlaces();
      this.isInitialized = true;
    } else if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 100);
    }
  },

  initMap() {
    const container = document.getElementById('biblical-map-container');
    if (!container || typeof L === 'undefined') {
      console.warn('Leaflet non disponible ou conteneur de carte introuvable.');
      return;
    }

    // 1. Initialisation de la carte Leaflet
    this.map = L.map('biblical-map-container', {
      center: this.DEFAULT_CENTER,
      zoom: this.DEFAULT_ZOOM,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: false // Zoom control repositionné à droite
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // 2. Définition des différentes couches de tuiles (Fonds de carte)
    this.tileLayers = {
      voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }),
      topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
        maxZoom: 17
      }),
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO &copy; OpenStreetMap',
        subdomains: 'abcd',
        maxZoom: 19
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      })
    };

    // Définir le fond de carte par défaut selon le thème
    const isDark = document.body.classList.contains('theme-dark');
    this.currentTileLayer = isDark ? this.tileLayers.dark : this.tileLayers.voyager;
    this.currentTileLayer.addTo(this.map);

    // 3. Groupes de couches pour les marqueurs et tracés
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.itineraryLayer = L.layerGroup().addTo(this.map);
  },

  setTileLayer(layerKey) {
    if (!this.map || !this.tileLayers[layerKey]) return;
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }
    this.currentTileLayer = this.tileLayers[layerKey];
    this.currentTileLayer.addTo(this.map);

    // Mettre à jour les boutons d'affichage
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === layerKey);
    });
  },

  bindEvents() {
    // Changement de fond de carte
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTileLayer(btn.dataset.layer);
      });
    });

    // Recherche de lieu
    const searchInput = document.getElementById('map-search-input');
    let debounceTimer = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = e.target.value.trim();
        const type = document.getElementById('map-type-filter')?.value || 'all';
        this.loadPlaces(query, type);
      }, 250);
    });

    // Filtre de catégorie de lieu
    document.getElementById('map-type-filter')?.addEventListener('change', (e) => {
      const type = e.target.value;
      const query = document.getElementById('map-search-input')?.value.trim() || '';
      this.loadPlaces(query, type);
    });

    // Sélecteur d'itinéraire
    document.getElementById('map-itinerary-select')?.addEventListener('change', (e) => {
      const itinId = e.target.value;
      if (itinId === 'none') {
        this.clearItinerary();
        const query = document.getElementById('map-search-input')?.value.trim() || '';
        const type = document.getElementById('map-type-filter')?.value || 'all';
        this.loadPlaces(query, type);
      } else {
        this.showItinerary(itinId);
      }
    });

    // Bouton Réinitialiser la vue de la carte
    document.getElementById('btn-map-reset-view')?.addEventListener('click', () => {
      this.resetMapView();
    });

    // Fermer le panneau de détails
    document.getElementById('btn-close-place-details')?.addEventListener('click', () => {
      document.getElementById('map-place-details-card')?.classList.add('hidden');
    });
  },

  async loadPlaces(query = '', placeType = 'all') {
    try {
      const places = await API.getBiblicalPlaces(query, placeType, 120);
      this.activePlaces = places || [];
      this.renderPlacesList(this.activePlaces);
      this.renderMarkers(this.activePlaces);
    } catch (err) {
      console.error('Erreur chargement des lieux:', err);
    }
  },

  async loadItineraries() {
    try {
      const itins = await API.getBiblicalItineraries();
      this.itinerariesList = itins || [];
      const selectEl = document.getElementById('map-itinerary-select');
      if (selectEl && this.itinerariesList.length > 0) {
        selectEl.innerHTML = `
          <option value="none">🗺️ Vue libre (Tous les lieux)</option>
          <optgroup label="Grandes Étapes & Voyages">
            ${this.itinerariesList.map(it => `
              <option value="${it.itinerary_id}">${it.title}</option>
            `).join('')}
          </optgroup>
        `;
      }
    } catch (err) {
      console.error('Erreur chargement itinéraires:', err);
    }
  },

  renderPlacesList(places) {
    const listContainer = document.getElementById('map-places-list');
    const countEl = document.getElementById('map-places-count');
    if (countEl) countEl.textContent = `${places.length} lieu${places.length > 1 ? 'x' : ''}`;

    if (!listContainer) return;

    if (places.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state-small" style="padding: 24px; text-align: center; color: var(--text-muted);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity: 0.6; margin-bottom: 8px;">
            <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>
          </svg>
          <p style="font-size: 12px;">Aucun lieu biblique trouvé pour cette recherche.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = places.map(p => {
      const typeLabel = this.getTypeLabel(p.place_type);
      const typeBadgeClass = `badge-type-${p.place_type || 'city'}`;
      return `
        <div class="map-place-item" data-place-id="${p.place_id}">
          <div class="place-item-header">
            <strong class="place-item-name">${p.name_fr}</strong>
            <span class="place-item-type ${typeBadgeClass}">${typeLabel}</span>
          </div>
          <div class="place-item-meta">
            ${p.modern_name ? `<span class="place-item-modern">${p.modern_name}</span>` : ''}
            <span class="place-item-count">${p.verses_count || 0} mention${(p.verses_count || 0) > 1 ? 's' : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    // Clic sur un élément de la liste
    listContainer.querySelectorAll('.map-place-item').forEach(item => {
      item.addEventListener('click', () => {
        const placeId = item.dataset.placeId;
        const place = this.activePlaces.find(p => p.place_id === placeId);
        if (place) {
          this.selectPlace(place, true);
        }
      });
    });
  },

  renderMarkers(places) {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    places.forEach(place => {
      const marker = this.createSingleMarker(place);
      if (marker) {
        this.markersLayer.addLayer(marker);
      }
    });
  },

  createSingleMarker(place) {
    if (!place || !place.latitude || !place.longitude) return null;
    const icon = this.createCustomMarkerIcon(place);
    const marker = L.marker([place.latitude, place.longitude], { icon: icon });
    marker._placeId = place.place_id;

    // Popup stylisé
    const popupContent = `
      <div class="leaflet-custom-popup">
        <div class="popup-title-row">
          <strong>${place.name_fr}</strong>
          <span class="popup-type-badge">${this.getTypeLabel(place.place_type)}</span>
        </div>
        ${place.modern_name ? `<div class="popup-modern">Nom moderne : <em>${place.modern_name}</em></div>` : ''}
        ${place.comment ? `<div class="popup-desc">${place.comment}</div>` : ''}
        <div class="popup-footer">
          <span class="popup-verses-badge">${place.verses_count || place.verses_detailed?.length || 0} référence(s)</span>
          <button class="popup-action-btn" onclick="MapsView.showPlaceDetailsById('${place.place_id}')">Détails & versets →</button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { className: 'open-shema-map-popup' });
    marker.on('click', () => {
      this.selectPlace(place, false);
    });
    return marker;
  },

  createCustomMarkerIcon(place) {
    const type = place.place_type || 'city';
    let color = '#2563EB'; // Bleu standard
    let iconSvg = '';

    if (type === 'mountain') {
      color = '#8B5CF6'; // Violet montagne
      iconSvg = '<polygon points="12,4 20,18 4,18" fill="white" />';
    } else if (type === 'river' || type === 'sea') {
      color = '#06B6D4'; // Cyan eau
      iconSvg = '<path d="M4 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="white" stroke-width="2" fill="none" /><path d="M4 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="white" stroke-width="2" fill="none" />';
    } else if (type === 'region') {
      color = '#D97706'; // Ambre région
      iconSvg = '<circle cx="12" cy="12" r="6" fill="white" />';
    } else {
      // Ville / Par défaut
      color = '#2563EB';
      iconSvg = '<circle cx="12" cy="12" r="5" fill="white" />';
    }

    const html = `
      <div class="custom-map-pin" style="background-color: ${color};">
        <svg viewBox="0 0 24 24" width="14" height="14" class="pin-svg">
          ${iconSvg}
        </svg>
      </div>
    `;

    return L.divIcon({
      className: 'custom-div-icon',
      html: html,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });
  },

  selectPlace(place, flyTo = true) {
    this.selectedPlace = place;

    // Surbrillance dans la liste
    document.querySelectorAll('.map-place-item').forEach(item => {
      item.classList.toggle('active', item.dataset.placeId === place.place_id);
    });

    if (this.map && place.latitude && place.longitude) {
      if (flyTo) {
        this.map.flyTo([place.latitude, place.longitude], 10, {
          duration: 1.0
        });
      }

      let foundMarker = null;
      if (this.markersLayer) {
        this.markersLayer.eachLayer(m => {
          if (m._placeId === place.place_id) {
            foundMarker = m;
          }
        });

        if (!foundMarker) {
          foundMarker = this.createSingleMarker(place);
          if (foundMarker) this.markersLayer.addLayer(foundMarker);
        }

        if (foundMarker) {
          setTimeout(() => {
            try { foundMarker.openPopup(); } catch(e) {}
          }, flyTo ? 500 : 50);
        }
      }
    }

    this.showPlaceDetails(place);
  },

  async showPlaceDetailsById(placeId) {
    try {
      const details = await API.getBiblicalPlaceDetails(placeId);
      if (details) {
        this.selectPlace(details, true);
      }
    } catch (err) {
      console.error('Erreur chargement détails lieu:', err);
    }
  },

  async showPlaceDetails(place) {
    const card = document.getElementById('map-place-details-card');
    if (!card) return;

    card.classList.remove('hidden');

    // Récupérer les détails complets avec tous les versets
    let fullDetails = place;
    if (!place.verses_detailed) {
      try {
        const d = await API.getBiblicalPlaceDetails(place.place_id);
        if (d) fullDetails = d;
      } catch (e) {}
    }

    document.getElementById('details-place-title').textContent = this.cleanText(fullDetails.name_fr);
    document.getElementById('details-place-type').textContent = this.getTypeLabel(fullDetails.place_type);
    document.getElementById('details-place-type').className = `place-item-type badge-type-${fullDetails.place_type || 'city'}`;
    
    document.getElementById('details-place-ancient').textContent = this.cleanText(fullDetails.ancient_name || fullDetails.name_en) || '—';
    document.getElementById('details-place-modern').textContent = this.cleanText(fullDetails.modern_name) || '—';
    document.getElementById('details-place-coords').textContent = `${fullDetails.latitude.toFixed(4)}°, ${fullDetails.longitude.toFixed(4)}°`;
    document.getElementById('details-place-comment').textContent = this.cleanText(fullDetails.comment) || 'Lieu mentionné dans les Écritures saintes.';

    // Niveau de certitude
    const confBadge = document.getElementById('details-place-confidence');
    if (confBadge) {
      const conf = fullDetails.confidence || 'certain';
      if (conf === 'certain') {
        confBadge.textContent = 'Identification certaine';
        confBadge.className = 'confidence-badge conf-certain';
      } else if (conf === 'probable') {
        confBadge.textContent = 'Emplacement probable';
        confBadge.className = 'confidence-badge conf-probable';
      } else {
        confBadge.textContent = 'Emplacement discuté / hypothèse';
        confBadge.className = 'confidence-badge conf-disputed';
      }
    }

    // Liste des versets (dédoublonnés par référence)
    const versesListEl = document.getElementById('details-place-verses-list');
    if (versesListEl) {
      const rawVerses = fullDetails.verses_detailed || [];
      const seenRefs = new Set();
      const uniqueVerses = [];

      rawVerses.forEach(v => {
        const refKey = `${v.book}_${v.chapter}_${v.verse}`;
        if (!seenRefs.has(refKey)) {
          seenRefs.add(refKey);
          uniqueVerses.push(v);
        }
      });

      if (uniqueVerses.length > 0) {
        versesListEl.innerHTML = uniqueVerses.map(v => {
          const readable = `${this.getFrenchBook(v.book)} ${v.chapter}:${v.verse}`;
          return `
            <button class="place-verse-pill" data-book="${v.book}" data-chap="${v.chapter}" data-verse="${v.verse}" title="Lire ce passage dans la Bible">
              ${readable}
            </button>
          `;
        }).join('');

        // Clic sur un verset -> saut dans le lecteur biblique
        versesListEl.querySelectorAll('.place-verse-pill').forEach(btn => {
          btn.addEventListener('click', () => {
            const b = btn.dataset.book;
            const c = parseInt(btn.dataset.chap);
            const v = parseInt(btn.dataset.verse);
            this.jumpToBibleVerse(b, c, v);
          });
        });
      } else {
        versesListEl.innerHTML = '<span style="font-size: 12px; color: var(--text-muted);">Aucune référence spécifique répertoriée.</span>';
      }
    }
  },

  cleanText(str) {
    if (!str) return '';
    return String(str).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
  },

  jumpToBibleVerse(bookCode, chapter, verse) {
    App.switchView('bible');
    document.querySelectorAll('.sidebar-menu .nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-bible')?.classList.add('active');

    // Résoudre le livre, charger le chapitre et faire défiler jusqu'au verset
    if (typeof BibleReader !== 'undefined') {
      const b = bookCode;
      const c = parseInt(chapter, 10) || 1;
      const v = parseInt(verse, 10) || 1;
      BibleReader.navigateTo(b, c, v);
    }
  },

  // Itinéraires
  async showItinerary(itineraryId) {
    this.activeItineraryId = itineraryId;
    const itin = this.itinerariesList.find(it => it.itinerary_id === itineraryId);
    if (!itin || !this.map) return;

    // Vider les calques actuels
    this.markersLayer.clearLayers();
    this.itineraryLayer.clearLayers();

    const waypoints = itin.waypoints || [];
    if (waypoints.length === 0) return;

    const latLngs = waypoints.map(w => [w.lat, w.lon]);
    const itinColor = itin.color || '#2563EB';

    // 1. Tracé de la ligne polyline
    const polyline = L.polyline(latLngs, {
      color: itinColor,
      weight: 4,
      opacity: 0.85,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.itineraryLayer);

    // 2. Marqueurs numérotés pour chaque étape
    waypoints.forEach((wp, index) => {
      const stepNum = index + 1;
      const html = `
        <div class="itinerary-step-pin" style="background-color: ${itinColor};">
          <span>${stepNum}</span>
        </div>
      `;
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: html,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      const marker = L.marker([wp.lat, wp.lon], { icon: icon });
      const popupHtml = `
        <div class="leaflet-custom-popup">
          <div class="popup-title-row">
            <span class="step-badge" style="background-color: ${itinColor};">Étape ${stepNum}</span>
            <strong>${wp.name}</strong>
          </div>
          <div class="popup-desc" style="margin-top: 6px;">${wp.desc || ''}</div>
        </div>
      `;
      marker.bindPopup(popupHtml, { className: 'open-shema-map-popup' });
      this.itineraryLayer.addLayer(marker);
    });

    // 3. Ajuster la vue pour englober tout le parcours
    this.map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    // 4. Mettre à jour la liste latérale avec les étapes de l'itinéraire
    this.renderItinerarySteps(itin);
  },

  renderItinerarySteps(itin) {
    const listContainer = document.getElementById('map-places-list');
    const countEl = document.getElementById('map-places-count');
    const waypoints = itin.waypoints || [];

    if (countEl) countEl.textContent = `${waypoints.length} étape${waypoints.length > 1 ? 's' : ''}`;
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="itinerary-info-banner" style="border-left: 4px solid ${itin.color || 'var(--accent-blue)'};">
        <h4 style="margin: 0 0 4px 0; font-size: 13px; color: var(--text-primary);">${itin.title}</h4>
        <p style="margin: 0; font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">${itin.description || ''}</p>
      </div>
      <div class="itinerary-steps-timeline">
        ${waypoints.map((wp, idx) => `
          <div class="itinerary-step-item" data-step-idx="${idx}">
            <div class="step-num-bubble" style="background-color: ${itin.color || 'var(--accent-blue)'};">${idx + 1}</div>
            <div class="step-content">
              <strong class="step-name">${wp.name}</strong>
              <p class="step-desc">${wp.desc || ''}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    listContainer.querySelectorAll('.itinerary-step-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.stepIdx);
        const wp = waypoints[idx];
        if (wp && this.map) {
          this.map.flyTo([wp.lat, wp.lon], 9, { duration: 0.8 });
        }
      });
    });
  },

  clearItinerary() {
    this.activeItineraryId = null;
    if (this.itineraryLayer) {
      this.itineraryLayer.clearLayers();
    }
  },

  // Synchronisation contextuelle : afficher les lieux d'un chapitre
  async showChapterPlaces(bookCode, chapterNum) {
    try {
      const places = await API.getChapterPlaces(bookCode, chapterNum);
      if (!places || places.length === 0) {
        App.showToast(`Aucun lieu cartographié dans ${this.getFrenchBook(bookCode)} ${chapterNum}.`);
        return;
      }

      // Basculer sur la vue Cartes
      App.switchView('maps');
      document.querySelectorAll('.sidebar-menu .nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-maps')?.classList.add('active');

      this.onViewActivated();

      this.activePlaces = places;
      this.renderPlacesList(places);
      this.renderMarkers(places);

      // Si des coordonnées existent, cadrer la carte dessus
      const validPoints = places.filter(p => p.latitude && p.longitude).map(p => [p.latitude, p.longitude]);
      if (validPoints.length > 0 && this.map) {
        if (validPoints.length === 1) {
          this.map.flyTo(validPoints[0], 9);
        } else {
          this.map.fitBounds(L.latLngBounds(validPoints), { padding: [60, 60] });
        }
      }

      App.showToast(`🗺️ ${places.length} lieu(x) détecté(s) dans ${this.getFrenchBook(bookCode)} ${chapterNum}`);
    } catch (err) {
      console.error('Erreur affichage lieux chapitre:', err);
    }
  },

  resetMapView() {
    if (this.map) {
      this.map.flyTo(this.DEFAULT_CENTER, this.DEFAULT_ZOOM, { duration: 0.8 });
    }
    this.clearItinerary();
    document.getElementById('map-itinerary-select').value = 'none';
    document.getElementById('map-search-input').value = '';
    document.getElementById('map-type-filter').value = 'all';
    this.loadPlaces();
  },

  getTypeLabel(type) {
    const map = {
      city: 'Ville',
      mountain: 'Montagne',
      river: 'Fleuve / Rivière',
      sea: 'Mer / Lac',
      region: 'Région / Territoire',
      island: 'Île'
    };
    return map[type] || 'Lieu';
  },

  getFrenchBook(code) {
    const names = {
      GEN: "Genèse", EXO: "Exode", LEV: "Lévitique", NUM: "Nombres", DEU: "Deutéronome",
      JOS: "Josué", JDG: "Juges", RUT: "Ruth", "1SA": "1 Samuel", "2SA": "2 Samuel",
      "1KI": "1 Rois", "2KI": "2 Rois", "1CH": "1 Chroniques", "2CH": "2 Chroniques",
      EZR: "Esdras", NEH: "Néhémie", EST: "Esther", JOB: "Job", PSA: "Psaumes",
      PRO: "Proverbes", ECC: "Ecclésiaste", SOL: "Cantique", ISA: "Ésaïe",
      JER: "Jérémie", LAM: "Lamentations", EZE: "Ézéchiel", DAN: "Daniel",
      HOS: "Osée", JOE: "Joël", AMO: "Amos", OBA: "Abdias", JON: "Jonas",
      MIC: "Michée", NAH: "Nahum", HAB: "Habacuc", ZEP: "Sophonie", HAG: "Aggée",
      ZEC: "Zacharie", MAL: "Malachie",
      MAT: "Matthieu", MAR: "Marc", LUK: "Luc", JOH: "Jean", ACT: "Actes",
      ROM: "Romains", "1CO": "1 Corinthiens", "2CO": "2 Corinthiens", GAL: "Galates",
      EPH: "Éphésiens", PHI: "Philippiens", COL: "Colossiens", "1TH": "1 Thessaloniciens",
      "2TH": "2 Thessaloniciens", "1TI": "1 Timothée", "2TI": "2 Timothée", TIT: "Tite",
      PHM: "Philémon", HEB: "Hébreux", JAM: "Jacques", "1PE": "1 Pierre", "2PE": "2 Pierre",
      "1JO": "1 Jean", "2JO": "2 Jean", "3JO": "3 Jean", JUD: "Jude", REV: "Apocalypse"
    };
    return names[code] || code;
  }
};
