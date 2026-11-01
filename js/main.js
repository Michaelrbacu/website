import { CONFIG } from './config.js';
import * as orb from './orbits.js';
import * as feeds from './feeds.js';

const ISS_ID = '25544';
const LABELS = { [ISS_ID]: 'ISS', 48274: 'Tiangong' };
const EMPTY = { type: 'FeatureCollection', features: [] };
// NASA's daily global mosaic is complete for yesterday (UTC); today's is still filling in.
const TODAY_DATE = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const BASEMAPS = ['map', 'satellite', 'today'];
const MAX_OFFSET = 24 * 3600e3; // time slider reaches ±24h
const PLAY_SPEED = 300; // simulated seconds per real second while playing
const IMPERIAL = /-(US|LR|MM)$/i.test(navigator.language);

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const state = {
  groups: new Map(), // group → sats[] once loaded
  enabled: new Set(Object.entries(orb.GROUPS).filter(([, g]) => g.on).map(([k]) => k)),
  active: [], // deduped sats across enabled groups
  byId: new Map(),
  selected: null,
  follow: false,
  user: null,
  hazards: [],
  showHazards: true,
  places: [],
  shows: [],
  localKey: null,
  localSeq: 0,
  passes: { key: null, at: 0, list: [] },
  tickCount: 0,
  basemap: 'map',
  terrain: false,
  timeOffset: 0, // ms between simulated and real time
  playing: false,
  nightAt: 0,
  trackAt: 0,
  skyAt: 0,
  weather: { key: null, at: 0, data: null, pending: null },
};

const simNow = () => new Date(Date.now() + state.timeOffset);

// ---------- formatting ----------

const fmtWhen = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const fmtDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtNum = (n, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

function until(date, from = simNow()) {
  const m = Math.round((date - from) / 60000);
  if (m <= 0) return 'now';
  const h = Math.floor(m / 60);
  return h ? `in ${h}h ${m % 60}m` : `in ${m}m`;
}

function ago(t) {
  const m = (Date.now() - t) / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
const fmtDist = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${fmtNum(km, km < 10 ? 1 : 0)} km`);

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

// ---------- map ----------

const map = new maplibregl.Map({
  container: 'map',
  style: CONFIG.mapStyle,
  center: [-40, 25],
  zoom: window.innerWidth < 760 ? 1.1 : 2,
  hash: true,
  maxPitch: 70,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

map.on('style.load', () => {
  map.setProjection({ type: 'globe' });
  // Tint the stock dark style so oceans read as oceans from orbit.
  if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', '#0a1a33');
  if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', '#141922');
  try {
    map.setSky({
      'sky-color': '#0b1430',
      'horizon-color': '#2a5aa8',
      'fog-color': '#0b1430',
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
    });
  } catch { /* older engines: no atmosphere, still works */ }
});

const groupColor = ['match', ['get', 'group'], ...Object.entries(orb.GROUPS).flatMap(([k, g]) => [k, g.color]), '#ffffff'];
const hazardColor = ['match', ['get', 'kind'], ...Object.entries(feeds.HAZARD_KINDS).flatMap(([k, h]) => [k, h.color]), '#ffd166'];

function setupLayers() {
  const layers = map.getStyle().layers;
  const firstSymbol = layers.find((l) => l.type === 'symbol')?.id;
  const firstLabel = layers.find((l) => l.type === 'symbol' && l.id.startsWith('place'))?.id;
  for (const id of ['night', 'hazards', 'places', 'shows', 'track', 'footprint', 'sats', 'selected']) {
    map.addSource(id, { type: 'geojson', data: EMPTY });
  }

  // Basemaps and terrain sit under every label so place names stay readable.
  map.addSource('esri', {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Imagery © <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
  });
  map.addSource('gibs', {
    type: 'raster',
    tiles: [`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${TODAY_DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`],
    tileSize: 256,
    maxzoom: 9,
    attribution: `<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> VIIRS ${TODAY_DATE}`,
  });
  const dem = {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15,
    attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>',
  };
  map.addSource('dem', dem);
  map.addSource('dem-shade', dem); // separate source: MapLibre renders terrain and hillshade better apart

  map.addLayer({ id: 'imagery', type: 'raster', source: 'esri', layout: { visibility: 'none' } }, firstSymbol);
  map.addLayer({
    id: 'today', type: 'raster', source: 'gibs', layout: { visibility: 'none' },
    // NASA's daily mosaic tops out at zoom 9; fade into Esri's sharper imagery beyond that.
    paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9.5, 0] },
  }, firstSymbol);
  map.addLayer({
    id: 'hillshade', type: 'hillshade', source: 'dem-shade', layout: { visibility: 'none' },
    paint: {
      'hillshade-shadow-color': '#000000',
      'hillshade-highlight-color': 'rgba(255,255,255,0.18)',
      'hillshade-accent-color': '#0a0f1c',
      'hillshade-exaggeration': 0.6,
    },
  }, firstSymbol);

  map.addLayer({
    id: 'night', type: 'fill', source: 'night',
    paint: {
      'fill-color': '#01040d',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 6, 0.3, 10, 0.08, 13, 0],
      'fill-antialias': false,
    },
  }, firstLabel);

  map.addLayer({
    id: 'hazards', type: 'circle', source: 'hazards',
    paint: {
      'circle-color': hazardColor,
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        1, ['case', ['==', ['get', 'kind'], 'quake'], ['interpolate', ['linear'], ['get', 'mag'], 2.5, 2, 7, 9], 3.5],
        10, ['case', ['==', ['get', 'kind'], 'quake'], ['interpolate', ['linear'], ['get', 'mag'], 2.5, 6, 7, 22], 8]],
      'circle-opacity': 0.7,
      'circle-stroke-color': hazardColor,
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'places', type: 'circle', source: 'places', minzoom: CONFIG.localZoom - 1,
    paint: {
      'circle-color': '#3ddc97',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4, 15, 7],
      'circle-stroke-color': '#06120d',
      'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: 'places-labels', type: 'symbol', source: 'places', minzoom: 12.5,
    layout: {
      'text-field': ['get', 'title'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 0.9],
      'text-anchor': 'top',
      'text-max-width': 9,
      'text-optional': true,
    },
    paint: { 'text-color': '#bff5dd', 'text-halo-color': '#060a16', 'text-halo-width': 1.4 },
  });

  map.addLayer({
    id: 'shows', type: 'circle', source: 'shows', minzoom: CONFIG.localZoom - 1,
    paint: {
      'circle-color': '#b388ff',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 8],
      'circle-stroke-color': '#130826',
      'circle-stroke-width': 1.5,
    },
  });

  map.addLayer({
    id: 'footprint', type: 'fill', source: 'footprint',
    paint: { 'fill-color': '#ffd166', 'fill-opacity': 0.06 },
  });
  map.addLayer({
    id: 'footprint-edge', type: 'line', source: 'footprint',
    paint: { 'line-color': '#ffd166', 'line-opacity': 0.45, 'line-width': 1 },
  });
  map.addLayer({
    id: 'track', type: 'line', source: 'track',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': ['case', ['get', 'past'], '#ffffff', '#ffd166'],
      'line-opacity': ['case', ['get', 'past'], 0.25, 0.85],
      'line-width': 1.6,
    },
  });

  map.addLayer({
    id: 'sats', type: 'circle', source: 'sats',
    paint: {
      'circle-color': groupColor,
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        1, ['match', ['get', 'group'], 'stations', 4, 'starlink', 1.3, 2.4],
        8, ['match', ['get', 'group'], 'stations', 7, 'starlink', 3, 4.5]],
      'circle-stroke-color': '#000000',
      'circle-stroke-width': ['match', ['get', 'group'], 'starlink', 0, 0.8],
      'circle-stroke-opacity': 0.6,
    },
  });
  map.addLayer({
    id: 'sat-labels', type: 'symbol', source: 'sats',
    filter: ['!=', ['get', 'label'], ''],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-offset': [0.9, 0],
      'text-anchor': 'left',
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 },
  });
  map.addLayer({
    id: 'selected', type: 'circle', source: 'selected',
    paint: {
      'circle-radius': 11,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#ffd166',
      'circle-stroke-width': 2,
    },
  });

  wireLayerEvents();
}

// ---------- satellites ----------

function rebuildActive() {
  const byId = new Map();
  for (const g of Object.keys(orb.GROUPS)) {
    if (!state.enabled.has(g)) continue;
    for (const s of state.groups.get(g) || []) if (!byId.has(s.id)) byId.set(s.id, s);
  }
  state.byId = byId;
  state.active = [...byId.values()];
  $('#count').textContent = `${fmtNum(state.active.length)} satellites`;
}
async function ensureGroup(g) {
  if (state.groups.has(g)) return;
  const chip = document.querySelector(`.chip[data-group="${g}"]`);
  chip?.classList.add('loading');
  try {
    state.groups.set(g, await orb.loadGroup(g));
  } catch (err) {
    console.error(err);
    toast(`Couldn't load ${orb.GROUPS[g].label} satellites`);
    state.enabled.delete(g);
    chip?.setAttribute('aria-pressed', 'false');
  } finally {
    chip?.classList.remove('loading');
  }
}

function findSat(id) {
  if (state.byId.has(id)) return state.byId.get(id);
  for (const list of state.groups.values()) {
    const s = list.find((x) => x.id === id);
    if (s) return s;
  }
  return null;
}

function tick() {
  const now = simNow();
  const gmst = orb.gmstFor(now);
  const features = [];
  for (const s of state.active) {
    const p = orb.position(s.satrec, now, gmst);
    s.pos = p;
    if (!p) continue;
    features.push({
      type: 'Feature',
      properties: { id: s.id, group: s.group, label: s === state.selected ? s.name : (LABELS[s.id] || '') },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    });
  }
  map.getSource('sats')?.setData({ type: 'FeatureCollection', features });

  const sel = state.selected;
  if (sel) {
    if (!state.byId.has(sel.id)) sel.pos = orb.position(sel.satrec, now, gmst);
    if (sel.pos) {
      map.getSource('selected').setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [sel.pos.lon, sel.pos.lat] } });
      map.getSource('footprint').setData(orb.footprint(sel.pos));
      if (state.follow) map.easeTo({ center: [sel.pos.lon, sel.pos.lat], duration: state.playing ? 100 : 900, easing: (t) => t });
    }
    if (Math.abs(now - state.trackAt) > 60e3) {
      map.getSource('track').setData(orb.groundTrack(sel.satrec, now));
      state.trackAt = now.getTime();
    }
    renderSelectedStats(now, gmst);
  }

  if (Math.abs(now - state.nightAt) > 60e3) {
    map.getSource('night')?.setData(orb.nightPolygon(now));
    state.nightAt = now.getTime();
  }
  if (Date.now() - state.skyAt > (state.playing ? 500 : 5000)) renderSky();
  $('#clock').textContent = `${now.toISOString().slice(11, 19)} UTC`;
  state.tickCount++;
}

let loopTimer;
let lastLoop = performance.now();
function loop() {
  clearTimeout(loopTimer);
  const heavy = state.active.length > 3000;
  const interval = state.playing ? (heavy ? 300 : 100) : (heavy ? 2500 : 1000);
  const t = performance.now();
  if (state.playing) {
    // Advance by real elapsed time so slow frames don't slow the simulation.
    setTimeOffset(state.timeOffset + PLAY_SPEED * Math.min(t - lastLoop, 1000));
    if (state.timeOffset >= MAX_OFFSET) setPlaying(false);
  }
  lastLoop = t;
  if (!document.hidden) tick();
  loopTimer = setTimeout(loop, interval);
}

// ---------- time travel ----------

function setTimeOffset(ms) {
  state.timeOffset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, ms));
  const live = Math.abs(state.timeOffset) < 60e3;
  if (live && !state.playing) state.timeOffset = 0;
  $('#time').value = String(Math.round(state.timeOffset / 60e3));
  $('#live').hidden = live;
  document.body.classList.toggle('shifted', !live);
  const m = Math.round(Math.abs(state.timeOffset) / 60e3);
  const span = `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  $('#time-label').textContent = live ? 'Live now' : `${state.timeOffset > 0 ? '+' : '−'}${span} · ${fmtWhen.format(simNow())}`;
  $('#live-text').textContent = live ? 'LIVE' : state.timeOffset > 0 ? 'FUTURE' : 'PAST';
}

function setPlaying(on) {
  state.playing = on;
  if (on && state.timeOffset >= MAX_OFFSET - 60e3) setTimeOffset(0);
  const btn = $('#play');
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Pause' : 'Play time forward');
  btn.textContent = on ? '❚❚' : '▶';
  loop();
}

function select(s, { fly = false } = {}) {
  state.selected = s;
  state.follow = false;
  const url = new URL(location.href);
  if (s) url.searchParams.set('sat', s.id); else url.searchParams.delete('sat');
  history.replaceState(null, '', url);

  if (!s) {
    for (const id of ['selected', 'footprint', 'track']) map.getSource(id).setData(EMPTY);
    $('#sel').hidden = true;
    state.passes.key = null;
    renderSky();
    return;
  }
  const now = simNow();
  s.pos = orb.position(s.satrec, now);
  map.getSource('track').setData(orb.groundTrack(s.satrec, now));
  state.trackAt = now.getTime();
  renderSelectedShell();
  state.passes.key = null;
  tick();
  if (fly && s.pos) map.flyTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.min(Math.max(map.getZoom(), 2.2), 4), duration: 1600 });
  openPanel();
}

// ---------- observer ----------

function centerPoint() {
  const c = map.getCenter();
  return { lat: c.lat, lon: c.lng };
}

function observer() {
  const center = centerPoint();
  if (map.getZoom() >= CONFIG.localZoom) {
    if (state.user && feeds.distanceKm(center, state.user) < 25) return { ...state.user, label: 'you' };
    return { ...center, label: 'this spot' };
  }
  return state.user ? { ...state.user, label: 'you' } : null;
}

// ---------- panel: selected satellite ----------

function renderSelectedShell() {
  const s = state.selected;
  const info = orb.orbitInfo(s.satrec);
  const g = orb.GROUPS[s.group];
  $('#sel').hidden = false;
  $('#sel').innerHTML = `
    <div class="card-head">
      <div>
        <span class="pill" style="--c:${g.color}">${esc(g.label)}</span>
        <h2>${esc(s.name)}</h2>
      </div>
      <button class="icon-btn" id="sel-close" aria-label="Close">×</button>
    </div>
    <dl class="stats" id="sel-stats"></dl>
    <dl class="stats static">
      <div><dt>Orbit period</dt><dd>${fmtNum(info.period, 1)} min</dd></div>
      <div><dt>Inclination</dt><dd>${fmtNum(info.inclination, 1)}°</dd></div>
      <div><dt>NORAD ID</dt><dd>${esc(s.id)}</dd></div>
      <div><dt>Orbits / day</dt><dd>${fmtNum(1440 / info.period, 1)}</dd></div>
    </dl>
    <div class="row-actions">
      <button class="btn" id="sel-follow" aria-pressed="false">Follow</button>
      <button class="btn ghost" id="sel-fly">Fly to</button>
      <a class="btn ghost" href="https://www.n2yo.com/satellite/?s=${encodeURIComponent(s.id)}" target="_blank" rel="noopener">Details ↗</a>
    </div>`;
  $('#sel-close').onclick = () => select(null);
  $('#sel-fly').onclick = () => s.pos && map.flyTo({ center: [s.pos.lon, s.pos.lat], zoom: Math.max(2.5, Math.min(map.getZoom(), 5)) });
  $('#sel-follow').onclick = (e) => {
    state.follow = !state.follow;
    e.currentTarget.setAttribute('aria-pressed', String(state.follow));
    if (state.follow && map.getZoom() > 5) map.zoomTo(4);
  };
}

function renderSelectedStats(now, gmst) {
  const s = state.selected;
  const p = s?.pos;
  const el = $('#sel-stats');
  if (!el) return;
  if (!p) { el.innerHTML = '<div><dt>Status</dt><dd>No position (orbit data may be stale)</dd></div>'; return; }
  const sunlit = orb.isSunlit(p.eci, orb.sunEci(now));
  const obs = observer();
  let look = '';
  if (obs) {
    const la = orb.lookAngles(orb.observerGd(obs), p.eci, gmst);
    look = la.el > 0
      ? `<div class="wide"><dt>From ${esc(obs.label)}</dt><dd class="hot">${fmtNum(la.el)}° up, look ${orb.compass(la.az)} · ${fmtNum(la.range)} km away</dd></div>`
      : `<div class="wide"><dt>From ${esc(obs.label)}</dt><dd>Below the horizon</dd></div>`;
  }
  el.innerHTML = `
    <div><dt>Altitude</dt><dd>${fmtNum(p.alt)} km</dd></div>
    <div><dt>Speed</dt><dd>${fmtNum(p.speed * 3600)} km/h</dd></div>
    <div><dt>Over</dt><dd>${fmtCoord(p.lat, p.lon)}</dd></div>
    <div><dt>Lighting</dt><dd>${sunlit ? '☀ In sunlight' : '● In Earth’s shadow'}</dd></div>
    ${look}`;
}

// ---------- panel: sky over the observer ----------

function passTarget() {
  return state.selected || findSat(ISS_ID);
}

function renderSky() {
  state.skyAt = Date.now();
  const obs = observer();
  const box = $('#sky');
  if (!obs) {
    box.innerHTML = `
      <h3>What’s overhead?</h3>
      <p class="muted">Share your location or zoom into any place on Earth to see which satellites are above it right now, and when the ISS will fly over.</p>
      <button class="btn" data-action="locate">📍 Use my location</button>`;
    return;
  }

  const now = simNow();
  const gmst = orb.gmstFor(now);
  const gd = orb.observerGd(obs);
  const up = [];
  for (const s of state.active) {
    if (!s.pos) continue;
    const la = orb.lookAngles(gd, s.pos.eci, gmst);
    if (la.el > 10) up.push({ s, ...la });
  }
  up.sort((a, b) => b.el - a.el);

  ensureWeather(obs);
  const wx = state.weather.key === weatherKey(obs) ? state.weather.data : null;

  const target = passTarget();
  let passHtml = '';
  if (target) {
    const key = `${target.id}|${obs.lat.toFixed(2)}|${obs.lon.toFixed(2)}`;
    const p0 = state.passes;
    if (p0.key !== key || Date.now() - p0.at > 60e3 || Math.abs(now - p0.from) > 10 * 60e3) {
      state.passes = { key, at: Date.now(), from: now.getTime(), list: orb.predictPasses(target.satrec, obs, now, { max: 6 }) };
    }
    const items = state.passes.list.filter((p) => p.open || p.end > now).slice(0, 5).map((p) => {
      if (p.open) return `<li class="pass"><div class="pass-when"><b>Always up</b></div><div class="muted">Stays above ${esc(obs.label)}’s horizon, peaking ${fmtNum(p.maxEl)}° ${orb.compass(p.maxAz)}</div></li>`;
      const mins = Math.max(1, Math.round((p.end - p.start) / 60000));
      const ongoing = p.start <= now;
      return `<li class="pass">
        <div class="pass-when"><b>${ongoing ? 'Overhead now' : fmtWhen.format(p.start)}</b><span>${ongoing ? `until ${fmtWhen.format(p.end)}` : until(p.start, now)}</span></div>
        <div class="muted">Peaks ${fmtNum(p.maxEl)}° · ${orb.compass(p.startAz)} → ${orb.compass(p.endAz)} · ${mins} min</div>
        ${p.visible ? visibilityBadge(wx && feeds.weatherAt(wx, p.maxAt)) : ''}
      </li>`;
    }).join('');
    passHtml = `
      <h3>Next ${esc(target.id === ISS_ID ? 'ISS' : target.name)} passes over ${esc(obs.label)}</h3>
      ${items ? `<ul class="passes">${items}</ul>` : '<p class="muted">No passes higher than 10° in the next 48 hours.</p>'}`;
  }

  box.innerHTML = `
    ${weatherHtml(wx, obs, now)}
    <h3>Above ${esc(obs.label)} ${state.timeOffset ? 'at this time' : 'right now'}</h3>
    <p class="big-stat"><b>${up.length}</b> satellite${up.length === 1 ? '' : 's'} more than 10° above the horizon</p>
    <ul class="sky-list">
      ${up.slice(0, 6).map((u) => `
        <li><button class="row" data-sat="${esc(u.s.id)}">
          <span class="dot" style="--c:${orb.GROUPS[u.s.group].color}"></span>
          <span class="name">${esc(u.s.name)}</span>
          <span class="muted">${fmtNum(u.el)}° ${orb.compass(u.az)}</span>
        </button></li>`).join('')}
    </ul>
    ${passHtml}`;
}

// ---------- weather ----------

const weatherKey = (obs) => `${obs.lat.toFixed(1)},${obs.lon.toFixed(1)}`;

async function ensureWeather(obs) {
  const key = weatherKey(obs);
  const w = state.weather;
  if ((w.key === key && Date.now() - w.at < 15 * 60e3) || w.pending === key) return;
  w.pending = key;
  try {
    const data = await feeds.fetchWeather(obs, IMPERIAL);
    state.weather = { key, at: Date.now(), data, pending: null };
    renderSky();
  } catch (err) {
    console.error(err);
    w.at = Date.now(); // back off for the cache window instead of retrying every render
    w.key = key;
    w.pending = null;
  }
}

function weatherHtml(wx, obs, now) {
  if (!wx) return '';
  // Live: current conditions. Time-shifted: the hourly forecast for that moment.
  const cur = state.timeOffset ? feeds.weatherAt(wx, now) : wx.current;
  if (!cur) return '';
  const { label, icon } = feeds.describeWeather(cur.code, cur.isDay);
  const sunAlt = orb.sunAltitude(obs, now);
  let verdict;
  if (sunAlt > -6) verdict = ['', sunAlt > 0 ? 'Daylight: satellites show up after dusk' : 'Twilight: the first satellites appear soon'];
  else if (cur.clouds < 30) verdict = ['good', 'Dark, clear skies: great for spotting satellites'];
  else if (cur.clouds < 75) verdict = ['ok', 'Dark, but patchy clouds'];
  else verdict = ['bad', 'Clouded over: satellites hidden'];
  return `
    <div class="wx">
      <span class="wx-icon" aria-hidden="true">${icon}</span>
      <div class="wx-main">
        <b>${fmtNum(cur.temp)}${wx.units.temp} · ${esc(label)}</b>
        <span class="muted">${fmtNum(cur.clouds)}% cloud${cur.wind != null ? ` · wind ${fmtNum(cur.wind)} ${wx.units.wind}` : ''}</span>
      </div>
    </div>
    <p class="wx-verdict ${verdict[0]}">${esc(verdict[1])}</p>`;
}

function visibilityBadge(w) {
  if (!w) return '<span class="badge">👁 Visible to the eye</span>';
  if (w.clouds < 35) return `<span class="badge">👁 Visible · clear skies (${fmtNum(w.clouds)}% cloud)</span>`;
  if (w.clouds < 75) return `<span class="badge ok">👁 Visible · partly cloudy (${fmtNum(w.clouds)}%)</span>`;
  return `<span class="badge bad">☁ Visible, but likely clouded out (${fmtNum(w.clouds)}%)</span>`;
}

// ---------- panel: local discovery ----------

function renderLocal() {
  const box = $('#local');
  const local = map.getZoom() >= CONFIG.localZoom;
  $('.panel-body').classList.toggle('local', local);
  if (!local) {
    const counts = {};
    for (const h of state.hazards) counts[h.kind] = (counts[h.kind] || 0) + 1;
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
      `<li><span class="dot" style="--c:${feeds.HAZARD_KINDS[k].color}"></span>${fmtNum(n)} ${esc(n === 1 ? feeds.HAZARD_KINDS[k].label : feeds.HAZARD_KINDS[k].plural)}</li>`).join('');
    box.innerHTML = `
      <h3>Live on Earth</h3>
      ${rows ? `<ul class="legend">${rows}</ul><p class="muted small">Earthquakes M2.5+ this week (USGS) and active natural events (NASA EONET).</p>` : '<p class="muted">Loading live events…</p>'}
      <div class="hint">🔍 <span>Zoom in anywhere to discover landmarks, history and events nearby.</span></div>`;
    return;
  }

  const center = centerPoint();
  // state.places is already ranked by notability
  const places = state.places.slice(0, 12).map((p) => ({ ...p, d: feeds.distanceKm(center, p) }));
  const hazards = state.hazards
    .map((h) => ({ ...h, d: feeds.distanceKm(center, h) }))
    .filter((h) => h.d < 500)
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  const shows = state.shows.slice(0, 8);

  const placeHtml = places.map((p) => `
    <li><button class="place" data-place="${esc(p.title)}">
      ${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
      <span class="txt"><b>${esc(p.title)}</b><span class="muted">${esc(p.desc || 'Landmark')} · ${fmtDist(p.d)}</span></span>
    </button></li>`).join('');

  const showHtml = shows.map((e) => `
    <li><a class="place" href="${esc(e.url)}" target="_blank" rel="noopener">
      ${e.thumb ? `<img src="${esc(e.thumb)}" alt="" loading="lazy">` : '<span class="ph">♪</span>'}
      <span class="txt"><b>${esc(e.title)}</b><span class="muted">${esc(e.venue)}${e.when ? ` · ${esc(fmtDate.format(new Date(e.when)))}` : ''}</span></span>
    </a></li>`).join('');

  const hazardHtml = hazards.map((h) => `
    <li><button class="row" data-hazard="${esc(h.lon)},${esc(h.lat)}">
      <span class="dot" style="--c:${feeds.HAZARD_KINDS[h.kind].color}"></span>
      <span class="name">${esc(h.title)}</span>
      <span class="muted">${fmtDist(h.d)}</span>
    </button></li>`).join('');

  box.innerHTML = `
    <h3>Around here</h3>
    ${state.places.length ? `<ul class="places">${placeHtml}</ul>` : '<p class="muted">Looking for landmarks…</p>'}
    ${feeds.showsEnabled() ? `<h3>Upcoming events</h3>${showHtml ? `<ul class="places">${showHtml}</ul>` : '<p class="muted">No listed events nearby.</p>'}` : ''}
    <h3>Natural events within 500 km</h3>
    ${hazardHtml ? `<ul class="sky-list">${hazardHtml}</ul>` : '<p class="muted">Nothing reported nearby. Quiet is good.</p>'}`;
}

let localTimer;
function scheduleLocal() {
  clearTimeout(localTimer);
  renderLocal();
  if (map.getZoom() < CONFIG.localZoom) return;
  localTimer = setTimeout(loadLocal, 450);
}

async function loadLocal() {
  const center = centerPoint();
  const b = map.getBounds();
  const radiusKm = feeds.distanceKm(center, { lat: b.getNorth(), lon: b.getEast() });
  const last = state.localKey;
  if (last && feeds.distanceKm(last.center, center) < last.radiusKm * 0.3 && Math.abs(radiusKm / last.radiusKm - 1) < 0.4) return;
  state.localKey = { center, radiusKm };
  const seq = ++state.localSeq;

  const [places, shows] = await Promise.allSettled([
    feeds.fetchPlaces({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }),
    feeds.fetchShows(center),
  ]);
  if (seq !== state.localSeq) return; // a newer request superseded this one

  if (places.status === 'fulfilled') state.places = places.value;
  else { console.error(places.reason); state.localKey = null; }
  if (shows.status === 'fulfilled') state.shows = shows.value;
  else console.error(shows.reason);

  map.getSource('places').setData({
    type: 'FeatureCollection',
    features: state.places.map((p) => ({ type: 'Feature', properties: { title: p.title }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
  });
  map.getSource('shows').setData({
    type: 'FeatureCollection',
    features: state.shows.map((e, i) => ({ type: 'Feature', properties: { i }, geometry: { type: 'Point', coordinates: [e.lon, e.lat] } })),
  });
  renderLocal();
}

async function loadHazards() {
  const results = await Promise.allSettled([feeds.fetchQuakes(), feeds.fetchNaturalEvents()]);
  state.hazards = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  results.filter((r) => r.status === 'rejected').forEach((r) => console.error(r.reason));
  map.getSource('hazards').setData({
    type: 'FeatureCollection',
    features: state.hazards.map((h, i) => ({ type: 'Feature', properties: { i, kind: h.kind, mag: typeof h.mag === 'number' ? h.mag : 0 }, geometry: { type: 'Point', coordinates: [h.lon, h.lat] } })),
  });
  renderLocal();
}

// ---------- popups ----------

const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 10 });
const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'hover-pop' });

function hazardPopup(h) {
  const k = feeds.HAZARD_KINDS[h.kind];
  popup.setLngLat([h.lon, h.lat]).setHTML(`
    <div class="pop">
      <span class="pill" style="--c:${k.color}">${esc(k.label)}</span>
      <b>${esc(h.title)}</b>
      <span class="muted">${h.kind === 'quake' ? `Magnitude ${esc(h.mag)} · ` : h.mag ? `${esc(h.mag)} · ` : ''}${ago(h.time)}</span>
      ${h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">Source ↗</a>` : ''}
    </div>`).addTo(map);
}

let popupPlace = null;
async function placePopup(p) {
  popupPlace = p.title;
  popup.setLngLat([p.lon, p.lat]).setHTML(`
    <div class="pop">
      ${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : ''}
      <b>${esc(p.title)}</b>
      ${p.desc ? `<span class="muted">${esc(p.desc)}</span>` : ''}
      <p class="extract">Loading…</p>
    </div>`).addTo(map);
  try {
    const sum = await feeds.fetchPlaceSummary(p.title);
    if (popupPlace !== p.title) return;
    const el = popup.getElement()?.querySelector('.extract');
    if (el) el.outerHTML = `<p class="extract">${esc(sum.extract)}</p>${sum.url ? `<a href="${esc(sum.url)}" target="_blank" rel="noopener">Read on Wikipedia ↗</a>` : ''}`;
  } catch {
    popup.getElement()?.querySelector('.extract')?.remove();
  }
}

function showPopup(e) {
  popup.setLngLat([e.lon, e.lat]).setHTML(`
    <div class="pop">
      ${e.thumb ? `<img src="${esc(e.thumb)}" alt="">` : ''}
      ${e.genre ? `<span class="pill" style="--c:#b388ff">${esc(e.genre)}</span>` : ''}
      <b>${esc(e.title)}</b>
      <span class="muted">${esc(e.venue)}${e.when ? ` · ${esc(fmtDate.format(new Date(e.when)))}` : ''}</span>
      <a href="${esc(e.url)}" target="_blank" rel="noopener">Tickets ↗</a>
    </div>`).addTo(map);
}

function wireLayerEvents() {
  for (const id of ['sats', 'hazards', 'places', 'shows']) {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; hover.remove(); });
  }
  map.on('mousemove', 'sats', (e) => {
    const s = state.byId.get(e.features[0].properties.id);
    if (s) hover.setLngLat(e.lngLat).setHTML(`<b>${esc(s.name)}</b>`).addTo(map);
  });
  map.on('click', 'sats', (e) => {
    const s = state.byId.get(e.features[0].properties.id);
    if (s) select(s);
  });
  map.on('click', 'hazards', (e) => hazardPopup(state.hazards[e.features[0].properties.i]));
  map.on('click', 'places', (e) => {
    const p = state.places.find((x) => x.title === e.features[0].properties.title);
    if (p) placePopup(p);
  });
  map.on('click', 'shows', (e) => showPopup(state.shows[e.features[0].properties.i]));
  map.on('dragstart', () => {
    if (!state.follow) return;
    state.follow = false;
    $('#sel-follow')?.setAttribute('aria-pressed', 'false');
  });
}

// ---------- controls ----------

function buildChips() {
  const wrap = $('#chips');
  const satChips = Object.entries(orb.GROUPS).map(([k, g]) =>
    `<button class="chip" data-group="${k}" aria-pressed="${state.enabled.has(k)}" style="--c:${g.color}"><span class="dot"></span>${esc(g.label)}</button>`).join('');
  wrap.innerHTML = `${satChips}<button class="chip" data-hazards aria-pressed="true" style="--c:#ff8a3d"><span class="dot"></span>Earth events</button>`;

  wrap.addEventListener('click', async (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.hasAttribute('data-hazards')) {
      state.showHazards = !state.showHazards;
      chip.setAttribute('aria-pressed', String(state.showHazards));
      map.setLayoutProperty('hazards', 'visibility', state.showHazards ? 'visible' : 'none');
      return;
    }
    const g = chip.dataset.group;
    const on = !state.enabled.has(g);
    chip.setAttribute('aria-pressed', String(on));
    if (on) {
      state.enabled.add(g);
      await ensureGroup(g);
    } else {
      state.enabled.delete(g);
    }
    rebuildActive();
    tick();
  });
}

const userEl = document.createElement('div');
userEl.className = 'user-dot';
const userMarker = new maplibregl.Marker({ element: userEl });

function locate() {
  if (!navigator.geolocation) return toast('Location isn’t available in this browser');
  const btn = $('#locate');
  btn.classList.add('loading');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.classList.remove('loading');
      state.user = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      userMarker.setLngLat([state.user.lon, state.user.lat]).addTo(map);
      map.flyTo({ center: [state.user.lon, state.user.lat], zoom: 11.5, duration: 3500, essential: true });
      state.passes.key = null;
      renderSky();
    },
    () => {
      btn.classList.remove('loading');
      toast('Couldn’t get your location. Try searching for a place instead.');
    },
    { timeout: 10000, maximumAge: 600000 },
  );
}

function setBasemap(name) {
  state.basemap = BASEMAPS.includes(name) ? name : 'map';
  // "Today" layers NASA's daily mosaic over Esri, which takes over when zoomed in.
  map.setLayoutProperty('imagery', 'visibility', state.basemap === 'map' ? 'none' : 'visible');
  map.setLayoutProperty('today', 'visibility', state.basemap === 'today' ? 'visible' : 'none');
  map.setLayoutProperty('hillshade', 'visibility', state.terrain && state.basemap === 'map' ? 'visible' : 'none');
  for (const b of document.querySelectorAll('[data-base]')) b.setAttribute('aria-pressed', String(b.dataset.base === state.basemap));
  store.set('basemap', state.basemap);
}

function setTerrain(on, { animate = true } = {}) {
  state.terrain = on;
  map.setTerrain(on ? { source: 'dem', exaggeration: 1.5 } : null);
  map.setLayoutProperty('hillshade', 'visibility', on && state.basemap === 'map' ? 'visible' : 'none');
  $('#terrain').setAttribute('aria-pressed', String(on));
  store.set('terrain', on ? '1' : '0');
  if (!animate) return;
  if (on && map.getZoom() < 8) toast('3D terrain on. Zoom into some mountains, or search “Yosemite”.');
  else if (on && map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 1200 });
  else if (!on && map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 800 });
}

function openPanel() {
  $('#panel').classList.remove('collapsed');
}

function wireControls() {
  $('#locate').onclick = locate;
  $('#iss').onclick = () => {
    const iss = findSat(ISS_ID);
    if (!iss) return toast('ISS data is still loading');
    select(iss, { fly: true });
    state.follow = true;
    $('#sel-follow')?.setAttribute('aria-pressed', 'true');
  };

  $('#search').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#q').value.trim();
    if (!q) return;
    try {
      const hit = await feeds.geocode(q);
      if (!hit) return toast(`No results for “${q}”`);
      $('#q').blur();
      map.fitBounds(hit.bounds, { maxZoom: 13.5, padding: 60, duration: 3000 });
    } catch {
      toast('Search is unavailable right now');
    }
  });

  $('#panel-toggle').onclick = () => $('#panel').classList.toggle('collapsed');

  for (const b of document.querySelectorAll('[data-base]')) b.onclick = () => setBasemap(b.dataset.base);
  $('[data-base="today"]').title = `NASA VIIRS true-color mosaic of the whole Earth, ${TODAY_DATE}`;
  $('#terrain').onclick = () => setTerrain(!state.terrain);

  $('#play').onclick = () => setPlaying(!state.playing);
  $('#time').addEventListener('input', (e) => {
    if (state.playing) setPlaying(false);
    setTimeOffset(Number(e.target.value) * 60e3);
    tick();
  });
  $('#live').onclick = () => {
    setPlaying(false);
    setTimeOffset(0);
    tick();
  };
  setBasemap(store.get('basemap'));
  if (store.get('terrain') === '1') setTerrain(true, { animate: false });

  // Delegated clicks inside the side panel
  $('#panel').addEventListener('click', (e) => {
    const t = e.target.closest('[data-sat],[data-place],[data-hazard],[data-action]');
    if (!t) return;
    if (t.dataset.sat) select(findSat(t.dataset.sat));
    else if (t.dataset.action === 'locate') locate();
    else if (t.dataset.place) {
      const p = state.places.find((x) => x.title === t.dataset.place);
      if (p) {
        map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 14) });
        placePopup(p);
      }
    } else if (t.dataset.hazard) {
      const [lon, lat] = t.dataset.hazard.split(',').map(Number);
      const h = state.hazards.find((x) => x.lon === lon && x.lat === lat);
      map.flyTo({ center: [lon, lat], zoom: Math.min(map.getZoom(), 8) });
      if (h) hazardPopup(h);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selected && document.activeElement?.id !== 'q') select(null);
  });

  map.on('moveend', () => {
    scheduleLocal();
    if (state.tickCount > 0) renderSky();
  });
}

// ---------- boot ----------

map.on('load', async () => {
  setupLayers();
  buildChips();
  wireControls();
  map.getSource('night').setData(orb.nightPolygon(simNow()));
  loadHazards();
  renderLocal();
  scheduleLocal();

  await Promise.all([...state.enabled].map(ensureGroup));
  rebuildActive();
  document.body.classList.add('ready');

  const want = new URL(location.href).searchParams.get('sat');
  const s = want && findSat(want);
  loop();
  if (s) select(s, { fly: !location.hash });
});
