import { GRID_SIZE } from './Constants';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Wrap coordinate to [0, GRID_SIZE) for toroidal map */
export function wrapCoord(v: number): number {
  return ((v % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
}

/** Wrapped distance between two coordinates on a single axis */
export function wrappedDist1D(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, GRID_SIZE - d);
}

/** Wrapped Manhattan distance */
export function wrappedManhattan(x1: number, z1: number, x2: number, z2: number): number {
  return wrappedDist1D(x1, x2) + wrappedDist1D(z1, z2);
}

/** Wrapped Euclidean distance */
export function wrappedDistance(x1: number, z1: number, x2: number, z2: number): number {
  const dx = wrappedDist1D(x1, x2);
  const dz = wrappedDist1D(z1, z2);
  return Math.sqrt(dx * dx + dz * dz);
}

/** Direction vector from (x1,z1) toward (x2,z2), accounting for wrapping */
export function wrappedDirection(x1: number, z1: number, x2: number, z2: number): { dx: number; dz: number } {
  let dx = x2 - x1;
  let dz = z2 - z1;

  // wrap to shortest path
  if (dx > GRID_SIZE / 2) dx -= GRID_SIZE;
  else if (dx < -GRID_SIZE / 2) dx += GRID_SIZE;
  if (dz > GRID_SIZE / 2) dz -= GRID_SIZE;
  else if (dz < -GRID_SIZE / 2) dz += GRID_SIZE;

  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.001) return { dx: 0, dz: 0 };
  return { dx: dx / len, dz: dz / len };
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
