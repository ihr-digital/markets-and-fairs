/**
 * Gazetteer SPA — MapLibre GL JS map module.
 */

let map;
const MARKER_COLOURS = {
  both:   '#8e44ad',
  market: '#c0392b',
  fair:   '#2980b9',
  none:   '#999',
};

export function initMap(state) {
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        carto: {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png'],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      },
      layers: [{
        id: 'basemap',
        type: 'raster',
        source: 'carto',
        minzoom: 0,
        maxzoom: 20,
      }],
    },
    center: [-1.5, 52.8],
    zoom: 5.8,
    maxZoom: 16,
    attributionControl: false,
  });

  // Add attribution control with custom attributions (source-level ones are merged automatically)
  map.addControl(new maplibregl.AttributionControl({
    compact: false,
    customAttribution: 'Data: <a href="https://beta.ukdataservice.ac.uk/datacatalogue/studies/study?id=4171">Letters et al. (2003) SN 4171</a> | Welsh names: <a href="https://historicplacenames.rcahmw.gov.uk/">RCAHMW</a>',
  }), 'bottom-left');

  map.on('load', () => {

    // --- Waterways (bottommost overlay) ---
    map.addSource('waterways', {
      type: 'geojson',
      data: 'data/waterways.geojson',
      attribution: 'Waterways: <a href="https://researchportal.helsinki.fi/en/datasets/inland-navigation-in-england-and-wales-before-1348-gis-database/">Oksanen &amp; Sherborne (2019)</a>',
    });

    map.addLayer({
      id: 'waterways',
      type: 'line',
      source: 'waterways',
      paint: {
        'line-color': '#4a90c4',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          5, ['match', ['get', 'class'], 'known_bulk', 1.2, 0.6],
          8, ['match', ['get', 'class'], 'known_bulk', 2.2, 1.2],
          12, ['match', ['get', 'class'], 'known_bulk', 3.5, 2],
        ],
        'line-opacity': 0.5,
      },
    });

    // --- Roads (above waterways) ---
    map.addSource('roads', {
      type: 'geojson',
      data: 'data/roads.geojson',
      attribution: 'Roads &copy; Stephen Gadd',
    });

    map.addLayer({
      id: 'roads-track',
      type: 'line',
      source: 'roads',
      filter: ['!=', ['get', 'class'], 'road'],
      paint: {
        'line-color': '#2d6a2d',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          5, 1.4,
          8, 2.5,
          12, 4,
        ],
        'line-opacity': 0.6,
      },
    });

    map.addLayer({
      id: 'roads-main',
      type: 'line',
      source: 'roads',
      filter: ['==', ['get', 'class'], 'road'],
      paint: {
        'line-color': '#2d6a2d',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          5, 1,
          8, 1.8,
          12, 3,
        ],
        'line-opacity': 0.55,
      },
    });

    // --- County boundary outlines ---
    map.addSource('counties', {
      type: 'geojson',
      data: 'data/counties.geojson',
      attribution: '&copy; <a href="https://county-borders.co.uk">Historic County Borders Project</a>',
    });

    map.addLayer({
      id: 'county-fill',
      type: 'fill',
      source: 'counties',
      paint: {
        'fill-color': '#555',
        'fill-opacity': 0.03,
      },
    });

    map.addLayer({
      id: 'county-lines',
      type: 'line',
      source: 'counties',
      paint: {
        'line-color': '#555',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          5, 0.5,
          8, 0.8,
          12, 1.2,
        ],
        'line-opacity': 0.6,
      },
    });

    // County labels — one point per polygon part (labels detached parts)
    map.addSource('county-labels', {
      type: 'geojson',
      data: 'data/county_labels.geojson',
    });

    // Main county labels (larger parts only, visible from zoom 7)
    map.addLayer({
      id: 'county-labels-main',
      type: 'symbol',
      source: 'county-labels',
      minzoom: 7,
      maxzoom: 12,
      filter: ['>=', ['get', 'area'], 0.01],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          7, 10,
          10, 13,
        ],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#555',
        'text-opacity': 0.8,
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });

    // All county labels including detached parts (zoom 12+)
    map.addLayer({
      id: 'county-labels-all',
      type: 'symbol',
      source: 'county-labels',
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          12, 11,
          14, 13,
        ],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.05,
        'text-max-width': 8,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#555',
        'text-opacity': 0.8,
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });

    // Add the GeoJSON source with clustering
    map.addSource('places', {
      type: 'geojson',
      data: state.geojson,
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 40,
    });

    // Cluster circles
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'places',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step', ['get', 'point_count'],
          '#d4a76a', 20,
          '#c0a060', 50,
          '#8b4513',
        ],
        'circle-radius': [
          'step', ['get', 'point_count'],
          14, 20, 18, 50, 24,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

    // Cluster count labels
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'places',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 12,
      },
      paint: { 'text-color': '#fff' },
    });

    // Individual place circles
    map.addLayer({
      id: 'place-points',
      type: 'circle',
      source: 'places',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          5, 3,
          10, 6,
          14, 10,
        ],
        'circle-color': [
          'match', ['get', 'cat'],
          'both',   MARKER_COLOURS.both,
          'market', MARKER_COLOURS.market,
          'fair',   MARKER_COLOURS.fair,
          MARKER_COLOURS.none,
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.9,
      },
    });

    // Highlight layer (ring around selected point)
    map.addLayer({
      id: 'place-highlight',
      type: 'circle',
      source: 'places',
      filter: ['==', ['get', 'id'], -1],
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          5, 8,
          10, 14,
          14, 20,
        ],
        'circle-color': 'transparent',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#f39c12',
      },
    });

    // Place name labels (unclustered points only)
    map.addLayer({
      id: 'place-labels',
      type: 'symbol',
      source: 'places',
      filter: ['!', ['has', 'point_count']],
      minzoom: 9,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          9, 10,
          13, 12,
        ],
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#333',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    });

    // Click on cluster → zoom in
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;
      const zoom = await map.getSource('places').getClusterExpansionZoom(clusterId);
      map.flyTo({ center: features[0].geometry.coordinates, zoom });
    });

    // Click on individual place
    map.on('click', 'place-points', (e) => {
      const f = e.features[0];
      const id = f.properties.id;
      window.location.hash = `#place/${id}`;
    });

    // Hover cursor
    map.on('mouseenter', 'place-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'place-points', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });

    // Popup on hover for individual places
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '280px' });
    map.on('mouseenter', 'place-points', (e) => {
      const f = e.features[0];
      const p = f.properties;
      // Properties may be stringified when coming from vector source
      const cat = p.cat;
      const nm = typeof p.nm === 'string' ? parseInt(p.nm) : p.nm;
      const nf = typeof p.nf === 'string' ? parseInt(p.nf) : p.nf;
      const name = p.name;
      const county = p.county || '';
      let stats = [];
      if (nm) stats.push(`${nm} market${nm > 1 ? 's' : ''}`);
      if (nf) stats.push(`${nf} fair${nf > 1 ? 's' : ''}`);
      popup.setLngLat(e.lngLat)
        .setHTML(`
          <div class="popup-name">${name}</div>
          <div class="popup-county">${county}</div>
          ${stats.length ? `<div class="popup-stats">${stats.join(', ')}</div>` : ''}
        `)
        .addTo(map);
    });
    map.on('mouseleave', 'place-points', () => { popup.remove(); });
  });
}

export function flyTo(coords, { offsetForPanel = false } = {}) {
  if (!map) return;
  const zoom = Math.max(map.getZoom(), 9);
  if (offsetForPanel) {
    const panelW = 480; // var(--detail-w)
    map.flyTo({
      center: coords,
      zoom,
      speed: 1.2,
      padding: { top: 0, bottom: 0, left: 0, right: panelW },
    });
  } else {
    map.flyTo({ center: coords, zoom, speed: 1.2 });
  }
}

export function highlightPlace(id) {
  if (!map || !map.getLayer('place-highlight')) return;
  map.setFilter('place-highlight', id != null
    ? ['==', ['get', 'id'], id]
    : ['==', ['get', 'id'], -1]);
}

export function resetPadding() {
  if (!map) return;
  map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 300 });
}

export function fitCountyBounds(bbox) {
  if (!map || !bbox) return;
  // bbox is [minLng, minLat, maxLng, maxLat]
  map.fitBounds(bbox, { padding: 40, speed: 1.2, maxZoom: 12 });
}

export function resetView() {
  if (!map) return;
  map.flyTo({ center: [-1.5, 52.8], zoom: 5.8, speed: 1.2 });
}

export function setFilter(county, cat, query) {
  if (!map || !map.getSource('places')) return;

  // Build a combined filter expression for the unclustered points
  const conditions = ['all'];
  if (county) conditions.push(['==', ['get', 'cc'], county]);
  if (cat) conditions.push(['==', ['get', 'cat'], cat]);
  // Note: text search filtering is handled at the list level only;
  // we can't easily substring-match in MapLibre expressions on nested arrays.
  // We filter the source data instead for text queries.

  // For text queries, swap the source data to a filtered subset
  if (query) {
    // This is handled by replacing the source data
    // We'll need the full state — import it
    import('./app.js').then(({ state }) => {
      const lq = query.toLowerCase();
      const filtered = {
        type: 'FeatureCollection',
        features: state.features.filter(f => {
          const p = f.properties;
          if (county && p.cc !== county) return false;
          if (cat === 'draft') { if (!p.draft) return false; }
          else if (cat && p.cat !== cat) return false;
          const names = (p.toponyms || []).map(t => (typeof t === 'string' ? t : t.name).toLowerCase());
          names.push(p.name.toLowerCase());
          return names.some(n => n.includes(lq));
        }),
      };
      map.getSource('places').setData(filtered);
    });
  } else if (county || cat) {
    import('./app.js').then(({ state }) => {
      const filtered = {
        type: 'FeatureCollection',
        features: state.features.filter(f => {
          const p = f.properties;
          if (county && p.cc !== county) return false;
          if (cat === 'draft') { if (!p.draft) return false; }
          else if (cat && p.cat !== cat) return false;
          return true;
        }),
      };
      map.getSource('places').setData(filtered);
    });
  } else {
    // Reset to full data
    import('./app.js').then(({ state }) => {
      map.getSource('places').setData(state.geojson);
    });
  }
}

