import { GRID_SIZE, MAX_HEIGHT, SEA_LEVEL, WATER_COLOR, TERRAIN_COLORS, TILE_SIZE } from '../utils/Constants';
import { World } from '../game/World';
import * as THREE from 'three';

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
    this.terrainMesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    );
    scene.add(this.terrainMesh);

    // Create water plane
    const waterGeo = new THREE.PlaneGeometry(GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE);
    const waterMat = new THREE.MeshLambertMaterial({
      color: WATER_COLOR,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(GRID_SIZE / 2, SEA_LEVEL * TILE_SIZE + 0.05, GRID_SIZE / 2);
    scene.add(this.waterMesh);

    this.buildFullMesh();
  }

  /** Rebuild the entire terrain mesh from the heightmap */
  buildFullMesh(): void {
    const size = this.world.size;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    const heightmap = this.world.getHeightmap();

    // Create vertices: (size+1) x (size+1) grid of vertices
    for (let z = 0; z <= size; z++) {
      for (let x = 0; x <= size; x++) {
        // Height at vertex = average of surrounding tile heights
        const h = this.getVertexHeight(heightmap, x, z, size);
        positions.push(x * TILE_SIZE, h * TILE_SIZE * 0.5, z * TILE_SIZE);

        // Color based on height
        const color = this.getHeightColor(h);
        colors.push(color.r, color.g, color.b);

        // Placeholder normal (computed later)
        normals.push(0, 1, 0);
      }
    }

    // Create faces (two triangles per tile)
    const stride = size + 1;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const i = z * stride + x;
        // Triangle 1
        indices.push(i, i + stride, i + 1);
        // Triangle 2
        indices.push(i + 1, i + stride, i + stride + 1);
      }
    }

    this.geometry.dispose();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.setIndex(indices);
    this.geometry.computeVertexNormals();

    this.terrainMesh.geometry = this.geometry;
  }

  /** Update only affected tiles after terrain changes */
  updateTiles(changedTiles: { x: number; z: number }[]): void {
    if (changedTiles.length === 0) return;

    // For simplicity and correctness, rebuild the full mesh
    // Optimization: could update only affected vertices
    // But for a 64x64 grid this is fast enough
    this.buildFullMesh();
  }

  private getVertexHeight(heightmap: number[][], x: number, z: number, size: number): number {
    // Vertex height is the average of the 4 tiles sharing this vertex
    let sum = 0;
    let count = 0;
    for (let dx = -1; dx <= 0; dx++) {
      for (let dz = -1; dz <= 0; dz++) {
        const tx = ((x + dx) % size + size) % size;
        const tz = ((z + dz) % size + size) % size;
        sum += heightmap[tx][tz];
        count++;
      }
    }
    return sum / count;
  }

  private getHeightColor(height: number): THREE.Color {
    const idx = Math.round(Math.min(height, MAX_HEIGHT));
    const colorHex = TERRAIN_COLORS[idx] || TERRAIN_COLORS[0];
    return new THREE.Color(colorHex);
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
