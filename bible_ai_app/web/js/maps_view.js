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
  wikiCache: {},
  _currentWikiRequestId: 0,

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
    }
    this.refreshMapSize();
  },

  refreshMapSize() {
    if (!this.map) return;
    requestAnimationFrame(() => {
      if (this.map) this.map.invalidateSize();
    });
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 100);
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 300);
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 600);
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

    // 2. Définition des différentes couches de tuiles (Fonds de carte sans clé API requise)
    this.tileLayers = {
      topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, DeLorme, NAVTEQ, TomTom, USGS',
        maxZoom: 18
      }),
      parchment: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; National Geographic, Esri, DeLorme, NAVTEQ',
        maxZoom: 16
      }),
      dark: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS',
        maxZoom: 16
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics, CNES/Airbus DS',
        maxZoom: 18
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      })
    };

    // Alias pour compatibilité
    this.tileLayers.voyager = this.tileLayers.topo;

    // Définir le fond de carte par défaut selon le thème
    const isDark = document.body.classList.contains('theme-dark') ||
                   (!document.body.classList.contains('reading-bg-white') && !document.body.classList.contains('theme-light'));
    const defaultLayerKey = isDark ? 'dark' : 'topo';
    this.currentTileLayer = this.tileLayers[defaultLayerKey] || this.tileLayers.topo;
    this.currentTileLayer.addTo(this.map);

    // Mettre à jour l'état actif des boutons
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === defaultLayerKey);
    });

    // 3. Groupes de couches pour les marqueurs et tracés
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.itineraryLayer = L.layerGroup().addTo(this.map);

    // Recalcul du clustering lors des zooms
    this.map.on('zoomend', () => {
      if (this.activePlaces && this.activePlaces.length > 0 && !this.activeItineraryId) {
        this.renderMarkers(this.activePlaces);
      }
    });

    // 4. ResizeObserver et listener pour garantir le rafraîchissement des dimensions
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      });
      this.resizeObserver.observe(container);
    }
    window.addEventListener('resize', () => {
      if (this.map) {
        this.map.invalidateSize();
      }
    });

    this.refreshMapSize();
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
    searchInput?.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.loadPlaces();
      }, 250);
    });

    // Filtre de type de lieu
    document.getElementById('map-type-filter')?.addEventListener('change', () => {
      this.loadPlaces();
    });

    // Filtre de tri
    document.getElementById('map-sort-filter')?.addEventListener('change', () => {
      this.loadPlaces();
    });

    // Filtre de période biblique
    document.getElementById('map-period-filter')?.addEventListener('change', () => {
      this.loadPlaces();
    });

    // Sélecteur d'itinéraire
    document.getElementById('map-itinerary-select')?.addEventListener('change', (e) => {
      const itinId = e.target.value;
      if (itinId === 'none') {
        this.clearItinerary();
        this.loadPlaces();
      } else {
        this.showItinerary(itinId);
      }
    });

    // Bouton Réinitialiser la vue de la carte
    document.getElementById('btn-map-reset-view')?.addEventListener('click', () => {
      this.resetMapView();
    });

    // Bouton Toggle volet inspecteur (Drawer)
    document.getElementById('btn-toggle-maps-drawer')?.addEventListener('click', () => {
      this.toggleDrawer();
    });

    // Bouton Fermer le volet inspecteur
    document.getElementById('btn-close-place-details')?.addEventListener('click', () => {
      this.closeDrawer();
    });

    // Fermer l'aperçu in-situ du verset
    document.getElementById('btn-close-verse-preview')?.addEventListener('click', () => {
      this.closeVersePreview();
    });

    // Bouton pour sauter dans le lecteur biblique depuis l'aperçu
    document.getElementById('btn-jump-to-reader-btn')?.addEventListener('click', () => {
      this.openCurrentVerseInReader();
    });

    // Bouton pour ouvrir le lieu dans les dictionnaires
    document.getElementById('btn-open-in-dictionary')?.addEventListener('click', () => {
      this.openInDictionary();
    });

    // Bouton Mode Immersion (Plein Écran sans volets)
    document.getElementById('btn-map-immersion')?.addEventListener('click', () => {
      this.toggleImmersionMode();
    });

    // Bouton Quitter l'itinéraire
    document.getElementById('btn-reset-itinerary')?.addEventListener('click', () => {
      const select = document.getElementById('map-itinerary-select');
      if (select) select.value = 'none';
      this.clearItinerary();
      this.loadPlaces();
    });

    // Contrôles de la barre flottante inférieure d'itinéraire (Piste 2)
    document.getElementById('btn-itin-prev')?.addEventListener('click', () => {
      if (this.activeItineraryStepIdx > 0) {
        this.selectItineraryStep(this.activeItineraryStepIdx - 1, false);
      }
    });

    document.getElementById('btn-itin-next')?.addEventListener('click', () => {
      const itin = this.itinerariesList.find(it => it.itinerary_id === this.activeItineraryId);
      if (itin && this.activeItineraryStepIdx < itin.waypoints.length - 1) {
        this.selectItineraryStep(this.activeItineraryStepIdx + 1, false);
      }
    });

    document.getElementById('itin-bottom-step-info')?.addEventListener('click', () => {
      this.toggleDrawer();
    });

    document.getElementById('btn-itin-open-drawer')?.addEventListener('click', () => {
      this.toggleDrawer();
    });

    // Raccourcis clavier : Flèche Gauche / Droite pour naviguer dans l'itinéraire, Échap pour quitter le plein écran
    window.addEventListener('keydown', (e) => {
      const mapsView = document.getElementById('view-maps');
      if (!mapsView || !mapsView.classList.contains('active')) return;
      if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;

      if (this.activeItineraryId) {
        if (e.key === 'ArrowLeft') {
          if (this.activeItineraryStepIdx > 0) {
            e.preventDefault();
            this.selectItineraryStep(this.activeItineraryStepIdx - 1, false);
          }
        } else if (e.key === 'ArrowRight') {
          const itin = this.itinerariesList.find(it => it.itinerary_id === this.activeItineraryId);
          if (itin && this.activeItineraryStepIdx < itin.waypoints.length - 1) {
            e.preventDefault();
            this.selectItineraryStep(this.activeItineraryStepIdx + 1, false);
          }
        }
      }

      if (e.key === 'Escape') {
        const layout = document.getElementById('maps-workspace-layout');
        if (layout?.classList.contains('immersion-mode')) {
          this.toggleImmersionMode(false);
        }
      }
    });
  },

  toggleImmersionMode(forceState) {
    const layout = document.getElementById('maps-workspace-layout');
    const btn = document.getElementById('btn-map-immersion');
    if (!layout) return;

    const isImmersion = forceState !== undefined ? forceState : !layout.classList.contains('immersion-mode');
    layout.classList.toggle('immersion-mode', isImmersion);
    document.body.classList.toggle('map-immersion-active', isImmersion);
    btn?.classList.toggle('active', isImmersion);

    if (btn) {
      btn.title = isImmersion ? "Quitter le mode Immersion (Échap)" : "Mode Immersion (Carte Plein Écran sans volets)";
    }

    if (isImmersion) {
      this.closeDrawer();
    }
    this.refreshMapSize();
    setTimeout(() => this.refreshMapSize(), 60);
    setTimeout(() => this.refreshMapSize(), 220);
  },

  async loadPlaces() {
    const query = document.getElementById('map-search-input')?.value.trim() || '';
    const type = document.getElementById('map-type-filter')?.value || 'all';
    const period = document.getElementById('map-period-filter')?.value || 'all';
    const sortBy = document.getElementById('map-sort-filter')?.value || 'mentions';

    try {
      const places = await API.getBiblicalPlaces(query, type, 250, period, sortBy);
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
          <option value="none">Vue libre (Tous les lieux)</option>
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

  updateClusterInfo(clusterCount) {
    const hintEl = document.getElementById('map-cluster-info');
    if (hintEl) {
      if (clusterCount > 0) {
        hintEl.textContent = `${clusterCount} grappe${clusterCount > 1 ? 's' : ''}`;
        hintEl.style.display = 'inline-block';
      } else {
        hintEl.textContent = 'Zoom précis';
      }
    }
  },

  renderMarkers(places) {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    if (!places || places.length === 0) {
      this.updateClusterInfo(0);
      return;
    }

    const zoom = this.map.getZoom();

    // Si zoom élevé (>= 13), désactiver le clustering et tout afficher en individuel
    if (zoom >= 13) {
      places.forEach(place => {
        const marker = this.createSingleMarker(place);
        if (marker) this.markersLayer.addLayer(marker);
      });
      this.updateClusterInfo(0);
      return;
    }

    // Clustering dynamique spatial par grille / rayon pixel selon le niveau de zoom
    const radius = zoom <= 5 ? 55 : (zoom <= 7 ? 48 : (zoom <= 9 ? 38 : 30));
    const clusters = [];

    places.forEach(place => {
      if (!place.latitude || !place.longitude) return;
      const pt = this.map.latLngToLayerPoint([place.latitude, place.longitude]);

      let targetCluster = null;
      for (const c of clusters) {
        const dx = c.centerPt.x - pt.x;
        const dy = c.centerPt.y - pt.y;
        if ((dx * dx + dy * dy) <= (radius * radius)) {
          targetCluster = c;
          break;
        }
      }

      if (targetCluster) {
        targetCluster.places.push(place);
        const count = targetCluster.places.length;
        targetCluster.centerLat = (targetCluster.centerLat * (count - 1) + place.latitude) / count;
        targetCluster.centerLng = (targetCluster.centerLng * (count - 1) + place.longitude) / count;
        targetCluster.centerPt = this.map.latLngToLayerPoint([targetCluster.centerLat, targetCluster.centerLng]);
      } else {
        clusters.push({
          centerLat: place.latitude,
          centerLng: place.longitude,
          centerPt: pt,
          places: [place]
        });
      }
    });

    let clusterCount = 0;
    clusters.forEach(c => {
      if (c.places.length === 1) {
        const marker = this.createSingleMarker(c.places[0]);
        if (marker) this.markersLayer.addLayer(marker);
      } else {
        clusterCount++;
        const clusterMarker = this.createClusterMarker(c);
        if (clusterMarker) this.markersLayer.addLayer(clusterMarker);
      }
    });

    this.updateClusterInfo(clusterCount);
  },

  createClusterMarker(cluster) {
    const count = cluster.places.length;
    let sizeClass = 'cluster-small';
    let iconSize = [32, 32];
    if (count >= 25) {
      sizeClass = 'cluster-large';
      iconSize = [44, 44];
    } else if (count >= 10) {
      sizeClass = 'cluster-medium';
      iconSize = [38, 38];
    }

    const html = `
      <div class="map-cluster-bubble ${sizeClass}" title="Cliquer pour zoomer sur cette grappe">
        <span>${count}</span>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: html,
      iconSize: iconSize,
      iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
    });

    const marker = L.marker([cluster.centerLat, cluster.centerLng], { icon: icon });

    // Infobulle listant les lieux phares contenus dans la grappe
    const sampleNames = cluster.places.slice(0, 4).map(p => p.name_fr).join(', ');
    const extra = count > 4 ? ` (+${count - 4} autres)` : '';
    marker.bindTooltip(`<strong>Grappe : ${count} lieux</strong><br><span style="opacity:0.85;font-size:10.5px;">${sampleNames}${extra}</span>`, {
      className: 'open-shema-map-tooltip',
      direction: 'top',
      offset: [0, -(iconSize[1] / 2)]
    });

    marker.on('click', () => {
      const zoom = this.map.getZoom();
      if (zoom >= 11) {
        const bounds = L.latLngBounds(cluster.places.map(p => [p.latitude, p.longitude]));
        this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } else {
        this.map.flyTo([cluster.centerLat, cluster.centerLng], zoom + 2, { duration: 0.6 });
      }
    });

    return marker;
  },

  createSingleMarker(place) {
    if (!place || !place.latitude || !place.longitude) return null;
    const icon = this.createCustomMarkerIcon(place);
    const marker = L.marker([place.latitude, place.longitude], { icon: icon });
    marker._placeId = place.place_id;

    const typeLabel = this.getTypeLabel(place.place_type);
    marker.bindTooltip(`<strong>${place.name_fr}</strong> <span style="opacity:0.8;font-size:10px;">(${typeLabel})</span>`, {
      className: 'open-shema-map-tooltip',
      direction: 'top',
      offset: [0, -10]
    });

    marker.on('click', () => {
      this.selectPlace(place, false);
    });
    return marker;
  },

  createCustomMarkerIcon(place) {
    const type = place.place_type || 'city';
    const versesCount = place.verses_count || 0;

    // Hiérarchie de taille selon l'importance dans le texte biblique
    let sizeClass = 'pin-minor';
    let iconDim = [18, 18];
    let svgSize = 10;
    if (versesCount >= 80) {
      sizeClass = 'pin-major';
      iconDim = [28, 28];
      svgSize = 15;
    } else if (versesCount >= 20) {
      sizeClass = 'pin-medium';
      iconDim = [22, 22];
      svgSize = 12;
    }

    let typeClass = 'pin-city';
    let iconSvg = '<circle cx="12" cy="12" r="5" fill="white" />';

    if (type === 'mountain') {
      typeClass = 'pin-mountain';
      iconSvg = '<polygon points="12,4 20,18 4,18" fill="white" />';
    } else if (type === 'sea') {
      typeClass = 'pin-sea';
      iconSvg = '<path d="M3 13c3-2 5 2 8 0s5-2 8 0" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" /><path d="M3 9c3-2 5 2 8 0s5-2 8 0" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" />';
    } else if (type === 'river') {
      typeClass = 'pin-river';
      iconSvg = '<path d="M4 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="white" stroke-width="2" fill="none" /><path d="M4 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="white" stroke-width="2" fill="none" />';
    } else if (type === 'region') {
      typeClass = 'pin-region';
      iconSvg = '<rect x="6" y="6" width="12" height="12" rx="2" fill="white" />';
    } else if (type === 'island') {
      typeClass = 'pin-island';
      iconSvg = '<circle cx="12" cy="12" r="6" fill="white" />';
    }

    const html = `
      <div class="custom-map-pin ${sizeClass} ${typeClass}" data-place-id="${place.place_id}">
        <svg viewBox="0 0 24 24" width="${svgSize}" height="${svgSize}" class="pin-svg">
          ${iconSvg}
        </svg>
      </div>
    `;

    return L.divIcon({
      className: 'custom-div-icon',
      html: html,
      iconSize: iconDim,
      iconAnchor: [iconDim[0] / 2, iconDim[1] / 2],
      popupAnchor: [0, -(iconDim[1] / 2)]
    });
  },

  selectPlace(place, flyTo = true) {
    this.selectedPlace = place;

    // Surbrillance dans la liste latérale
    document.querySelectorAll('.map-place-item').forEach(item => {
      item.classList.toggle('active', item.dataset.placeId === place.place_id);
    });

    // Surbrillance visuelle du pin sélectionné
    document.querySelectorAll('.custom-map-pin').forEach(pin => {
      pin.classList.toggle('pin-selected', pin.dataset.placeId === place.place_id);
    });

    if (this.map && place.latitude && place.longitude) {
      if (flyTo) {
        this.map.flyTo([place.latitude, place.longitude], Math.max(this.map.getZoom(), 9), {
          duration: 0.8
        });
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

  openDrawer() {
    const drawer = document.getElementById('maps-details-drawer');
    if (drawer) drawer.classList.remove('hidden');
    document.getElementById('maps-workspace-layout')?.classList.add('drawer-open');
    document.getElementById('btn-toggle-maps-drawer')?.classList.add('active');
  },

  closeDrawer() {
    const drawer = document.getElementById('maps-details-drawer');
    if (drawer) drawer.classList.add('hidden');
    document.getElementById('maps-workspace-layout')?.classList.remove('drawer-open');
    document.getElementById('btn-toggle-maps-drawer')?.classList.remove('active');
    this.closeVersePreview();
    this.hideVerseHoverTooltip();
  },

  toggleDrawer() {
    const drawer = document.getElementById('maps-details-drawer');
    if (drawer) {
      const isHidden = drawer.classList.toggle('hidden');
      if (isHidden) {
        document.getElementById('maps-workspace-layout')?.classList.remove('drawer-open');
        document.getElementById('btn-toggle-maps-drawer')?.classList.remove('active');
      } else {
        document.getElementById('maps-workspace-layout')?.classList.add('drawer-open');
        document.getElementById('btn-toggle-maps-drawer')?.classList.add('active');
      }
    }
  },

  async showPlaceDetails(place) {
    this.openDrawer();

    let fullDetails = place;
    if (!place.verses_detailed) {
      try {
        const d = await API.getBiblicalPlaceDetails(place.place_id);
        if (d) fullDetails = d;
      } catch (e) {}
    }

    this.selectedPlace = fullDetails;

    const titleEl = document.getElementById('details-place-title');
    if (titleEl) titleEl.textContent = this.cleanText(fullDetails.name_fr);

    const typeEl = document.getElementById('details-place-type');
    if (typeEl) {
      typeEl.textContent = this.getTypeLabel(fullDetails.place_type);
      typeEl.className = `place-item-type badge-type-${fullDetails.place_type || 'city'}`;
    }

    const ancientEl = document.getElementById('details-place-ancient');
    if (ancientEl) {
      const ancient = this.cleanText(fullDetails.ancient_name);
      const isEnglishDuplicate = ancient && fullDetails.name_en && ancient.toLowerCase() === fullDetails.name_en.toLowerCase();
      if (ancient && !isEnglishDuplicate && ancient.toLowerCase() !== fullDetails.name_fr.toLowerCase()) {
        ancientEl.textContent = ancient;
        ancientEl.style.display = 'inline-block';
      } else {
        ancientEl.textContent = '';
        ancientEl.style.display = 'none';
      }
    }

    const modernEl = document.getElementById('details-place-modern');
    if (modernEl) modernEl.textContent = this.cleanText(fullDetails.modern_name) || '—';

    const coordsEl = document.getElementById('details-place-coords');
    if (coordsEl && fullDetails.latitude && fullDetails.longitude) {
      coordsEl.textContent = `${Number(fullDetails.latitude).toFixed(4)}°, ${Number(fullDetails.longitude).toFixed(4)}°`;
    }

    // Périodes bibliques
    const periodsContainer = document.getElementById('details-place-periods-tags');
    if (periodsContainer) {
      const periodsRaw = fullDetails.periods || '';
      const periodMap = {
        patriarchs: 'Patriarches & Exode',
        conquest: 'Conquête & Rois',
        prophets: 'Prophètes & Exil',
        gospels: 'Évangiles',
        apostolic: 'Église primitive'
      };
      const tags = periodsRaw.split(',').filter(Boolean).map(k => periodMap[k.trim()] || k.trim());
      if (tags.length > 0) {
        periodsContainer.innerHTML = tags.map(t => `<span class="period-tag">${t}</span>`).join('');
        document.getElementById('details-periods-row')?.style.setProperty('display', 'flex');
      } else {
        document.getElementById('details-periods-row')?.style.setProperty('display', 'none');
      }
    }

    // Certitude
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
        confBadge.textContent = 'Emplacement discuté';
        confBadge.className = 'confidence-badge conf-disputed';
      }
    }

    // Commentaire
    const commentEl = document.getElementById('details-place-comment');
    if (commentEl) {
      commentEl.textContent = this.cleanText(fullDetails.comment) || 'Lieu mentionné dans les Écritures saintes.';
    }

    // Versets
    const totalEl = document.getElementById('details-verses-total');
    const listEl = document.getElementById('details-place-verses-list');
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

    if (totalEl) totalEl.textContent = `${uniqueVerses.length} réf.`;

    if (listEl) {
      if (uniqueVerses.length > 0) {
        listEl.innerHTML = uniqueVerses.map(v => {
          const readable = `${this.getFrenchBook(v.book)} ${v.chapter}:${v.verse}`;
          return `
            <button class="place-verse-pill" data-book="${v.book}" data-chap="${v.chapter}" data-verse="${v.verse}" data-ref="${readable}">
              ${readable}
            </button>
          `;
        }).join('');

        listEl.querySelectorAll('.place-verse-pill').forEach(btn => {
          btn.addEventListener('click', () => {
            listEl.querySelectorAll('.place-verse-pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const b = btn.dataset.book;
            const c = parseInt(btn.dataset.chap, 10);
            const v = parseInt(btn.dataset.verse, 10);
            this.previewVerseInSitu(b, c, v);
          });

          // Infobulle de passage biblique au survol
          btn.addEventListener('mouseenter', () => {
            const b = btn.dataset.book;
            const c = parseInt(btn.dataset.chap, 10);
            const v = parseInt(btn.dataset.verse, 10);
            this.handleVersePillHover(btn, b, c, v);
          });

          btn.addEventListener('mouseleave', () => {
            this.hideVerseHoverTooltip();
          });
        });

        // Masquer l'infobulle si l'utilisateur fait défiler le tiroir
        const drawerBody = document.querySelector('.drawer-body');
        if (drawerBody && !drawerBody._hasScrollTooltipListener) {
          drawerBody._hasScrollTooltipListener = true;
          drawerBody.addEventListener('scroll', () => {
            this.hideVerseHoverTooltip();
          }, { passive: true });
        }
      } else {
        listEl.innerHTML = '<span style="font-size: 11.5px; color: var(--text-muted);">Aucune référence spécifique répertoriée.</span>';
      }
    }

    this.closeVersePreview();
    this.loadWikipediaForPlace(fullDetails.name_fr || fullDetails.name_en, fullDetails.modern_name, fullDetails.ancient_name);
  },

  async previewVerseInSitu(bookCode, chapter, verse) {
    const box = document.getElementById('maps-verse-preview-box');
    const titleEl = document.getElementById('maps-preview-ref-title');
    const textEl = document.getElementById('maps-preview-text');
    if (!box || !titleEl || !textEl) return;

    const readableRef = `${this.getFrenchBook(bookCode)} ${chapter}:${verse}`;
    titleEl.textContent = readableRef;
    textEl.innerHTML = '<em>Chargement du passage...</em>';
    box.classList.remove('hidden');

    this.currentPreviewVerse = { bookCode, chapter, verse };

    try {
      const preview = await API.getVersePreview(readableRef);
      if (preview && preview.text) {
        textEl.textContent = `« ${preview.text.trim()} »`;
      } else {
        textEl.textContent = 'Texte biblique indisponible pour cette référence.';
      }
    } catch (e) {
      textEl.textContent = 'Impossible de charger le texte du verset.';
    }
  },

  closeVersePreview() {
    const box = document.getElementById('maps-verse-preview-box');
    if (box) box.classList.add('hidden');
    document.querySelectorAll('.place-verse-pill').forEach(p => p.classList.remove('active'));
    this.currentPreviewVerse = null;
  },

  openCurrentVerseInReader() {
    if (!this.currentPreviewVerse) return;
    const { bookCode, chapter, verse } = this.currentPreviewVerse;
    this.jumpToBibleVerse(bookCode, chapter, verse);
  },

  handleVersePillHover(btn, bookCode, chapter, verse) {
    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
    }
    const readableRef = `${this.getFrenchBook(bookCode)} ${chapter}:${verse}`;
    this._currentHoverBtn = btn;

    this._hoverTimeout = setTimeout(() => {
      if (this._currentHoverBtn === btn) {
        this.showVerseHoverTooltip(btn, readableRef);
      }
    }, 130);
  },

  hideVerseHoverTooltip() {
    this._currentHoverBtn = null;
    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
      this._hoverTimeout = null;
    }
    if (this._tooltipEl) {
      this._tooltipEl.classList.remove('visible');
    }
  },

  async showVerseHoverTooltip(anchorEl, readableRef) {
    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement('div');
      this._tooltipEl.id = 'maps-verse-floating-tooltip';
      this._tooltipEl.className = 'maps-verse-hover-tooltip';
      document.body.appendChild(this._tooltipEl);
    }

    if (!this.verseTooltipCache) {
      this.verseTooltipCache = new Map();
    }

    const rect = anchorEl.getBoundingClientRect();
    const tooltipWidth = 300;

    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    if (left < 12) left = 12;
    if (left + tooltipWidth > window.innerWidth - 12) {
      left = window.innerWidth - tooltipWidth - 12;
    }

    const cached = this.verseTooltipCache.get(readableRef);
    if (cached) {
      this._tooltipEl.innerHTML = `
        <div class="maps-verse-hover-header">
          <span class="maps-verse-hover-ref">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            ${readableRef}
          </span>
          <span class="maps-verse-hover-version">Passage biblique</span>
        </div>
        <div class="maps-verse-hover-body">« ${cached} »</div>
      `;
    } else {
      this._tooltipEl.innerHTML = `
        <div class="maps-verse-hover-header">
          <span class="maps-verse-hover-ref">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            ${readableRef}
          </span>
          <span class="maps-verse-hover-version">Passage biblique</span>
        </div>
        <div class="maps-verse-hover-loading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/></svg>
          <span>Chargement du passage...</span>
        </div>
      `;
    }

    this._tooltipEl.style.left = `${left}px`;
    this._tooltipEl.style.width = `${tooltipWidth}px`;
    this._tooltipEl.classList.add('visible');

    const tipRect = this._tooltipEl.getBoundingClientRect();
    let top = rect.top - tipRect.height - 8;
    if (top < 12) {
      top = rect.bottom + 8;
    }
    this._tooltipEl.style.top = `${top}px`;

    if (!cached) {
      try {
        const preview = await API.getVersePreview(readableRef);
        if (this._currentHoverBtn === anchorEl && this._tooltipEl.classList.contains('visible')) {
          if (preview && preview.text) {
            const clean = preview.text.trim();
            this.verseTooltipCache.set(readableRef, clean);
            const loadingEl = this._tooltipEl.querySelector('.maps-verse-hover-loading');
            if (loadingEl) {
              loadingEl.className = 'maps-verse-hover-body';
              loadingEl.textContent = `« ${clean} »`;
              const updatedTip = this._tooltipEl.getBoundingClientRect();
              let updatedTop = rect.top - updatedTip.height - 8;
              if (updatedTop < 12) updatedTop = rect.bottom + 8;
              this._tooltipEl.style.top = `${updatedTop}px`;
            }
          } else {
            const loadingEl = this._tooltipEl.querySelector('.maps-verse-hover-loading');
            if (loadingEl) {
              loadingEl.textContent = 'Texte non disponible dans la version active.';
            }
          }
        }
      } catch (err) {
        console.error('Erreur infobulle verset:', err);
      }
    }
  },

  openInDictionary() {
    if (!this.selectedPlace) return;
    const rawName = this.selectedPlace.name_fr || this.selectedPlace.name_en;
    if (!rawName) return;

    // Isoler le toponyme principal sans parenthèses ni notes d'étapes
    const cleanName = rawName.split('(')[0].split('&')[0].replace(/<[^>]+>/g, '').trim();
    if (!cleanName) return;

    App.switchView('dict');
    document.querySelectorAll('.sidebar-menu .nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-dict')?.classList.add('active');

    // Mettre à jour le champ de recherche et exécuter la recherche globale dans tous les dictionnaires
    setTimeout(() => {
      const searchInput = document.getElementById('dict-search-input');
      if (searchInput) {
        searchInput.value = cleanName;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (typeof DictView !== 'undefined' && DictView.executeLookup) {
        DictView.executeLookup(cleanName);
      }
    }, 120);
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
    this.itineraryMarkers = [];
    const itin = this.itinerariesList.find(it => it.itinerary_id === itineraryId);
    if (!itin || !this.map) return;

    // 1. Activer le mode itinéraire épuré sur l'interface
    const layout = document.getElementById('maps-workspace-layout');
    layout?.classList.add('itinerary-mode');
    document.getElementById('btn-reset-itinerary')?.classList.remove('hidden');
    document.getElementById('map-itinerary-bottom-bar')?.classList.remove('hidden');

    // Vider les calques actuels
    this.markersLayer.clearLayers();
    this.itineraryLayer.clearLayers();

    const waypoints = itin.waypoints || [];
    if (waypoints.length === 0) return;

    const latLngs = waypoints.map(w => [w.lat, w.lon]);
    const itinColor = itin.color || '#2563EB';

    // 2. Tracé de la ligne polyline
    const polyline = L.polyline(latLngs, {
      color: itinColor,
      weight: 4,
      opacity: 0.85,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.itineraryLayer);

    // 3. Marqueurs numérotés pour chaque étape avec infobulle fluide (sans bulle popup intrusive)
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
        iconAnchor: [14, 14]
      });

      const marker = L.marker([wp.lat, wp.lon], { icon: icon });
      marker.bindTooltip(`<strong>Étape ${stepNum} : ${wp.name}</strong>`, {
        direction: 'top',
        offset: [0, -16],
        className: 'open-shema-map-tooltip'
      });
      
      marker.on('click', () => {
        this.selectItineraryStep(index, true);
      });

      this.itineraryMarkers.push(marker);
      this.itineraryLayer.addLayer(marker);
    });

    // 4. Ajuster la vue pour englober tout le parcours initialement
    this.map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    // 5. Mettre à jour la liste latérale avec les étapes de l'itinéraire
    this.renderItinerarySteps(itin);

    // 6. Sélectionner la première étape (sans forcer l'ouverture du tiroir de droite pour laisser respirer la carte)
    this.selectItineraryStep(0, false);
  },

  renderItinerarySteps(itin) {
    const listContainer = document.getElementById('map-places-list');
    const countEl = document.getElementById('map-places-count');
    const waypoints = itin.waypoints || [];

    if (countEl) countEl.textContent = `${waypoints.length} étape${waypoints.length > 1 ? 's' : ''}`;
    if (!listContainer) return;

    const descHtml = itin.description ? `
      <div class="itinerary-summary-badge" style="border-left: 3px solid ${itin.color || 'var(--accent-blue)'};">
        <span>${itin.description}</span>
      </div>
    ` : '';

    listContainer.innerHTML = `
      ${descHtml}
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
        const idx = parseInt(item.dataset.stepIdx, 10);
        this.selectItineraryStep(idx, true);
      });
    });
  },

  async selectItineraryStep(stepIdx, openDrawer = false) {
    if (!this.activeItineraryId) return;
    const itin = this.itinerariesList.find(it => it.itinerary_id === this.activeItineraryId);
    if (!itin || !itin.waypoints || !itin.waypoints[stepIdx]) return;

    const wp = itin.waypoints[stepIdx];
    this.activeItineraryStepIdx = stepIdx;

    // 1. Mettre à jour l'élément actif dans la liste des étapes
    document.querySelectorAll('.itinerary-step-item').forEach((item, idx) => {
      const isActive = idx === stepIdx;
      item.classList.toggle('active', isActive);
      if (isActive && stepIdx > 0) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (isActive && stepIdx === 0) {
        const listContainer = document.getElementById('map-places-list');
        if (listContainer) listContainer.scrollTop = 0;
      }
    });

    // 2. Mettre à jour la barre inférieure flottante (Piste 2)
    const badgeEl = document.getElementById('itin-bottom-step-badge');
    if (badgeEl) {
      badgeEl.textContent = `Étape ${stepIdx + 1} / ${itin.waypoints.length}`;
      badgeEl.style.backgroundColor = itin.color || 'var(--accent-blue)';
    }
    const nameEl = document.getElementById('itin-bottom-step-name');
    if (nameEl) nameEl.textContent = wp.name;
    const descEl = document.getElementById('itin-bottom-step-desc');
    if (descEl) descEl.textContent = wp.desc || '';
    const prevBtn = document.getElementById('btn-itin-prev');
    if (prevBtn) prevBtn.disabled = (stepIdx === 0);
    const nextBtn = document.getElementById('btn-itin-next');
    if (nextBtn) nextBtn.disabled = (stepIdx === itin.waypoints.length - 1);

    // 3. Centrer la carte sur l'étape
    if (this.map) {
      this.map.flyTo([wp.lat, wp.lon], Math.max(this.map.getZoom(), 9), { duration: 0.6 });
    }

    // 4. Ouvrir le volet de droite si déjà ouvert ou si demandé explicitement
    const drawer = document.getElementById('maps-details-drawer');
    const isDrawerOpen = drawer && !drawer.classList.contains('hidden');
    if (openDrawer || isDrawerOpen) {
      this.openDrawer();
    }

    const titleEl = document.getElementById('details-place-title');
    if (titleEl) titleEl.textContent = wp.name;

    const typeEl = document.getElementById('details-place-type');
    if (typeEl) {
      typeEl.textContent = `Étape ${stepIdx + 1} / ${itin.waypoints.length}`;
      typeEl.className = 'place-item-type';
      typeEl.style.backgroundColor = itin.color || 'var(--accent-blue)';
      typeEl.style.color = '#ffffff';
    }

    const ancientEl = document.getElementById('details-place-ancient');
    if (ancientEl) {
      ancientEl.textContent = itin.title;
      ancientEl.style.display = 'inline-block';
    }

    const modernEl = document.getElementById('details-place-modern');
    if (modernEl) modernEl.textContent = 'Étape de parcours biblique';

    const coordsEl = document.getElementById('details-place-coords');
    if (coordsEl && wp.lat && wp.lon) {
      coordsEl.textContent = `${Number(wp.lat).toFixed(4)}°, ${Number(wp.lon).toFixed(4)}°`;
    }

    // Période selon l'itinéraire
    const periodsContainer = document.getElementById('details-place-periods-tags');
    if (periodsContainer) {
      const catMap = {
        patriarchs: 'Patriarches & Exode',
        conquest: 'Conquête & Rois',
        prophets: 'Prophètes & Exil',
        gospels: 'Évangiles',
        apostolic: 'Église primitive'
      };
      const catLabel = catMap[itin.category] || 'Histoire biblique';
      periodsContainer.innerHTML = `<span class="period-tag">${catLabel}</span>`;
      document.getElementById('details-periods-row')?.style.setProperty('display', 'flex');
    }

    const confBadge = document.getElementById('details-place-confidence');
    if (confBadge) {
      confBadge.textContent = 'Parcours historique';
      confBadge.className = 'confidence-badge conf-certain';
    }

    const commentEl = document.getElementById('details-place-comment');
    if (commentEl) {
      commentEl.textContent = wp.desc || 'Étape du grand itinéraire biblique.';
    }

    // Extraire les références bibliques contenues dans la description
    const stepRefs = this.extractReferencesFromText(wp.desc || '');

    // Chercher si le lieu existe dans la base pour enrichir avec les mentions complètes
    let dbVerses = [];
    try {
      const cleanName = wp.name.split('(')[0].split('&')[0].trim().toLowerCase();
      const matched = (this.placesData || []).find(p =>
        (p.name_fr && p.name_fr.toLowerCase() === cleanName) ||
        (p.name_en && p.name_en.toLowerCase() === cleanName)
      );
      if (matched) {
        const details = await API.getBiblicalPlaceDetails(matched.place_id);
        if (details && details.verses_detailed) {
          dbVerses = details.verses_detailed;
          if (details.comment && commentEl) {
            commentEl.innerHTML = `<strong>Événement :</strong> ${wp.desc}<br><br><span style="color: var(--text-secondary); font-size: 11.5px;"><strong>Notice historique :</strong> ${details.comment}</span>`;
          }
        }
      }
    } catch (e) {}

    // Affichage des références
    const listEl = document.getElementById('details-place-verses-list');
    const totalEl = document.getElementById('details-verses-total');

    if (totalEl) {
      const count = stepRefs.length + dbVerses.length;
      totalEl.textContent = `${count} réf.`;
    }

    if (listEl) {
      if (stepRefs.length > 0 || dbVerses.length > 0) {
        let html = '';
        if (stepRefs.length > 0) {
          html += `<div style="width: 100%; font-size: 11px; font-weight: 700; color: ${itin.color || 'var(--accent-blue)'}; margin-bottom: 4px;">Passages clés de l'étape :</div>`;
          html += stepRefs.map(ref => `
            <button class="place-verse-pill itin-key-verse" data-ref="${ref}" style="border-color: ${itin.color || 'var(--accent-blue)'}; font-weight: 700;">
              ${ref}
            </button>
          `).join('');
        }

        if (dbVerses.length > 0) {
          if (stepRefs.length > 0) {
            html += `<div style="width: 100%; font-size: 11px; font-weight: 600; color: var(--text-muted); margin: 8px 0 4px 0;">Toutes les mentions de ce lieu :</div>`;
          }
          const seen = new Set();
          dbVerses.slice(0, 16).forEach(v => {
            const r = `${this.getFrenchBook(v.book)} ${v.chapter}:${v.verse}`;
            if (!seen.has(r)) {
              seen.add(r);
              html += `
                <button class="place-verse-pill" data-book="${v.book}" data-chap="${v.chapter}" data-verse="${v.verse}" data-ref="${r}">
                  ${r}
                </button>
              `;
            }
          });
        }

        listEl.innerHTML = html;

        // Attacher écouteurs de survol et de clic
        listEl.querySelectorAll('.place-verse-pill').forEach(btn => {
          btn.addEventListener('click', () => {
            listEl.querySelectorAll('.place-verse-pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const refStr = btn.dataset.ref;
            this.previewReferenceInSitu(refStr);
          });

          btn.addEventListener('mouseenter', () => {
            const refStr = btn.dataset.ref;
            this.handleReferenceHover(btn, refStr);
          });

          btn.addEventListener('mouseleave', () => {
            this.hideVerseHoverTooltip();
          });
        });
      } else {
        listEl.innerHTML = '<span style="font-size: 11.5px; color: var(--text-muted);">Aucune référence spécifique répertoriée pour cette étape.</span>';
      }
    }

    this.closeVersePreview();
    this.loadWikipediaForPlace(wp.name);
  },

  extractReferencesFromText(text) {
    if (!text) return [];
    const matches = text.match(/\(([^)]+)\)/g);
    if (!matches) return [];

    const refs = [];
    matches.forEach(m => {
      const inner = m.slice(1, -1);
      const parts = inner.split(';');
      parts.forEach(p => {
        const trimmed = p.trim();
        if (/\d+/.test(trimmed) && (trimmed.includes(':') || /(Gen|Exo|Lév|Nom|Deut|Jos|Jug|Ruth|Sam|Rois|Chr|Esd|Néh|Est|Job|Ps|Prov|Eccl|Cant|Ésa|Jér|Lam|Ézé|Dan|Os|Joël|Amos|Abd|Jon|Mic|Nah|Hab|Soph|Agg|Zach|Mal|Mat|Marc|Luc|Jean|Act|Rom|Cor|Gal|Éph|Phil|Col|Thess|Tim|Tite|Philém|Héb|Jacq|Pier|Jean|Jude|Apoc)/i.test(trimmed))) {
          refs.push(trimmed);
        }
      });
    });
    return refs;
  },

  handleReferenceHover(btn, refStr) {
    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
    }
    this._currentHoverBtn = btn;
    this._hoverTimeout = setTimeout(() => {
      if (this._currentHoverBtn === btn) {
        this.showVerseHoverTooltip(btn, refStr);
      }
    }, 130);
  },

  async previewReferenceInSitu(refStr) {
    const box = document.getElementById('maps-verse-preview-box');
    const titleEl = document.getElementById('maps-preview-ref-title');
    const textEl = document.getElementById('maps-preview-text');
    if (!box || !titleEl || !textEl) return;

    titleEl.textContent = refStr;
    textEl.innerHTML = '<em>Chargement du passage...</em>';
    box.classList.remove('hidden');

    try {
      const preview = await API.getVersePreview(refStr);
      if (preview && preview.text) {
        textEl.textContent = `« ${preview.text.trim()} »`;
      } else {
        textEl.textContent = 'Texte biblique indisponible pour cette référence.';
      }
    } catch (e) {
      textEl.textContent = 'Impossible de charger le texte du verset.';
    }
  },

  clearItinerary() {
    this.activeItineraryId = null;
    this.itineraryMarkers = [];
    if (this.itineraryLayer) {
      this.itineraryLayer.clearLayers();
    }
    const layout = document.getElementById('maps-workspace-layout');
    layout?.classList.remove('itinerary-mode');
    document.getElementById('btn-reset-itinerary')?.classList.add('hidden');
    document.getElementById('map-itinerary-bottom-bar')?.classList.add('hidden');
    this.closeDrawer();
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

      App.showToast(`${places.length} lieu(x) détecté(s) dans ${this.getFrenchBook(bookCode)} ${chapterNum}`);
    } catch (err) {
      console.error('Erreur affichage lieux chapitre:', err);
    }
  },

  resetMapView() {
    if (this.map) {
      this.map.flyTo(this.DEFAULT_CENTER, this.DEFAULT_ZOOM, { duration: 0.8 });
    }
    this.clearItinerary();
    const itinSelect = document.getElementById('map-itinerary-select');
    if (itinSelect) itinSelect.value = 'none';
    const searchInput = document.getElementById('map-search-input');
    if (searchInput) searchInput.value = '';
    const typeFilter = document.getElementById('map-type-filter');
    if (typeFilter) typeFilter.value = 'all';
    const periodFilter = document.getElementById('map-period-filter');
    if (periodFilter) periodFilter.value = 'all';
    const sortFilter = document.getElementById('map-sort-filter');
    if (sortFilter) sortFilter.value = 'mentions';

    this.closeDrawer();
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
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  async loadWikipediaForPlace(placeName, modernName = null, ancientName = null) {
    const wikiContainer = document.getElementById('maps-wiki-content');
    if (!wikiContainer) return;

    if (!placeName) {
      wikiContainer.innerHTML = '<div class="maps-wiki-empty">Aucun lieu sélectionné.</div>';
      return;
    }

    // Isoler le toponyme principal sans parenthèses ni notes
    const cleanPrimary = placeName.split('(')[0].split('&')[0].replace(/<[^>]+>/g, '').trim();
    const cleanModern = modernName ? modernName.split('/')[0].split('(')[0].trim() : null;
    const cleanAncient = ancientName ? ancientName.split('(')[0].trim() : null;

    const cacheKey = cleanPrimary.toLowerCase();
    if (this.wikiCache[cacheKey]) {
      this.renderWikipediaCard(wikiContainer, this.wikiCache[cacheKey]);
      return;
    }

    const reqId = ++this._currentWikiRequestId;
    wikiContainer.innerHTML = `
      <div class="maps-wiki-loading">
        Recherche des données historiques pour « ${this.escapeHtml(cleanPrimary)} »...
      </div>
    `;

    try {
      // 1. Essai avec le nom principal (filtrage strict anachronismes géographiques)
      let res = await API.getWikipediaSummary(cleanPrimary, null, 'place');

      // 2. Si non trouvé ou anachronique et qu'un nom moderne existe, essayer le nom moderne
      if ((!res || !res.found) && cleanModern && cleanModern.toLowerCase() !== cleanPrimary.toLowerCase()) {
        const altRes = await API.getWikipediaSummary(cleanModern, null, 'place');
        if (altRes && altRes.found) {
          res = altRes;
        }
      }

      // 3. Si toujours non trouvé et qu'un nom antique existe, essayer le nom antique
      if ((!res || !res.found) && cleanAncient && cleanAncient.toLowerCase() !== cleanPrimary.toLowerCase()) {
        const ancRes = await API.getWikipediaSummary(cleanAncient, null, 'place');
        if (ancRes && ancRes.found) {
          res = ancRes;
        }
      }

      // Si entre-temps un autre lieu a été sélectionné, ignorer
      if (reqId !== this._currentWikiRequestId) return;

      if (res && res.found) {
        this.wikiCache[cacheKey] = res;
        this.renderWikipediaCard(wikiContainer, res);
      } else {
        wikiContainer.innerHTML = `
          <div class="maps-wiki-empty">
            Aucun article encyclopédique direct trouvé pour « ${this.escapeHtml(cleanPrimary)} ».
            <br>
            <a href="https://fr.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(cleanPrimary)}" target="_blank" rel="noopener noreferrer" class="maps-wiki-toggle-btn" style="display:inline-block; margin-top:4px;">
              Chercher « ${this.escapeHtml(cleanPrimary)} » sur Wikipédia ↗
            </a>
          </div>
        `;
      }
    } catch (err) {
      if (reqId !== this._currentWikiRequestId) return;
      wikiContainer.innerHTML = `
        <div class="maps-wiki-empty">
          Notice indisponible hors connexion.
        </div>
      `;
    }
  },

  renderWikipediaCard(container, data) {
    const hasThumb = !!data.thumbnail;
    const cleanExtract = (data.extract || '').replace(/\n+/g, ' ').trim();
    const isLong = cleanExtract.length > 220;

    let thumbHtml = '';
    if (hasThumb) {
      thumbHtml = `
        <div class="maps-wiki-thumb-wrap">
          <img src="${data.thumbnail}" class="maps-wiki-thumb" alt="${this.escapeHtml(data.title)}" loading="lazy" />
        </div>
      `;
    }

    let metaDesc = '';
    if (data.description) {
      metaDesc = `<span class="maps-wiki-desc">${this.escapeHtml(data.description)}</span>`;
    }

    container.innerHTML = `
      <div class="maps-wiki-card">
        ${thumbHtml}
        <div class="maps-wiki-meta">
          <strong class="maps-wiki-title">${this.escapeHtml(data.title)}</strong>
          ${metaDesc}
        </div>
        <div class="maps-wiki-extract ${isLong ? 'clamped' : ''}" id="maps-wiki-extract-box">
          ${this.escapeHtml(cleanExtract)}
        </div>
        <div class="maps-wiki-btn-row">
          ${isLong ? `<button type="button" class="maps-wiki-toggle-btn" id="btn-toggle-wiki-clamp">Lire la suite ▾</button>` : '<span></span>'}
          <a href="${data.url || `https://fr.wikipedia.org/wiki/${encodeURIComponent(data.title)}`}" target="_blank" rel="noopener noreferrer" class="maps-wiki-open-link" title="Consulter l'article complet sur Wikipédia">
            <span>Article complet</span>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>
    `;

    const toggleBtn = container.querySelector('#btn-toggle-wiki-clamp');
    const extractBox = container.querySelector('#maps-wiki-extract-box');
    if (toggleBtn && extractBox) {
      toggleBtn.addEventListener('click', () => {
        const isClamped = extractBox.classList.toggle('clamped');
        toggleBtn.textContent = isClamped ? 'Lire la suite ▾' : 'Réduire ▴';
      });
    }
  }
};
