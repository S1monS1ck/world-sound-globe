"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type LandmarkKind =
  | "eiffel"
  | "oriental-pearl"
  | "elizabeth-tower"
  | "gateway-india"
  | "tokyo-tower"
  | "temple-of-heaven"
  | "hall-of-supreme-harmony"
  | "canton-tower"
  | "taipei-101"
  | "bank-of-china-tower"
  | "west-pearl-tower"
  | "wild-goose-pagoda";

type Point = [number, number, number];
type Finish = { color: string; metalness?: number; roughness?: number };
type ModelPart = Finish & { geometry: THREE.BufferGeometry };
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Meter-scale, Y-up architectural interpretations, with ground at y=0.
 * Published overall heights and major levels are respected. Small ornaments,
 * beam sections and unlisted widths are simplified; these are not survey scans.
 *
 * Dimensional references:
 * https://www.toureiffel.paris/fr/le-monument/chiffres-cle
 * https://www.parliament.uk/about/living-heritage/building/palace/big-ben/facts-figures/
 * https://www.parliament.uk/about/living-heritage/building/palace/architecture/palacestructure/towers-of-parliament/
 * https://ticket.tokyotower.co.jp/en/
 * https://www.incredibleindia.gov.in/en/maharashtra/mumbai/the-gateway-of-india
 * https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html
 * https://www.cnssce.org/50/201308/1220.html
 * https://english.beijing.gov.cn/specials/parktours/guidevisitors/templeofheaven/mustsee/202301/t20230112_2897330.html
 * https://whc.unesco.org/en/list/881
 */
class ModelBuilder {
  private batches = new Map<string, THREE.BufferGeometry[]>();

  constructor(private finishes: Record<string, Finish>) {}

  add(geometry: THREE.BufferGeometry, finish: string, position: Point = [0, 0, 0], rotation?: Point) {
    if (rotation) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    geometry.translate(...position);
    // Extruded arches and the primitive geometries must share an attribute layout.
    if (geometry.index) {
      const expanded = geometry.toNonIndexed();
      geometry.dispose();
      geometry = expanded;
    }
    const batch = this.batches.get(finish) ?? [];
    batch.push(geometry);
    this.batches.set(finish, batch);
  }

  box(position: Point, size: Point, finish: string, rotation?: Point) {
    this.add(new THREE.BoxGeometry(...size), finish, position, rotation);
  }

  cylinder(position: Point, top: number, bottom: number, height: number, finish: string, sides = 28) {
    this.add(new THREE.CylinderGeometry(top, bottom, height, sides), finish, position);
  }

  sphere(position: Point, radius: number, finish: string, scale: Point = [1, 1, 1]) {
    const geometry = new THREE.SphereGeometry(radius, 40, 24);
    geometry.scale(...scale);
    this.add(geometry, finish, position);
  }

  beam(from: Point, to: Point, diameter: number, finish: string) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, direction.length(), 10);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()));
    this.add(geometry, finish, a.add(b).multiplyScalar(0.5).toArray() as Point);
  }

  torus(position: Point, radius: number, tube: number, finish: string, rotation: Point = [Math.PI / 2, 0, 0]) {
    this.add(new THREE.TorusGeometry(radius, tube, 10, 44), finish, position, rotation);
  }

  squareRing(y: number, width: number, depth: number, thickness: number, finish: string) {
    this.box([0, y, -width / 2], [width, thickness, depth], finish);
    this.box([0, y, width / 2], [width, thickness, depth], finish);
    this.box([-width / 2, y, 0], [depth, thickness, width], finish);
    this.box([width / 2, y, 0], [depth, thickness, width], finish);
  }

  finish(): ModelPart[] {
    return Array.from(this.batches, ([name, geometries]) => {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((part) => part.dispose());
      if (!geometry) throw new Error(`Could not merge landmark geometry: ${name}`);
      // Trim the rounded ends of inclined foot members to the ground datum.
      const vertices = geometry.getAttribute("position");
      for (let index = 0; index < vertices.count; index += 1) {
        if (vertices.getY(index) < 0) vertices.setY(index, 0);
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return { geometry, ...this.finishes[name] };
    });
  }
}

// A through-opening, rather than a dark rectangle painted on a solid building.
function archWall(width: number, height: number, depth: number, opening: number, spring: number, rise: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height);
  shape.lineTo(width / 2, height);
  shape.lineTo(width / 2, 0);
  shape.lineTo(opening / 2, 0);
  shape.lineTo(opening / 2, spring);
  shape.bezierCurveTo(opening / 2, spring + rise * 0.56, opening * 0.23, spring + rise * 0.87, 0, spring + rise);
  shape.bezierCurveTo(-opening * 0.23, spring + rise * 0.87, -opening / 2, spring + rise * 0.56, -opening / 2, spring);
  shape.lineTo(-opening / 2, 0);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, -depth / 2);
}

// Rectangular hip-roof frustum: a square pyramid trunk stretched along depth.
// The top face shrinks by `topScale` and keeps the base's width/depth ratio.
function rectFrustum(baseW: number, baseD: number, topScale: number, height: number) {
  const geometry = new THREE.CylinderGeometry(baseW * Math.SQRT1_2 * topScale, baseW * Math.SQRT1_2, height, 4);
  geometry.rotateY(Math.PI / 4);
  geometry.scale(1, 1, baseD / baseW);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

type TowerLevel = { y: number; half: number };

function latticeTower(builder: ModelBuilder, levels: TowerLevel[], finishAt: (height: number) => string, thickness: number) {
  for (let index = 0; index < levels.length - 1; index += 1) {
    const lower = levels[index];
    const upper = levels[index + 1];
    const material = finishAt((lower.y + upper.y) / 2);
    const beamSize = Math.max(0.45, thickness * (0.3 + lower.half / levels[0].half * 0.7));
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        builder.beam([x * lower.half, lower.y, z * lower.half], [x * upper.half, upper.y, z * upper.half], beamSize * 1.8, material);
      }
    }
    // X-bracing on all four faces retains real open steelwork at every angle.
    for (const side of [-1, 1]) {
      builder.beam([-lower.half, lower.y, side * lower.half], [upper.half, upper.y, side * upper.half], beamSize, material);
      builder.beam([lower.half, lower.y, side * lower.half], [-upper.half, upper.y, side * upper.half], beamSize, material);
      builder.beam([side * lower.half, lower.y, -lower.half], [side * upper.half, upper.y, upper.half], beamSize, material);
      builder.beam([side * lower.half, lower.y, lower.half], [side * upper.half, upper.y, -upper.half], beamSize, material);
    }
    builder.squareRing(upper.y, upper.half * 2, beamSize, beamSize, material);
  }
}

function eiffel() {
  const b = new ModelBuilder({
    iron: { color: "#8f7963", metalness: 0.45, roughness: 0.65 },
    edge: { color: "#baa386", metalness: 0.35, roughness: 0.58 },
    glass: { color: "#42616b", metalness: 0.35, roughness: 0.28 },
    stone: { color: "#c1b7a0", roughness: 0.95 },
  });
  // Four separated splayed legs leave the monumental arches genuinely open.
  const legLevels = [
    { y: 0, center: 50, half: 12.5 },
    { y: 18, center: 43.5, half: 10 },
    { y: 38, center: 35.5, half: 7.8 },
    { y: 57, center: 29, half: 6 },
    { y: 78, center: 23.7, half: 4.5 },
    { y: 98, center: 19.3, half: 3.2 },
    { y: 115, center: 16, half: 2.5 },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box([sx * 50, 1, sz * 50], [25, 2, 25], "stone");
    for (let i = 0; i < legLevels.length - 1; i += 1) {
      const a = legLevels[i], c = legLevels[i + 1];
      const corners = (level: typeof a): Point[] => [
        [sx * level.center - level.half, level.y, sz * level.center - level.half],
        [sx * level.center + level.half, level.y, sz * level.center - level.half],
        [sx * level.center + level.half, level.y, sz * level.center + level.half],
        [sx * level.center - level.half, level.y, sz * level.center + level.half],
      ];
      const lower = corners(a), upper = corners(c);
      for (let face = 0; face < 4; face += 1) {
        const next = (face + 1) % 4;
        b.beam(lower[face], upper[face], i < 3 ? 2.3 : 1.5, "iron");
        b.beam(lower[face], upper[next], i < 3 ? 0.95 : 0.65, "iron");
        b.beam(lower[next], upper[face], i < 3 ? 0.95 : 0.65, "iron");
        b.beam(upper[face], upper[next], 1.1, "edge");
      }
    }
  }
  // Four curved decorative arches between the lower legs.
  for (const axis of [0, 1]) for (const side of [-1, 1]) {
    for (let i = 0; i < 24; i += 1) {
      const point = (step: number): Point => {
        const x = -43 + 86 * step / 24;
        const y = 9 + 39 * Math.sqrt(Math.max(0, 1 - (x / 43) ** 2));
        return axis === 0 ? [x, y, side * 35] : [side * 35, y, x];
      };
      b.beam(point(i), point(i + 1), 2, "edge");
    }
  }
  b.squareRing(57, 69, 10, 4, "iron");
  b.squareRing(61, 69, 0.8, 1, "edge");
  b.squareRing(115, 40, 7, 3.5, "iron");
  b.squareRing(119, 40, 0.65, 1, "edge");
  const levels: TowerLevel[] = [];
  for (let y = 119; y <= 263; y += 12) {
    const t = (y - 119) / (276 - 119);
    levels.push({ y, half: 16 * (1 - t) ** 1.6 + 3.8 * t });
  }
  levels.push({ y: 276, half: 3.8 }, { y: 291, half: 2.8 }, { y: 300, half: 1.6 });
  latticeTower(b, levels, () => "iron", 1);
  b.box([0, 275, 0], [16, 5, 16], "glass");
  b.squareRing(272, 17, 2, 1.5, "edge");
  b.squareRing(279, 17, 1.5, 1.5, "edge");
  b.cylinder([0, 301.5, 0], 2.2, 3.5, 7, "iron");
  b.cylinder([0, 313, 0], 0.8, 1.6, 20, "edge");
  b.cylinder([0, 326.5, 0], 0.3, 0.8, 7, "iron");
  return b.finish();
}

function tokyoTower() {
  const b = new ModelBuilder({
    orange: { color: "#d9653f", metalness: 0.25, roughness: 0.64 },
    white: { color: "#e7e6d9", metalness: 0.18, roughness: 0.62 },
    glass: { color: "#325366", metalness: 0.36, roughness: 0.27 },
    base: { color: "#b8b9ae", roughness: 0.85 },
  });
  const tint = (y: number) => y < 175 ? "orange" : Math.floor((y - 175) / 22) % 2 ? "orange" : "white";
  b.box([0, 9, 0], [66, 18, 52], "base");
  b.box([0, 18.8, 0], [70, 1.6, 56], "white");
  const levels = [
    { y: 0, half: 44 }, { y: 25, half: 37 }, { y: 50, half: 30 }, { y: 75, half: 24 },
    { y: 100, half: 19 }, { y: 125, half: 15.5 }, { y: 145, half: 12.8 },
    { y: 162, half: 11.2 }, { y: 179, half: 10 }, { y: 197, half: 8.7 },
    { y: 215, half: 7.2 }, { y: 233, half: 5.9 }, { y: 250, half: 4.5 },
    { y: 267, half: 3.6 }, { y: 283, half: 2.4 },
  ];
  // Keep the lowest four portals open: bracing starts above the broad feet.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.beam([sx * 44, 0, sz * 44], [sx * 30, 50, sz * 30], 4, "orange");
    b.beam([sx * 39, 0, sz * 39], [sx * 27, 50, sz * 27], 2.7, "orange");
    for (let y = 8; y < 49; y += 8) {
      const half = 44 - y * 0.28;
      b.beam([sx * half, y, sz * half], [sx * (half - 4), y + 6, sz * (half - 4)], 1.5, "orange");
    }
  }
  latticeTower(b, levels.slice(2), tint, 1.5);
  // The broad rectangular double-height main deck is the key Tokyo silhouette.
  b.box([0, 150, 0], [37, 14, 37], "orange");
  for (const side of [-1, 1]) {
    b.box([0, 151, side * 18.6], [34, 7, 0.3], "glass");
    b.box([side * 18.6, 151, 0], [0.3, 7, 34], "glass");
    for (let i = -15; i <= 15; i += 3) {
      b.box([i, 151, side * 18.9], [0.45, 7.6, 0.4], "white");
      b.box([side * 18.9, 151, i], [0.4, 7.6, 0.45], "white");
    }
  }
  b.squareRing(143, 39, 2.5, 2, "white");
  b.squareRing(158, 38, 2, 2, "white");
  b.cylinder([0, 249.5, 0], 8.5, 9.5, 9, "white", 12);
  b.cylinder([0, 250, 0], 9.6, 9.6, 4, "glass", 12);
  b.cylinder([0, 255, 0], 6, 9.6, 3, "white", 12);
  for (let y = 283; y < 325; y += 7) {
    b.cylinder([0, y + 3.5, 0], 1.6 - (y - 283) * 0.026, 1.8 - (y - 283) * 0.026, 7, tint(y), 16);
    b.torus([0, y, 0], 2.2 - (y - 283) * 0.025, 0.22, "orange");
  }
  b.cylinder([0, 329, 0], 0.3, 0.8, 8, "white", 12);
  return b.finish();
}

function orientalPearl() {
  const b = new ModelBuilder({
    concrete: { color: "#bcbfc4", metalness: 0.12, roughness: 0.75 },
    pearl: { color: "#ba617a", metalness: 0.38, roughness: 0.38 },
    glass: { color: "#304d64", metalness: 0.5, roughness: 0.28 },
    silver: { color: "#d6dadd", metalness: 0.58, roughness: 0.38 },
  });
  b.cylinder([0, 2, 0], 38, 42, 4, "concrete", 48);
  for (let i = 0; i < 3; i += 1) {
    const a = Math.PI * 2 * i / 3;
    const at = (radius: number, y: number): Point => [Math.cos(a) * radius, y, Math.sin(a) * radius];
    b.beam(at(10, 0), at(10, 286), 9, "concrete");
    b.beam(at(49, 0), at(10, 68), 7, "concrete");
    b.sphere(at(35, 13), 8, "pearl");
    b.torus(at(35, 13), 8.05, 0.4, "silver");
  }
  const pearl = (y: number, radius: number) => {
    b.sphere([0, y, 0], radius, "pearl");
    // Equatorial glazed galleries and thin structural ribs retain the sphere.
    for (const offset of [-0.16, 0.16]) {
      b.cylinder([0, y + radius * offset, 0], radius * 0.992, radius * 0.992, radius * 0.10, "glass", 48);
      b.torus([0, y + radius * offset, 0], radius * 0.993, 0.32, "silver");
    }
    for (let j = 0; j < 12; j += 1) {
      const angle = j * Math.PI / 12;
      b.torus([0, y, 0], radius + 0.15, 0.18, "silver", [0, angle, 0]);
    }
  };
  pearl(93, 25);
  pearl(263.5, 22.5);
  for (const y of [145, 167, 189, 211, 233]) pearl(y, 6);
  b.cylinder([0, 317, 0], 3.5, 5.5, 66, "concrete");
  pearl(350, 7);
  b.cylinder([0, 382, 0], 2.6, 4.2, 56, "silver");
  b.cylinder([0, 429, 0], 1.25, 2.6, 38, "silver");
  b.cylinder([0, 458, 0], 0.35, 1.25, 20, "silver");
  for (const y of [367, 378, 389, 400, 414, 425, 436]) {
    b.torus([0, y, 0], y < 410 ? 4.5 : 3, 0.4, "pearl");
  }
  return b.finish();
}

function elizabethTower() {
  const b = new ModelBuilder({
    stone: { color: "#c2ad7f", roughness: 0.85 },
    edge: { color: "#dfc99a", roughness: 0.72 },
    roof: { color: "#536264", metalness: 0.32, roughness: 0.58 },
    dark: { color: "#243b4f", metalness: 0.22, roughness: 0.55 },
    dial: { color: "#f0ebd9", roughness: 0.6 },
    gold: { color: "#c8a557", metalness: 0.62, roughness: 0.38 },
  });
  b.box([0, 27.5, 0], [12, 55, 12], "stone");
  b.box([0, 61, 0], [12.8, 12, 12.8], "stone");
  b.box([0, 72, 0], [11.4, 10, 11.4], "stone");
  for (const y of [2, 7, 17, 27, 37, 47, 55, 67, 77]) b.squareRing(y, y >= 55 ? 13 : 12.4, 0.6, 0.75, "edge");
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    b.box([x * 5.7, 37.5, z * 5.7], [1.5, 75, 1.5], "edge");
    b.cylinder([x * 5.7, 79, z * 5.7], 0, 1.1, 7, "stone", 8);
    b.cylinder([x * 5.7, 83, z * 5.7], 0, 0.35, 2, "gold", 12);
  }
  // Slender paired Gothic windows, applied on all four facades.
  for (let face = 0; face < 4; face += 1) {
    const angle = face * Math.PI / 2;
    const place = (x: number, y: number, out: number): Point => [Math.cos(angle) * x + Math.sin(angle) * out, y, -Math.sin(angle) * x + Math.cos(angle) * out];
    for (const y of [12, 22, 32, 42, 50, 72]) for (const x of [-2.7, 0, 2.7]) {
      b.box(place(x, y, y === 72 ? 5.76 : 6.06), [1.1, y === 72 ? 5.5 : 4.5, 0.12], "dark", [0, angle, 0]);
      b.add(new THREE.ConeGeometry(0.78, 1.5, 6), "edge", place(x, y + (y === 72 ? 3.5 : 3), y === 72 ? 5.9 : 6.2), [0, angle, 0]);
    }
    const center = place(0, 61, 6.48);
    b.add(new THREE.CircleGeometry(3.5, 64), "dial", center, [0, angle, 0]);
    b.torus(place(0, 61, 6.52), 3.55, 0.18, "gold", [0, angle, 0]);
    b.torus(place(0, 61, 6.54), 2.95, 0.06, "dark", [0, angle, 0]);
    for (let tick = 0; tick < 12; tick += 1) {
      const a = tick * Math.PI / 6;
      const p = place(Math.sin(a) * 3.15, 61 + Math.cos(a) * 3.15, 6.56);
      b.box(p, [0.13, 0.56, 0.1], "dark", [0, angle, -a]);
    }
    b.beam(place(0, 61, 6.63), place(-1.9, 62.05, 6.63), 0.18, "dark");
    b.beam(place(0, 61, 6.65), place(2.25, 62.3, 6.65), 0.12, "dark");
  }
  // Four-sided steep roof, lantern and gilded terminal.
  b.add(new THREE.CylinderGeometry(1.5, 8.5, 12, 4), "roof", [0, 83, 0], [0, Math.PI / 4, 0]);
  for (const side of [-1, 1]) {
    b.beam([side * 6, 77, -6], [0, 91, 0], 0.3, "gold");
    b.beam([side * 6, 77, 6], [0, 91, 0], 0.3, "gold");
  }
  b.cylinder([0, 90.5, 0], 1.6, 1.8, 3, "dark", 12);
  b.cylinder([0, 93, 0], 0.3, 1.8, 2, "roof", 12);
  b.cylinder([0, 95.15, 0], 0.08, 0.24, 2.3, "gold", 12);
  return b.finish();
}

function gatewayIndia() {
  const b = new ModelBuilder({
    stone: { color: "#b29b74", roughness: 0.9 },
    trim: { color: "#d0bc92", roughness: 0.82 },
    shadow: { color: "#665b49", roughness: 0.96 },
  });
  // Broad Indo-Saracenic gateway: a real through arch and four corner turrets.
  b.add(archWall(24, 20.5, 12, 10, 8.6, 7.2), "stone");
  for (const z of [-6.18, 6.18]) {
    b.add(archWall(13.2, 18, 0.45, 10, 8.6, 7.2), "trim", [0, 0, z]);
    b.box([0, 19.2, z], [24.8, 0.8, 0.9], "trim");
    b.box([0, 21, z], [25.4, 1.0, 1], "trim");
    for (let x = -10.8; x <= 10.8; x += 1.2) {
      b.box([x, 22, z], [0.6, 1.1, 0.55], "trim");
    }
    for (const x of [-9.2, 9.2]) {
      b.box([x, 9, z + Math.sign(z) * 0.08], [2.2, 8.8, 0.15], "shadow");
      for (let row = 0; row < 6; row += 1) for (const column of [-0.6, 0, 0.6]) {
        b.box([x + column, 5.3 + row * 1.35, z + Math.sign(z) * 0.2], [0.1, 1.05, 0.18], "trim");
      }
    }
  }
  // Central shallow dome and cornice remain subordinate to the arch frontage.
  b.cylinder([0, 21.7, 0], 6.6, 6.8, 1.5, "stone", 40);
  b.sphere([0, 22.3, 0], 6.7, "stone", [1, 0.43, 1]);
  b.cylinder([0, 25.65, 0], 0.08, 0.42, 0.7, "trim", 12);
  for (const x of [-10.4, 10.4]) for (const z of [-5.2, 5.2]) {
    b.cylinder([x, 10.4, z], 1.6, 2.0, 20.8, "stone", 12);
    for (const y of [1, 7, 15, 20.5, 22.8]) b.cylinder([x, y, z], 2.2, 2.2, 0.55, "trim", 12);
    b.cylinder([x, 21.7, z], 1.4, 1.5, 2.2, "shadow", 12);
    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4;
      b.beam([x + Math.sin(a) * 1.45, 20.7, z + Math.cos(a) * 1.45], [x + Math.sin(a) * 1.45, 22.8, z + Math.cos(a) * 1.45], 0.25, "trim");
    }
    b.sphere([x, 23.1, z], 2.1, "stone", [1, 0.7, 1]);
    b.cylinder([x, 25, z], 0.06, 0.3, 0.9, "trim", 12);
  }
  return b.finish();
}

function templeOfHeaven() {
  const b = new ModelBuilder({
    marble: { color: "#d8d2bd", roughness: 0.92 },
    stoneEdge: { color: "#f1e9d2", roughness: 0.82 },
    vermilion: { color: "#8d2f2b", roughness: 0.78 },
    redLight: { color: "#b44b3b", roughness: 0.8 },
    blue: { color: "#183f70", roughness: 0.72 },
    blueEdge: { color: "#2f6b9b", roughness: 0.7 },
    gold: { color: "#d8af61", metalness: 0.38, roughness: 0.48 },
    shadow: { color: "#402d2c", roughness: 0.95 },
  });
  // Three circular marble terraces and a round, colonnaded hall.
  for (const [radius, y] of [[29, 0.48], [25.5, 1.37], [22, 2.27]]) {
    b.cylinder([0, y, 0], radius, radius + 0.5, 0.96, "marble", 64);
    b.torus([0, y + 0.48, 0], radius - 0.35, 0.19, "stoneEdge");
  }
  b.cylinder([0, 3.07, 0], 15.3, 15.5, 0.62, "stoneEdge", 56);
  b.cylinder([0, 10.55, 0], 12.0, 12.4, 14.4, "vermilion", 56);
  b.cylinder([0, 10.55, 0], 11.6, 11.65, 11.5, "shadow", 56);
  for (let i = 0; i < 24; i += 1) {
    const a = i * Math.PI * 2 / 24;
    const x = Math.sin(a) * 13.25;
    const z = Math.cos(a) * 13.25;
    b.cylinder([x, 10.65, z], 0.58, 0.66, 14.5, i % 3 === 0 ? "redLight" : "vermilion", 12);
    b.cylinder([x, 18.05, z], 0.9, 0.7, 0.7, "gold", 12);
  }
  // Broad blue eaves, then two progressively smaller blue roof tiers.
  for (const [baseY, bottom, top, height] of [[18.6, 17.2, 9.8, 5.0], [25.0, 12.5, 6.5, 4.8], [31.1, 8.3, 0.55, 5.7]]) {
    // Concave swept profile: eaves flare wide low down, the ridge climbs steeply.
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      profile.push(new THREE.Vector2(top + (bottom - top) * (1 - t) ** 1.6, baseY + height * t));
    }
    b.add(new THREE.LatheGeometry(profile, 64), "blue");
    b.cylinder([0, baseY + 0.12, 0], bottom + 0.5, bottom + 0.6, 0.4, "blueEdge", 64);
    b.torus([0, baseY + 0.2, 0], bottom + 0.45, 0.18, "gold");
    b.torus([0, baseY + 0.53, 0], bottom - 0.2, 0.13, "blueEdge");
  }
  for (const [y, radius] of [[24.15, 7.8], [30.3, 4.75]]) {
    b.cylinder([0, y, 0], radius, radius, 1.3, "vermilion", 56);
    b.torus([0, y + 0.64, 0], radius, 0.12, "gold");
  }
  b.cylinder([0, 37.4, 0], 0.6, 0.9, 1.25, "gold", 24);
  b.sphere([0, 38.1, 0], 0.52, "gold");
  return b.finish();
}

// Stylised Forbidden City compound: vermilion perimeter walls with gilded caps,
// corner watch pavilions, a south gatehouse with a real through arch, and the
// Hall of Supreme Harmony on a three-tier marble terrace with yellow-glazed
// double eaves. The real 961m x 693m complex is compressed into one legible
// block; the hall keeps roughly its published height. The gate faces the
// miniature's south, along Beijing's central axis.
// Reference: https://whc.unesco.org/en/list/439 / https://www.dpm.org.cn
function hallOfSupremeHarmony() {
  const b = new ModelBuilder({
    marble: { color: "#d8d2bd", roughness: 0.92 },
    stoneEdge: { color: "#f1e9d2", roughness: 0.82 },
    vermilion: { color: "#8d2f2b", roughness: 0.78 },
    redLight: { color: "#b44b3b", roughness: 0.8 },
    wall: { color: "#7e2a26", roughness: 0.85 },
    roof: { color: "#c9a24b", metalness: 0.24, roughness: 0.55 },
    gold: { color: "#d8af61", metalness: 0.38, roughness: 0.48 },
    shadow: { color: "#402d2c", roughness: 0.95 },
  });

  const W = 150, D = 100, WALL_H = 9, T = 3.2;
  // Perimeter wall with gilded capping tiles.
  for (const z of [-D / 2, D / 2]) {
    b.box([0, WALL_H / 2, z], [W, WALL_H, T], "wall");
    b.box([0, WALL_H + 0.4, z], [W + 1.4, 0.8, T + 1.2], "gold");
  }
  for (const x of [-W / 2, W / 2]) {
    b.box([x, WALL_H / 2, 0], [T, WALL_H, D - T * 2], "wall");
    b.box([x, WALL_H + 0.4, 0], [T + 1.2, 0.8, D - T * 2 + 1.4], "gold");
  }
  // Corner watch pavilions with small hip roofs.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 6), z = sz * (D / 2 - 6);
    b.box([x, 6.5, z], [10, 13, 10], "vermilion");
    b.add(rectFrustum(13, 13, 0.45, 4.5), "roof", [x, 13, z]);
    b.cylinder([x, 15.8, z], 0.25, 0.6, 1.4, "gold", 12);
  }
  // South gatehouse with a through arch and a small hip roof.
  b.add(archWall(38, 15, 14, 12, 8, 5.5), "wall", [0, 0, D / 2 - 7]);
  b.add(rectFrustum(42, 17, 0.5, 4.2), "roof", [0, 15, D / 2 - 7]);
  b.box([0, 19.6, D / 2 - 7], [11, 1, 2], "gold");

  // Three-tier marble terrace with balustrade rings.
  const tiers: [number, number, number][] = [[64, 38, 2.3], [56, 32, 2.1], [48, 26, 1.9]];
  const hallZ = -14;
  let ty = 0;
  for (const [w, d, h] of tiers) {
    b.box([0, ty + h / 2, hallZ], [w, h, d], "marble");
    b.box([0, ty + h + 0.35, hallZ - d / 2 + 0.4], [w - 0.4, 0.7, 0.5], "stoneEdge");
    b.box([0, ty + h + 0.35, hallZ + d / 2 - 0.4], [w - 0.4, 0.7, 0.5], "stoneEdge");
    b.box([-w / 2 + 0.4, ty + h + 0.35, hallZ], [0.5, 0.7, d - 0.8], "stoneEdge");
    b.box([w / 2 - 0.4, ty + h + 0.35, hallZ], [0.5, 0.7, d - 0.8], "stoneEdge");
    ty += h;
  }
  // Hall body with a column rhythm on the long facades.
  b.box([0, ty + 5, hallZ], [44, 10, 26], "vermilion");
  for (const side of [-1, 1]) {
    for (let i = -4; i <= 4; i += 1) {
      b.box([i * 4.8, ty + 5, hallZ + side * 13.1], [1.1, 9, 0.5], i % 2 ? "redLight" : "shadow");
    }
    b.box([side * 22.1, ty + 5, hallZ], [0.5, 9, 24], "shadow");
  }
  // Double-eave roof: broad lower skirt, clerestory, then the main hip roof.
  b.add(rectFrustum(58, 40, 0.68, 3.4), "roof", [0, ty + 10, hallZ]);
  b.box([0, ty + 10 + 3.4 + 2, hallZ], [33, 4, 19], "vermilion");
  const ridgeY = ty + 10 + 3.4 + 4 + 5.6;
  b.add(rectFrustum(38, 24, 0.28, 5.6), "roof", [0, ty + 10 + 3.4 + 4, hallZ]);
  b.box([0, ridgeY + 0.4, hallZ], [15, 1, 1.4], "gold");
  for (const sx of [-1, 1]) b.box([sx * 8.4, ridgeY + 0.9, hallZ], [1.6, 1.8, 1.4], "gold");

  // Two flanking side pavilions complete the courtyard composition.
  for (const sx of [-1, 1]) {
    b.box([sx * 54, 3.5, hallZ], [26, 7, 18], "vermilion");
    b.add(rectFrustum(30, 21, 0.5, 3.2), "roof", [sx * 54, 7, hallZ]);
  }
  return b.finish();
}

// Twisted hyperboloid lattice: two crossing column families between waisted rings.
function cantonTower() {
  const b = new ModelBuilder({
    steel: { color: "#c7ccd4", metalness: 0.55, roughness: 0.35 },
    core: { color: "#9aa0a6", metalness: 0.2, roughness: 0.7 },
    mast: { color: "#d6dade", metalness: 0.5, roughness: 0.4 },
  });
  const levels: { y: number; r: number; twist: number }[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const y = i * 454 / 12;
    levels.push({ y, r: 14 + 26 * ((y - 280) / 280) ** 2, twist: (y / 454) * (Math.PI / 4) });
  }
  const at = (r: number, y: number, a: number): Point => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let i = 0; i < levels.length - 1; i += 1) {
    const lo = levels[i], hi = levels[i + 1];
    const diameter = 2.4 - (i / levels.length) * 1.1;
    for (let k = 0; k < 16; k += 1) {
      const a = k * Math.PI / 8;
      b.beam(at(lo.r, lo.y, a + lo.twist), at(hi.r, hi.y, a + hi.twist + Math.PI / 16), diameter, "steel");
      b.beam(at(lo.r, lo.y, a + lo.twist), at(hi.r, hi.y, a + hi.twist - Math.PI / 16), diameter, "steel");
    }
    b.torus([0, lo.y, 0], lo.r + 0.3, 0.9, "steel");
  }
  b.torus([0, 454, 0], levels[levels.length - 1].r + 0.3, 0.9, "steel");
  b.cylinder([0, 225, 0], 6, 7.5, 450, "core");
  b.cylinder([0, 527, 0], 0.7, 2.6, 146, "mast");
  for (const y of [470, 500, 540]) b.torus([0, y, 0], 1.7, 0.28, "mast");
  return b.finish();
}

// Eight flared pagoda-like segments on a mall podium, then the 508 m spire.
function taipei101() {
  const b = new ModelBuilder({
    glass: { color: "#41707c", metalness: 0.45, roughness: 0.3 },
    trim: { color: "#d9d4c2", roughness: 0.7 },
    base: { color: "#b9b3a4", roughness: 0.85 },
    mast: { color: "#cfd4d8", metalness: 0.5, roughness: 0.4 },
  });
  b.box([0, 15, 0], [68, 30, 68], "base");
  b.box([0, 30.6, 0], [70, 1.2, 70], "trim");
  for (let s = 0; s < 8; s += 1) {
    const yb = 31 + s * 42;
    b.add(new THREE.CylinderGeometry(29.7, 24.0, 42, 4), "glass", [0, yb + 21, 0], [0, Math.PI / 4, 0]);
    b.squareRing(yb + 42, 44, 3, 2, "trim");
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      b.box([x * 20.5, yb + 21, z * 20.5], [1.6, 42, 1.6], "trim");
    }
  }
  b.add(new THREE.CylinderGeometry(20, 25, 24, 4), "glass", [0, 379, 0], [0, Math.PI / 4, 0]);
  b.squareRing(391, 32, 2.5, 2, "trim");
  b.cylinder([0, 449, 0], 0.9, 2.4, 118, "mast");
  for (const y of [402, 424, 446]) b.torus([0, y, 0], 1.6, 0.3, "mast");
  return b.finish();
}

// Stepped crystal quadrants with the signature facade X-bracing.
function bankOfChinaTower() {
  const b = new ModelBuilder({
    glass: { color: "#6f8a99", metalness: 0.5, roughness: 0.28 },
    brace: { color: "#e2e6e8", metalness: 0.3, roughness: 0.45 },
    mast: { color: "#d4d8db", metalness: 0.5, roughness: 0.4 },
  });
  b.box([0, 3, 0], [62, 6, 62], "brace");
  b.box([0, 111, 0], [52, 216, 52], "glass");
  b.box([-13, 260.5, 13], [26, 89, 26], "glass");
  b.box([13, 242, 13], [26, 52, 26], "glass");
  b.box([-13, 228, -13], [26, 24, 26], "glass");
  const tilt = Math.atan2(52, 216);
  for (const side of [-1, 1]) {
    b.box([0, 111, side * 26.4], [1.2, 224, 1.2], "brace", [0, 0, tilt]);
    b.box([0, 111, side * 26.4], [1.2, 224, 1.2], "brace", [0, 0, -tilt]);
    b.box([side * 26.4, 111, 0], [1.2, 224, 1.2], "brace", [tilt, 0, 0]);
    b.box([side * 26.4, 111, 0], [1.2, 224, 1.2], "brace", [-tilt, 0, 0]);
  }
  b.squareRing(111, 53.5, 2, 1.6, "brace");
  b.squareRing(216, 53.5, 2.4, 1.8, "brace");
  for (const x of [-1, 1]) for (const z of [-1, 1]) b.box([x * 26, 111, z * 26], [1.8, 216, 1.8], "brace");
  b.cylinder([-13, 336, 13], 0.5, 1.6, 62, "mast");
  b.cylinder([13, 283, 13], 0.4, 1.1, 30, "mast");
  return b.finish();
}

// Tripod legs, concrete shaft and stacked observation pods of Chengdu 339.
function westPearlTower() {
  const b = new ModelBuilder({
    concrete: { color: "#b8bcc0", roughness: 0.8 },
    pod: { color: "#8fa3ad", metalness: 0.35, roughness: 0.35 },
    glass: { color: "#375462", metalness: 0.4, roughness: 0.3 },
    mast: { color: "#d2d6d9", metalness: 0.5, roughness: 0.4 },
  });
  for (let i = 0; i < 3; i += 1) {
    const a = i * Math.PI * 2 / 3;
    b.beam([Math.cos(a) * 26, 0, Math.sin(a) * 26], [Math.cos(a) * 8, 70, Math.sin(a) * 8], 6, "concrete");
  }
  b.cylinder([0, 120, 0], 5.5, 9, 150, "concrete");
  b.cylinder([0, 200, 0], 13, 11, 10, "pod");
  b.cylinder([0, 210, 0], 14, 14, 10, "glass");
  b.cylinder([0, 220, 0], 11, 14, 10, "pod");
  b.cylinder([0, 228, 0], 6, 11, 6, "pod");
  b.cylinder([0, 240, 0], 3.5, 5, 18, "concrete");
  b.cylinder([0, 289, 0], 0.6, 2.2, 90, "mast");
  b.cylinder([0, 336, 0], 0.25, 0.6, 6, "mast");
  for (const y of [260, 280, 300]) b.torus([0, y, 0], 1.4, 0.25, "mast");
  return b.finish();
}

// Seven tapering brick storeys with cornices, on a two-step stone platform.
function wildGoosePagoda() {
  const b = new ModelBuilder({
    brick: { color: "#9a8a70", roughness: 0.85 },
    eave: { color: "#6a5a48", roughness: 0.8 },
    dark: { color: "#37302b", roughness: 0.9 },
    stone: { color: "#c8c1ac", roughness: 0.9 },
    gold: { color: "#b08d4f", metalness: 0.5, roughness: 0.45 },
  });
  b.box([0, 1.2, 0], [64, 2.4, 64], "stone");
  b.box([0, 3.2, 0], [52, 1.6, 52], "stone");
  const halves = [20, 18.3, 16.8, 15.4, 14.1, 12.9, 11.8];
  const heights = [9, 8.2, 7.6, 7.1, 6.7, 6.3, 6.0];
  let y = 4;
  for (let s = 0; s < 7; s += 1) {
    const w = halves[s], h = heights[s];
    b.box([0, y + h / 2, 0], [w * 2, h, w * 2], "brick");
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box([x * w, y + h / 2, z * w], [1.4, h, 1.4], "eave");
    for (const side of [-1, 1]) {
      b.box([0, y + h * 0.42, side * (w + 0.15)], [3.2, h * 0.55, 0.5], "dark");
      b.box([side * (w + 0.15), y + h * 0.42, 0], [0.5, h * 0.55, 3.2], "dark");
    }
    y += h;
    b.box([0, y + 0.6, 0], [w * 2 + 3, 1.2, w * 2 + 3], "eave");
    y += 1.2;
  }
  b.cylinder([0, y + 1.1, 0], 0.5, 1.6, 2.2, "gold");
  b.sphere([0, y + 2.5, 0], 0.7, "gold");
  return b.finish();
}

const builders: Record<LandmarkKind, () => ModelPart[]> = {
  eiffel,
  "oriental-pearl": orientalPearl,
  "elizabeth-tower": elizabethTower,
  "gateway-india": gatewayIndia,
  "tokyo-tower": tokyoTower,
  "temple-of-heaven": templeOfHeaven,
  "hall-of-supreme-harmony": hallOfSupremeHarmony,
  "canton-tower": cantonTower,
  "taipei-101": taipei101,
  "bank-of-china-tower": bankOfChinaTower,
  "west-pearl-tower": westPearlTower,
  "wild-goose-pagoda": wildGoosePagoda,
};

export function LandmarkModel({ kind }: { kind: LandmarkKind }) {
  // Every color is one merged mesh: 3–6 draw calls, including all repeated braces.
  const parts = useMemo(() => builders[kind](), [kind]);
  useEffect(() => () => parts.forEach(({ geometry }) => geometry.dispose()), [parts]);
  return (
    <group userData={{ landmark: kind, units: "meters" }}>
      {parts.map(({ geometry, color, metalness = 0, roughness = 0.8 }, index) => (
        <mesh key={`${kind}-${index}`} geometry={geometry}>
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} emissive={color} emissiveIntensity={0.06} />
        </mesh>
      ))}
    </group>
  );
}
