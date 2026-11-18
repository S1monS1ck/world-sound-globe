"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import type { City } from "@/lib/cities";
import { getCitySignature, getCityVisualAnchor, type SignatureKind } from "@/lib/city-signatures";
import { EARTH_RADIUS, cityVector, tangentBasis } from "@/lib/globe";

type Finish = "stone" | "pale" | "ivory" | "shadow" | "roof" | "road" | "accent" | "gold" | "red";
type Part = { finish: Finish; geometry: THREE.BufferGeometry };
const DISPLAY_SCALE = 0.00011;
const COASTAL_CITIES = new Set(["hong-kong", "singapore", "sydney", "rio", "auckland", "busan", "manila", "jakarta", "lima", "lisbon", "lagos", "dakar", "cape-town", "havana", "san-juan", "kingston", "beirut", "naples", "melbourne", "barcelona"]);

// These are deliberately interpretive city sketches, not mapped landmark models.
// Their small footprint has no terrain plate, avoiding cut-out discs and sea overlap.
class SketchBuilder {
  private batches = new Map<Finish, THREE.BufferGeometry[]>();

  add(geometry: THREE.BufferGeometry, finish: Finish, x = 0, y = 0, z = 0, ry = 0) {
    if (ry) geometry.rotateY(ry);
    geometry.translate(x, y, z);
    if (geometry.index) {
      const nonIndexed = geometry.toNonIndexed();
      geometry.dispose();
      geometry = nonIndexed;
    }
    const batch = this.batches.get(finish) ?? [];
    batch.push(geometry);
    this.batches.set(finish, batch);
  }

  box(x: number, y: number, z: number, width: number, height: number, depth: number, finish: Finish, ry = 0) {
    this.add(new THREE.BoxGeometry(width, height, depth), finish, x, y, z, ry);
  }

  cylinder(x: number, y: number, z: number, top: number, bottom: number, height: number, finish: Finish, sides = 16) {
    this.add(new THREE.CylinderGeometry(top, bottom, height, sides), finish, x, y, z);
  }

  sphere(x: number, y: number, z: number, radius: number, finish: Finish, heightScale = 1) {
    const geometry = new THREE.SphereGeometry(radius, 20, 12);
    geometry.scale(1, heightScale, 1);
    this.add(geometry, finish, x, y, z);
  }

  beam(from: [number, number, number], to: [number, number, number], width: number, finish: Finish) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(width / 2, width / 2, direction.length(), 6);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    const center = a.add(b).multiplyScalar(0.5);
    this.add(geometry, finish, center.x, center.y, center.z);
  }

  arch(x: number, y: number, z: number, radius: number, width: number, finish: Finish) {
    this.add(new THREE.TorusGeometry(radius, width / 2, 6, 24, Math.PI), finish, x, y, z);
  }

  hollowCylinder(x: number, y: number, z: number, outer: number, inner: number, height: number, finish: Finish) {
    const outline = new THREE.Shape();
    outline.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const courtyard = new THREE.Path();
    courtyard.absarc(0, 0, inner, 0, Math.PI * 2, true);
    outline.holes.push(courtyard);
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 24 });
    geometry.rotateX(-Math.PI / 2);
    this.add(geometry, finish, x, y, z);
  }

  sail(x: number, z: number, width: number, height: number, depth: number, finish: Finish, flip = false) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.bezierCurveTo(-width * 0.25, height * 0.24, width * 0.26, height * 0.9, width * 0.46, height);
    shape.bezierCurveTo(width * 0.43, height * 0.47, width * 0.23, height * 0.12, width / 2, 0);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 1, curveSegments: 6 });
    if (flip) geometry.scale(-1, 1, 1);
    this.add(geometry, finish, x, 0, z - depth / 2);
  }

  gable(x: number, y: number, z: number, width: number, height: number, depth: number, finish: Finish) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, height);
    shape.lineTo(width / 2, 0);
    shape.closePath();
    this.add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), finish, x, y, z - depth / 2);
  }

  pyramidRoof(x: number, y: number, z: number, width: number, height: number, finish: Finish) {
    this.add(new THREE.CylinderGeometry(0, width * 0.71, height, 4), finish, x, y + height / 2, z, Math.PI / 4);
  }

  finish(): Part[] {
    return Array.from(this.batches, ([finish, geometries]) => {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((part) => part.dispose());
      if (!geometry) throw new Error(`Cannot merge ${finish} city sketch`);
      geometry.computeBoundingSphere();
      return { finish, geometry };
    });
  }
}

function signatureModel(builder: SketchBuilder, kind: SignatureKind) {
  switch (kind) {
    case "rizal": {
      builder.box(0, 6, 0, 132, 12, 92, "stone");
      builder.box(0, 19, 0, 84, 14, 59, "pale");
      builder.box(0, 47, 0, 40, 42, 37, "stone");
      builder.cylinder(0, 122, 0, 2, 18, 150, "pale", 4);
      builder.box(0, 71, 22, 31, 38, 5, "shadow");
      builder.sphere(0, 87, 25, 7, "gold");
      break;
    }
    case "saigoncathedral": {
      builder.box(0, 40, 0, 148, 80, 74, "red");
      builder.gable(0, 80, 0, 150, 30, 80, "roof");
      for (const x of [-57, 57]) {
        builder.box(x, 95, 27, 37, 145, 38, "red");
        builder.box(x, 168, 27, 41, 8, 42, "ivory");
        builder.pyramidRoof(x, 172, 27, 41, 55, "roof");
        builder.cylinder(x, 233, 27, .5, 1.5, 13, "gold", 8);
        for (const y of [50, 90, 135]) builder.box(x, y, 47, 9, 20, 2, "shadow");
      }
      builder.arch(0, 32, 38, 18, 5, "ivory");
      builder.box(0, 22, 39, 28, 40, 2, "shadow");
      break;
    }
    case "victoriamemorial": {
      builder.box(0, 7, 0, 235, 14, 116, "stone");
      builder.box(0, 43, 0, 215, 72, 100, "ivory");
      for (const x of [-82, -62, -42, -22, 22, 42, 62, 82]) builder.cylinder(x, 41, 52, 4, 5, 60, "pale", 10);
      builder.box(0, 82, 0, 220, 7, 105, "pale");
      builder.cylinder(0, 99, 0, 41, 43, 28, "ivory", 24);
      builder.sphere(0, 113, 0, 42, "pale", .7);
      // The bronze Angel of Victory crowns the dome instead of a plain finial.
      builder.cylinder(0, 145, 0, 2.5, 5, 12, "pale", 10);
      builder.sphere(0, 156, 0, 3, "gold");
      builder.beam([-2, 154, 0], [-10, 162, 0], 1.6, "gold");
      builder.beam([2, 154, 0], [10, 162, 0], 1.6, "gold");
      for (const x of [-95, 95]) for (const z of [-40, 40]) {
        builder.cylinder(x, 96, z, 12, 13, 25, "pale", 12);
        builder.sphere(x, 109, z, 13, "ivory", .55);
      }
      break;
    }
    case "beirutmosque": {
      builder.box(0, 6, 0, 174, 12, 135, "stone");
      builder.box(0, 45, 0, 145, 78, 110, "pale");
      builder.cylinder(0, 90, 0, 42, 44, 15, "ivory", 24);
      builder.sphere(0, 98, 0, 43, "accent", .75);
      builder.cylinder(0, 136, 0, 1, 4, 14, "gold", 8);
      for (const x of [-67, 67]) for (const z of [-48, 48]) {
        builder.cylinder(x, 91, z, 4, 8, 180, "ivory", 12);
        builder.cylinder(x, 180, z, 10, 6, 7, "pale", 12);
        builder.cylinder(x, 197, z, 0, 7, 28, "accent", 12);
      }
      break;
    }
    case "rijksmuseum": {
      builder.box(0, 7, 0, 244, 14, 94, "stone");
      builder.box(0, 51, 0, 232, 88, 82, "red");
      for (const x of [-94, -69, -44, -19, 19, 44, 69, 94]) for (const y of [34, 62]) {
        builder.box(x, y, 42, 11, 19, 2, "shadow");
        builder.arch(x, y + 9, 43, 5.5, 2, "ivory");
      }
      for (const x of [-68, 68]) {
        builder.box(x, 105, 0, 35, 44, 50, "pale");
        builder.pyramidRoof(x, 127, 0, 43, 43, "roof");
        builder.cylinder(x, 175, 0, .5, 2, 12, "gold", 8);
      }
      builder.box(0, 42, 42, 30, 62, 2, "shadow");
      builder.arch(0, 71, 43, 15, 5, "ivory");
      break;
    }
    case "cibeles": {
      builder.box(0, 7, 0, 242, 14, 92, "stone");
      builder.box(0, 53, 0, 230, 92, 82, "ivory");
      for (const x of [-95, -75, -55, -35, -15, 15, 35, 55, 75, 95]) for (const y of [31, 52, 73]) builder.box(x, y, 42, 9, 13, 2, "shadow");
      for (const x of [-92, 0, 92]) {
        const tall = x === 0;
        builder.box(x, tall ? 124 : 102, 0, tall ? 42 : 31, tall ? 58 : 35, 42, "pale");
        builder.pyramidRoof(x, tall ? 153 : 120, 0, tall ? 48 : 37, tall ? 36 : 25, "roof");
        builder.cylinder(x, tall ? 195 : 149, 0, .5, 2, 14, "gold", 8);
      }
      break;
    }
    case "stockholmhall": {
      builder.box(0, 6, 0, 222, 12, 108, "stone");
      builder.box(-15, 48, 0, 185, 84, 95, "red");
      for (const x of [-91, -70, -49, -28, -7, 14, 35, 56]) {
        builder.box(x, 46, 49, 10, 20, 2, "shadow");
        builder.arch(x, 56, 50, 5, 2, "pale");
      }
      builder.box(84, 102, -23, 42, 192, 42, "red");
      builder.box(84, 202, -23, 48, 9, 48, "pale");
      builder.pyramidRoof(84, 207, -23, 48, 29, "roof");
      for (const x of [76, 84, 92]) builder.cylinder(x, 242, -23, 2, 3, 10, "gold", 8);
      break;
    }
    case "renaissanceafrica": {
      builder.cylinder(0, 10, 0, 60, 68, 20, "stone", 8);
      builder.box(0, 33, 0, 75, 27, 65, "pale");
      // Three figures, the child held up and the raised arm defining the silhouette.
      for (const [x, y, z, radius] of [[-14, 72, 0, 14], [18, 73, 0, 12], [8, 105, 0, 7]]) builder.sphere(x, y, z, radius, "gold");
      builder.beam([-17, 47, 0], [-14, 66, 0], 23, "gold");
      builder.beam([17, 47, 0], [18, 65, 0], 20, "gold");
      builder.beam([-20, 58, 0], [6, 100, 0], 8, "gold");
      builder.beam([22, 65, 0], [46, 94, 0], 8, "gold");
      builder.beam([46, 94, 0], [70, 112, 0], 6, "gold");
      break;
    }
    case "palaispeuple": {
      builder.box(0, 7, 0, 238, 14, 130, "stone");
      builder.box(0, 47, 0, 205, 80, 100, "pale");
      for (const x of [-92, -70, -48, -26, -4, 18, 40, 62, 84]) builder.box(x, 48, 51, 12, 54, 2, "shadow");
      builder.box(0, 88, 0, 225, 8, 114, "ivory");
      const crown = new THREE.CylinderGeometry(105, 95, 22, 6);
      crown.scale(1, 1, .55);
      builder.add(crown, "roof", 0, 103, 0, Math.PI / 6);
      break;
    }
    case "kicc": {
      builder.cylinder(-25, 100, 0, 29, 34, 200, "stone", 32);
      for (let y = 14; y < 200; y += 12) builder.cylinder(-25, y, 0, 35, 35, 2, "pale", 32);
      builder.cylinder(-25, 205, 0, 38, 32, 12, "ivory", 32);
      builder.cylinder(-25, 225, 0, 1, 4, 30, "gold", 10);
      builder.cylinder(68, 25, 0, 66, 70, 50, "pale", 32);
      builder.cylinder(68, 58, 0, 15, 67, 20, "roof", 32);
      builder.cylinder(68, 73, 0, 1, 15, 10, "gold", 12);
      break;
    }
    case "bobmarley": {
      builder.box(0, 5, 0, 196, 10, 106, "stone");
      builder.box(0, 49, 0, 174, 88, 72, "pale");
      builder.gable(0, 93, 0, 186, 35, 82, "roof");
      for (const x of [-67, -42, -17, 17, 42, 67]) for (const y of [31, 68]) {
        builder.box(x, y, 37, 12, 20, 2, "shadow");
        builder.box(x, y, 38, 2, 20, 1, "ivory");
      }
      builder.box(0, 51, 52, 185, 5, 30, "ivory");
      builder.box(0, 17, 52, 185, 5, 30, "ivory");
      for (const x of [-82, -54, -26, 26, 54, 82]) builder.cylinder(x, 33, 64, 2, 2, 35, "ivory", 8);
      builder.box(0, 25, 38, 20, 40, 2, "roof");
      break;
    }
    case "elmorro": {
      builder.box(0, 6, 0, 235, 12, 142, "stone");
      builder.box(0, 24, -40, 215, 36, 29, "pale");
      builder.box(-98, 24, 8, 22, 36, 95, "pale");
      builder.box(98, 24, 8, 22, 36, 95, "pale");
      builder.box(0, 21, 53, 205, 30, 20, "pale");
      for (const [x,z] of [[-99,-42],[99,-42],[-99,53],[99,53]]) {
        builder.cylinder(x, 49, z, 10, 12, 35, "ivory", 12);
        builder.sphere(x, 69, z, 11, "pale", .7);
      }
      builder.cylinder(0, 52, -26, 12, 16, 54, "ivory", 12);
      builder.cylinder(0, 81, -26, 15, 13, 5, "roof", 12);
      builder.cylinder(0, 93, -26, 2, 13, 20, "pale", 12);
      break;
    }
    case "colpatria": {
      builder.box(0, 6, 0, 104, 12, 72, "stone");
      builder.box(0, 113, 0, 72, 214, 51, "shadow");
      for (const x of [-30, -20, -10, 0, 10, 20, 30]) builder.box(x, 114, 26, 2, 210, 2, "pale");
      for (let y = 21; y < 220; y += 14) builder.box(0, y, 26, 72, 1.5, 2, "stone");
      builder.box(0, 224, 0, 78, 8, 57, "ivory");
      break;
    }
    case "culturepalace": {
      builder.box(0, 6, 0, 204, 12, 86, "stone");
      builder.box(0, 49, 0, 190, 86, 74, "ivory");
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 11; col += 1) {
        if ((row + col) % 2 === 0) builder.box(-85 + col * 17, 17 + row * 17, 38, 16, 16, 2, "shadow");
      }
      builder.box(0, 105, 0, 62, 32, 66, "pale");
      builder.sphere(0, 121, 0, 34, "roof", .7);
      builder.cylinder(0, 151, 0, 1, 5, 17, "gold", 8);
      for (const x of [-78, 78]) {
        builder.box(x, 99, 0, 26, 27, 30, "pale");
        builder.pyramidRoof(x, 112, 0, 31, 23, "roof");
      }
      break;
    }
    case "limacathedral": {
      builder.box(0, 6, 0, 225, 12, 95, "stone");
      builder.box(0, 48, 0, 207, 84, 78, "ivory");
      for (const x of [-83, 83]) {
        builder.box(x, 104, 24, 34, 105, 38, "pale");
        for (const y of [80, 115, 141]) builder.box(x, y, 44, 9, 18, 2, "shadow");
        builder.box(x, 157, 24, 38, 7, 42, "ivory");
        builder.pyramidRoof(x, 161, 24, 37, 32, "roof");
        builder.cylinder(x, 198, 24, .5, 1.5, 12, "gold", 8);
      }
      builder.box(0, 43, 40, 33, 65, 2, "shadow");
      builder.arch(0, 74, 41, 17, 5, "pale");
      break;
    }
    case "grantorre": {
      builder.box(0, 5, 0, 104, 10, 80, "stone");
      builder.box(0, 122, 0, 66, 234, 49, "shadow");
      for (const x of [-26,-16,-6,6,16,26]) builder.box(x, 122, 25, 2, 230, 1.5, "pale");
      for (let y = 20; y < 236; y += 14) builder.box(0, y, 25, 65, 1.2, 1.5, "stone");
      builder.box(0, 242, 0, 70, 6, 53, "ivory");
      break;
    }
    case "biosphere": {
      // The geodesic shell surrounds the smaller exhibition buildings.
      const radius = 85;
      builder.box(0, 42, 0, 98, 84, 70, "shadow");
      builder.box(0, 85, 0, 103, 5, 75, "pale");
      const shell = new THREE.IcosahedronGeometry(radius, 2);
      const edges = new THREE.EdgesGeometry(shell);
      const points = edges.getAttribute("position");
      for (let i = 0; i < points.count; i += 2) {
        const a: [number, number, number] = [points.getX(i), points.getY(i) + radius, points.getZ(i)];
        const b: [number, number, number] = [points.getX(i + 1), points.getY(i + 1) + radius, points.getZ(i + 1)];
        builder.beam(a, b, 1.6, "ivory");
      }
      shell.dispose();
      edges.dispose();
      break;
    }
    case "flinders": {
      builder.box(0, 7, 0, 245, 14, 80, "stone");
      builder.box(0, 44, 0, 235, 74, 68, "gold");
      builder.box(0, 82, 0, 241, 5, 74, "ivory");
      for (const x of [-100, -80, -60, -40, -20, 20, 40, 60, 80, 100]) {
        for (const y of [32, 59]) {
          builder.box(x, y, 35, 10, 15, 2, "shadow");
          builder.arch(x, y + 7, 36, 5, 2, "ivory");
        }
      }
      builder.box(0, 63, 40, 56, 108, 24, "pale");
      builder.arch(0, 33, 53, 17, 5, "ivory");
      builder.box(0, 25, 54, 28, 44, 2, "shadow");
      for (const x of [-16, -8, 0, 8, 16]) builder.add(new THREE.CircleGeometry(2.8, 16), "ivory", x, 69, 53);
      builder.cylinder(0, 125, 37, 27, 31, 20, "pale", 24);
      builder.sphere(0, 137, 37, 29, "roof", 0.68);
      builder.cylinder(0, 160, 37, 1, 4, 12, "gold", 8);
      for (const x of [-107, 107]) {
        builder.box(x, 94, 0, 23, 28, 28, "pale");
        builder.pyramidRoof(x, 108, 0, 30, 21, "roof");
      }
      break;
    }
    case "busantower": {
      builder.cylinder(0, 8, 0, 37, 44, 16, "stone", 24);
      builder.cylinder(0, 94, 0, 8, 14, 172, "pale", 20);
      builder.cylinder(0, 182, 0, 27, 13, 12, "ivory", 24);
      builder.cylinder(0, 193, 0, 29, 27, 12, "shadow", 24);
      builder.cylinder(0, 202, 0, 33, 28, 8, "pale", 24);
      builder.cylinder(0, 210, 0, 8, 30, 9, "roof", 24);
      builder.cylinder(0, 228, 0, 1, 5, 30, "gold", 10);
      break;
    }
    case "manchestertownhall": {
      builder.box(0, 7, 0, 220, 14, 90, "stone");
      builder.box(0, 48, 0, 210, 82, 78, "stone");
      builder.box(0, 90, 0, 216, 5, 84, "pale");
      builder.gable(0, 93, 0, 220, 32, 84, "roof");
      for (const x of [-85, -62, -39, 39, 62, 85]) {
        for (const y of [37, 65]) {
          builder.box(x, y, 40, 11, 18, 2, "shadow");
          builder.gable(x, y + 9, 40, 11, 6, 2, "shadow");
        }
      }
      builder.box(0, 98, 5, 48, 170, 53, "pale");
      builder.box(0, 176, 5, 54, 8, 59, "stone");
      for (const z of [-22, 32]) {
        const clock = new THREE.CircleGeometry(12, 32);
        if (z < 0) clock.rotateY(Math.PI);
        builder.add(clock, "ivory", 0, 152, z);
      }
      builder.pyramidRoof(0, 180, 5, 53, 62, "roof");
      builder.cylinder(0, 250, 5, 0.5, 2, 17, "gold", 8);
      for (const x of [-98, 98]) {
        builder.box(x, 94, 0, 20, 26, 24, "stone");
        builder.pyramidRoof(x, 107, 0, 24, 23, "roof");
      }
      break;
    }
    case "liverbuilding": {
      builder.box(0, 7, 0, 220, 14, 80, "stone");
      builder.box(0, 52, 0, 210, 90, 72, "pale");
      for (const x of [-91, -76, -61, -46, -31, -16, 0, 16, 31, 46, 61, 76, 91]) {
        for (const y of [30, 49, 68, 87]) builder.box(x, y, 37, 7, 12, 2, "shadow");
      }
      builder.box(0, 100, 0, 216, 8, 78, "ivory");
      for (const x of [-73, 73]) {
        builder.box(x, 122, 0, 38, 42, 38, "stone");
        builder.add(new THREE.CircleGeometry(13, 32), "ivory", x, 125, 20);
        builder.cylinder(x, 148, 0, 23, 23, 10, "pale", 24);
        builder.cylinder(x, 159, 0, 18, 21, 15, "roof", 24);
        builder.sphere(x, 167, 0, 18, "roof", 0.45);
        builder.cylinder(x, 177, 0, 1.5, 4, 10, "gold", 8);
        // Restrained bird silhouette at the peak.
        builder.sphere(x, 184, 0, 4, "accent", 0.7);
        builder.beam([x - 7, 183, 0], [x + 7, 187, 0], 2.5, "accent");
        builder.beam([x + 2, 185, 0], [x + 7, 190, 0], 2, "accent");
      }
      break;
    }
    case "independencearch": {
      builder.box(0, 5, 0, 210, 10, 70, "stone");
      for (const x of [-68, 68]) {
        builder.box(x, 57, 0, 29, 104, 48, "pale");
        builder.box(x, 113, 0, 38, 10, 55, "ivory");
      }
      builder.box(0, 121, 0, 175, 16, 50, "pale");
      builder.arch(0, 68, 26, 51, 10, "ivory");
      builder.box(0, 133, 0, 185, 8, 57, "ivory");
      builder.box(0, 148, 0, 44, 22, 38, "pale");
      const starShape = new THREE.Shape();
      for (let point = 0; point < 10; point += 1) {
        const angle = Math.PI / 2 + point * Math.PI / 5;
        const radius = point % 2 ? 7 : 17;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (point === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
      }
      starShape.closePath();
      builder.add(new THREE.ExtrudeGeometry(starShape, { depth: 5, bevelEnabled: false }), "shadow", 0, 174, 0);
      break;
    }
    case "nationaltheatre": {
      // The perimeter terraces belong to the building, with open approaches between them.
      const podium = new THREE.CylinderGeometry(130, 138, 21, 64);
      podium.scale(1, 1, 0.79);
      builder.add(podium, "stone", 0, 10.5);
      for (let sector = 0; sector < 4; sector += 1) {
        const terrace = new THREE.CylinderGeometry(175, 182, 9, 16, 1, false,
          sector * Math.PI / 2 + 0.13, Math.PI / 2 - 0.26);
        terrace.scale(1, 1, 0.79);
        builder.add(terrace, "pale", 0, 4.5);
      }
      const hall = new THREE.CylinderGeometry(104, 107, 48, 48);
      hall.scale(1, 1, 0.77);
      builder.add(hall, "shadow", 0, 45);
      const roofHeight = (x: number, z: number) => 88 + 13 * x * x - 9 * z * z + 13 * z;
      const roof = new ParametricGeometry((u, v, target) => {
        const angle = u * Math.PI * 2;
        const x = Math.cos(angle) * v;
        const z = Math.sin(angle) * v;
        target.set(x * 119, roofHeight(x, z), z * 94);
      }, 48, 12);
      builder.add(roof, "ivory");
      for (let rib = 0; rib < 32; rib += 1) {
        const angle = rib * Math.PI * 2 / 32;
        const x = Math.cos(angle), z = Math.sin(angle);
        builder.beam([x * 118, 20, z * 93], [x * 119, roofHeight(x, z), z * 94], 3, "pale");
        const next = angle + Math.PI / 16;
        builder.beam([x * 119, roofHeight(x, z), z * 94],
          [Math.cos(next) * 119, roofHeight(Math.cos(next), Math.sin(next)), Math.sin(next) * 94], 4, "ivory");
      }
      break;
    }
    case "rencen": {
      // Four lower office towers surround the hotel. Two smaller eastern towers complete the group.
      builder.box(0, 7, 0, 219, 14, 180, "stone");
      const towers = [[0, 0, 245, 32], [-66, -61, 151, 27], [66, -61, 151, 27],
        [-66, 61, 151, 27], [66, 61, 151, 27], [135, -44, 98, 21], [135, 44, 98, 21]];
      for (const [x, z, height, radius] of towers) {
        builder.cylinder(x, height / 2 + 14, z, radius, radius, height, "shadow", 32);
        builder.cylinder(x, height + 15, z, radius + 1, radius + 1, 5, "pale", 32);
        for (let y = 23; y < height + 12; y += 11) builder.cylinder(x, y, z, radius + 0.5, radius + 0.5, 1.2, "stone", 32);
        for (let rib = 0; rib < 16; rib += 1) {
          const angle = rib * Math.PI / 8;
          builder.box(x + Math.cos(angle) * radius, height / 2 + 14, z + Math.sin(angle) * radius,
            1.2, height, 1.2, "pale");
        }
      }
      builder.cylinder(0, 268, 0, 29, 32, 13, "accent", 32);
      break;
    }
    case "batman": {
      builder.box(0, 7, 0, 124, 14, 85, "stone");
      builder.box(0, 104, 0, 86, 194, 57, "shadow");
      for (const side of [-1, 1]) {
        for (const [x, height, z] of [[45, 164, 1], [32, 145, 27], [18, 126, 40]]) {
          builder.box(x * side, height / 2 + 14, z, 20, height, 20, "pale");
          for (const offset of [-5, 5]) builder.box(x * side + offset, height / 2 + 18, z + 10.3, 4, height - 12, 1, "shadow");
        }
        builder.box(side * 42, 215, 0, 7, 80, 57, "ivory");
        builder.box(side * 42, 263, 0, 5, 24, 7, "pale");
        builder.cylinder(side * 42, 287, 0, 0.6, 2.4, 27, "pale", 8);
      }
      for (const x of [-25, -12, 0, 12, 25]) builder.box(x, 110, 29, 1.6, 181, 1, "stone");
      // Inclined glazing rises to the open crown between the two antennae.
      const glassRoof = new THREE.BoxGeometry(78, 3, 63);
      glassRoof.rotateX(-0.66);
      builder.add(glassRoof, "shadow", 0, 212, 0);
      builder.arch(0, 215, -26, 29, 7, "ivory");
      builder.box(0, 248, -26, 85, 9, 7, "ivory");
      break;
    }
    case "ponte": {
      // Build a true through-hole, including the inner wall and the annular rooftop.
      builder.hollowCylinder(0, 0, 0, 49, 27, 12, "stone");
      builder.hollowCylinder(0, 12, 0, 44, 27, 228, "shadow");
      for (let y = 16; y <= 240; y += 8) builder.hollowCylinder(0, y, 0, 45, 27, 1.7, "pale");
      for (let rib = 0; rib < 32; rib += 1) {
        const angle = rib * Math.PI / 16;
        builder.box(Math.cos(angle) * 44.5, 126, Math.sin(angle) * 44.5, 1.5, 228, 1.5, "stone");
      }
      builder.hollowCylinder(0, 240, 0, 47, 27, 20, "red");
      builder.hollowCylinder(0, 260, 0, 47.5, 26.5, 3, "pale");
      break;
    }
    case "belem": {
      // The lower bastion projects in front of the square keep.
      builder.box(0, 15, 35, 133, 30, 113, "pale");
      builder.box(0, 33, 35, 140, 6, 120, "ivory");
      builder.box(0, 83, -21, 73, 166, 66, "pale");
      for (const y of [42, 78, 115, 161]) builder.box(0, y, -21, 80, 5, 73, "ivory");
      for (const y of [57, 93, 133]) {
        for (const x of [-20, 0, 20]) {
          builder.box(x, y, 13, 9, 17, 1.5, "shadow");
          builder.arch(x, y + 8, 14, 4.5, 2, "ivory");
        }
      }
      builder.box(0, 79, 21, 72, 4, 20, "ivory");
      for (const x of [-32, -16, 0, 16, 32]) builder.cylinder(x, 88, 29, 1.6, 1.6, 15, "pale", 8);
      builder.box(0, 97, 29, 74, 3, 4, "ivory");
      for (const [x, z, base] of [[-38, -54, 160], [38, -54, 160], [-38, 12, 160], [38, 12, 160],
        [-66, 87, 32], [66, 87, 32], [-66, -18, 32], [66, -18, 32]]) {
        builder.cylinder(x, base + 10, z, 9, 10, 23, "ivory", 12);
        builder.sphere(x, base + 24, z, 10, "pale", 0.7);
        builder.cylinder(x, base + 33, z, 0.4, 2, 9, "ivory", 8);
      }
      for (let x = -28; x <= 28; x += 14) {
        builder.box(x, 169, 13, 7, 12, 6, "ivory");
        builder.box(x, 169, -55, 7, 12, 6, "ivory");
      }
      for (let x = -48; x <= 48; x += 16) builder.box(x, 40, 94, 8, 10, 6, "ivory");
      break;
    }
    case "castelnuovo": {
      // A hollow courtyard, five round defensive towers, and the pale triumphal entrance.
      builder.box(0, 2, 0, 210, 4, 150, "stone");
      builder.box(0, 41, -65, 202, 78, 18, "stone");
      for (const x of [-96, 96]) builder.box(x, 41, 0, 18, 78, 140, "stone");
      builder.box(-53, 41, 66, 92, 78, 18, "stone");
      builder.box(82, 41, 66, 29, 78, 18, "stone");
      for (const [x, z] of [[-98, -65], [98, -65], [-98, 66], [2, 66], [98, 66]]) {
        builder.cylinder(x, 12, z, 26, 33, 24, "stone", 24);
        builder.cylinder(x, 58, z, 26, 26, 90, "stone", 24);
        builder.cylinder(x, 104, z, 29, 26, 8, "pale", 24);
        for (let tooth = 0; tooth < 12; tooth += 1) {
          const angle = tooth * Math.PI / 6;
          builder.box(x + Math.cos(angle) * 26, 113, z + Math.sin(angle) * 26, 7, 12, 7, "stone", -angle);
        }
      }
      for (const x of [29, 64]) builder.box(x, 46, 81, 10, 90, 15, "ivory");
      builder.arch(46.5, 39, 82, 17.5, 9, "ivory");
      builder.box(46.5, 84, 81, 46, 12, 15, "ivory");
      builder.arch(46.5, 99, 81, 16, 6, "pale");
      builder.box(46.5, 118, 81, 46, 6, 15, "ivory");
      for (let x = -72; x <= 72; x += 18) builder.box(x, 85, -65, 8, 11, 19, "pale");
      break;
    }
    case "anshun": {
      // A roofed crossing with three stone arches, not a generic suspension bridge.
      builder.box(0, 27, 0, 254, 13, 66, "stone");
      for (const x of [-112, -38, 38, 112]) builder.box(x, 17, 0, 20, 34, 67, "pale");
      for (const x of [-75, 0, 75]) {
        builder.arch(x, 0, 34, 25, 8, "ivory");
        builder.arch(x, 0, -34, 25, 8, "ivory");
      }
      for (const x of [-76, 0, 76]) {
        builder.box(x, 55, 0, 69, 42, 48, "ivory");
        builder.box(x, 76, 0, 79, 5, 60, "roof");
        builder.pyramidRoof(x, 79, 0, 81, 22, "roof");
        for (const offset of [-23, 0, 23]) builder.box(x + offset, 53, 26, 10, 22, 2, "shadow");
      }
      break;
    }
    case "griffith": {
      // The broad Art Deco frontage and three observatory domes carry the silhouette.
      builder.box(0, 36, 0, 230, 72, 78, "ivory");
      builder.box(0, 75, 0, 242, 8, 85, "pale");
      builder.box(0, 85, 0, 76, 17, 82, "ivory");
      for (const [x, radius, base] of [[-92, 30, 75], [0, 37, 92], [92, 30, 75]]) {
        builder.cylinder(x, base + 7, 0, radius, radius, 14, "stone", 24);
        builder.sphere(x, base + 17, 0, radius, "roof", 0.57);
        builder.cylinder(x, base + 44, 0, 2, 4, 16, "gold", 10);
      }
      for (const x of [-54, -27, 0, 27, 54]) builder.box(x, 39, 40, 13, 31, 2, "shadow");
      for (const z of [51, 62, 73]) builder.box(0, 5 - (z - 51) * 0.17, z, 93, 4, 8, "pale");
      break;
    }
    case "masp": {
      // Lina Bo Bardi's suspended gallery: the void beneath is the landmark.
      builder.box(0, 118, 0, 235, 74, 72, "shadow");
      builder.box(0, 155, 0, 241, 5, 77, "pale");
      builder.box(0, 82, 0, 241, 5, 77, "pale");
      for (const x of [-106, 106]) {
        for (const z of [-39, 39]) builder.box(x, 79, z, 11, 158, 12, "red");
        builder.box(x, 161, 0, 14, 13, 91, "red");
      }
      builder.box(0, 170, 0, 227, 12, 12, "red");
      for (const x of [-81, -48, -15, 18, 51, 84]) builder.box(x, 120, 38, 3, 70, 2, "pale");
      break;
    }
    case "monas": {
      builder.box(0, 11, 0, 144, 22, 144, "stone");
      builder.box(0, 29, 0, 93, 14, 93, "pale");
      builder.cylinder(0, 132, 0, 10, 24, 191, "ivory", 4);
      // A distinct observation cup sits below the gold-leaf flame.
      builder.box(0, 229, 0, 41, 10, 41, "stone");
      builder.box(0, 237, 0, 33, 6, 33, "pale");
      builder.cylinder(0, 250, 0, 7, 13, 22, "gold", 7);
      builder.add(new THREE.ConeGeometry(11, 30, 7), "gold", 0, 276, 0);
      break;
    }
    case "stlouis": {
      builder.box(0, 46, 0, 180, 92, 68, "ivory");
      builder.box(0, 97, 0, 185, 11, 72, "pale");
      for (const x of [-66, 0, 66]) {
        const middle = x === 0;
        const height = middle ? 162 : 136;
        builder.box(x, 105, 0, middle ? 42 : 39, 54, 42, "stone");
        builder.box(x, height - 7, 0, 44, 8, 47, "pale");
        builder.cylinder(x, height + 13, 0, 11, 19, 38, "ivory", 8);
        builder.cylinder(x, height + 43, 0, 0.4, 12, 25, "roof", 8);
        builder.cylinder(x, height + 59, 0, 0.3, 1.4, 10, "gold", 8);
      }
      for (const x of [-56, 0, 56]) {
        builder.arch(x, 36, 35, 15, 5, "stone");
        builder.box(x, 25, 36, 25, 38, 2, "shadow");
      }
      break;
    }
    case "capitolio": {
      builder.box(0, 12, 0, 228, 24, 124, "stone");
      builder.box(0, 58, 0, 219, 69, 111, "ivory");
      for (const x of [-82, -59, -36, -13, 13, 36, 59, 82]) {
        builder.cylinder(x, 49, 59, 5, 6, 63, "pale", 10);
      }
      builder.box(0, 86, 56, 204, 10, 24, "stone");
      builder.gable(0, 93, 57, 199, 26, 18, "ivory");
      builder.cylinder(0, 114, 0, 45, 48, 42, "pale", 28);
      builder.sphere(0, 141, 0, 48, "roof", 0.74);
      builder.cylinder(0, 181, 0, 10, 13, 28, "ivory", 16);
      builder.sphere(0, 197, 0, 12, "gold", 0.7);
      break;
    }
    case "taipei101": {
      builder.box(0, 19, 0, 82, 38, 82, "stone");
      for (let floor = 0; floor < 8; floor += 1) {
        const width = 56 + (floor % 2) * 5 - floor * 2.2;
        builder.box(0, 47 + floor * 22, 0, width, 22, width, floor % 2 ? "stone" : "pale");
        builder.box(0, 57 + floor * 22, 0, width + 6, 3.5, width + 6, "accent");
      }
      builder.cylinder(0, 246, 0, 1.2, 8, 55, "gold", 10);
      break;
    }
    case "canton": {
      for (const [y, width] of [[15, 48], [73, 30], [139, 19], [193, 33], [223, 37]]) {
        builder.cylinder(0, y, 0, width / 2, width / 2, 7, "accent", 24);
      }
      for (let spoke = 0; spoke < 12; spoke += 1) {
        const angle = spoke * Math.PI / 6;
        builder.beam([Math.cos(angle) * 24, 2, Math.sin(angle) * 24], [Math.cos(angle + 0.48) * 10, 125, Math.sin(angle + 0.48) * 10], 2, "pale");
        builder.beam([Math.cos(angle + 0.48) * 10, 125, Math.sin(angle + 0.48) * 10], [Math.cos(angle + 0.8) * 18, 223, Math.sin(angle + 0.8) * 18], 2, "pale");
      }
      builder.cylinder(0, 248, 0, 2, 12, 43, "stone");
      builder.cylinder(0, 284, 0, 0.2, 2, 35, "gold");
      break;
    }
    case "nseoul": {
      builder.cylinder(0, 95, 0, 8, 16, 190, "ivory", 16);
      // The Namsan tower wears a multi-storey glazed drum, not a solid pod.
      builder.cylinder(0, 186, 0, 30, 26, 6, "pale", 24);
      builder.cylinder(0, 197, 0, 25, 29, 16, "shadow", 24);
      builder.cylinder(0, 208, 0, 22, 25, 7, "red", 24);
      builder.cylinder(0, 215, 0, 16, 22, 6, "pale", 24);
      builder.cylinder(0, 244, 0, 2, 5, 52, "ivory", 12);
      builder.cylinder(0, 272, 0, 0.4, 1.6, 12, "red", 8);
      break;
    }
    case "cntower": {
      for (const angle of [0, 2.1, 4.2]) builder.beam([Math.cos(angle) * 30, 0, Math.sin(angle) * 30], [0, 178, 0], 9, "pale");
      builder.cylinder(0, 183, 0, 9, 15, 74, "stone", 16);
      builder.cylinder(0, 178, 0, 29, 24, 18, "ivory", 24);
      builder.cylinder(0, 192, 0, 23, 28, 9, "accent", 24);
      builder.cylinder(0, 250, 0, 1, 6, 64, "pale", 12);
      break;
    }
    case "skytower": {
      builder.cylinder(0, 90, 0, 6, 22, 180, "stone", 18);
      builder.cylinder(0, 187, 0, 23, 27, 17, "pale", 24);
      builder.cylinder(0, 202, 0, 14, 23, 13, "accent", 24);
      builder.cylinder(0, 229, 0, 3.5, 5, 45, "stone", 12);
      builder.cylinder(0, 268, 0, 0.4, 2.3, 39, "gold", 10);
      break;
    }
    case "marina": {
      for (const x of [-73, 0, 73]) {
        builder.box(x - 7, 90, -5, 26, 180, 43, "stone", -0.075);
        builder.box(x + 11, 90, -5, 24, 180, 43, "pale", 0.075);
        for (let y = 21; y < 180; y += 22) builder.box(x + 2, y, 17, 47, 2, 2, "shadow");
      }
      builder.box(5, 188, 0, 243, 12, 61, "accent");
      builder.box(30, 196, 0, 217, 5, 57, "pale");
      // The sky park cantilevers past the end tower, with the infinity pool as a dark waterline.
      builder.box(-133, 189, 0, 44, 10, 57, "accent");
      builder.box(30, 199, 0, 200, 1.5, 40, "shadow");
      break;
    }
    case "hagia": {
      builder.box(0, 43, 0, 150, 86, 118, "stone");
      builder.cylinder(0, 94, 0, 57, 59, 20, "pale", 32);
      builder.sphere(0, 109, 0, 57, "roof", 0.63);
      for (const x of [-84, 84]) for (const z of [-69, 69]) {
        builder.cylinder(x, 84, z, 4, 7, 168, "pale", 12);
        // Each minaret carries a balcony ring below its conical cap.
        builder.cylinder(x, 150, z, 7.5, 6, 5, "ivory", 12);
        builder.cylinder(x, 177, z, 0, 10, 27, "roof", 12);
      }
      for (const x of [-54, 54]) {
        builder.sphere(x, 81, 0, 22, "roof", 0.62);
        builder.box(x, 47, 0, 40, 52, 50, "pale");
        // Smaller quarter-domes cascade up toward the great dome.
        builder.sphere(x, 96, 0, 13, "roof", 0.55);
      }
      break;
    }
    case "giza": {
      for (const [x, z, radius, height] of [[-66, -21, 76, 139], [64, -42, 61, 117], [82, 79, 41, 74]]) {
        builder.add(new THREE.ConeGeometry(radius, height, 4, 1), "stone", x, height / 2, z, Math.PI / 4);
        builder.add(new THREE.ConeGeometry(radius * 0.22, height * 0.22, 4, 1), "pale", x, height * 0.89, z, Math.PI / 4);
      }
      break;
    }
    case "burj": {
      builder.box(0, 37, 0, 58, 74, 58, "stone");
      for (const angle of [0, 2.09, 4.18]) {
        builder.box(Math.cos(angle) * 31, 39, Math.sin(angle) * 31, 35, 78, 29, "pale", -angle);
      }
      // The Y-plan wings step back in a spiral as the tower climbs toward 828 m.
      const tiers = [[75, 55, 45], [130, 46, 36], [176, 38, 28], [214, 31, 21], [245, 25, 15], [270, 20, 10]] as const;
      tiers.forEach(([base, height, width], index) => {
        builder.box(0, base + height / 2, 0, width, height, width, "stone");
        builder.box(0, base + height, 0, width + 2, 2, width + 2, "accent");
        const angle = index * 0.9;
        builder.box(Math.cos(angle) * width * 0.55, base + height * 0.4, Math.sin(angle) * width * 0.55, width * 0.5, height * 0.8, width * 0.42, "pale", -angle);
      });
      builder.cylinder(0, 312, 0, 0.3, 4, 46, "pale", 12);
      break;
    }
    case "sagrada": {
      builder.box(0, 45, 0, 118, 90, 83, "stone");
      builder.box(0, 92, 0, 106, 12, 77, "accent");
      for (const x of [-49, -17, 17, 49]) for (const z of [-29, 29]) {
        const height = Math.abs(x) < 20 ? 174 : 148;
        builder.cylinder(x, height / 2, z, 7, 12, height, "pale", 9);
        builder.cylinder(x, height + 17, z, 0.2, 9, 34, "accent", 9);
        builder.sphere(x, height + 33, z, 3.2, "gold");
      }
      builder.cylinder(0, 119, 0, 12, 24, 91, "stone", 12);
      builder.cylinder(0, 192, 0, 0.2, 11, 59, "accent", 12);
      break;
    }
    case "empire": {
      builder.box(0, 24, 0, 94, 48, 68, "stone");
      builder.box(0, 94, 0, 66, 92, 60, "pale");
      builder.box(0, 164, 0, 45, 51, 47, "stone");
      builder.box(0, 206, 0, 29, 33, 32, "pale");
      builder.cylinder(0, 242, 0, 3, 12, 40, "stone", 8);
      builder.cylinder(0, 275, 0, 0.5, 3, 28, "gold", 8);
      for (const x of [-27, 27]) for (let y = 60; y < 138; y += 14) builder.box(x, y, 31, 3, 7, 1.5, "shadow");
      break;
    }
    case "brandenburg": {
      for (const x of [-79, -52, -26, 0, 26, 52, 79]) builder.cylinder(x, 46, 0, 6, 7, 92, "pale", 10);
      builder.box(0, 9, 0, 191, 18, 45, "stone");
      builder.box(0, 99, 0, 193, 14, 49, "stone");
      builder.box(0, 115, 0, 205, 17, 56, "pale");
      builder.box(0, 128, 0, 211, 7, 61, "accent");
      builder.box(0, 142, 0, 25, 25, 18, "roof");
      builder.beam([-28, 152, 0], [28, 152, 0], 6, "gold");
      break;
    }
    case "christ": {
      builder.cylinder(0, 27, 0, 42, 49, 54, "stone", 7);
      builder.box(0, 68, 0, 33, 43, 26, "pale");
      builder.box(0, 125, 0, 30, 75, 23, "pale");
      builder.box(0, 147, 0, 156, 16, 25, "pale");
      builder.sphere(0, 172, 0, 15, "pale", 1.12);
      break;
    }
    case "opera": {
      builder.box(0, 9, 0, 210, 18, 118, "stone");
      builder.box(0, 20, 0, 198, 5, 105, "shadow");
      for (const [x, z, width, height, flip] of [[-64, -29, 70, 99, false], [-5, -29, 82, 117, true], [51, -29, 64, 82, false], [-35, 27, 66, 67, true], [30, 27, 70, 78, false]] as const) {
        builder.sail(x, z, width, height, 13, "ivory", flip);
      }
      break;
    }
    case "willis": {
      for (const [x, z, height] of [[-24, -24, 215], [0, -24, 178], [24, -24, 147], [-24, 0, 192], [0, 0, 242], [24, 0, 207], [-24, 24, 154], [0, 24, 185], [24, 24, 130]]) {
        builder.box(x, height / 2, z, 23, height, 23, "stone");
        for (let y = 15; y < height; y += 22) builder.box(x, y, z + 12, 21, 1.5, 1, "pale");
      }
      for (const x of [-24, 0]) builder.cylinder(x, 263, -24, 0.4, 1.5, 43, "gold", 8);
      break;
    }
    case "obelisco": {
      builder.box(0, 7, 0, 52, 14, 52, "stone");
      builder.box(0, 102, 0, 27, 190, 27, "pale");
      builder.add(new THREE.ConeGeometry(19, 37, 4), "pale", 0, 216, 0, Math.PI / 4);
      break;
    }
    case "watarun": {
      // One tall central prang ringed by four smaller satellite prangs on terraced bases.
      builder.box(0, 10, 0, 150, 20, 150, "stone");
      builder.box(0, 24, 0, 112, 10, 112, "pale");
      builder.box(0, 33, 0, 88, 8, 88, "stone");
      for (const [y, bottom, top] of [[53, 42, 27], [88, 28, 17], [117, 18, 10], [141, 10, 4.5]]) {
        builder.cylinder(0, y, 0, top, bottom, 28, "pale", 8);
        builder.cylinder(0, y + 15, 0, top * 1.1, top * 0.9, 4, "accent", 8);
      }
      builder.cylinder(0, 170, 0, 0.2, 4.5, 36, "gold", 8);
      for (const x of [-58, 58]) for (const z of [-58, 58]) {
        builder.cylinder(x, 42, z, 6, 16, 62, "pale", 8);
        builder.cylinder(x, 76, z, 3, 7, 14, "accent", 8);
        builder.cylinder(x, 90, z, 0.2, 3.4, 16, "gold", 8);
      }
      break;
    }
    case "xianbell": {
      for (const [y, size, height] of [[0, 128, 43], [48, 92, 42], [99, 70, 35]]) {
        builder.box(0, y + height / 2, 0, size, height, size, "stone");
        builder.box(0, y + height + 4, 0, size + 20, 8, size + 20, "roof");
        builder.pyramidRoof(0, y + height + 8, 0, size + 18, 17, "roof");
      }
      builder.cylinder(0, 164, 0, 0, 7, 28, "gold", 8);
      for (const x of [-41, 41]) builder.box(x, 24, 65, 14, 39, 4, "shadow");
      for (const x of [-29, 0, 29]) builder.box(x, 82, 47, 11, 24, 3, "shadow");
      break;
    }
    case "osakacastle": {
      // Five visible storeys above a sloped stone base, gold trim and shachi on the top roof.
      builder.box(0, 20, 0, 138, 40, 126, "stone");
      builder.box(0, 44, 0, 122, 10, 110, "stone");
      for (const [y, width, depth] of [[50, 118, 102], [82, 98, 86], [111, 80, 70], [137, 64, 56], [160, 50, 44]]) {
        builder.box(0, y + 13, 0, width - 14, 26, depth - 14, "ivory");
        builder.box(0, y + 27, 0, width + 12, 6, depth + 12, "roof");
        builder.pyramidRoof(0, y + 30, 0, width + 9, 13, "roof");
        for (const x of [-width * 0.26, width * 0.26]) builder.box(x, y + 13, depth / 2 - 5, 8, 11, 3, "shadow");
        builder.box(0, y + 24, depth / 2 - 4, width - 20, 2, 2, "gold");
      }
      for (const x of [-20, 20]) {
        builder.sphere(x, 205, 0, 3.5, "gold");
        builder.beam([x, 205, 0], [x * 1.35, 213, 0], 2, "gold");
      }
      break;
    }
    case "indiagate": {
      // The opening is cut through the masonry, with a curved crown.
      builder.box(0, 4, 0, 142, 8, 72, "red");
      const wall = new THREE.Shape();
      wall.moveTo(-60, 0);
      wall.lineTo(-60, 150);
      wall.lineTo(60, 150);
      wall.lineTo(60, 0);
      wall.lineTo(22, 0);
      wall.lineTo(22, 84);
      wall.absarc(0, 84, 22, 0, Math.PI, false);
      wall.lineTo(-22, 0);
      wall.closePath();
      builder.add(new THREE.ExtrudeGeometry(wall, { depth: 48, bevelEnabled: false, curveSegments: 24 }), "pale", 0, 8, -24);
      for (const x of [-48, 48]) for (const z of [-25, 25]) {
        builder.box(x, 74, z, 5, 130, 3, "stone");
      }
      builder.box(0, 160, 0, 130, 8, 56, "stone");
      builder.box(0, 167, 0, 139, 7, 61, "pale");
      builder.box(0, 178, 0, 93, 15, 49, "stone");
      builder.box(0, 187, 0, 99, 4, 53, "pale");
      // Shallow crown bowl above, and the Amar Jawan Jyoti flame burning under the arch.
      builder.cylinder(0, 192, 0, 20, 26, 6, "stone", 20);
      builder.cylinder(0, 12, 0, 3.5, 4.5, 8, "stone", 10);
      builder.add(new THREE.ConeGeometry(2.2, 6, 8), "gold", 0, 19, 0);
      break;
    }
    case "parthenon": {
      builder.box(0, 16, 0, 200, 32, 114, "stone");
      for (const x of [-84, -60, -36, -12, 12, 36, 60, 84]) for (const z of [-43, 43]) {
        builder.cylinder(x, 65, z, 4, 5, 95, "ivory", 12);
      }
      for (const x of [-84, 84]) for (const z of [-21, 0, 21]) builder.cylinder(x, 65, z, 4, 5, 95, "ivory", 12);
      builder.box(0, 114, 0, 207, 10, 119, "pale");
      builder.gable(0, 119, 0, 205, 30, 116, "ivory");
      break;
    }
    case "angel": {
      builder.box(0, 18, 0, 71, 36, 71, "stone");
      builder.cylinder(0, 99, 0, 13, 20, 126, "pale", 20);
      builder.cylinder(0, 171, 0, 21, 19, 18, "gold", 20);
      builder.cylinder(0, 195, 0, 3, 4, 34, "gold", 12);
      builder.sphere(0, 220, 0, 11, "gold", 1.2);
      for (const direction of [-1, 1]) {
        builder.beam([direction * 7, 217, 0], [direction * 32, 233, 0], 6, "gold");
        builder.beam([direction * 12, 215, 0], [direction * 29, 202, 0], 4, "gold");
      }
      break;
    }
    case "tablemountain": {
      builder.box(0, 138, -15, 171, 23, 88, "stone");
      for (const [x, z, radius, height] of [[-87, -15, 63, 131], [83, -15, 59, 126], [-36, 21, 71, 114], [45, 14, 72, 120]]) {
        builder.cylinder(x, height / 2, z, radius * 0.72, radius, height, "stone", 6);
      }
      builder.box(0, 153, -15, 147, 7, 77, "pale");
      break;
    }
    case "hongkong": {
      // A compressed city silhouette, not a claim to model a single building.
      for (const [x, z, width, height] of [[-83, 0, 24, 126], [-49, -4, 28, 201], [-11, -16, 31, 166], [31, 3, 34, 218], [74, -6, 27, 143]]) {
        builder.box(x, height / 2, z, width, height, width, "stone");
        for (let y = 15; y < height; y += 19) builder.box(x, y, z + width / 2 + 1, width - 4, 1.5, 1, "gold");
      }
      builder.cylinder(31, 237, 3, 0.3, 3, 40, "pale", 8);
      break;
    }
    default: {
      // A newly named signature must never silently fall back to an empty scene.
      const unmodeled: never = kind;
      throw new Error(`Missing city signature geometry: ${unmodeled}`);
    }
  }
}

function citySeed(id: string) {
  let value = 2166136261;
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function sketchMotif(builder: SketchBuilder, motif: City["landmark"], variation: number) {
  if (motif === "tower") {
    builder.cylinder(0, 78, 0, 9, 13, 156, "stone", 16);
    builder.cylinder(0, 155, 0, 22, 17, 17, "accent", 20);
    builder.cylinder(0, 172, 0, 12, 22, 14, "roof", 20);
    builder.cylinder(0, 214, 0, 1, 3.4, 72, "pale", 10);
    builder.sphere(0, 239, 0, 5.6, "gold", 0.55);
  } else if (motif === "spire") {
    builder.box(0, 39, 0, 88, 78, 45, "stone");
    for (const x of [-30, 30]) {
      builder.box(x, 78, 0, 20, 155, 22, "pale");
      builder.cylinder(x, 181, 0, 0.5, 14, 52, "roof", 8);
      builder.cylinder(x, 212, 0, 0.1, 1.3, 17, "gold", 8);
    }
    builder.box(0, 100, 23, 18, 24, 1.2, "shadow");
  } else if (motif === "dome") {
    builder.box(0, 37, 0, 116, 74, 76, "stone");
    builder.cylinder(0, 90, 0, 34, 37, 32, "pale", 32);
    builder.sphere(0, 109, 0, 37, "accent", 0.66);
    builder.cylinder(0, 139, 0, 0.4, 2.5, 14, "gold", 12);
    for (const x of [-48, 48]) builder.cylinder(x, 74, 25, 4, 5, 148, "pale", 12);
  } else if (motif === "bridge") {
    builder.box(0, 51, 0, 240, 10, 26, "stone");
    for (const x of [-82, 82]) {
      builder.box(x, 99, 0, 18, 198, 22, "pale");
      builder.box(x, 195, 0, 25, 12, 29, "accent");
    }
    for (let index = -4; index <= 4; index += 1) {
      const x = index * 22;
      const pylon = x < 0 ? -82 : 82;
      builder.beam([x, 55, 0], [pylon, 181, 0], 2.2, "gold");
    }
  } else if (motif === "mountain") {
    for (const [x, height, radius] of [[-63, 160, 76], [42, 212, 91], [112, 120, 62]]) {
      builder.cylinder(x, height / 2, -35, 0, radius, height, "stone", 5);
      builder.cylinder(x, height - 18, -35, 0, radius * 0.21, 36, "pale", 5);
    }
  } else if (motif === "harbor") {
    builder.box(-45, 53, 0, 55, 106, 43, "stone");
    builder.box(25, 81, 17, 40, 162, 37, "pale");
    builder.box(90, 33, -15, 34, 66, 50, "stone");
    builder.box(23, 168, 17, 53, 8, 45, "accent");
    builder.beam([-92, 0, -25], [-92, 157, -25], 9, "gold");
    builder.beam([-92, 155, -25], [-7, 155, -25], 6, "gold");
    builder.beam([-38, 155, -25], [-38, 88, -25], 2, "gold");
  } else {
    // Open civic arch, used if a future city is assigned the arch motif.
    for (const x of [-41, 41]) builder.box(x, 65, 0, 27, 130, 35, "stone");
    builder.box(0, 136, 0, 116, 23, 39, "pale");
    builder.box(0, 153, 0, 127, 11, 47, "accent");
  }
  // A very small asymmetry stops archetypes from repeating exactly.
  if (variation % 2 === 0 && motif !== "mountain" && motif !== "bridge") {
    builder.box(74, 29, 74, 32, 58, 30, "stone");
    builder.box(74, 59, 74, 36, 4, 34, "roof");
  }
}

export function buildCity(city: City) {
  const builder = new SketchBuilder();
  const seed = citySeed(city.id);
  const signature = getCitySignature(city.id);
  if (signature) signatureModel(builder, signature.kind);
  else sketchMotif(builder, city.landmark, seed % 7);
  const sparseSetting = signature && (signature.settingRadius || ["giza", "christ", "opera", "brandenburg", "marina", "anshun", "griffith", "masp", "monas", "stlouis", "capitolio"].includes(signature.kind));
  const density = city.id === "singapore" ? 2 : sparseSetting ? 4 : signature ? 7 : city.prominence === "global" ? 9 : 7;
  const coastal = COASTAL_CITIES.has(city.id);
  if (!coastal && signature?.kind !== "giza") {
    // Open street lines ground the miniature without placing a filled plate on Earth.
    const roadRadius = signature?.settingRadius ? signature.settingRadius - 26 : 91;
    const length = Math.max(285, roadRadius * 2 + 40);
    builder.box(0, 0.9, -roadRadius, length, 1.8, 4.2, "road");
    builder.box(-roadRadius, 0.9, 0, 4.2, 1.8, length, "road");
    builder.box(0, 0.9, roadRadius, length, 1.8, 4.2, "road");
    builder.box(roadRadius, 0.9, 0, 4.2, 1.8, length, "road");
  }
  for (let index = 0; index < density; index += 1) {
    const side = index % 2 ? 1 : -1;
    const row = Math.floor(index / 2);
    const wideLandmark = signature && ["anshun", "griffith", "masp", "capitolio"].includes(signature.kind);
    const x = signature?.settingRadius ? side * signature.settingRadius : coastal ? side * (city.id === "singapore" ? 75 : wideLandmark ? 172 : 103) : side * (wideLandmark ? 180 : signature?.kind === "brandenburg" || city.landmark === "bridge" ? 150 : 118);
    const z = coastal ? (row - 1) * 56 : (row - 1.5) * 55;
    const width = 21 + ((seed + index * 17) % 18);
    const depth = 22 + ((seed + index * 29) % 16);
    const height = 22 + ((seed >>> (index % 13)) % (signature ? 43 : 62));
    builder.box(x, height / 2, z, width, height, depth, index % 3 === 0 ? "pale" : "stone");
    builder.box(x, height + 2, z, width + 3, 4, depth + 3, "roof");
  }
  return builder.finish();
}

export function CityVignette({ city }: { city: City }) {
  const signature = getCitySignature(city.id);
  const parts = useMemo(() => buildCity(city), [city]);
  const materials = useMemo(() => ({
    stone: new THREE.MeshStandardMaterial({ color: "#8f9994", roughness: 0.94 }),
    pale: new THREE.MeshStandardMaterial({ color: "#c9c3b7", roughness: 0.88 }),
    ivory: new THREE.MeshStandardMaterial({ color: "#efece2", emissive: "#514e48", emissiveIntensity: 0.12, roughness: 0.72 }),
    shadow: new THREE.MeshStandardMaterial({ color: "#3d4c50", roughness: 0.97 }),
    roof: new THREE.MeshStandardMaterial({ color: "#535f66", roughness: 0.91 }),
    road: new THREE.MeshBasicMaterial({ color: "#72888a", transparent: true, opacity: 0.54, depthWrite: false }),
    accent: new THREE.MeshStandardMaterial({ color: city.accent, metalness: 0.08, roughness: 0.68 }),
    gold: new THREE.MeshStandardMaterial({ color: "#c3ad76", metalness: 0.22, roughness: 0.65 }),
    red: new THREE.MeshStandardMaterial({ color: "#ba493d", roughness: 0.8 }),
  }), [city.accent]);
  useEffect(() => () => {
    parts.forEach(({ geometry }) => geometry.dispose());
    Object.values(materials).forEach((material) => material.dispose());
  }, [parts, materials]);
  const { lat: displayLat, lon: displayLon } = getCityVisualAnchor(city);
  const position = useMemo(() => cityVector(displayLat, displayLon, EARTH_RADIUS), [displayLat, displayLon]);
  const quaternion = useMemo(() => {
    const { up, east, north } = tangentBasis(displayLat, displayLon);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, north.negate()));
  }, [displayLat, displayLon]);
  const footprintScale = signature?.displayScale ?? (city.id === "singapore" ? 0.000045 : COASTAL_CITIES.has(city.id) ? 0.000034 : signature ? 0.000055 : 0.000061);
  const heightScale = signature?.displayScale ?? (city.id === "singapore" ? 0.00009 : DISPLAY_SCALE);
  return (
    <group position={position} quaternion={quaternion} scale={[footprintScale, heightScale, footprintScale]} userData={{ city: city.id, conceptual: true, signature: signature?.kind }}>
      <group rotation={[0, (signature?.heading ?? 0) * Math.PI / 180, 0]}>
        {parts.map(({ finish, geometry }) => <mesh key={finish} geometry={geometry} material={materials[finish]} />)}
      </group>
    </group>
  );
}
