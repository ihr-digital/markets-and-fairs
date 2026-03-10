/**
 * Gazetteer SPA — Detail panel renderer.
 */

/* ── VCH lookup (loaded by app.js, injected here) ─────────────────── */

let _vchLookup = null;

/** Called once from app.js after boot to hand us the lookup table. */
export function setVchLookup(lookup) { _vchLookup = lookup; }

/** County aliases used in citations → VCH series key */
const _VCH_COUNTY_ALIASES = {
  'lancashire': 'lancaster', 'lancs': 'lancaster',
  'wilts': 'wiltshire',
  'gloucesteshire': 'gloucestershire', 'gloucs': 'gloucestershire',
  'huntingdon': 'huntingdonshire', 'hunts': 'huntingdonshire',
  'hants': 'hampshire', 'northants': 'northamptonshire',
  'salop': 'shropshire', 'worcs': 'worcestershire',
  'warwicks': 'warwickshire', 'staffs': 'staffordshire',
  'leics': 'leicestershire', 'lincs': 'lincolnshire',
  'notts': 'nottinghamshire', 'bucks': 'buckinghamshire',
  'berks': 'berkshire', 'cambs': 'cambridgeshire',
  'beds': 'bedfordshire', 'herts': 'hertfordshire',
  'middx': 'middlesex', 'oxon': 'oxfordshire',
};

const _BHO_BASE = 'https://www.british-history.ac.uk';

/**
 * In an already-escaped HTML string, find VCH references and wrap them
 * in <a> links to British History Online.
 *
 * Pattern: VCH County, vol, p. NNN or VCH County, vol, pp. NNN-NNN
 */
const _VCH_RE = /VCH\s+(\w[\w\s]*?),\s*([ivxlcIVXLC]+)\s*(?:,\s*part\s+([ivxlcIVXLC]+))?\s*,\s*(pp?\.\s*\d+(?:\s*[-–]\s*\d+)?)/g;

function linkVch(html) {
  if (!_vchLookup || !html.includes('VCH')) return html;
  return html.replace(_VCH_RE, (match, county, vol, part, pagePart) => {
    const ctyKey = _VCH_COUNTY_ALIASES[county.trim().toLowerCase()] || county.trim().toLowerCase();
    const volKey = vol.trim().toLowerCase();
    const partKey = part ? part.trim().toLowerCase() : '';
    // Try part-qualified key first, then fall back to volume-only
    const entry = (partKey && _vchLookup[`${ctyKey}:${volKey}:${partKey}`])
               || _vchLookup[`${ctyKey}:${volKey}`];
    if (!entry) return match;

    // Extract the first page number to look up the component slug
    const pageMatch = pagePart.match(/(\d+)/);
    if (!pageMatch) return match;
    const slug = entry.p[pageMatch[1]];
    if (slug) {
      const url = `${_BHO_BASE}${entry.u}/pp${slug}`;
      return `<a href="${url}" target="_blank" rel="noopener" class="vch-link" title="Open on British History Online (new tab)">${match}</a>`;
    }
    // No page-level link but we have the volume
    const url = `${_BHO_BASE}${entry.u}`;
    return `<a href="${url}" target="_blank" rel="noopener" class="vch-link" title="Open on British History Online (new tab)">${match}</a>`;
  });
}

/** Escape HTML, inject VCH hyperlinks, then annotate source abbreviations. */
function escVch(s) {
  if (!s) return '';
  return annotateSources(linkVch(esc(s)));
}

/* ── Glossaries ───────────────────────────────────────────────────── */

/** Welsh flag indicator for Welsh-language toponyms. */
const _WELSH_FLAG = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}';

/** Grant type codes → { label, title (tooltip), colour } */
const GRANT_TYPES = {
  'GC':    { label: 'Charter',           title: 'Granted by royal charter',                     colour: '#c0392b' },
  'GL':    { label: 'Letter Close',      title: 'Granted by letter close',                      colour: '#2980b9' },
  'GP':    { label: 'Letter Patent',     title: 'Granted by letter patent',                     colour: '#16a085' },
  'GO':    { label: 'Other Grant',       title: 'Granted by other means (not charter, close or patent)', colour: '#e67e22' },
  'P':     { label: 'Prescriptive',      title: 'Held by prescriptive right (custom)',          colour: '#7f8c8d' },
  'PB':    { label: 'Prescriptive (B)',   title: 'Prescriptive market in a borough',             colour: '#8e44ad' },
  'PM':    { label: 'Prescriptive (M)',   title: 'Prescriptive market at a mint',                colour: '#6c3483' },
  'PB PM': { label: 'Prescriptive (B+M)', title: 'Prescriptive market in a borough with a mint', colour: '#5b2c6f' },
  'FP':    { label: 'Formerly Prescriptive', title: 'Formerly prescriptive',                    colour: '#95a5a6' },
};

/** Fair days-held abbreviation key (for the glossary panel) */
const DAYS_GLOSSARY = {
  'v':   'vigil (eve of the feast)',
  'f':   'feast day',
  'm':   'morrow (day after the feast)',
  'vf':  'vigil + feast (2 days)',
  'fm':  'feast + morrow (2 days)',
  'vfm': 'vigil + feast + morrow (3 days)',
};

/** Abbreviated source references → full citation for tooltips.
 *  Populated at boot via setSourceTooltips(). */
let SOURCE_TOOLTIPS = {};
let _SRC_RE = null;

/** Called from app.js at boot with the parsed sources array. */
export function setSourceTooltips(sources) {
  SOURCE_TOOLTIPS = {};
  for (const s of sources) {
    SOURCE_TOOLTIPS[s.abbrev] = s.tooltip;
  }
  // Build regex matching any known abbreviation as a whole word, longest first
  const keys = Object.keys(SOURCE_TOOLTIPS).sort((a, b) => b.length - a.length);
  if (keys.length) {
    _SRC_RE = new RegExp(
      '\\b(' + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g'
    );
  }
}

/**
 * In already-escaped HTML, wrap known source abbreviations in a
 * <span> with a title tooltip.  Skips text already inside an HTML tag.
 */
function annotateSources(html) {
  if (!html || !_SRC_RE) return html;
  // Split on HTML tags to avoid replacing inside attribute values
  return html.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
    if (tag) return tag;
    return text.replace(_SRC_RE, (match) => {
      const tip = SOURCE_TOOLTIPS[match];
      if (!tip) return match;
      return `<span class="src-tip" title="${esc(tip).replace(/"/g, '&quot;')}">${match}</span>`;
    });
  });
}


const panel = document.getElementById('detail');
const content = document.getElementById('detail-content');

export function showDetail(feature) {
  const p = feature.properties;
  // Properties might be stringified when coming from map features;
  // ensure we have the full object from state
  const props = typeof p.markets === 'string' ? parseProps(p) : p;

  let html = '';

  // Name — with Welsh toponym inline if present
  const cyTop = (props.toponyms || []).find(t => t.lang === 'cy');
  const cyInline = cyTop ? ` <span class="detail-name-cy">${_WELSH_FLAG} ${esc(cyTop.name)}</span>` : '';
  html += `<h2 class="detail-name">${esc(props.name)}${cyInline}</h2>`;
  html += `<div class="detail-county">${esc(props.county || '')}`;
  if (feature.geometry && feature.geometry.coordinates) {
    const [lng, lat] = feature.geometry.coordinates;
    html += ` <span style="font-size:11px;color:#999">(${lat.toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'})</span>`;
  } else {
    html += ` <span style="font-size:11px;color:#999">(no coordinates)</span>`;
  }
  if (props.wd) {
    html += ` <a href="https://www.wikidata.org/wiki/${esc(props.wd)}" target="_blank" rel="noopener" class="detail-wd-link" title="View on Wikidata">wd:${esc(props.wd)}</a>`;
  }
  html += `</div>`;
  if (props.draft) {
    html += `<div class="detail-draft-notice">Draft entry. No charter or grant evidence.</div>`;
  }

  // Timeline
  html += renderTimeline(props);

  // Toponyms — show non-Welsh alternatives only (Welsh is shown in heading)
  if (props.toponyms && props.toponyms.length > 0) {
    const alts = props.toponyms.filter(t => t.lang !== 'cy' && (!t.primary || t.name !== props.name));
    if (alts.length > 0) {
      const tags = alts.map(t => `<span class="toponym-badge">${esc(t.name)}</span>`).join('');
      html += `<div class="detail-toponyms">${tags}</div>`;
    }
  }

  // Meta fields
  const metaFields = [];
  if (props.borough) metaFields.push(['Borough', props.borough]);
  if (props.boro_date) metaFields.push(['Borough date', props.boro_date]);
  if (props.boro_src) metaFields.push(['Borough source', props.boro_src]);
  if (props.mint) metaFields.push(['Mint', props.mint]);
  if (props.val1334) metaFields.push(['1334 value', '£' + props.val1334]);
  if (props.harrison) metaFields.push(['Harrison', props.harrison]);
  if (props.see) metaFields.push(['See also', props.see]);
  if (props.pr_first && props.pr_last && props.pr_total) {
    let txt = `${props.pr_first}-${props.pr_last} (${props.pr_total} returns`;
    if (props.pr_consec) txt += `; ${props.pr_consec} consecutive-serving MPs`;
    txt += ')';
    metaFields.push(['Parliamentary returns', txt]);
  }

  if (metaFields.length) {
    html += '<dl class="detail-meta">';
    metaFields.forEach(([k, v]) => {
      html += `<dt>${esc(k)}</dt><dd>${escVch(String(v))}</dd>`;
    });
    html += '</dl>';
  }

  // Attestations
  const atts = props.attestations || [];
  if (atts.length) {
    const TYPE_LABELS = { m: 'Market', f: 'Fair', b: 'Market & Fair' };
    html += '<div class="detail-attestations"><strong>Attested:</strong> ';
    html += atts.map(a => {
      const lbl = TYPE_LABELS[a.type] || a.type;
      const tip = a.detail ? ` title="${esc(a.detail).replace(/"/g, '&quot;')}"` : '';
      return `<span class="att-badge"${tip}>${esc(a.source)} ${a.year} (${lbl})</span>`;
    }).join(' ');
    html += '</div>';
  }

  // History
  if (props.history) {
    html += `<div class="detail-history">${escVch(props.history)}</div>`;
  }

  // Markets
  if (props.markets && props.markets.length) {
    html += `<div class="detail-section"><h3 class="market-h">Markets (${props.markets.length})</h3>`;
    props.markets.forEach(m => { html += renderGrant(m, 'market'); });
    html += '</div>';
  }

  // Fairs
  if (props.fairs && props.fairs.length) {
    html += `<div class="detail-section"><h3 class="fair-h">Fairs (${props.fairs.length})</h3>`;
    props.fairs.forEach(f => { html += renderGrant(f, 'fair'); });
    html += '</div>';
  }

  // Notes
  if (props.notes) {
    html += `<div class="detail-notes"><strong>Notes:</strong> ${escVch(props.notes)}</div>`;
  }

  content.innerHTML = html;
  panel.classList.remove('hidden');
}

export function hideDetail() {
  panel.classList.add('hidden');
}

/* ── Timeline ─────────────────────────────────────────────────────── */

/** Tick categories: colour and label. */
const TICK_CATS = {
  borough:  { colour: '#8e44ad', label: 'Borough' },
  mint:     { colour: '#f39c12', label: 'Mint' },
  attested: { colour: '#27ae60', label: 'Attested' },
  returns:  { colour: '#6b7280', label: 'Parliamentary Returns' },
  charter:  { colour: '#c0392b', label: 'Charter/Grant' },
  conf:     { colour: '#2980b9', label: 'Confirmation' },
  first:    { colour: '#7f8c8d', label: 'First Recorded' },
};

/**
 * Extract the first four-digit year from a string like "1194", "02-May",
 * "early tenth century", "before 924-1154", "May 1156", "12 Dec 1228".
 */
function _extractYear(s) {
  if (!s) return null;
  const m = String(s).match(/\b(\d{4})\b/);
  return m ? parseInt(m[1]) : null;
}

/**
 * Build an SVG timeline for a place.
 * Returns HTML string or '' if no dateable events.
 */
function renderTimeline(props) {
  const markets = props.markets || [];
  const fairs = props.fairs || [];

  // Collect ticks: { year, cat ('charter'|'conf'|...), row ('m'|'f'|'place'') }
  const ticks = [];

  // Place-level dated references
  const boroYear = _extractYear(props.boro_date);
  if (boroYear) ticks.push({ year: boroYear, cat: 'borough', row: 'place' });

  if (props.mint) {
    // mint may contain ranges like "before 924-1154"
    const mintYears = String(props.mint).match(/\d{3,4}/g);
    if (mintYears) mintYears.forEach(y => ticks.push({ year: parseInt(y), cat: 'mint', row: 'place' }));
  }

  if (props.pr_first) ticks.push({ year: parseInt(props.pr_first), cat: 'returns', row: 'place' });
  if (props.pr_last && props.pr_last !== props.pr_first) {
    ticks.push({ year: parseInt(props.pr_last), cat: 'returns', row: 'place' });
  }

  // Attestations (from attestation table: Everitt, Harrison, Adams IV, etc.)
  (props.attestations || []).forEach(a => {
    if (a.year) {
      const row = a.type === 'f' ? 'f' : a.type === 'b' ? 'place' : 'm';
      ticks.push({ year: a.year, cat: 'attested', row });
    }
  });

  // Market-level
  markets.forEach(m => {
    const cy = _extractYear(m.cyear);
    if (cy) ticks.push({ year: cy, cat: 'charter', row: 'm' });
    const fy = _extractYear(m.first);
    if (fy) ticks.push({ year: fy, cat: 'first', row: 'm' });
    (m.confs || []).forEach(c => {
      const y = _extractYear(c.year);
      if (y) ticks.push({ year: y, cat: 'conf', row: 'm' });
    });
  });

  // Fair-level
  fairs.forEach(f => {
    const cy = _extractYear(f.cyear);
    if (cy) ticks.push({ year: cy, cat: 'charter', row: 'f' });
    const fy = _extractYear(f.first);
    if (fy) ticks.push({ year: fy, cat: 'first', row: 'f' });
    (f.confs || []).forEach(c => {
      const y = _extractYear(c.year);
      if (y) ticks.push({ year: y, cat: 'conf', row: 'f' });
    });
  });

  if (ticks.length === 0) return '';

  // Fixed global axis range
  const yMin = 880;
  const yMax = 1850;

  // Which rows do we need?
  // For draft (attestation-only) places, derive rows from attestation types
  let hasM = markets.length > 0;
  let hasF = fairs.length > 0;
  if (!hasM && !hasF) {
    // Check attestations for market/fair types
    (props.attestations || []).forEach(a => {
      if (a.type === 'm' || a.type === 'b') hasM = true;
      if (a.type === 'f' || a.type === 'b') hasF = true;
    });
  }

  // SVG layout
  const W = 420;   // total width
  const lMargin = 44; // left margin for labels
  const rMargin = 8;
  const barW = W - lMargin - rMargin;
  const barH = 14;
  const barGap = 4;
  const tickOverhang = 3; // tick extends above/below bar
  const legendH = 16;
  const topPad = 14; // space for year labels at top

  const rows = [];
  if (hasM) rows.push('m');
  if (hasF) rows.push('f');
  // Parliamentary-only or other place-level dated references still need a timeline row.
  if (rows.length === 0) rows.push('place');

  const barsH = rows.length * barH + (rows.length - 1) * barGap;
  const totalH = topPad + barsH + 8 + legendH;

  const xScale = (year) => lMargin + ((year - yMin) / (yMax - yMin)) * barW;

  let svg = `<svg class="timeline-svg" viewBox="0 0 ${W} ${totalH}" preserveAspectRatio="xMidYMid meet">`;

  // Year axis labels at top
  const niceYears = _niceAxisYears(yMin, yMax);
  niceYears.forEach(y => {
    const x = xScale(y);
    svg += `<text x="${x}" y="${topPad - 4}" class="tl-year">${y}</text>`;
    // Light vertical grid line through bars
    svg += `<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + barsH}" class="tl-grid"/>`;
  });

  // Bars
  rows.forEach((row, i) => {
    const y = topPad + i * (barH + barGap);
    const fill = row === 'm' ? 'var(--cat-market)' : row === 'f' ? 'var(--cat-fair)' : '#6b7280';
    const label = row === 'm' ? 'Markets' : row === 'f' ? 'Fairs' : 'Place';
    // Label
    svg += `<text x="${lMargin - 4}" y="${y + barH / 2 + 4}" class="tl-label">${label}</text>`;
    // Bar background
    svg += `<rect x="${lMargin}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="${fill}" opacity="0.12"/>`;

    // Ticks for this row + place-level ticks on market/fair rows
    ticks.forEach(t => {
      if (row === 'place') {
        if (t.row !== 'place') return;
      } else {
        if (t.row !== row && t.row !== 'place') return;
      }
      const x = xScale(t.year);
      const tc = TICK_CATS[t.cat] || { colour: '#999', label: t.cat };
      svg += `<line x1="${x}" y1="${y - tickOverhang}" x2="${x}" y2="${y + barH + tickOverhang}" `
           + `stroke="${tc.colour}" stroke-width="1.5" opacity="0.85">`
           + `<title>${tc.label}: ${t.year}</title></line>`;
    });
  });

  // Legend
  const usedCats = [...new Set(ticks.map(t => t.cat))];
  const ly = topPad + barsH + 8;
  let lx = lMargin;
  usedCats.forEach(cat => {
    const tc = TICK_CATS[cat] || { colour: '#999', label: cat };
    svg += `<line x1="${lx}" y1="${ly}" x2="${lx}" y2="${ly + 10}" stroke="${tc.colour}" stroke-width="2"/>`;
    svg += `<text x="${lx + 4}" y="${ly + 9}" class="tl-legend">${tc.label}</text>`;
    lx += tc.label.length * 5.5 + 14;
  });

  svg += '</svg>';
  return `<div class="detail-timeline">${svg}</div>`;
}

/**
 * Generate nice round years for the axis within [yMin, yMax].
 */
function _niceAxisYears(yMin, yMax) {
  const span = yMax - yMin;
  let step;
  if (span > 600) step = 200;
  else if (span > 400) step = 100;
  else if (span > 200) step = 50;
  else if (span > 80) step = 25;
  else step = 10;
  const years = [];
  let y = Math.ceil(yMin / step) * step;
  while (y <= yMax) {
    years.push(y);
    y += step;
  }
  return years;
}

/* ── Grant cards ──────────────────────────────────────────────────── */

function renderGrant(g, kind) {
  let html = '<div class="grant-card">';

  // Grant type badge with colour and tooltip
  const gt = GRANT_TYPES[g.type];
  if (gt) {
    html += `<div class="grant-type-badge" style="background:${gt.colour}" title="${esc(gt.title)}">${esc(gt.label)}</div>`;
  } else if (g.type) {
    html += `<div class="grant-type-badge" style="background:#999" title="${esc(g.type)}">${esc(g.type)}</div>`;
  }

  // Key fields — [label, value, isHtml?]
  const fields = [];
  if (kind === 'market') {
    if (g.days) fields.push(['Day(s)', g.days]);
    if (g.ndays) fields.push(['No. of days', g.ndays]);
    if (g.first) fields.push(['First recorded', g.first]);
    if (g.term) fields.push(['Term used', g.term]);
    if (g.presc) fields.push(['Prescriptive holder', g.presc]);
  } else {
    if (g.days) fields.push(['Days held', annotateDays(g.days), true]);
    if (g.feast) fields.push(['Feast', g.feast]);
    if (g.feast_date) fields.push(['Feast date', g.feast_date]);
    if (g.dur) fields.push(['Duration (days)', g.dur]);
    if (g.term) fields.push(['Term used', g.term]);
    if (g.first) fields.push(['First reference', g.first]);
    if (g.owner) fields.push(['Owner (prescriptive)', g.owner]);
  }
  if (g.cyear) fields.push(['Charter year', g.cyear]);
  if (g.cdate) fields.push(['Charter date', g.cdate]);
  if (g.grantor) fields.push(['Grantor', g.grantor + (g.gtype ? ` (${g.gtype})` : '')]);
  if (g.grantee) fields.push(['Grantee', g.grantee + (g.gee_type ? ` (${g.gee_type})` : '')]);
  if (g.source) fields.push(['Source', g.source]);

  if (fields.length) {
    html += '<dl>';
    fields.forEach(([k, v, isHtml]) => {
      html += `<dt>${esc(k)}</dt><dd>${isHtml ? v : escVch(String(v))}</dd>`;
    });
    html += '</dl>';
  }

  // Confirmations
  if (g.confs && g.confs.length) {
    html += `<table class="conf-table">
      <tr><th>Year</th><th>Date</th><th>From</th><th>To</th><th>Source</th></tr>`;
    g.confs.forEach(c => {
      html += `<tr>
        <td>${esc(c.year || '')}</td>
        <td>${esc(c.date || '')}</td>
        <td>${esc(c.from || '')}</td>
        <td>${esc(c.to || '')}</td>
        <td>${escVch(c.src || '')}</td>
      </tr>`;
    });
    html += '</table>';
  }

  // Notes
  if (g.notes) {
    html += `<div class="grant-notes">${escVch(g.notes)}</div>`;
  }

  html += '</div>';
  return html;
}

/**
 * When properties come from a MapLibre feature query, nested objects
 * are serialised as JSON strings.  Parse them back.
 */
function parseProps(p) {
  const result = { ...p };
  for (const key of ['toponyms', 'markets', 'fairs', 'attestations']) {
    if (typeof result[key] === 'string') {
      try { result[key] = JSON.parse(result[key]); } catch { /* keep as-is */ }
    }
  }
  if (typeof result.nm === 'string') result.nm = parseInt(result.nm) || 0;
  if (typeof result.nf === 'string') result.nf = parseInt(result.nf) || 0;
  return result;
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Annotate fair days-held strings with a single tooltip span for abbreviations.
 * e.g. "vfm+1" → '<span class="days-abbr" title="vigil + feast + morrow">vfm</span>+1'
 * Returns HTML (already escaped where needed).
 */
function annotateDays(raw) {
  if (!raw) return '';
  const s = esc(raw);
  // Match a leading abbreviation of v/f/m letters, optionally inside brackets
  return s.replace(/^(\[?)([vfm]+)/, (match, bracket, abbr) => {
    // Build a single tooltip from the individual letter meanings
    const compound = DAYS_GLOSSARY[abbr];
    if (compound) {
      return `${bracket}<span class="days-abbr" title="${esc(compound)}">${abbr}</span>`;
    }
    // No compound entry — build from individual letters
    const parts = abbr.split('').map(ch => DAYS_GLOSSARY[ch] || ch).join(' + ');
    return `${bracket}<span class="days-abbr" title="${esc(parts)}">${abbr}</span>`;
  });
}

