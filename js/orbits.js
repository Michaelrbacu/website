// Orbital math: TLE loading, SGP4 propagation, pass prediction, sun geometry.
// Uses satellite.js (global `satellite`) loaded from index.html.
const sgp = window.satellite;

export const RE = 6371; // mean Earth radius, km
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const AU = 149597870.7;
const CACHE_MS = 2 * 60 * 60 * 1000; // CelesTrak updates GP data roughly every 2h

export const GROUPS = {
  stations: { label: 'Space stations', color: '#ffffff', on: true },
  visual: { label: 'Brightest', color: '#ffd166', on: true },
  'gps-ops': { label: 'GPS', color: '#4dd0e1', on: false },
  weather: { label: 'Weather', color: '#81c784', on: false },
  science: { label: 'Science', color: '#f48fb1', on: false },
  starlink: { label: 'Starlink', color: '#8fa3b8', on: false },
};

export const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

// ---------- loading ----------

async function fetchTleText(group) {
  const key = `tle:${group}`;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(key)); } catch {}
  if (cached && Date.now() - cached.t < CACHE_MS) return cached.text;

  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`);
    if (!res.ok) throw new Error(`CelesTrak ${res.status}`);
    const text = await res.text();
    if (!text.includes('\n1 ')) throw new Error('CelesTrak returned no TLE data');
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), text })); } catch {}
    return text;
  } catch (err) {
    // Stale cache beats a bundled snapshot; the snapshot beats nothing.
    if (cached) return cached.text;
    const res = await fetch(`data/tle/${group}.txt`);
    if (!res.ok) throw err;
    return res.text();
  }
}

function parseTle(text, group) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; ) {
    const l1 = lines[i + 1], l2 = lines[i + 2];
    if (l1?.startsWith('1 ') && l2?.startsWith('2 ')) {
      const satrec = sgp.twoline2satrec(l1, l2);
      if (!satrec.error) {
        out.push({ id: l1.slice(2, 7).trim(), name: lines[i].trim(), group, satrec });
      }
      i += 3;
    } else {
      i += 1;
    }
  }
  return out;
}

export async function loadGroup(group) {
  return parseTle(await fetchTleText(group), group);
}

// ---------- propagation ----------

export function observerGd({ lat, lon }) {
  return { latitude: lat * RAD, longitude: lon * RAD, height: 0 };
}

export function position(satrec, date, gmst = sgp.gstime(date)) {
  const pv = sgp.propagate(satrec, date);
  const p = pv.position;
  if (!p || Number.isNaN(p.x)) return null;
  const gd = sgp.eciToGeodetic(p, gmst);
  const v = pv.velocity;
  return {
    lat: gd.latitude * DEG,
    lon: wrapLon(gd.longitude * DEG),
    alt: gd.height,
    speed: Math.hypot(v.x, v.y, v.z), // km/s
    eci: p,
  };
}

export function lookAngles(gd, eci, gmst) {
  const la = sgp.ecfToLookAngles(gd, sgp.eciToEcf(eci, gmst));
  return { az: (la.azimuth * DEG + 360) % 360, el: la.elevation * DEG, range: la.rangeSat };
}

export function orbitInfo(satrec) {
  return {
    period: (2 * Math.PI) / satrec.no, // satrec.no is rad/min
    inclination: satrec.inclo * DEG,
  };
}

// ---------- sun ----------

// Low-precision solar position (Astronomical Almanac), good to ~0.01°.
export function sunEci(date) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) * RAD;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const lambda = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const r = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AU;
  return {
    x: r * Math.cos(lambda),
    y: r * Math.cos(eps) * Math.sin(lambda),
    z: r * Math.sin(eps) * Math.sin(lambda),
  };
}

export function isSunlit(eci, sun) {
  const r = Math.hypot(sun.x, sun.y, sun.z);
  const ux = sun.x / r, uy = sun.y / r, uz = sun.z / r;
  const dot = eci.x * ux + eci.y * uy + eci.z * uz;
  if (dot > 0) return true;
  // Cylindrical Earth-shadow model
  return Math.hypot(eci.x - dot * ux, eci.y - dot * uy, eci.z - dot * uz) > RE;
}

function sunElevation(gd, sun, gmst) {
  return sgp.ecfToLookAngles(gd, sgp.eciToEcf(sun, gmst)).elevation * DEG;
}

export function sunAltitude(obs, date) {
  return sunElevation(observerGd(obs), sunEci(date), sgp.gstime(date));
}

export function subsolarPoint(date) {
  const s = sunEci(date);
  const dec = Math.asin(s.z / Math.hypot(s.x, s.y, s.z));
  const ra = Math.atan2(s.y, s.x);
  return { lat: dec * DEG, lon: wrapLon((ra - sgp.gstime(date)) * DEG) };
}

export function nightPolygon(date) {
  const sun = subsolarPoint(date);
  // Near the equinox tan(dec) → 0; nudge it so the terminator stays finite.
  const dec = Math.abs(sun.lat) < 0.05 ? (sun.lat < 0 ? -0.05 : 0.05) : sun.lat;
  const t = Math.tan(dec * RAD);
  const ring = [];
  for (let x = -180; x <= 180; x += 2) {
    ring.push([x, Math.atan(-Math.cos((x - sun.lon) * RAD) / t) * DEG]);
  }
  const pole = dec > 0 ? -90 : 90;
  ring.push([180, pole], [-180, pole], ring[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

// ---------- geometry for the map ----------

function destination(lat, lon, ang, bearing) {
  const φ1 = lat * RAD, λ1 = lon * RAD;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(ang) + Math.cos(φ1) * Math.sin(ang) * Math.cos(bearing));
  const λ2 = λ1 + Math.atan2(
    Math.sin(bearing) * Math.sin(ang) * Math.cos(φ1),
    Math.cos(ang) - Math.sin(φ1) * Math.sin(φ2),
  );
  return [λ2 * DEG, φ2 * DEG];
}

// Area of the Earth from which the satellite is above the horizon.
export function footprint(p) {
  const ang = Math.acos(RE / (RE + p.alt));
  const ring = [];
  let prevLon = null;
  for (let b = 0; b <= 360; b += 4) {
    let [lon, lat] = destination(p.lat, p.lon, ang, b * RAD);
    // Keep longitudes continuous; MapLibre wraps coordinates outside ±180.
    if (prevLon !== null) lon += Math.round((prevLon - lon) / 360) * 360;
    ring.push([lon, lat]);
    prevLon = lon;
  }
  const span = ring.at(-1)[0] - ring[0][0];
  if (Math.abs(span) > 180) {
    // Footprint contains a pole: close the ring over it.
    const pole = p.lat > 0 ? 90 : -90;
    ring.push([ring.at(-1)[0], pole], [ring[0][0], pole], ring[0]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function groundTrack(satrec, date, { before = 45, after = 95, step = 30 } = {}) {
  const line = (fromSec, toSec) => {
    const coords = [];
    let prevLon = null;
    for (let s = fromSec; s <= toSec; s += step) {
      const p = position(satrec, new Date(date.getTime() + s * 1000));
      if (!p) continue;
      let lon = p.lon;
      if (prevLon !== null) lon += Math.round((prevLon - lon) / 360) * 360;
      coords.push([lon, p.lat]);
      prevLon = lon;
    }
    return coords;
  };
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { past: true }, geometry: { type: 'LineString', coordinates: line(-before * 60, 0) } },
      { type: 'Feature', properties: { past: false }, geometry: { type: 'LineString', coordinates: line(0, after * 60) } },
    ].filter((f) => f.geometry.coordinates.length > 1),
  };
}

// ---------- passes ----------

export function predictPasses(satrec, obs, from = new Date(), { hours = 48, minEl = 10, max = 5, step = 30 } = {}) {
  const gd = observerGd(obs);
  const t0 = from.getTime();
  const end = t0 + hours * 3600e3;
  const passes = [];
  let cur = null;

  for (let t = t0; t <= end && passes.length < max; t += step * 1000) {
    const d = new Date(t);
    const pv = sgp.propagate(satrec, d);
    if (!pv.position || Number.isNaN(pv.position.x)) continue;
    const gmst = sgp.gstime(d);
    const { az, el } = lookAngles(gd, pv.position, gmst);

    if (el > 0) {
      if (!cur) cur = { start: d, startAz: az, maxEl: el, maxAt: d, maxAz: az, visible: false, ongoing: t === t0 };
      if (el > cur.maxEl) Object.assign(cur, { maxEl: el, maxAt: d, maxAz: az });
      if (!cur.visible) {
        const sun = sunEci(d);
        cur.visible = isSunlit(pv.position, sun) && sunElevation(gd, sun, gmst) < -6;
      }
      cur.end = d;
      cur.endAz = az;
    } else if (cur) {
      if (cur.maxEl >= minEl) passes.push(cur);
      cur = null;
    }
  }
  // Still above the horizon when the window ends (e.g. geostationary).
  if (cur && cur.maxEl >= minEl && passes.length < max) passes.push({ ...cur, open: true });
  return passes;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (az) => COMPASS[Math.round(az / 22.5) % 16];

export function gmstFor(date) {
  return sgp.gstime(date);
}
