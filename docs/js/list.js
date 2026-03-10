/**
 * Gazetteer SPA — Sidebar place list module.
 */

/** Welsh flag indicator for Welsh-language toponyms. */
const _WELSH_FLAG = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}';

let currentFiltered = [];

export function initList(state) {
  currentFiltered = state.features;
  renderList(currentFiltered);
}

export function filterList(filtered) {
  currentFiltered = filtered;
  renderList(filtered);
}

function renderList(features) {
  const ul = document.getElementById('place-list');

  // Build HTML in one go
  const html = features.map(f => {
    const p = f.properties;
    const badges = [];
    // For draft places without market/fair records, derive badges from attestations
    const hasMarketRecord = p.nm > 0;
    const hasFairRecord = p.nf > 0;
    let showMarketBadge = hasMarketRecord;
    let showFairBadge = hasFairRecord;
    if (p.draft && !hasMarketRecord && !hasFairRecord) {
      (p.attestations || []).forEach(a => {
        if (a.type === 'm' || a.type === 'b') showMarketBadge = true;
        if (a.type === 'f' || a.type === 'b') showFairBadge = true;
      });
    }
    if (showMarketBadge) badges.push('<span class="badge badge-m" title="Market"></span>');
    if (showFairBadge) badges.push('<span class="badge badge-f" title="Fair"></span>');
    if (p.draft) badges.push('<span class="badge badge-draft" title="Draft (attestation only)">D</span>');
    // Welsh toponym
    const cy = (p.toponyms || []).find(t => t.lang === 'cy');
    const welshHtml = cy ? ` <span class="cy-badge-sm">${_WELSH_FLAG} ${esc(cy.name)}</span>` : '';
    return `<li data-id="${p.id}">
      <span class="place-name">${esc(p.name)}${welshHtml}</span>
      <span class="place-badges">${badges.join('')}</span>
      <span class="place-county">${esc(p.county || '')}</span>
    </li>`;
  }).join('');

  ul.innerHTML = html;

  // Click handlers via delegation
  ul.onclick = (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = parseInt(li.dataset.id);
    window.location.hash = `#place/${id}`;
  };
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

