# Overhead

**A live 3D globe of the satellites above you, and of what's around you on the ground.**

Live at [michaelrbacu.com](https://michaelrbacu.com)

- **Watch ~170 satellites move in real time**, including the ISS and Tiangong. Optional layers add GPS, weather, science and Starlink (10,000+ objects).
- **Click any satellite** to see its altitude, speed, ground track, coverage footprint, and whether it's in sunlight or Earth's shadow.
- **ISS pass predictions** for your location. Each pass shows rise and set directions and peak elevation, and is flagged when it will be visible to the naked eye.
- **Zoom into any place** and the globe turns into a street map showing notable landmarks, nearby natural events, and the satellites over that exact spot.
- **Live Earth events** worldwide: earthquakes (USGS) plus wildfires, storms and ice (NASA EONET).
- **Time travel**: drag the slider up to 24 hours into the past or future, or press play to watch 5 minutes go by every second. Satellites, orbits, day and night, and pass predictions all follow.
- **Local weather and sky conditions**: current weather for wherever you're looking, whether it's dark and clear enough to spot satellites, and the forecast cloud cover for each visible ISS pass (Open-Meteo).
- **Three ways to view the planet**: a dark vector map, high-resolution satellite imagery, or **Today**, NASA's real image of the whole Earth from the last day, clouds and all. Add **3D terrain** to any of them to raise the mountains.

## How it works

Everything runs in the browser. There's no backend, no build step and no API keys.

| Piece | Source |
|---|---|
| Globe and street map | [MapLibre GL](https://maplibre.org) 5 globe projection + [OpenFreeMap](https://openfreemap.org) vector tiles |
| Orbits | [CelesTrak](https://celestrak.org) TLEs, propagated with SGP4 ([satellite.js](https://github.com/shashwatak/satellite-js)) |
| Earthquakes | USGS real-time GeoJSON feed |
| Natural events | NASA EONET v3 |
| Places | Wikipedia GeoSearch |
| Satellite imagery | Esri World Imagery |
| Today's Earth | NASA GIBS, VIIRS NOAA-20 corrected-reflectance daily mosaic |
| 3D terrain | AWS Open Data Terrain Tiles (Terrarium encoding) |
| Weather | Open-Meteo forecast API |
| Search | OpenStreetMap Nominatim |

Engineering notes:

- **Pass prediction** steps SGP4 through a 48-hour window and computes look angles from the observer. A pass counts as *visible* when the satellite is sunlit (cylindrical Earth-shadow model) while the observer's sun elevation is below −6° (civil twilight).
- **The day/night terminator** comes from a low-precision solar ephemeris: subsolar point → terminator latitude for each longitude.
- **Coverage footprint** is the spherical cap where the satellite is above the horizon, `acos(R / (R + h))`. Polygons that wrap a pole are closed over it.
- **Places are spread across the view.** Geosearch returns the pages nearest a point, which bunches up in dense cities. The view is split into a 3×3 grid and each cell's articles are ranked, using article length as a stand-in for notability.
- **One simulated clock** (real time + offset) drives satellite positions, the terminator, ground tracks, pass predictions and weather lookups, so time travel needs no special cases. Playback advances by real elapsed time, so slow frames don't slow the simulation.
- **Pass visibility uses the forecast.** Each visible pass is matched to the hourly cloud-cover forecast closest to its peak.
- **Resilient data.** Orbit data is cached for 2 hours, matching CelesTrak's update cadence. If CelesTrak is unreachable the app falls back to the stale cache, then to a bundled snapshot in `data/tle/`.

## Run locally

```sh
python -m http.server 8000
# open http://localhost:8000
```

## Optional: concerts and events

Add a free [Ticketmaster Discovery](https://developer.ticketmaster.com/) key to `js/config.js` to show upcoming shows near the map.

## Structure

```
index.html         page shell
css/styles.css     styles (desktop side panel, mobile bottom sheet)
js/main.js         map, layers, UI wiring
js/orbits.js       TLE loading, SGP4, passes, sun, terminator, footprints
js/feeds.js        USGS, EONET, Wikipedia, Nominatim, Ticketmaster
js/config.js       settings
data/tle/          fallback orbit snapshot
```
