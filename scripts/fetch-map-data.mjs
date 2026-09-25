#!/usr/bin/env node
/**
 * Fetches the streets, parks, metro and landmarks around the office from
 * OpenStreetMap (Overpass API) and writes them, projected to metres and
 * simplified, to src/data/findmap.json. The site draws its own map from that
 * file ({{findmap}} in vite.config.js), so visitors load no third-party map.
 *
 * Run once, and again only if the office moves or the streets change:
 *   npm run map-data
 * The office position comes from site.json findMap.office ([lat, lon]).
 * Map data © OpenStreetMap contributors (ODbL); the map shows the credit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const site = JSON.parse(readFileSync(join(root, 'src/data/site.json'), 'utf8'));
const cfg = site.findMap;
if (!cfg?.office) throw new Error('site.json findMap.office ([lat, lon]) is not set');
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
  nwr["amenity"~"^(place_of_worship|college|university|school|hospital)$"]["name"];
  nwr["landuse"="commercial"]["name"];
  node["place"~"^(suburb|neighbourhood|quarter)$"];
);
out geom;`;

const endpoint = process.env.OVERPASS || 'https://overpass-api.de/api/interpreter';
console.log(`map-data: asking ${endpoint} for ${bbox}`);
const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'prayatn-website-map-build' } });
if (!res.ok) throw new Error(`Overpass answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
const { elements } = await res.json();

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
const line = (pts) => 'M' + pts.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join(' L');
const poly = (pts) => line(pts) + 'Z';
const centroid = (pts) => pts.reduce((a, [x, y]) => [a[0] + x / pts.length, a[1] + y / pts.length], [0, 0]).map(Math.round);
const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

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
const seenStation = new Set();

for (const el of elements) {
  const t = el.tags || {};
  if (el.type === 'way' && el.geometry) {
    const pts = proj(el.geometry);
    if (!inside(pts)) continue;
    if (t.highway && ROAD[t.highway] && t.area !== 'yes') {
      const cls = ROAD[t.highway];
      const s = simplify(pts, 1.5);
      out.roads[cls].push(line(s));
      if (t.name && ['major', 'secondary', 'tertiary', 'minor'].includes(cls)) {
        const k = t.name;
        const prev = named.get(k);
        const L = lengthOf(s);
        if (!prev || L > prev.len) named.set(k, { name: t.name, cls, len: L, pts: s });
      }
    } else if (t.railway && !t.building) {
      out.rail.push({ kind: t.railway, under: t.tunnel === 'yes' || Number(t.layer) < 0, d: line(simplify(pts, 2)) });
    } else if (t.building) {
      if (pts.length > 3) out.buildings.push(poly(simplify(pts, 1)));
    } else if (t.leisure || t.landuse || t.natural === 'wood' || t.natural === 'scrub') {
      if (t.landuse === 'commercial') continue;
      out.green.push(poly(simplify(pts, 2)));
      if (t.name && t.leisure === 'park') out.pois.push({ kind: 'park', name: t.name, at: centroid(pts) });
    } else if (t.natural === 'water') {
      out.water.push(poly(simplify(pts, 2)));
    } else if (t.waterway) {
      out.rivers.push(line(simplify(pts, 2)));
    }
    if (t.name && t.amenity && ['place_of_worship', 'college', 'university', 'school', 'hospital'].includes(t.amenity)) {
      out.pois.push({ kind: t.amenity, name: t.name, at: centroid(pts) });
    }
    if (t.name && t.landuse === 'commercial') out.places.push({ name: t.name, at: centroid(pts), kind: 'commercial' });
  } else if (el.type === 'relation' && el.members) {
    for (const m of el.members) if (m.role === 'outer' && m.geometry) out.green.push(poly(simplify(proj(m.geometry), 2)));
  } else if (el.type === 'node') {
    const at = [Math.round(px(el.lon)), Math.round(py(el.lat))];
    if (Math.abs(at[0]) > HALF_W || Math.abs(at[1]) > HALF_H) continue;
    if ((t.railway === 'station' || t.station === 'subway') && t.name) {
      if (seenStation.has(t.name)) continue;
      seenStation.add(t.name);
      out.stations.push({ name: t.name, at, lines: t.colour || t.line || null });
    } else if (t.place && t.name) {
      out.places.push({ name: t.name, at, kind: t.place });
    } else if (t.amenity && t.name) {
      out.pois.push({ kind: t.amenity, name: t.name, at });
    }
  }
}
// Street names: the longest stretch of each named road, drawn left to right.
out.names = [...named.values()].filter((n) => n.len > 180).sort((a, b) => b.len - a.len).slice(0, 40)
  .map((n) => { const pts = n.pts[0][0] > n.pts.at(-1)[0] ? [...n.pts].reverse() : n.pts; return { name: n.name, cls: n.cls, d: line(pts), len: Math.round(n.len) }; });
out.buildings = [out.buildings.join('')];

const file = join(root, 'src/data/findmap.json');
writeFileSync(file, JSON.stringify(out) + '\n');
const count = (k) => (Array.isArray(out[k]) ? out[k].length : 0);
console.log(`map-data: ${Object.values(out.roads).flat().length} roads, ${count('names')} names, ${count('green')} green, ${count('rail')} rail, ${count('stations')} stations, ${count('pois')} places of note -> ${file} (${(JSON.stringify(out).length / 1024).toFixed(0)} kB)`);
