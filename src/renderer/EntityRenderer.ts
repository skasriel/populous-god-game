import * as THREE from 'three';
import { World } from '../game/World';
import { Walker, WalkerState } from '../game/Walker';
import { Settlement } from '../game/Settlement';
import { PLAYER_COLOR, ENEMY_COLOR, TILE_SIZE, BUILDING_TIERS } from '../utils/Constants';

interface EntityMesh {
  mesh: THREE.Object3D;
  id: number;
}

export class EntityRenderer {
  private scene: THREE.Scene;
  private world: World;
  private walkerMeshes: Map<number, THREE.Object3D> = new Map();
  private settlementMeshes: Map<number, THREE.Object3D> = new Map();
  private magnetMeshes: Map<number, THREE.Object3D> = new Map();

  // Shared geometries for performance
  private walkerGeo: THREE.ConeGeometry;
  private playerMat: THREE.MeshLambertMaterial;
  private enemyMat: THREE.MeshLambertMaterial;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    this.walkerGeo = new THREE.ConeGeometry(0.25, 0.6, 6);
    this.playerMat = new THREE.MeshLambertMaterial({ color: PLAYER_COLOR });
    this.enemyMat = new THREE.MeshLambertMaterial({ color: ENEMY_COLOR });
  }

  updateWalkers(walkers: Walker[], playerIndex: number): void {
    const activeIds = new Set<number>();

    for (const walker of walkers) {
      activeIds.add(walker.id);
      let mesh = this.walkerMeshes.get(walker.id);

      if (!mesh) {
        // Create new walker mesh
        const mat = walker.playerIndex === 0 ? this.playerMat : this.enemyMat;
        const cone = new THREE.Mesh(this.walkerGeo, mat);
        // Scale based on population
        const group = new THREE.Group();
        group.add(cone);
        this.scene.add(group);
        this.walkerMeshes.set(walker.id, group);
        mesh = group;
      }

      // Update position
      const y = this.world.getHeightInterpolated(walker.x, walker.z) * TILE_SIZE * 0.5;
      mesh.position.set(walker.x, y + 0.3, walker.z);

      // Scale based on population
      const scale = 0.5 + (walker.population / 20) * 0.5;
      mesh.scale.setScalar(Math.min(scale, 1.5));

      // Pulse when fighting
      if (walker.state === WalkerState.FIGHTING) {
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        mesh.scale.multiplyScalar(pulse);
      }
    }

    // Remove meshes for dead walkers
    for (const [id, mesh] of this.walkerMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.walkerMeshes.delete(id);
      }
    }
  }

  updateSettlements(settlements: Settlement[]): void {
    const activeIds = new Set<number>();

    for (const settlement of settlements) {
      activeIds.add(settlement.id);
      let mesh = this.settlementMeshes.get(settlement.id);

      const tier = settlement.getTier();
      const tierData = BUILDING_TIERS[tier];

      if (!mesh) {
        mesh = this.createBuildingMesh(settlement, tier);
        this.scene.add(mesh);
        this.settlementMeshes.set(settlement.id, mesh);
      }

      // Update building if tier changed - check userData
      if ((mesh.userData as any).tier !== tier) {
        this.scene.remove(mesh);
        mesh = this.createBuildingMesh(settlement, tier);
        this.scene.add(mesh);
        this.settlementMeshes.set(settlement.id, mesh);
      }

      // Update position
      const y = this.world.getHeight(settlement.x, settlement.z) * TILE_SIZE * 0.5;
      mesh.position.set(settlement.x + 0.5, y, settlement.z + 0.5);
    }

    // Remove meshes for destroyed settlements
    for (const [id, mesh] of this.settlementMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.settlementMeshes.delete(id);
      }
    }
  }

  private createBuildingMesh(settlement: Settlement, tier: number): THREE.Object3D {
    const tierData = BUILDING_TIERS[tier];
    const group = new THREE.Group();

    const isPlayer = settlement.playerIndex === 0;
    const baseColor = isPlayer ? PLAYER_COLOR : ENEMY_COLOR;

    // Building body
    const sizes = [
      { w: 0.4, h: 0.3, d: 0.4 }, // Hut
      { w: 0.55, h: 0.45, d: 0.55 }, // House
      { w: 0.7, h: 0.6, d: 0.7 }, // Manor
      { w: 0.85, h: 0.8, d: 0.85 }, // Castle
    ];
    const s = sizes[tier];

    // Main body
    const bodyGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
    const bodyMat = new THREE.MeshLambertMaterial({ color: tierData.color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = s.h / 2;
    group.add(body);

    // Roof (pyramid)
    const roofGeo = new THREE.ConeGeometry(s.w * 0.7, s.h * 0.5, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: baseColor });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = s.h + s.h * 0.25;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // For castles, add turrets
    if (tier >= 3) {
      const turretGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6);
      const turretMat = new THREE.MeshLambertMaterial({ color: baseColor });
      for (const [tx, tz] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) {
        const turret = new THREE.Mesh(turretGeo, turretMat);
        turret.position.set(tx, s.h + 0.25, tz);
        group.add(turret);
      }
    }

    group.userData = { tier };
    return group;
  }

  updatePapalMagnets(magnets: { x: number; z: number; playerIndex: number }[]): void {
    const activeIds = new Set<number>();

    for (let i = 0; i < magnets.length; i++) {
      const m = magnets[i];
      activeIds.add(i);
      let mesh = this.magnetMeshes.get(i);

      if (!mesh) {
        const group = new THREE.Group();
        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6);
        const color = m.playerIndex === 0 ? PLAYER_COLOR : ENEMY_COLOR;
        const poleMat = new THREE.MeshLambertMaterial({ color });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 0.75;
        group.add(pole);

        // Flag
        const flagGeo = new THREE.PlaneGeometry(0.5, 0.3);
        const flagMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(0.25, 1.3, 0);
        group.add(flag);

        this.scene.add(group);
        this.magnetMeshes.set(i, group);
        mesh = group;
      }

      const y = this.world.getHeight(Math.floor(m.x), Math.floor(m.z)) * TILE_SIZE * 0.5;
      mesh.position.set(m.x + 0.5, y, m.z + 0.5);
    }

    for (const [id, mesh] of this.magnetMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.magnetMeshes.delete(id);
      }
    }
  }

  dispose(): void {
    this.walkerGeo.dispose();
    this.playerMat.dispose();
    this.enemyMat.dispose();
    for (const mesh of this.walkerMeshes.values()) this.scene.remove(mesh);
    for (const mesh of this.settlementMeshes.values()) this.scene.remove(mesh);
    for (const mesh of this.magnetMeshes.values()) this.scene.remove(mesh);
  }
}
