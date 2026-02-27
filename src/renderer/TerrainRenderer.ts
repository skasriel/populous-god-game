import { GRID_SIZE, MAX_HEIGHT, SEA_LEVEL, WATER_COLOR, TILE_SIZE } from '../utils/Constants';
import { World } from '../game/World';
import * as THREE from 'three';

// Height scale: each height unit = this many world units vertically
// Higher = more pronounced height steps, matching original Populous look
const H_SCALE = 0.7;

// ── Populous Color Palette ──
// Grass: multiple shades for fine dithered crosshatch pattern
const GRASS_COLORS = [
  new THREE.Color(0x40d040),  // bright green
  new THREE.Color(0x30b830),  // medium green
  new THREE.Color(0x28a828),  // slightly darker
  new THREE.Color(0x38c038),  // mid-bright
];
// Brown cliffs: multiple shades for dithered slope pattern
const CLIFF_COLORS = [
  new THREE.Color(0xd0a050),  // light sandy
  new THREE.Color(0xc08840),  // medium brown
  new THREE.Color(0xa87030),  // darker brown
  new THREE.Color(0xb88038),  // mid brown
];
// Beach
const BEACH_COLOR = new THREE.Color(0xd4c882);
// Water-adjacent brown edge
const SHORE_BROWN = new THREE.Color(0xb08040);

// Simple hash for per-tile variation (deterministic pseudo-random)
function tileHash(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296; // 0..1
}

export { H_SCALE };

export class TerrainRenderer {
  private terrainMesh: THREE.Mesh;
  private waterMesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private world: World;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    // Create terrain geometry
    this.geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.terrainMesh = new THREE.Mesh(this.geometry, material);
    scene.add(this.terrainMesh);

    // Map border
    this.createMapBorder(scene);

    // Water plane with diagonal ripple pattern
    const waterGeo = new THREE.PlaneGeometry(GRID_SIZE * TILE_SIZE + 10, GRID_SIZE * TILE_SIZE + 10);
    const waterCanvas = document.createElement('canvas');
    waterCanvas.width = 128;
    waterCanvas.height = 128;
    const wctx = waterCanvas.getContext('2d')!;
    wctx.fillStyle = '#1848b0';
    wctx.fillRect(0, 0, 128, 128);
    wctx.strokeStyle = '#0c3080';
    wctx.lineWidth = 1;
    for (let i = -128; i < 256; i += 4) {
      wctx.beginPath();
      wctx.moveTo(i, 0);
      wctx.lineTo(i + 128, 128);
      wctx.stroke();
    }
    wctx.strokeStyle = '#2058c8';
    wctx.lineWidth = 0.5;
    for (let i = -128; i < 256; i += 8) {
      wctx.beginPath();
      wctx.moveTo(i + 2, 0);
      wctx.lineTo(i + 130, 128);
      wctx.stroke();
    }
    const waterTexture = new THREE.CanvasTexture(waterCanvas);
    waterTexture.wrapS = THREE.RepeatWrapping;
    waterTexture.wrapT = THREE.RepeatWrapping;
    waterTexture.repeat.set(GRID_SIZE / 4, GRID_SIZE / 4);
    waterTexture.magFilter = THREE.NearestFilter;
    waterTexture.minFilter = THREE.NearestFilter;
    const waterMat = new THREE.MeshBasicMaterial({ map: waterTexture, side: THREE.DoubleSide });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(GRID_SIZE / 2, (SEA_LEVEL + 0.5) * H_SCALE, GRID_SIZE / 2);
    scene.add(this.waterMesh);

    this.buildFullMesh();
  }

  private createMapBorder(scene: THREE.Scene): void {
    const mapSize = GRID_SIZE * TILE_SIZE;
    const borderWidth = 1.5;
    const borderHeight = 2.0;
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const borderTrimMat = new THREE.MeshBasicMaterial({ color: 0xcc4422 });

    const sides = [
      { pos: [mapSize / 2, -borderHeight / 2, -borderWidth / 2], size: [mapSize + borderWidth * 2, borderHeight, borderWidth] },
      { pos: [mapSize / 2, -borderHeight / 2, mapSize + borderWidth / 2], size: [mapSize + borderWidth * 2, borderHeight, borderWidth] },
      { pos: [-borderWidth / 2, -borderHeight / 2, mapSize / 2], size: [borderWidth, borderHeight, mapSize] },
      { pos: [mapSize + borderWidth / 2, -borderHeight / 2, mapSize / 2], size: [borderWidth, borderHeight, mapSize] },
    ];
    for (const side of sides) {
      const geo = new THREE.BoxGeometry(side.size[0], side.size[1], side.size[2]);
      const mesh = new THREE.Mesh(geo, borderMat);
      mesh.position.set(side.pos[0], side.pos[1], side.pos[2]);
      scene.add(mesh);
    }
    const trimHeight = 0.15;
    const trimSides = [
      { pos: [mapSize / 2, trimHeight / 2, -borderWidth + 0.1], size: [mapSize + borderWidth * 2, trimHeight, 0.2] },
      { pos: [mapSize / 2, trimHeight / 2, mapSize + borderWidth - 0.1], size: [mapSize + borderWidth * 2, trimHeight, 0.2] },
      { pos: [-borderWidth + 0.1, trimHeight / 2, mapSize / 2], size: [0.2, trimHeight, mapSize] },
      { pos: [mapSize + borderWidth - 0.1, trimHeight / 2, mapSize / 2], size: [0.2, trimHeight, mapSize] },
    ];
    for (const side of trimSides) {
      const geo = new THREE.BoxGeometry(side.size[0], side.size[1], side.size[2]);
      const mesh = new THREE.Mesh(geo, borderTrimMat);
      mesh.position.set(side.pos[0], side.pos[1], side.pos[2]);
      scene.add(mesh);
    }
    const floorGeo = new THREE.PlaneGeometry(mapSize + borderWidth * 2, mapSize + borderWidth * 2);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0c2050, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mapSize / 2, -borderHeight, mapSize / 2);
    scene.add(floor);
  }

  /**
   * Build terrain using averaged corner heights for smooth slopes.
   *
   * Instead of flat tiles + vertical walls, each vertex height is the average
   * of the 4 tiles sharing that corner. This creates natural angled slopes
   * at height transitions — matching the original Populous look.
   *
   * Colors use a dithered pattern: alternating light/dark green for grass,
   * with brown for steep slopes (cliff faces).
   */
  buildFullMesh(): void {
    const size = this.world.size;
    const heightmap = this.world.getHeightmap();

    // ── Step 1: Compute corner heights ──
    // Grid of (size+1) x (size+1) corner vertices.
    // Each corner averages the heights of up to 4 surrounding tiles.
    const cornerH: number[][] = [];
    for (let cx = 0; cx <= size; cx++) {
      cornerH[cx] = [];
      for (let cz = 0; cz <= size; cz++) {
        let sum = 0;
        let count = 0;
        // The 4 tiles sharing this corner: (cx-1,cz-1), (cx,cz-1), (cx-1,cz), (cx,cz)
        for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const tx = cx + dx;
          const tz = cz + dz;
          if (tx >= 0 && tx < size && tz >= 0 && tz < size) {
            sum += heightmap[tx][tz];
            count++;
          }
        }
        cornerH[cx][cz] = count > 0 ? sum / count : 0;
      }
    }

    // ── Step 2: Build mesh ──
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vi = 0;

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const tileH = heightmap[x][z];

        // Skip tiles fully underwater
        if (tileH <= SEA_LEVEL) continue;

        // Corner heights for this tile, clamped to at least sea level for visible land
        const h00 = Math.max(cornerH[x][z], SEA_LEVEL) * H_SCALE;
        const h10 = Math.max(cornerH[x + 1][z], SEA_LEVEL) * H_SCALE;
        const h11 = Math.max(cornerH[x + 1][z + 1], SEA_LEVEL) * H_SCALE;
        const h01 = Math.max(cornerH[x][z + 1], SEA_LEVEL) * H_SCALE;

        // The four corners of this tile quad
        const v = vi;
        positions.push(x, h00, z);         // v+0: top-left
        positions.push(x + 1, h10, z);     // v+1: top-right
        positions.push(x + 1, h11, z + 1); // v+2: bottom-right
        positions.push(x, h01, z + 1);     // v+3: bottom-left

        // ── Determine color per vertex ──
        // Fine crosshatch dithering like original Populous:
        // Each vertex gets a color based on (x+z) parity PLUS per-tile variation
        const maxDiff = Math.max(
          Math.abs(h00 - h11),
          Math.abs(h10 - h01),
          Math.abs(h00 - h10),
          Math.abs(h00 - h01),
          Math.abs(h10 - h11),
          Math.abs(h01 - h11)
        );

        // Steep slope → brown cliff, gentle → green grass
        const steepness = maxDiff / H_SCALE;
        const isBeach = tileH === 1;
        const tileVar = tileHash(x, z); // per-tile variation 0..1

        // Corner positions in the grid for crosshatch pattern
        const cornerParities = [
          (x + z) % 2,         // v0: top-left
          (x + 1 + z) % 2,     // v1: top-right
          (x + 1 + z + 1) % 2, // v2: bottom-right
          (x + z + 1) % 2,     // v3: bottom-left
        ];

        for (let ci = 0; ci < 4; ci++) {
          let color: THREE.Color;
          const cp = cornerParities[ci];
          // Pick from color palette using parity + tile variation
          const palIdx = (cp + (tileVar > 0.5 ? 2 : 0)) % 4;

          if (isBeach && steepness < 0.8) {
            color = BEACH_COLOR;
          } else if (steepness > 1.0) {
            // Steep slope → brown crosshatch
            color = CLIFF_COLORS[palIdx];
          } else if (steepness > 0.3) {
            // Medium slope → blend green to brown
            const mix = (steepness - 0.3) / 0.7;
            color = GRASS_COLORS[palIdx].clone().lerp(CLIFF_COLORS[palIdx], mix);
          } else {
            // Flat grass — fine crosshatch dithering with per-tile variation
            color = GRASS_COLORS[palIdx];
          }

          colors.push(color.r, color.g, color.b);
        }

        // Two triangles for the quad
        indices.push(v, v + 2, v + 1);
        indices.push(v, v + 3, v + 2);
        vi += 4;
      }
    }

    // ── Step 3: Add cliff "skirt" faces at map edges and water transitions ──
    // Where a land tile borders water or the map edge, add a vertical face
    // down to sea level so there's no gap.
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const h = heightmap[x][z];
        if (h <= SEA_LEVEL) continue;

        const edges: [number, number, number, number, number, number][] = [
          // [neighborX, neighborZ, edge x0, z0, x1, z1]
          [x, z - 1, x, z, x + 1, z],       // south
          [x, z + 1, x + 1, z + 1, x, z + 1], // north
          [x - 1, z, x, z + 1, x, z],       // west
          [x + 1, z, x + 1, z, x + 1, z + 1], // east
        ];

        for (const [nx, nz, ex0, ez0, ex1, ez1] of edges) {
          let neighborH: number;
          if (nx < 0 || nx >= size || nz < 0 || nz >= size) {
            neighborH = 0; // map edge → treat as water
          } else {
            neighborH = heightmap[nx][nz];
          }

          if (neighborH <= SEA_LEVEL && h > SEA_LEVEL) {
            // Land borders water — draw a cliff face down to water level
            const topY0 = Math.max(cornerH[ex0][ez0], SEA_LEVEL) * H_SCALE;
            const topY1 = Math.max(cornerH[ex1][ez1], SEA_LEVEL) * H_SCALE;
            const botY = SEA_LEVEL * H_SCALE;

            // Clamp corner indices to valid range for edge lookups
            const clampedEx0 = Math.min(ex0, size);
            const clampedEz0 = Math.min(ez0, size);
            const clampedEx1 = Math.min(ex1, size);
            const clampedEz1 = Math.min(ez1, size);

            const top0 = Math.max(cornerH[clampedEx0][clampedEz0], SEA_LEVEL) * H_SCALE;
            const top1 = Math.max(cornerH[clampedEx1][clampedEz1], SEA_LEVEL) * H_SCALE;

            const w = vi;
            positions.push(ex0, top0, ez0);
            positions.push(ex1, top1, ez1);
            positions.push(ex1, botY, ez1);
            positions.push(ex0, botY, ez0);

            // Brown cliff face with crosshatch dithering
            const cpShore = [
              (ex0 + ez0) % 2,
              (ex1 + ez1) % 2,
              (ex1 + ez1 + 1) % 2,
              (ex0 + ez0 + 1) % 2,
            ];
            for (let ci = 0; ci < 4; ci++) {
              const palIdx = (cpShore[ci] + (tileHash(x, z) > 0.5 ? 2 : 0)) % 4;
              const c = CLIFF_COLORS[palIdx];
              colors.push(c.r, c.g, c.b);
            }

            indices.push(w, w + 1, w + 2);
            indices.push(w, w + 2, w + 3);
            vi += 4;
          }
        }
      }
    }

    this.geometry.dispose();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.setIndex(indices);
    this.terrainMesh.geometry = this.geometry;
  }

  updateTiles(_changedTiles: { x: number; z: number }[]): void {
    this.buildFullMesh();
  }

  getTerrainMesh(): THREE.Mesh {
    return this.terrainMesh;
  }

  dispose(): void {
    this.geometry.dispose();
    this.scene.remove(this.terrainMesh);
    this.scene.remove(this.waterMesh);
  }
}
