import { GRID_SIZE, MAX_HEIGHT, SEA_LEVEL, MAX_HEIGHT_DIFF } from '../utils/Constants';
import { clamp, wrapCoord } from '../utils/MathUtils';

export class World {
  readonly size: number;
  private heightmap: number[][]; // heightmap[x][z]
  private swampMap: boolean[][]; // true if tile is swamp

  constructor(size: number = GRID_SIZE) {
    this.size = size;
    this.heightmap = [];
    this.swampMap = [];
    for (let x = 0; x < size; x++) {
      this.heightmap[x] = [];
      this.swampMap[x] = [];
      for (let z = 0; z < size; z++) {
        this.heightmap[x][z] = 0;
        this.swampMap[x][z] = false;
      }
    }
  }

  /** Generate initial terrain with some hills and valleys */
  generate(): void {
    // Use multiple octaves of simplex-like noise via simple sine sums
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        let h = 0;
        // Large features
        h += Math.sin(x * 0.08) * Math.cos(z * 0.08) * 3;
        h += Math.sin(x * 0.15 + 1.3) * Math.sin(z * 0.12 + 0.7) * 2;
        // Medium features
        h += Math.sin(x * 0.25 + 2.5) * Math.cos(z * 0.3 + 1.1) * 1.5;
        // Small features
        h += Math.sin(x * 0.5 + 4.2) * Math.sin(z * 0.45 + 3.3) * 0.5;

        // Normalize to 0-MAX_HEIGHT range
        h = Math.round((h + 7) * MAX_HEIGHT / 14);
        this.heightmap[x][z] = clamp(h, 0, MAX_HEIGHT);
      }
    }

    // Ensure some water - push edges down slightly
    // Create a basin effect: lower terrain near borders to create a more island-like feel
    const center = this.size / 2;
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        const dx = (x - center) / center;
        const dz = (z - center) / center;
        const distFromCenter = Math.sqrt(dx * dx + dz * dz);
        if (distFromCenter > 0.7) {
          const reduction = Math.floor((distFromCenter - 0.7) * 8);
          this.heightmap[x][z] = Math.max(0, this.heightmap[x][z] - reduction);
        }
      }
    }
  }

  getHeight(x: number, z: number): number {
    const wx = wrapCoord(Math.floor(x));
    const wz = wrapCoord(Math.floor(z));
    return this.heightmap[wx][wz];
  }

  /** Get interpolated height at fractional position */
  getHeightInterpolated(x: number, z: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;

    const h00 = this.getHeight(ix, iz);
    const h10 = this.getHeight(ix + 1, iz);
    const h01 = this.getHeight(ix, iz + 1);
    const h11 = this.getHeight(ix + 1, iz + 1);

    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fz;
  }

  setHeight(x: number, z: number, height: number): void {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    this.heightmap[wx][wz] = clamp(height, 0, MAX_HEIGHT);
  }

  isSwamp(x: number, z: number): boolean {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    return this.swampMap[wx][wz];
  }

  setSwamp(x: number, z: number, val: boolean): void {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    this.swampMap[wx][wz] = val;
  }

  isWater(x: number, z: number): boolean {
    return this.getHeight(x, z) <= SEA_LEVEL;
  }

  isPassable(x: number, z: number): boolean {
    return !this.isWater(x, z) && !this.isSwamp(x, z);
  }

  /**
   * Raise terrain at (x,z). Smooths neighbors so no cliff exceeds MAX_HEIGHT_DIFF.
   * Returns list of changed tiles.
   */
  raiseTerrain(x: number, z: number): { x: number; z: number }[] {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const currentHeight = this.heightmap[wx][wz];
    if (currentHeight >= MAX_HEIGHT) return [];

    this.heightmap[wx][wz] = currentHeight + 1;
    const changed = [{ x: wx, z: wz }];
    this.smoothNeighbors(wx, wz, changed);
    return changed;
  }

  /**
   * Lower terrain at (x,z). Smooths neighbors so no cliff exceeds MAX_HEIGHT_DIFF.
   * Returns list of changed tiles.
   */
  lowerTerrain(x: number, z: number): { x: number; z: number }[] {
    const wx = wrapCoord(x);
    const wz = wrapCoord(z);
    const currentHeight = this.heightmap[wx][wz];
    if (currentHeight <= 0) return [];

    this.heightmap[wx][wz] = currentHeight - 1;
    const changed = [{ x: wx, z: wz }];
    this.smoothNeighbors(wx, wz, changed);
    return changed;
  }

  private smoothNeighbors(x: number, z: number, changed: { x: number; z: number }[]): void {
    const queue = [{ x, z }];
    const visited = new Set<string>();
    visited.add(`${x},${z}`);

    while (queue.length > 0) {
      const tile = queue.shift()!;
      const h = this.heightmap[tile.x][tile.z];

      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = wrapCoord(tile.x + dx);
        const nz = wrapCoord(tile.z + dz);
        const key = `${nx},${nz}`;
        if (visited.has(key)) continue;

        const nh = this.heightmap[nx][nz];
        if (Math.abs(h - nh) > MAX_HEIGHT_DIFF) {
          // Adjust neighbor toward this tile's height
          if (nh < h) {
            this.heightmap[nx][nz] = h - MAX_HEIGHT_DIFF;
          } else {
            this.heightmap[nx][nz] = h + MAX_HEIGHT_DIFF;
          }
          this.heightmap[nx][nz] = clamp(this.heightmap[nx][nz], 0, MAX_HEIGHT);
          changed.push({ x: nx, z: nz });
          visited.add(key);
          queue.push({ x: nx, z: nz });
        }
      }
    }
  }

  /**
   * Count the number of connected flat tiles around (x,z) at the same height.
   * Used to determine building tier.
   */
  countFlatArea(cx: number, cz: number): number {
    const wx = wrapCoord(cx);
    const wz = wrapCoord(cz);
    const targetHeight = this.heightmap[wx][wz];
    if (targetHeight <= SEA_LEVEL) return 0;

    const visited = new Set<string>();
    const queue = [{ x: wx, z: wz }];
    visited.add(`${wx},${wz}`);
    let count = 0;
    const maxCount = 12; // don't need to count more than this

    while (queue.length > 0 && count < maxCount) {
      const tile = queue.shift()!;
      count++;

      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = wrapCoord(tile.x + dx);
        const nz = wrapCoord(tile.z + dz);
        const key = `${nx},${nz}`;
        if (visited.has(key)) continue;
        if (this.heightmap[nx][nz] === targetHeight && !this.swampMap[nx][nz]) {
          visited.add(key);
          queue.push({ x: nx, z: nz });
        }
      }
    }

    return count;
  }

  /** Get raw heightmap for rendering */
  getHeightmap(): number[][] {
    return this.heightmap;
  }

  /** Find a random land tile */
  findRandomLandTile(): { x: number; z: number } | null {
    for (let attempts = 0; attempts < 1000; attempts++) {
      const x = Math.floor(Math.random() * this.size);
      const z = Math.floor(Math.random() * this.size);
      if (this.isPassable(x, z)) {
        return { x, z };
      }
    }
    return null;
  }

  /** Find land tile in a specific quadrant */
  findLandInRegion(minX: number, maxX: number, minZ: number, maxZ: number): { x: number; z: number } | null {
    for (let attempts = 0; attempts < 500; attempts++) {
      const x = Math.floor(Math.random() * (maxX - minX)) + minX;
      const z = Math.floor(Math.random() * (maxZ - minZ)) + minZ;
      const wx = wrapCoord(x);
      const wz = wrapCoord(z);
      if (this.isPassable(wx, wz)) {
        return { x: wx, z: wz };
      }
    }
    return null;
  }
}
