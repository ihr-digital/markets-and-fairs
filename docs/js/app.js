/**
 * Gazetteer SPA — Main application module.
 *
 * Loads data, sets up the map, list, detail panel, and hash-based routing.
 */

import { initMap, flyTo, setFilter as setMapFilter, highlightPlace, resetPadding, fitCountyBounds, resetView } from './map.js';
import { initList, filterList } from './list.js';
import { showDetail, hideDetail, setVchLookup, setSourceTooltips } from './detail.js';

/* ── State ────────────────────────────────────────────────────────── */

export const state = {
  geojson: null,       // raw GeoJSON FeatureCollection
  counties: null,      // county lookup array
  countyByCode: {},    // hcs_code → county object (with bbox)
  metadata: null,      // year range, counts
  vchLookup: null,     // VCH county:vol → { u: path, p: { page: slug } }
  sources: null,       // [{abbrev, tooltip, html}]
  features: [],        // geojson.features (convenience)
  byId: new Map(),     // place_id → feature
  selectedId: null,
};

/* ── Bootstrap ────────────────────────────────────────────────────── */

async function boot() {
  const [geojsonResp, countiesResp, metaResp, vchResp, srcResp] = await Promise.all([
    fetch('data/places.geojson'),
    fetch('data/counties.json'),
    fetch('data/metadata.json'),
    fetch('data/vch_lookup.json'),
    fetch('data/sources.json'),
  ]);
  state.geojson = await geojsonResp.json();
  state.counties = await countiesResp.json();
  state.metadata = await metaResp.json();
  state.vchLookup = vchResp.ok ? await vchResp.json() : {};
  state.sources = srcResp.ok ? await srcResp.json() : [];
  state.features = state.geojson.features;
  state.features.forEach(f => state.byId.set(f.properties.id, f));
  state.counties.forEach(c => { state.countyByCode[c.code] = c; });
  setVchLookup(state.vchLookup);
  setSourceTooltips(state.sources);

  // Populate the modal source list
  const srcDl = document.getElementById('attr-sources-dl');
  if (srcDl && state.sources.length) {
    srcDl.innerHTML = state.sources.map(s =>
      `<dt>${_escHtml(s.abbrev)}</dt><dd>${s.html}</dd>`
    ).join('');
  }

  // Dynamic subtitle with year range
  const m = state.metadata;
  const subtitle = document.getElementById('subtitle');
  if (m.year_min && m.year_max) {
    subtitle.textContent = `England & Wales, ${m.year_min}–${m.year_max}`;
  }

  // Populate the meta-summary in the attribution modal
  const summary = document.getElementById('meta-summary');
  if (summary && m) {
    summary.textContent = `${m.place_count.toLocaleString()} places · `
      + `${m.market_count.toLocaleString()} markets · `
      + `${m.fair_count.toLocaleString()} fairs · `
      + `${m.county_count} counties · `
      + `date range ${m.year_min}–${m.year_max}`;
  }

  initCountyDropdown();
  initMap(state);
  initList(state);
  wireEvents();
  handleHash();
}

/* ── County dropdown ──────────────────────────────────────────────── */

function initCountyDropdown() {
  const sel = document.getElementById('filter-county');
  state.counties.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

/* ── Filtering ────────────────────────────────────────────────────── */

function applyFilters() {
  const query = document.getElementById('search').value.trim().toLowerCase();
  const county = document.getElementById('filter-county').value;
  const cat = document.getElementById('filter-cat').value;

  const filtered = state.features.filter(f => {
    const p = f.properties;
    if (county && p.cc !== county) return false;
    if (cat === 'draft') {
      if (!p.draft) return false;
    } else if (cat) {
      if (p.cat !== cat) return false;
    }
    if (query) {
      const names = (p.toponyms || []).map(t => t.name.toLowerCase());
      names.push(p.name.toLowerCase());
      if (!names.some(n => n.includes(query))) return false;
    }
    return true;
  });

  filterList(filtered);
  setMapFilter(county, cat, query);

  const el = document.getElementById('result-count');
  el.textContent = `${filtered.length} of ${state.features.length} places`;
}

/* ── Events ───────────────────────────────────────────────────────── */

function wireEvents() {
  document.getElementById('search').addEventListener('input', applyFilters);
  document.getElementById('filter-county').addEventListener('change', () => {
    applyFilters();
    const county = document.getElementById('filter-county').value;
    if (county) {
      const c = state.countyByCode[county];
      if (c && c.bbox) fitCountyBounds(c.bbox);
    } else {
      resetView();
    }
  });
  document.getElementById('filter-cat').addEventListener('change', applyFilters);
  document.getElementById('detail-close').addEventListener('click', () => {
    window.location.hash = '';
  });
  window.addEventListener('hashchange', handleHash);

  // Attribution modal
  const attrPanel = document.getElementById('attribution');
  const backdrop = document.getElementById('modal-backdrop');
  const openModal = () => { attrPanel.classList.remove('hidden'); backdrop.classList.remove('hidden'); };
  const closeModal = () => {
    attrPanel.classList.add('hidden');
    backdrop.classList.add('hidden');
    try { localStorage.setItem('gazetteer_visited', '1'); } catch {}
  };
  document.getElementById('attribution-toggle').addEventListener('click', openModal);
  document.getElementById('attribution-close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // Auto-open on first visit
  try {
    if (!localStorage.getItem('gazetteer_visited')) openModal();
  } catch {}

  // Initial filter count
  applyFilters();
}

/* ── Hash routing ─────────────────────────────────────────────────── */

function handleHash() {
  const hash = window.location.hash;
  const m = hash.match(/^#place\/(\d+)$/);
  if (m) {
    const id = parseInt(m[1]);
    selectPlace(id);
  } else {
    deselectPlace();
  }
}

export function selectPlace(id) {
  const feature = state.byId.get(id);
  if (!feature) return;
  state.selectedId = id;
  showDetail(feature);
  highlightPlace(id);
  if (feature.geometry && feature.geometry.coordinates) {
    flyTo(feature.geometry.coordinates, { offsetForPanel: true });
  }

  // Update list active state
  document.querySelectorAll('#place-list li.active').forEach(el => el.classList.remove('active'));
  const li = document.querySelector(`#place-list li[data-id="${id}"]`);
  if (li) {
    li.classList.add('active');
    li.scrollIntoView({ block: 'nearest' });
  }
}

function deselectPlace() {
  state.selectedId = null;
  hideDetail();
  highlightPlace(null);
  resetPadding();
  document.querySelectorAll('#place-list li.active').forEach(el => el.classList.remove('active'));
}

/* ── Utilities ────────────────────────────────────────────────────── */

function _escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Go ───────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', boot);

