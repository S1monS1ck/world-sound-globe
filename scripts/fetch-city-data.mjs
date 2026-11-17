/**
 * One-off, serial OSM downloads. Runtime never calls a map service.
 * Generated datasets: © OpenStreetMap contributors, ODbL 1.0.
 * https://www.openstreetmap.org/copyright
 * Run: node scripts/fetch-city-data.mjs [beijing mumbai paris shanghai london tokyo]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const scenes = [
  { id: "beijing", lat: 39.88225, lon: 116.40662, extent: 700, landmark: /hall of prayer for good harvests|祈年殿/i },
  { id: "mumbai", lat: 18.92190, lon: 72.83460, extent: 1100, landmark: /gateway of india|印度门/i },
  { id: "paris", lat: 48.85837, lon: 2.29448, extent: 1100, landmark: /tour eiffel|eiffel tower/i },
  { id: "shanghai", lat: 31.23970, lon: 121.49980, extent: 1100, landmark: /oriental pearl|东方明珠|東方明珠/i },
  { id: "london", lat: 51.50070, lon: -0.12460, extent: 1100, landmark: /elizabeth tower|big ben/i },
  { id: "tokyo", lat: 35.65858, lon: 139.74543, extent: 1100, landmark: /tokyo tower|東京タワー|东京塔/i },
  { id: "guangzhou", lat: 23.10905, lon: 113.31799, extent: 700, landmark: /canton tower|广州塔|廣州塔/i },
  { id: "taipei", lat: 25.03395, lon: 121.56455, extent: 700, landmark: /taipei 101|台北101|臺北101/i },
  { id: "hong-kong", lat: 22.27927, lon: 114.16157, extent: 700, landmark: /bank of china tower|中銀大廈/i },
  { id: "xian", lat: 34.21980, lon: 108.95943, extent: 700, landmark: /^大雁塔$|big wild goose pagoda/i },
  { id: "chengdu", lat: 30.66469, lon: 104.09211, extent: 700, landmark: /west pearl tower|天府熊猫塔|天府熊貓塔/i },
];
const output = fileURLToPath(new URL("../public/city-data/", import.meta.url));
const requested = new Set(process.argv.slice(2));
const endpoint = process.env.OSM_OVERPASS_ENDPOINT || "https://overpass-api.de/api/interpreter";
const round = (value) => Math.round(value * 1e7) / 1e7;
const coordinate = (point) => [round(point.lon), round(point.lat)];
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

function parseOsmXml(xml) {
  const nodes = new Map();
  for (const match of xml.matchAll(/<node\b([^>]*)>/g)) {
    const id = match[1].match(/\bid="(\d+)"/)?.[1];
    const lat = Number(match[1].match(/\blat="([^"]+)"/)?.[1]);
    const lon = Number(match[1].match(/\blon="([^"]+)"/)?.[1]);
    if (id && Number.isFinite(lat) && Number.isFinite(lon)) nodes.set(id, { lat, lon });
  }
  const elements = [];
  for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
    const id = Number(match[1].match(/\bid="(\d+)"/)?.[1]);
    const geometry = [...match[2].matchAll(/<nd\s+ref="(\d+)"\s*\/>/g)].map((part) => nodes.get(part[1]));
    const tags = Object.fromEntries([...match[2].matchAll(/<tag\s+k="([^"]+)"\s+v="([^"]*)"\s*\/>/g)].map((part) => [part[1], part[2]]));
    if (geometry.length > 1 && geometry.every(Boolean)) elements.push({ type: "way", id, tags, geometry });
  }
  return { elements };
}

function ringOf(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 3 || geometry.some((point) => !point || !Number.isFinite(point.lon) || !Number.isFinite(point.lat))) return null;
  const points = geometry.map(coordinate);
  return same(points[0], points.at(-1)) ? points : null;
}

/** Join multipolygon way members; never invent a closing edge for incomplete rings. */
function joinRings(members, role) {
  const fragments = members.filter((m) => (m.role || "outer") === role && Array.isArray(m.geometry) && m.geometry.length > 1)
    .map((m) => m.geometry.filter(Boolean).map(coordinate));
  const rings = [];
  while (fragments.length) {
    let current = fragments.pop();
    let changed = true;
    while (!same(current[0], current.at(-1)) && changed) {
      changed = false;
      for (let i = 0; i < fragments.length; i += 1) {
        const part = fragments[i];
        if (same(current.at(-1), part[0])) current.push(...part.slice(1));
        else if (same(current.at(-1), part.at(-1))) current.push(...part.slice(0, -1).reverse());
        else if (same(current[0], part.at(-1))) current.unshift(...part.slice(0, -1));
        else if (same(current[0], part[0])) current.unshift(...part.slice(1).reverse());
        else continue;
        fragments.splice(i, 1);
        changed = true;
        break;
      }
    }
    if (current.length >= 4 && same(current[0], current.at(-1))) rings.push(current);
  }
  return rings;
}

function inside(point, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function polygons(element) {
  if (element.type === "way") {
    const ring = ringOf(element.geometry);
    return ring ? [{ ring }] : [];
  }
  if (element.type !== "relation") return [];
  const outer = joinRings(element.members || [], "outer");
  const inner = joinRings(element.members || [], "inner");
  return outer.map((ring) => {
    const holes = inner.filter((hole) => inside(hole[0], ring));
    return holes.length ? { ring, holes } : { ring };
  });
}

function numericMetres(text) {
  if (!text) return null;
  const result = Number.parseFloat(String(text).replace(",", "."));
  if (!Number.isFinite(result)) return null;
  return /ft|feet|'/.test(String(text)) ? result * 0.3048 : result;
}

function nearLandmark(ring, scene, tags) {
  if (scene.landmark.test(Object.entries(tags).filter(([key]) => key.includes("name")).map(([,value]) => value).join(" "))) return true;
  const center = [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
  const x = (center[0] - scene.lon) * 111320 * Math.cos(scene.lat * Math.PI / 180);
  const y = (center[1] - scene.lat) * 111320;
  return Math.hypot(x, y) < (scene.id === "london" ? 15 : scene.id === "mumbai" ? 25 : 70);
}

function compact(raw, scene) {
  const buildings = [], roads = [], water = [], parks = [], coastline = [];
  const relationWayIds = new Set();
  for (const element of raw.elements) {
    if (element.type === "relation" && (element.tags?.natural === "water" || element.tags?.waterway === "riverbank")) {
      for (const member of element.members || []) if (member.type === "way") relationWayIds.add(member.ref);
    }
  }
  const landmarkEvidence = [];
  for (const element of raw.elements) {
    const tags = element.tags || {};
    if (scene.landmark.test(Object.values(tags).join(" "))) landmarkEvidence.push({ id: element.id, type: element.type, name: tags.name || tags["name:en"], bounds: element.bounds });
    if (element.type === "way" && tags.building && tags.building !== "no") {
      const ring = ringOf(element.geometry);
      if (!ring || nearLandmark(ring, scene, tags)) continue;
      const measuredHeight = numericMetres(tags.height);
      const levels = numericMetres(tags["building:levels"]);
      const height = Math.max(3, Math.min(450, measuredHeight ?? (levels ? levels * 3 : 9)));
      const minHeight = Math.max(0, Math.min(height - 1, numericMetres(tags.min_height) ?? (numericMetres(tags["building:min_level"]) || 0) * 3));
      buildings.push({ id: element.id, ring, height: Math.round(height * 10) / 10, minHeight: Math.round(minHeight * 10) / 10, estimated: measuredHeight === null });
    }
    if (element.type === "way" && tags.highway && element.geometry?.length > 1 && !tags.area && !["proposed", "construction", "platform", "elevator"].includes(tags.highway)) {
      roads.push({ points: element.geometry.filter(Boolean).map(coordinate), kind: tags.highway });
    }
    if ((tags.natural === "water" || tags.waterway === "riverbank") && !relationWayIds.has(element.id)) water.push(...polygons(element));
    if (tags.leisure === "park" || tags.landuse === "recreation_ground") parks.push(...polygons(element).map(({ ring }) => ({ ring })));
    if (element.type === "way" && tags.natural === "coastline" && element.geometry?.length > 1) {
      // OSM coastline direction is preserved exactly: land lies on its left.
      coastline.push(element.geometry.filter(Boolean).map(coordinate));
    }
  }
  return { dataset: { center: [scene.lon, scene.lat], extent: scene.extent, buildings, roads, water, parks, coastline, source: "© OpenStreetMap contributors · ODbL 1.0 · https://www.openstreetmap.org/copyright", updated: raw.osm3s?.timestamp_osm_base || new Date().toISOString() }, landmarkEvidence };
}

async function fetchScene(scene) {
  if (!process.env.OSM_OVERPASS_ENDPOINT) {
    const extent = Math.min(scene.extent, 700);
    const latitudeDelta = extent / 111320;
    const longitudeDelta = latitudeDelta / Math.cos(scene.lat * Math.PI / 180);
    const bbox = [scene.lon - longitudeDelta, scene.lat - latitudeDelta, scene.lon + longitudeDelta, scene.lat + latitudeDelta].join(",");
    const xml = process.env.OSM_XML_DIR
      ? await readFile(`${process.env.OSM_XML_DIR}/${scene.id}.xml`, "utf8")
      : await (async () => {
          const response = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, {
            headers: { "User-Agent": "WorldSoundGlobe-local-data-preparation/0.2" },
            signal: AbortSignal.timeout(45000),
          });
          if (!response.ok) throw new Error(`${scene.id}: OSM map HTTP ${response.status}`);
          return response.text();
        })();
    const { dataset, landmarkEvidence } = compact(parseOsmXml(xml), scene);
    dataset.extent = extent;
    if (dataset.buildings.length < 3) throw new Error(`${scene.id}: too few real buildings; refusing to fabricate context`);
    await writeFile(`${output}${scene.id}.json`, JSON.stringify(dataset));
    console.log(JSON.stringify({ id: scene.id, buildings: dataset.buildings.length, roads: dataset.roads.length, water: dataset.water.length, parks: dataset.parks.length, coastline: dataset.coastline.length, bytes: JSON.stringify(dataset).length, landmarkEvidence }));
    return;
  }
  // A square envelope includes all geometry intersecting the rendered square.
  const latitudeDelta = scene.extent / 111320;
  const longitudeDelta = latitudeDelta / Math.cos(scene.lat * Math.PI / 180);
  const bbox = [scene.lat - latitudeDelta, scene.lon - longitudeDelta, scene.lat + latitudeDelta, scene.lon + longitudeDelta].join(",");
  const query = `[out:json][timeout:60];(way[building](${bbox});way[highway](${bbox});way[natural=water](${bbox});relation[natural=water](${bbox});way[waterway=riverbank](${bbox});relation[waterway=riverbank](${bbox});way[natural=coastline](${bbox});way[leisure=park](${bbox});relation[leisure=park](${bbox}););out geom;`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "WorldSoundGlobe-local-data-preparation/0.1" },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`${scene.id}: Overpass HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const raw = await response.json();
  if (raw.remark) throw new Error(`${scene.id}: Overpass returned incomplete data: ${raw.remark}`);
  const { dataset, landmarkEvidence } = compact(raw, scene);
  if (dataset.buildings.length < 3) throw new Error(`${scene.id}: too few real buildings; refusing to fabricate context`);
  await writeFile(`${output}${scene.id}.json`, JSON.stringify(dataset));
  console.log(JSON.stringify({ id: scene.id, buildings: dataset.buildings.length, roads: dataset.roads.length, water: dataset.water.length, parks: dataset.parks.length, coastline: dataset.coastline.length, bytes: JSON.stringify(dataset).length, landmarkEvidence }));
}

await mkdir(output, { recursive: true });
for (const scene of scenes) {
  if (requested.size && !requested.has(scene.id)) continue;
  await fetchScene(scene);
}
