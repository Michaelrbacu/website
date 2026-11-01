// External data feeds. Every source here is free, keyless (except the optional
// Ticketmaster layer) and CORS-enabled, so the site stays fully static.
import { CONFIG } from './config.js';

const RAD = Math.PI / 180;

export function distanceKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

// ---------- hazards: earthquakes + NASA EONET natural events ----------

export const HAZARD_KINDS = {
  quake: { label: 'Earthquake', plural: 'Earthquakes', color: '#ff8a3d' },
  wildfires: { label: 'Wildfire', plural: 'Wildfires', color: '#ff4d4d' },
  severeStorms: { label: 'Severe storm', plural: 'Severe storms', color: '#7aa2ff' },
  volcanoes: { label: 'Volcano', plural: 'Volcanoes', color: '#ff2fa0' },
  seaLakeIce: { label: 'Sea & lake ice', plural: 'Icebergs & sea ice', color: '#9ff3ff' },
  floods: { label: 'Flood', plural: 'Floods', color: '#4f8cff' },
  other: { label: 'Natural event', plural: 'Other natural events', color: '#ffd166' },
};

export async function fetchQuakes() {
  const data = await getJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
  return data.features.map((f) => ({
    kind: 'quake',
    title: f.properties.title,
    mag: f.properties.mag,
    time: f.properties.time,
    url: f.properties.url,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

function eonetPoint(geom) {
  if (geom.type === 'Point') return geom.coordinates;
  // Polygon: average the outer ring.
  const ring = geom.coordinates[0];
  const sum = ring.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

export async function fetchNaturalEvents() {
  const data = await getJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60');
  return data.events
    .filter((e) => e.geometry?.length)
    .map((e) => {
      const g = e.geometry.at(-1);
      const [lon, lat] = eonetPoint(g);
      const cat = e.categories[0]?.id;
      return {
        kind: HAZARD_KINDS[cat] ? cat : 'other',
        title: e.title,
        mag: g.magnitudeValue ? `${g.magnitudeValue.toLocaleString()} ${g.magnitudeUnit}` : null,
        time: Date.parse(g.date),
        url: e.sources[0]?.url || e.link,
        lon,
        lat,
      };
    });
}

// ---------- places: Wikipedia geosearch ----------

async function fetchPlaceCell(cell, keep) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${cell.lat}|${cell.lon}`,
    ggsradius: String(Math.round(Math.min(10000, Math.max(10, cell.radiusM)))),
    ggslimit: '50',
    prop: 'coordinates|pageimages|description|info',
    colimit: 'max',
    piprop: 'thumbnail',
    pithumbsize: '240',
    pilimit: 'max',
    format: 'json',
    origin: '*',
  });
  const data = await getJson(`https://en.wikipedia.org/w/api.php?${params}`);
  return Object.values(data.query?.pages || {})
    .filter((p) => p.coordinates?.length)
    .map((p) => ({
      title: p.title,
      desc: p.description || '',
      thumb: p.thumbnail?.source || null,
      lat: p.coordinates[0].lat,
      lon: p.coordinates[0].lon,
      // Article length is a cheap proxy for how notable a place is.
      score: (p.length || 0) * (p.thumbnail ? 1.5 : 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, keep);
}

// Geosearch always returns the pages nearest its center, which clusters
// results in dense cities. Query a grid of cells to spread them over the view.
export async function fetchPlaces({ west, south, east, north }, { grid = 3, perCell = 6 } = {}) {
  const cells = [];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const s = south + ((north - south) * i) / grid, n = south + ((north - south) * (i + 1)) / grid;
      const w = west + ((east - west) * j) / grid, e = west + ((east - west) * (j + 1)) / grid;
      cells.push({ lat: (s + n) / 2, lon: (w + e) / 2, radiusM: distanceKm({ lat: s, lon: w }, { lat: n, lon: e }) * 500 });
    }
  }
  const results = await Promise.allSettled(cells.map((c) => fetchPlaceCell(c, perCell)));
  const ok = results.filter((r) => r.status === 'fulfilled');
  if (!ok.length) throw results[0].reason;
  const byTitle = new Map();
  for (const r of ok) for (const p of r.value) byTitle.set(p.title, p);
  return [...byTitle.values()].sort((a, b) => b.score - a.score);
}

export async function fetchPlaceSummary(title) {
  const data = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  return { extract: data.extract || '', url: data.content_urls?.desktop?.page };
}

// ---------- shows: Ticketmaster (optional, needs a free key) ----------

export const showsEnabled = () => Boolean(CONFIG.ticketmasterKey);

export async function fetchShows(center, radiusKm = 40) {
  if (!showsEnabled()) return [];
  const params = new URLSearchParams({
    apikey: CONFIG.ticketmasterKey,
    latlong: `${center.lat},${center.lon}`,
    radius: String(Math.round(radiusKm)),
    unit: 'km',
    size: '50',
    sort: 'date,asc',
  });
  const data = await getJson(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  return (data._embedded?.events || [])
    .map((e) => {
      const venue = e._embedded?.venues?.[0];
      const loc = venue?.location;
      if (!loc) return null;
      const img = (e.images || []).filter((i) => i.width >= 200).sort((a, b) => a.width - b.width)[0];
      return {
        title: e.name,
        venue: venue.name,
        when: e.dates?.start?.dateTime || e.dates?.start?.localDate,
        genre: e.classifications?.[0]?.segment?.name || '',
        url: e.url,
        thumb: img?.url || null,
        lat: Number(loc.latitude),
        lon: Number(loc.longitude),
      };
    })
    .filter(Boolean);
}

// ---------- weather: Open-Meteo ----------

// WMO weather interpretation codes → [label, day icon, night icon]
const WMO = {
  0: ['Clear', '☀️', '🌙'], 1: ['Mainly clear', '🌤️', '🌙'], 2: ['Partly cloudy', '⛅', '☁️'], 3: ['Overcast', '☁️', '☁️'],
  45: ['Fog', '🌫️', '🌫️'], 48: ['Freezing fog', '🌫️', '🌫️'],
  51: ['Light drizzle', '🌦️', '🌧️'], 53: ['Drizzle', '🌦️', '🌧️'], 55: ['Heavy drizzle', '🌧️', '🌧️'],
  56: ['Freezing drizzle', '🌧️', '🌧️'], 57: ['Freezing drizzle', '🌧️', '🌧️'],
  61: ['Light rain', '🌦️', '🌧️'], 63: ['Rain', '🌧️', '🌧️'], 65: ['Heavy rain', '🌧️', '🌧️'],
  66: ['Freezing rain', '🌧️', '🌧️'], 67: ['Freezing rain', '🌧️', '🌧️'],
  71: ['Light snow', '🌨️', '🌨️'], 73: ['Snow', '🌨️', '🌨️'], 75: ['Heavy snow', '❄️', '❄️'], 77: ['Snow grains', '🌨️', '🌨️'],
  80: ['Showers', '🌦️', '🌧️'], 81: ['Showers', '🌧️', '🌧️'], 82: ['Violent showers', '⛈️', '⛈️'],
  85: ['Snow showers', '🌨️', '🌨️'], 86: ['Snow showers', '🌨️', '🌨️'],
  95: ['Thunderstorm', '⛈️', '⛈️'], 96: ['Thunderstorm, hail', '⛈️', '⛈️'], 99: ['Thunderstorm, hail', '⛈️', '⛈️'],
};

export function describeWeather(code, isDay) {
  const [label, day, night] = WMO[code] || ['Unknown', '🌡️', '🌡️'];
  return { label, icon: isDay ? day : night };
}

export async function fetchWeather({ lat, lon }, imperial) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: 'temperature_2m,weather_code,cloud_cover,wind_speed_10m,is_day',
    hourly: 'temperature_2m,weather_code,cloud_cover,is_day',
    past_days: '1', // the time slider can look back a day
    forecast_days: '3',
    timeformat: 'unixtime',
    timezone: 'auto',
  });
  if (imperial) {
    params.set('temperature_unit', 'fahrenheit');
    params.set('wind_speed_unit', 'mph');
  }
  const d = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  return {
    current: {
      temp: d.current.temperature_2m,
      code: d.current.weather_code,
      clouds: d.current.cloud_cover,
      wind: d.current.wind_speed_10m,
      isDay: d.current.is_day === 1,
    },
    hourly: d.hourly.time.map((t, i) => ({
      t: t * 1000,
      temp: d.hourly.temperature_2m[i],
      code: d.hourly.weather_code[i],
      clouds: d.hourly.cloud_cover[i],
      isDay: d.hourly.is_day[i] === 1,
    })),
    units: { temp: imperial ? '°F' : '°C', wind: imperial ? 'mph' : 'km/h' },
  };
}

// Nearest hourly forecast to `date`, or null outside the forecast window.
export function weatherAt(wx, date) {
  const t = date.getTime();
  let best = null;
  for (const h of wx.hourly) if (!best || Math.abs(h.t - t) < Math.abs(best.t - t)) best = h;
  return best && Math.abs(best.t - t) <= 90 * 60e3 ? best : null;
}

// ---------- search: OpenStreetMap Nominatim ----------

export async function geocode(query) {
  const params = new URLSearchParams({ q: query, format: 'json', limit: '1' });
  const [hit] = await getJson(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!hit) return null;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  return { name: hit.display_name, lat: Number(hit.lat), lon: Number(hit.lon), bounds: [[w, s], [e, n]] };
}
