import { Vector3, type Camera } from "three";
import type { City } from "./cities";

type Marker = { city: City; position: Vector3 };

// Measure in CSS pixels so zoom, perspective, and pixel density don't shrink the target.
export function pickCity(markers: Marker[], camera: Camera, bounds: DOMRect, x: number, y: number, touch: boolean) {
  let nearest: City | null = null;
  let best = (touch ? 26 : 18) ** 2;
  const projected = new Vector3();
  for (const { city, position } of markers) {
    if (camera.position.dot(position) <= position.lengthSq()) continue;
    projected.copy(position).project(camera);
    if (projected.z < -1 || projected.z > 1) continue;
    const dx = bounds.left + (1 + projected.x) * bounds.width / 2 - x;
    const dy = bounds.top + (1 - projected.y) * bounds.height / 2 - y;
    const distance = dx * dx + dy * dy;
    if (distance <= best) {
      nearest = city;
      best = distance;
    }
  }
  return nearest;
}

export function bindCityPicking(canvas: HTMLCanvasElement, pick: (e: PointerEvent) => City | null,
  hover: (city: City | null) => void, select: (id: string) => void) {
  let press: { id: number; x: number; y: number; tolerance: number; city: City } | null = null;
  function cancel() { press = null; }
  function moved(e: PointerEvent) {
    return press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > press.tolerance;
  }
  function down(e: PointerEvent) {
    cancel();
    if (!e.isPrimary || e.button !== 0) return;
    const city = pick(e);
    if (city) press = { id: e.pointerId, x: e.clientX, y: e.clientY, tolerance: e.pointerType === "touch" ? 12 : 7, city };
  }
  function move(e: PointerEvent) {
    if (moved(e)) cancel();
    hover(!e.buttons && e.pointerType !== "touch" ? pick(e) : null);
  }
  function up(e: PointerEvent) {
    const target = press?.id === e.pointerId && !moved(e) ? press.city : null;
    cancel();
    if (target) select(target.id);
  }
  function leave(e: PointerEvent) {
    if (!(e.relatedTarget instanceof Element && e.relatedTarget.closest(".city-label"))) hover(null);
  }
  const listeners = { pointerdown: down, pointermove: move, pointerup: up, pointerleave: leave,
    pointercancel: cancel, lostpointercapture: cancel, wheel: cancel };
  const options = { capture: true };
  for (const [event, listener] of Object.entries(listeners)) canvas.addEventListener(event, listener as EventListener, options);
  return () => {
    for (const [event, listener] of Object.entries(listeners)) canvas.removeEventListener(event, listener as EventListener, options);
  };
}
