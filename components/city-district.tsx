"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { City } from "@/lib/cities";
import { getCityScene } from "@/lib/city-scenes";
import { EARTH_RADIUS, EARTH_METERS, cityVector, tangentBasis } from "@/lib/globe";
import { LandmarkModel, type LandmarkKind } from "@/components/landmark-model";
import { CityVignette } from "@/components/city-vignette";

type Coordinate = [number, number];
type Polygon = { ring: Coordinate[]; holes?: Coordinate[][] };
type Geography = {
  center: Coordinate;
  extent: number;
  buildings: (Polygon & { id: number; height: number; minHeight: number; estimated: boolean })[];
  roads: { points: Coordinate[]; kind: string }[];
  water: Polygon[];
  parks: Polygon[];
  coastline: Coordinate[][];
};
type Point = { x: number; y: number };
const geographyCache = new Map<string, Promise<Geography>>();
const ASSET_BASE = import.meta.env.BASE_URL ?? "/";
// A compact on-globe miniature: legible at orbital distance without becoming a second landscape.
export const CITY_DISPLAY_SCALE = 0.00011;
const DISPLAY_RADIUS_METERS = EARTH_RADIUS / CITY_DISPLAY_SCALE;

// Display disc radius per landmark, in miniature meters.
export function districtExtent(landmark: LandmarkKind) {
  return landmark === "oriental-pearl" || landmark === "temple-of-heaven" ? 700 : landmark === "gateway-india" ? 380 : 500;
}

// Low landmarks are enlarged so they stay legible beside the mapped blocks;
// tall ones are capped near 240 m so the street-level camera stays inside the
// block field and no tower dwarfs its district.
export function landmarkDisplayScale(landmark: LandmarkKind) {
  return landmark === "temple-of-heaven" ? 6 : landmark === "gateway-india" ? 7.5 : landmark === "elizabeth-tower" ? 2.2 : landmark === "wild-goose-pagoda" ? 3 : landmark === "canton-tower" ? 0.4 : landmark === "taipei-101" ? 0.47 : landmark === "oriental-pearl" ? 0.51 : landmark === "bank-of-china-tower" ? 0.65 : landmark === "west-pearl-tower" ? 0.71 : landmark === "tokyo-tower" ? 0.72 : landmark === "eiffel" ? 0.73 : 1;
}

function localPoint(coordinate: Coordinate, center: Coordinate): Point {
  return {
    x: (coordinate[0] - center[0]) * Math.PI / 180 * EARTH_METERS * Math.cos(center[1] * Math.PI / 180),
    y: (coordinate[1] - center[1]) * Math.PI / 180 * EARTH_METERS,
  };
}

function clipToDisc(points: Point[], radius: number) {
  let output = points;
  const sides = 32;
  for (let i = 0; i < sides && output.length >= 3; i++) {
    const angle = i * Math.PI * 2 / sides;
    const nextAngle = (i + 1) * Math.PI * 2 / sides;
    const a = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    const b = { x: Math.cos(nextAngle) * radius, y: Math.sin(nextAngle) * radius };
    const signed = (p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const start = input[j], end = input[(j + 1) % input.length];
      const startSide = signed(start), endSide = signed(end);
      if (startSide >= 0 && endSide >= 0) output.push(end);
      else if ((startSide >= 0) !== (endSide >= 0)) {
        const t = startSide / (startSide - endSide);
        output.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
        if (endSide >= 0) output.push(end);
      }
    }
  }
  return output.length >= 3 ? output : [];
}

function clipRoadToDisc(a: Point, b: Point, radius: number): [Point, Point] | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.0001) return null;
  const projection = a.x * dx + a.y * dy;
  const discriminant = projection * projection - lengthSquared * (a.x * a.x + a.y * a.y - radius * radius);
  if (discriminant < 0) return a.x * a.x + a.y * a.y < radius * radius ? [a, b] : null;
  const root = Math.sqrt(discriminant);
  const first = Math.max(0, (-projection - root) / lengthSquared);
  const last = Math.min(1, (-projection + root) / lengthSquared);
  if (first >= last) return null;
  return [
    { x: a.x + dx * first, y: a.y + dy * first },
    { x: a.x + dx * last, y: a.y + dy * last },
  ];
}

function shapeFor(points: Point[], holes: Point[][] = []) {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)));
  shape.holes = holes.filter((hole) => hole.length >= 3).map((hole) => new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, p.y))));
  return shape;
}

function curveGeometry(geometry: THREE.BufferGeometry, elevation: number) {
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, positions.getY(i) + elevation - (x * x + z * z) / (2 * DISPLAY_RADIUS_METERS));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function mergeAndDispose(geometries: THREE.BufferGeometry[]) {
  if (!geometries.length) return null;
  const merged = mergeGeometries(geometries);
  geometries.forEach((geometry) => geometry.dispose());
  return merged;
}

function hash01(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function buildGeography(data: Geography, extent: number, restrained = false, clearRadius = 55) {
  const buildingBatches: THREE.BufferGeometry[][] = Array.from({ length: 4 }, () => []);
  const roofGeometries: THREE.BufferGeometry[] = [];
  const nearbyBuildings = data.buildings.map((building) => {
    const points = building.ring.map((p) => localPoint(p, data.center));
    const location = points.reduce((sum, p) => ({x:sum.x+p.x/points.length,y:sum.y+p.y/points.length}), {x:0,y:0});
    const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const depth = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    return { building, location, distance: Math.hypot(location.x, location.y), area: width * depth };
  }).filter(({ building, distance, area }) => distance > clearRadius && distance < extent * 0.95 && area > 35 && area < 14000 && building.height <= 100)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, restrained ? 240 : extent < 300 ? 220 : extent < 450 ? 320 : 450);
  for (const { building, distance } of nearbyBuildings) {
    const rawRing = building.ring.map((p) => localPoint(p, data.center));
    const stride = Math.max(1, Math.ceil(rawRing.length / 12));
    const footprint = stride === 1 ? rawRing : rawRing.filter((_, i) => i % stride === 0);
    const width = Math.max(...footprint.map((p) => p.x)) - Math.min(...footprint.map((p) => p.x));
    const depth = Math.max(...footprint.map((p) => p.y)) - Math.min(...footprint.map((p) => p.y));
    if (width < 2 || depth < 2) continue;
    const ring = clipToDisc(footprint, extent * 0.96);
    if (ring.length < 3) continue;
    const shape = shapeFor(ring);
    // Tiered heights with a downtown boost keep the miniature skyline legible and varied.
    const boost = 1.25 - 0.5 * Math.min(1, distance / extent);
    const jitter = restrained ? 0.9 + 0.25 * hash01(building.id + 7) : 0.85 + 0.4 * hash01(building.id);
    const raw = building.height * (restrained ? 2.1 : 3.2) * boost * jitter;
    const step = restrained ? 8 : 12;
    const height = THREE.MathUtils.clamp(Math.round(raw / step) * step, restrained ? 8 : 12, restrained ? 48 : 108);
    const floor = THREE.MathUtils.clamp((building.minHeight || 0) * (restrained ? 2.1 : 3.2), 0, height - 2);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1, height - floor), bevelEnabled: false, steps: 1, curveSegments: 1 });
    curveGeometry(geometry, floor + 2);
    buildingBatches[Math.abs(building.id) % 4].push(geometry);
    if (restrained) {
      const cx = footprint.reduce((s, p) => s + p.x, 0) / footprint.length;
      const cy = footprint.reduce((s, p) => s + p.y, 0) / footprint.length;
      const roof = new THREE.BoxGeometry(Math.min(width, 60) + 2, 1.5, Math.min(depth, 60) + 2);
      roof.translate(cx, height + 2.75, -cy);
      roofGeometries.push(roof);
    }
  }
  // Procedural infill: a continuous block grid where mapped footprints are sparse,
  // skipping road corridors, mapped buildings, parks and water.
  const cell = 26;
  const roadKeys = new Set<string>();
  for (const road of data.roads) for (const p of road.points) {
    const lp = localPoint(p, data.center);
    roadKeys.add(`${Math.round(lp.x / cell)},${Math.round(lp.y / cell)}`);
  }
  const solidKeys = new Set<string>();
  for (const { building } of nearbyBuildings) {
    const pts = building.ring.map((p) => localPoint(p, data.center));
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    for (let gx = Math.floor(minX / cell); gx <= Math.floor(maxX / cell); gx++)
      for (let gy = Math.floor(minY / cell); gy <= Math.floor(maxY / cell); gy++)
        solidKeys.add(`${gx},${gy}`);
  }
  const avoidPolys = [...data.parks, ...data.water].map(({ ring }) => ring.map((p) => localPoint(p, data.center)));
  const insideAvoid = (x: number, y: number) => avoidPolys.some((poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  });
  const limit = extent * 0.92;
  const gmax = Math.ceil(limit / cell);
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let gx = -gmax; gx <= gmax; gx++) for (let gy = -gmax; gy <= gmax; gy++) {
    const x = (gx + 0.5) * cell, y = (gy + 0.5) * cell;
    const d = Math.hypot(x, y);
    if (d > limit || d < clearRadius + 10) continue;
    const key = `${gx},${gy}`;
    if (roadKeys.has(key) || solidKeys.has(key) || insideAvoid(x, y)) continue;
    candidates.push({ x, y, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const spot of candidates.slice(0, restrained ? 420 : 900)) {
    const seed = Math.abs(Math.round(spot.x * 7 + spot.y * 13)) + 1;
    const w = 14 + 8 * hash01(seed), dp = 12 + 8 * hash01(seed + 3);
    const ring = [
      { x: spot.x - w / 2, y: spot.y - dp / 2 },
      { x: spot.x + w / 2, y: spot.y - dp / 2 },
      { x: spot.x + w / 2, y: spot.y + dp / 2 },
      { x: spot.x - w / 2, y: spot.y + dp / 2 },
    ];
    const boost = 1.25 - 0.5 * Math.min(1, spot.d / extent);
    const raw = ((restrained ? 9 : 11) + (restrained ? 10 : 26) * hash01(seed + 11)) * boost;
    const step = restrained ? 8 : 12;
    const height = THREE.MathUtils.clamp(Math.round(raw / step) * step, restrained ? 8 : 12, restrained ? 32 : 96);
    const geometry = new THREE.ExtrudeGeometry(shapeFor(ring), { depth: Math.max(1, height), bevelEnabled: false, steps: 1, curveSegments: 1 });
    curveGeometry(geometry, 2);
    buildingBatches[seed % 4].push(geometry);
  }
  const roadPoints: number[] = [];
  for (const road of data.roads) {
    const points = road.points.map((p)=>localPoint(p,data.center));
    for (let i=1;i<points.length && roadPoints.length<15000;i++) {
      const clipped = clipRoadToDisc(points[i-1], points[i], extent * 0.9);
      if (!clipped) continue;
      const [a, b] = clipped;
      const lift=(p:Point)=>2.7-(p.x*p.x+p.y*p.y)/(2*DISPLAY_RADIUS_METERS);
      roadPoints.push(a.x,lift(a),-a.y,b.x,lift(b),-b.y);
    }
  }
  const roads = new THREE.BufferGeometry();
  roads.setAttribute("position",new THREE.Float32BufferAttribute(roadPoints,3));
  const coastPoints: number[] = [];
  for (const line of data.coastline) {
    const points = line.map((p) => localPoint(p, data.center));
    for (let i = 1; i < points.length; i++) {
      const clipped = clipRoadToDisc(points[i - 1], points[i], extent * 0.9);
      if (!clipped) continue;
      const [a, b] = clipped;
      const lift = (p: Point) => 2.5 - (p.x * p.x + p.y * p.y) / (2 * DISPLAY_RADIUS_METERS);
      coastPoints.push(a.x, lift(a), -a.y, b.x, lift(b), -b.y);
    }
  }
  // Shoreline strokes for inland water (rivers/lakes) so channels read as water, not void.
  for (const { ring } of data.water) {
    const clipped = clipToDisc(ring.map((p) => localPoint(p, data.center)), extent * 0.9);
    if (clipped.length < 3) continue;
    const lift = (p: Point) => 2.6 - (p.x * p.x + p.y * p.y) / (2 * DISPLAY_RADIUS_METERS);
    for (let i = 0; i < clipped.length; i += 1) {
      const a = clipped[i], b = clipped[(i + 1) % clipped.length];
      coastPoints.push(a.x, lift(a), -a.y, b.x, lift(b), -b.y);
    }
  }
  const coast = new THREE.BufferGeometry();
  coast.setAttribute("position", new THREE.Float32BufferAttribute(coastPoints, 3));
  return {
    buildings: buildingBatches.map(mergeAndDispose),
    roofs: mergeAndDispose(roofGeometries),
    water: mergeAndDispose(data.water.map(({ring})=>clipToDisc(ring.map((p)=>localPoint(p,data.center)),extent*0.9)).filter((ring)=>ring.length>=3).map((ring)=>curveGeometry(new THREE.ShapeGeometry(shapeFor(ring)),2.4))),
    parks: mergeAndDispose(data.parks.map(({ring})=>clipToDisc(ring.map((p)=>localPoint(p,data.center)),extent*0.9)).filter((ring)=>ring.length>=3).map((ring)=>curveGeometry(new THREE.ShapeGeometry(shapeFor(ring)),2.3))),
    roads,
    coast,
  };
}

function GeographicDistrict({ data, landmark, heading, displayCenter }: { data: Geography; landmark: Parameters<typeof LandmarkModel>[0]["kind"]; heading: number; displayCenter: Coordinate }) {
  const restrained = landmark === "temple-of-heaven";
  const gateway = landmark === "gateway-india";
  const extent = districtExtent(landmark);
  const terrainExtent = extent + 30;
  const clearRadius = gateway ? 120 : restrained ? 110 : landmark === "eiffel" ? 70 : landmark === "elizabeth-tower" ? 60 : landmark === "wild-goose-pagoda" ? 70 : landmark === "canton-tower" || landmark === "taipei-101" || landmark === "bank-of-china-tower" ? 62 : landmark === "west-pearl-tower" ? 45 : 55;
  const geometry = useMemo(() => buildGeography(data, extent, restrained, clearRadius), [data, extent, restrained, clearRadius]);
  const materials = useMemo(() => ["#76839b","#8b96a8","#66748c","#9aa4b4"].map((color) => new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:0.05, roughness:0.95})), []);
  const waterMaterial = useMemo(()=>new THREE.MeshBasicMaterial({color:"#0d2b3d",depthTest:false,depthWrite:false,side:THREE.DoubleSide}),[]);
  const parkMaterial = useMemo(()=>new THREE.MeshBasicMaterial({color:"#2b4a41",depthTest:false,depthWrite:false,side:THREE.DoubleSide}),[]);
  const roadMaterial = useMemo(()=>new THREE.LineBasicMaterial({color:"#9a8f77",transparent:true,opacity:0.65,depthTest:false,depthWrite:false}),[]);
  const coastMaterial = useMemo(()=>new THREE.LineBasicMaterial({color:"#2a566b",transparent:true,opacity:0.85,depthTest:false,depthWrite:false}),[]);
  const roofMaterial = useMemo(()=>new THREE.MeshStandardMaterial({color:"#545d6b",roughness:0.95}),[]);
  const base = useMemo(() => {
    const plane = new THREE.PlaneGeometry(terrainExtent*2,terrainExtent*2,32,32);
    return curveGeometry(plane,2);
  },[terrainExtent]);
  const baseMaterial = useMemo(() => new THREE.ShaderMaterial({
    depthWrite:false, depthTest:true, transparent:true,
    uniforms:{extent:{value:terrainExtent}},
    vertexShader:`varying vec2 vLocal; void main(){vLocal=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float extent; varying vec2 vLocal; void main(){float edge=length(vLocal)/extent; if(edge>.96) discard; float alpha=.9*(1.0-smoothstep(.62,.96,edge)); float grain=sin(vLocal.x*.013)*sin(vLocal.y*.011)*.016; vec3 terrain=vec3(.07,.10,.14)+grain; gl_FragColor=vec4(terrain,alpha);}`,
  }),[terrainExtent]);
  useEffect(() => () => {
    geometry.buildings.forEach((item)=>item?.dispose());
    geometry.roofs?.dispose();
    geometry.water?.dispose(); geometry.parks?.dispose(); geometry.roads.dispose(); geometry.coast.dispose();
  },[geometry]);
  useEffect(() => () => {base.dispose();baseMaterial.dispose();},[base,baseMaterial]);
  useEffect(() => () => materials.forEach((material)=>material.dispose()),[materials]);
  useEffect(() => () => {waterMaterial.dispose();parkMaterial.dispose();roadMaterial.dispose();coastMaterial.dispose();roofMaterial.dispose();},[waterMaterial,parkMaterial,roadMaterial,coastMaterial,roofMaterial]);
  const position = useMemo(()=>cityVector(displayCenter[1],displayCenter[0],EARTH_RADIUS),[displayCenter]);
  const quaternion = useMemo(()=>{
    const {up,east,north}=tangentBasis(displayCenter[1],displayCenter[0]);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,up,north.negate()));
  },[displayCenter]);
  return (
    <group position={position} quaternion={quaternion} scale={CITY_DISPLAY_SCALE}>
      <mesh geometry={base} material={baseMaterial} renderOrder={-5} />
      {geometry.water && <mesh geometry={geometry.water} material={waterMaterial} renderOrder={-4} />}
      {geometry.parks && <mesh geometry={geometry.parks} material={parkMaterial} renderOrder={-3} />}
      <lineSegments geometry={geometry.roads} material={roadMaterial} renderOrder={-2} />
      <lineSegments geometry={geometry.coast} material={coastMaterial} renderOrder={-2} />
      {geometry.buildings.map((batch,index)=>batch && <mesh key={index} geometry={batch} material={materials[index]}/>)}
      {geometry.roofs && <mesh geometry={geometry.roofs} material={roofMaterial} />}
      <group position={[0,2,0]} rotation={[0,Math.PI-heading*Math.PI/180,0]} scale={landmarkDisplayScale(landmark)}>
        <LandmarkModel kind={landmark}/>
      </group>
    </group>
  );
}

export function CityDistrict({city}:{city:City}) {
  const scene=getCityScene(city.id);
  const [loaded,setLoaded]=useState<{id:string;data:Geography}|null>(null);
  useEffect(()=>{
    if(!scene)return;
    let current=true;
    let request=geographyCache.get(scene.id);
    if(!request){
      request=fetch(`${ASSET_BASE}city-data/${scene.id}.json`).then(response=>{
        if(!response.ok)throw new Error("City geography unavailable");
        return response.json() as Promise<Geography>;
      });
      geographyCache.set(scene.id,request);
    }
    request.then(data=>{if(current)setLoaded({id:scene.id,data});}).catch(()=>{
      geographyCache.delete(scene.id);
      if(current)setLoaded({id:scene.id,data:{center:[scene.lon,scene.lat],extent:scene.extent,buildings:[],roads:[],water:[],parks:[],coastline:[]}});
    });
    return()=>{current=false;};
  },[scene]);
  if(!scene)return <CityVignette city={city}/>;
  if(loaded?.id!==scene.id)return null;
  return <GeographicDistrict data={loaded.data} landmark={scene.landmark} heading={scene.heading} displayCenter={[scene.displayLon ?? scene.lon, scene.displayLat ?? scene.lat]}/>;
}
