import * as THREE from "three";

export const EARTH_RADIUS = 1.28;
export const EARTH_METERS = 6_371_000;
export const METERS_TO_WORLD = EARTH_RADIUS / EARTH_METERS;

export function cityVector(lat: number, lon: number, radius = EARTH_RADIUS) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function tangentBasis(lat: number, lon: number) {
  const up = cityVector(lat, lon, 1).normalize();
  const east = new THREE.Vector3(up.z, 0, -up.x).normalize();
  const north = up.clone().cross(east).normalize();
  return { up, east, north };
}

export function localSurfacePoint(
  up: THREE.Vector3,
  east: THREE.Vector3,
  north: THREE.Vector3,
  x: number,
  z: number,
  height = 0,
) {
  return up.clone().addScaledVector(east, x / EARTH_RADIUS)
    .addScaledVector(north, z / EARTH_RADIUS)
    .normalize()
    .multiplyScalar(EARTH_RADIUS + height);
}
