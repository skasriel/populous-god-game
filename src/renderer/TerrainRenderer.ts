import { GRID_SIZE, MAX_HEIGHT, SEA_LEVEL, WATER_COLOR, TILE_SIZE } from '../utils/Constants';
import { World } from '../game/World';
import * as THREE from 'three';

// Height scale: each height unit = this many world units vertically
// Original Populous had very pronounced height steps
const H_SCALE = 0.5;

// ── Original Populous Color Palette ──
// The original game used bright green for land tops, with brown/sandy
// cliff walls for height transitions. Very flat-shaded, no gradients.
const LAND_TOP_COLOR = new THREE.Color(0x30b830);      // Vivid bright green (land top)
const LAND_WALL_COLOR = new THREE.Color(0xc08040);     // Brown/sandy (cliff wall front-lit)
const LAND_WALL_SHADOW = new THREE.Color(0x906020);    // Darker brown (cliff wall shadow)
const BEACH_COLOR = new THREE.Color(0xd4c882);         // Sandy beach at height 1
const UNDERWATER_COLOR = new THREE.Color(0x2a6a2a);    // Submerged land

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

    // Create terrain geometry - flat shaded for retro look
    this.geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide });
    this.terrainMesh = new THREE.Mesh(this.geometry, material);
    scene.add(this.terrainMesh);

    // ── Map border ── gives the "book/table" feel from Populous
    this.createMapBorder(scene);

    // Create water plane — dark blue with diagonal ripple pattern like original Populous
    const waterGeo = new THREE.PlaneGeometry(GRID_SIZE * TILE_SIZE + 10, GRID_SIZE * TILE_SIZE + 10);
    const waterCanvas = document.createElement('canvas');
    waterCanvas.width = 128;
    waterCanvas.height = 128;
    const wctx = waterCanvas.getContext('2d')!;
    // Base deep blue
    wctx.fillStyle = '#1848b0';
    wctx.fillRect(0, 0, 128, 128);
    // Diagonal dark ripple lines — Populous-style hash pattern
    wctx.strokeStyle = '#0c3080';
    wctx.lineWidth = 1;
    for (let i = -128; i < 256; i += 4) {
      wctx.beginPath();
      wctx.moveTo(i, 0);
      wctx.lineTo(i + 128, 128);
      wctx.stroke();
    }
    // Subtle lighter highlights between
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
    const waterMat = new THREE.MeshBasicMaterial({
      map: waterTexture,
      side: THREE.DoubleSide,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(GRID_SIZE / 2, (SEA_LEVEL + 0.5) * H_SCALE, GRID_SIZE / 2);
    scene.add(this.waterMesh);

    this.buildFullMesh();
  }

  /**
   * Create a decorative border around the map — like the stone/ornate frame
   * visible in Populous screenshots. The game world sits on a raised platform.
   */
  private createMapBorder(scene: THREE.Scene): void {
    const mapSize = GRID_SIZE * TILE_SIZE;
    const borderWidth = 1.5;
    const borderHeight = 2.0;
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x888888 }); // gray stone
    const borderTopMat = new THREE.MeshBasicMaterial({ color: 0x999999 }); // lighter top
    const borderTrimMat = new THREE.MeshBasicMaterial({ color: 0xcc4422 }); // red trim accent

    // Four side walls around the map
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

    // Red trim strip along top of border
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

    // Floor beneath the water (bottom of the map area)
    const floorGeo = new THREE.PlaneGeometry(mapSize + borderWidth * 2, mapSize + borderWidth * 2);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0c2050, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mapSize / 2, -borderHeight, mapSize / 2);
    scene.add(floor);
  }

  /**
   * Build terrain as flat-topped tiles with vertical cliff walls.
   * Original Populous style: each tile is a flat colored diamond at its height,
   * with darker walls on height transitions. Single green color for all land.
   */
  buildFullMesh(): void {
    const size = this.world.size;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const heightmap = this.world.getHeightmap();
    let vi = 0; // vertex index

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const h = heightmap[x][z];
        const y = h * H_SCALE;
        const isBeach = h === 1;
        const topColor = isBeach ? BEACH_COLOR : LAND_TOP_COLOR;

        // Only draw top face for tiles above water
        if (h > SEA_LEVEL) {
          // ── Top face (flat quad) ──
          const v = vi;
          positions.push(x, y, z);           // v+0
          positions.push(x + 1, y, z);       // v+1
          positions.push(x + 1, y, z + 1);   // v+2
          positions.push(x, y, z + 1);       // v+3

          for (let i = 0; i < 4; i++) {
            colors.push(topColor.r, topColor.g, topColor.b);
          }

          indices.push(v, v + 2, v + 1);
          indices.push(v, v + 3, v + 2);
          vi += 4;
        }

        // ── Cliff walls ──
        // Draw walls where this tile is higher than its neighbor.
        // Use two shades for left/right vs front/back walls (like original).
        const edges: [number, number, number, number, number, number, THREE.Color][] = [
          // [nx, nz, edge x0, z0, x1, z1, wallColor]
          // South wall (z-1): lighter shade (front-facing)
          [x, z - 1, x, z, x + 1, z, LAND_WALL_COLOR],
          // North wall (z+1): shadow shade
          [x, z + 1, x + 1, z + 1, x, z + 1, LAND_WALL_SHADOW],
          // West wall (x-1): shadow shade
          [x - 1, z, x, z + 1, x, z, LAND_WALL_SHADOW],
          // East wall (x+1): lighter shade (front-facing)
          [x + 1, z, x + 1, z, x + 1, z + 1, LAND_WALL_COLOR],
        ];

        for (const [nx, nz, ex0, ez0, ex1, ez1, wallColor] of edges) {
          const wnx = ((nx % size) + size) % size;
          const wnz = ((nz % size) + size) % size;
          const nh = heightmap[wnx][wnz];

          if (h > nh && h > SEA_LEVEL) {
            // Wall goes from this tile's top down to max(neighbor height, sea level)
            const bottomY = Math.max(nh, SEA_LEVEL) * H_SCALE;
            const topY = y;

            const w = vi;
            positions.push(ex0, topY, ez0);
            positions.push(ex1, topY, ez1);
            positions.push(ex1, bottomY, ez1);
            positions.push(ex0, bottomY, ez0);

            for (let i = 0; i < 4; i++) {
              colors.push(wallColor.r, wallColor.g, wallColor.b);
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
    // No computeVertexNormals — using MeshBasicMaterial for flat-shaded retro look

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
