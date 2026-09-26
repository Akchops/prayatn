#!/usr/bin/env node
/**
 * Fetches the streets, parks, metro and landmarks around the office from
 * OpenStreetMap (Overpass API) and writes them, projected to metres and
 * simplified, to src/data/findmap.json. The site draws its own map from that
 * file ({{findmap}} in vite.config.js), so visitors load no third-party map.
 *
 *   npm run map-data                 fetch (again), e.g. after the office moves
 *   node scripts/fetch-map-data.mjs --if-missing
 *                                    what npm run build does: fetch only if the
 *                                    file is not there, and if the fetch fails,
 *                                    carry on (the page then shows Google's map)
 *
 * The office position comes from site.json findMap.office ([lat, lon]).
 * OVERPASS_FILE=<saved response.json> processes a saved answer instead.
 * Map data © OpenStreetMap contributors (ODbL); the map shows the credit.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const file = join(root, 'src/data/findmap.json');
const soft = process.argv.includes('--if-missing');
if (soft && existsSync(file)) process.exit(0);

const site = JSON.parse(readFileSync(join(root, 'src/data/site.json'), 'utf8'));
const cfg = site.findMap;
if (!site.features?.findMap || !cfg?.office) {
  console.log('map-data: findMap is off or has no office position; skipped');
  process.exit(0);
}
const [lat0, lon0] = cfg.office;
const HALF_W = cfg.halfWidth ?? 1400, HALF_H = cfg.halfHeight ?? 1000;   // metres either side of the office

// Metres east and south of the office.
const KX = Math.cos((lat0 * Math.PI) / 180) * 111320, KY = 110540;
const px = (lon) => (lon - lon0) * KX, py = (lat) => (lat0 - lat) * KY;
const bbox = [lat0 - HALF_H / KY, lon0 - HALF_W / KX, lat0 + HALF_H / KY, lon0 + HALF_W / KX].map((v) => v.toFixed(6)).join(',');

const query = `[out:json][timeout:90][bbox:${bbox}];
(
  way["highway"];
  way["railway"~"^(subway|rail|light_rail|monorail)$"];
  node["railway"="station"];
  node["station"="subway"];
  way["leisure"~"^(park|garden|pitch|playground|stadium)$"];
  relation["leisure"~"^(park|garden)$"];
  way["landuse"~"^(grass|recreation_ground|cemetery|forest|village_green)$"];
  way["natural"~"^(water|wood|scrub)$"];
  way["waterway"];
  way["building"];
  nwr["amenity"~"^(place_of_worship|college|university|hospital)$"]["name"];
  node["place"~"^(suburb|neighbourhood|quarter)$"];
);
out geom;`;

async function fetchElements() {
  if (process.env.OVERPASS_FILE) return JSON.parse(readFileSync(process.env.OVERPASS_FILE, 'utf8')).elements;
  const endpoints = process.env.OVERPASS ? [process.env.OVERPASS] : ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  let last;
  for (const url of endpoints) {
    try {
      console.log(`map-data: asking ${url} for ${bbox}`);
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'prayatn-website-map-build' }, signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).elements;
    } catch (e) { last = e; console.warn(`map-data: ${url} failed: ${e.message}`); }
  }
  throw last;
}

let elements;
try { elements = await fetchElements(); } catch (e) {
  if (soft) { console.warn('map-data: could not fetch the streets; the page will show the Google map'); process.exit(0); }
  throw e;
}

// Douglas-Peucker, in metres.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let far = -1, dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > dmax) { dmax = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const MX = HALF_W + 200, MY = HALF_H + 200;   // a margin so lines run off the edge cleanly
const inside = (pts) => pts.some(([x, y]) => Math.abs(x) < MX && Math.abs(y) < MY);
const proj = (geom) => geom.map((g) => [px(g.lon), py(g.lat)]);
// Paths in whole metres; after the first point, each step is relative (shorter).
function rel(pts, close) {
  const r = pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
  let d = `M${r[0][0]} ${r[0][1]}`;
  if (r.length > 1) d += 'l' + r.slice(1).map(([x, y], i) => `${x - r[i][0]} ${y - r[i][1]}`).join(' ').replace(/ -/g, '-');
  return d + (close ? 'z' : '');
}
const line = (pts) => 'M' + pts.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join(' L');
const centroid = (pts) => pts.reduce((a, [x, y]) => [a[0] + x / pts.length, a[1] + y / pts.length], [0, 0]).map(Math.round);
const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const area = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const notable = (t) => Boolean(t.wikidata || t.wikipedia);

const ROAD = {
  motorway: 'major', trunk: 'major', primary: 'major', motorway_link: 'secondary', trunk_link: 'secondary', primary_link: 'secondary',
  secondary: 'secondary', secondary_link: 'tertiary', tertiary: 'tertiary', tertiary_link: 'minor',
  unclassified: 'minor', residential: 'minor', living_street: 'minor', road: 'minor',
  service: 'service', pedestrian: 'path', footway: 'path', path: 'path', cycleway: 'path', steps: 'path',
};
const out = { credit: '© OpenStreetMap contributors', fetched: new Date().toISOString().slice(0, 10), office: cfg.office, size: [HALF_W * 2, HALF_H * 2],
  roads: { major: [], secondary: [], tertiary: [], minor: [], service: [], path: [] }, names: [],
  green: [], water: [], rivers: [], buildings: [], rail: [], stations: [], pois: [], places: [] };
const named = new Map();
const seenStation = new Set(), seenPoi = new Set();
const buildings = [];
const poi = (kind, name, at) => { if (!seenPoi.has(name) && Math.abs(at[0]) < HALF_W && Math.abs(at[1]) < HALF_H) { seenPoi.add(name); out.pois.push({ kind, name, at }); } };

for (const el of elements) {
  const t = el.tags || {};
  if (el.type === 'way' && el.geometry) {
    const pts = proj(el.geometry);
    if (!inside(pts)) continue;
    if (t.highway && ROAD[t.highway] && t.area !== 'yes') {
      const cls = ROAD[t.highway];
      const s = simplify(pts, 1.5);
      out.roads[cls].push(rel(s));
      if (t.name && ['major', 'secondary', 'tertiary', 'minor'].includes(cls)) {
        const prev = named.get(t.name);
        const L = lengthOf(s);
        if (!prev || L > prev.len) named.set(t.name, { name: t.name, cls, len: L, pts: s });
      }
    } else if (t.railway && !t.building) {
      out.rail.push({ kind: t.railway, under: t.tunnel === 'yes' || Number(t.layer) < 0, d: rel(simplify(pts, 2)) });
    } else if (t.building) {
      if (pts.length > 3) { const c = centroid(pts); buildings.push({ r: Math.hypot(c[0], c[1] * 1.3), d: rel(simplify(pts.slice(0, -1), 1.2), true) }); }
    } else if (t.leisure || t.landuse || t.natural === 'wood' || t.natural === 'scrub') {
      out.green.push(rel(simplify(pts, 2), true));
      if (t.name && t.leisure === 'park' && (notable(t) || area(pts) > 15000)) poi('park', t.name, centroid(pts));
    } else if (t.natural === 'water') {
      out.water.push(rel(simplify(pts, 2), true));
    } else if (t.waterway) {
      out.rivers.push(rel(simplify(pts, 2)));
    }
    // Landmarks: only well-known ones (with a Wikidata entry), so the map
    // shows the places people give directions by, not every building.
    if (t.name && t.amenity && notable(t)) poi(t.amenity, t['name:en'] || t.name, centroid(pts));
  } else if (el.type === 'relation' && el.members) {
    for (const m of el.members) if (m.role === 'outer' && m.geometry) out.green.push(rel(simplify(proj(m.geometry), 2), true));
    if (t.name && notable(t)) {
      const outer = el.members.find((m) => m.role === 'outer' && m.geometry);
      if (outer) poi('park', t['name:en'] || t.name, centroid(proj(outer.geometry)));
    }
  } else if (el.type === 'node') {
    const at = [Math.round(px(el.lon)), Math.round(py(el.lat))];
    if (Math.abs(at[0]) > HALF_W || Math.abs(at[1]) > HALF_H) continue;
    const name = t['name:en'] || t.name;
    if ((t.railway === 'station' || t.station === 'subway') && name) {
      const key = name.replace(/\s*(metro station|station)$/i, '');
      if (seenStation.has(key)) continue;
      seenStation.add(key);
      out.stations.push({ name: key, at });
    } else if (t.place && name) {
      out.places.push({ name, at, kind: t.place });
    } else if (t.amenity && name && notable(t)) {
      poi(t.amenity, name, at);
    }
  }
}
// Street names: the longest stretch of each named road, drawn left to right.
out.names = [...named.values()].filter((n) => n.len > 180).sort((a, b) => b.len - a.len).slice(0, 40)
  .map((n) => { const pts = n.pts[0][0] > n.pts.at(-1)[0] ? [...n.pts].reverse() : n.pts; return { name: n.name, cls: n.cls, d: line(pts), len: Math.round(n.len) }; });
// Buildings nearest the office first, at most 5000, as one path.
out.buildings = [buildings.sort((a, b) => a.r - b.r).slice(0, 5000).map((b) => b.d).join('')];
// Place names: the dozen nearest.
out.places = out.places.sort((a, b) => Math.hypot(...a.at) - Math.hypot(...b.at)).slice(0, 12);

writeFileSync(file, JSON.stringify(out) + '\n');
const n = (k) => out[k].length;
console.log(`map-data: ${Object.values(out.roads).flat().length} roads, ${n('names')} street names, ${Math.min(buildings.length, 5000)} buildings, ${n('green')} green, ${n('rail')} rail, ${n('stations')} stations (${out.stations.map((s) => s.name).join(', ')}), ${n('pois')} landmarks (${out.pois.map((p) => p.name).join(', ')}), ${n('places')} places -> src/data/findmap.json (${(JSON.stringify(out).length / 1024).toFixed(0)} kB)`);
