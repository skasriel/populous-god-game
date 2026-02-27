import * as THREE from 'three';
import { World } from '../game/World';
import { Walker, WalkerState } from '../game/Walker';
import { Settlement } from '../game/Settlement';
import { PLAYER_COLOR, ENEMY_COLOR, TILE_SIZE, BUILDING_TIERS } from '../utils/Constants';
import { H_SCALE } from './TerrainRenderer';

// Sprite path prefix
const SP = '/sprites/Populous-SMS-';

// Town level sprite filenames (8 levels, Grassy Plains theme)
const TOWN_SPRITES = [
  `${SP}Townlevel1-GrassyPlains.png`,
  `${SP}Townlevel2-GrassyPlains.png`,
  `${SP}Townlevel3-GrassyPlains.png`,
  `${SP}Townlevel4-GrassyPlains.png`,
  `${SP}Townlevel5-GrassyPlains.png`,
  `${SP}Townlevel6-GrassyPlains.png`,
  `${SP}Townlevel7-GrassyPlains.png`,
  `${SP}Townlevel8-GrassyPlains.png`,
];

// Castle wall sprites
const CASTLE_WALL_A = `${SP}CastlewallA-GrassyPlains.png`;
const CASTLE_WALL_B = `${SP}CastlewallB-GrassyPlains.png`;

// Follower sprites
const FOLLOWER_GOOD = `${SP}FollowerGood-WalkingSouth.png`;
const FOLLOWER_EVIL = `${SP}FollowerEvil-WalkingSouth.png`;

// Papal magnet sprites
const MAGNET_GOOD = `${SP}PapalmagnetGood-GrassyPlains.png`;
const MAGNET_EVIL = `${SP}PapalmagnetEvil-GrassyPlains.png`;

// Tree sprites
const TREE_SPRITES = [
  `${SP}TreeA-GrassyPlains.png`,
  `${SP}TreeB-GrassyPlains.png`,
  `${SP}TreeC-GrassyPlains.png`,
];

// Rock sprites
const ROCK_HARD = `${SP}Rockhard-GrassyPlains.png`;
const ROCK_SOFT = `${SP}Rocksoft-GrassyPlains.png`;

// Map our 4 building tiers to town level sprites (0-indexed)
// Tier 0 → levels 1-2, Tier 1 → levels 3-4, Tier 2 → levels 5-6, Tier 3 → levels 7-8
const TIER_TO_LEVELS: [number, number][] = [
  [0, 1], // Tier 0: town levels 1-2
  [2, 3], // Tier 1: town levels 3-4
  [4, 5], // Tier 2: town levels 5-6
  [6, 7], // Tier 3: town levels 7-8
];

// Scale factor: how many world units per pixel
// Larger = bigger sprites. Pixelated look is intentional (NearestFilter).
const BUILDING_PX_SCALE = 0.055;  // Buildings fill ~1.5 tiles wide
const WALKER_PX_SCALE = 0.05;     // Walkers clearly visible
const MAGNET_PX_SCALE = 0.06;     // Magnets prominent

function loadTexture(path: string): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSprite(texture: THREE.Texture, pxWidth: number, pxHeight: number, pxScale: number, tintColor?: THREE.Color): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    color: tintColor || new THREE.Color(0xffffff),
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(pxWidth * pxScale, pxHeight * pxScale, 1);
  return sprite;
}

// Enemy tint — red-ish multiply on the sprite texture
const ENEMY_TINT = new THREE.Color(0xff6666);

export class EntityRenderer {
  private scene: THREE.Scene;
  private world: World;
  private walkerMeshes: Map<number, THREE.Sprite> = new Map();
  private settlementMeshes: Map<number, THREE.Object3D> = new Map();
  private magnetMeshes: Map<number, THREE.Sprite> = new Map();

  // Preloaded textures
  private townTextures: THREE.Texture[] = [];
  private wallTexA: THREE.Texture;
  private wallTexB: THREE.Texture;
  private followerGoodTex: THREE.Texture;
  private followerEvilTex: THREE.Texture;
  private magnetGoodTex: THREE.Texture;
  private magnetEvilTex: THREE.Texture;

  // Sprite pixel dimensions (approximate, from the actual files)
  private townSizes: [number, number][] = [
    [30, 22], [30, 22], [31, 24], [32, 24],
    [32, 24], [32, 23], [30, 22], [24, 24],
  ];
  private followerSize: [number, number] = [8, 16];
  private magnetGoodSize: [number, number] = [16, 24];
  private magnetEvilSize: [number, number] = [32, 24];
  private wallSizeA: [number, number] = [23, 20];
  private wallSizeB: [number, number] = [23, 20];

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    // Preload all textures
    this.townTextures = TOWN_SPRITES.map(path => loadTexture(path));
    this.wallTexA = loadTexture(CASTLE_WALL_A);
    this.wallTexB = loadTexture(CASTLE_WALL_B);
    this.followerGoodTex = loadTexture(FOLLOWER_GOOD);
    this.followerEvilTex = loadTexture(FOLLOWER_EVIL);
    this.magnetGoodTex = loadTexture(MAGNET_GOOD);
    this.magnetEvilTex = loadTexture(MAGNET_EVIL);
  }

  updateWalkers(walkers: Walker[], playerIndex: number): void {
    const activeIds = new Set<number>();

    for (const walker of walkers) {
      activeIds.add(walker.id);
      let sprite = this.walkerMeshes.get(walker.id);

      if (!sprite) {
        const tex = walker.playerIndex === 0 ? this.followerGoodTex : this.followerEvilTex;
        const tint = walker.playerIndex !== 0 ? ENEMY_TINT : undefined;
        sprite = createSprite(tex, this.followerSize[0], this.followerSize[1], WALKER_PX_SCALE, tint);
        this.scene.add(sprite);
        this.walkerMeshes.set(walker.id, sprite);
        sprite.userData = { isKnight: walker.isKnight, playerIndex: walker.playerIndex };
      }

      // Recreate if knight status changed (knights are slightly larger/tinted)
      if ((sprite.userData as any).isKnight !== walker.isKnight) {
        this.scene.remove(sprite);
        const tex = walker.playerIndex === 0 ? this.followerGoodTex : this.followerEvilTex;
        const tint = walker.playerIndex !== 0 ? ENEMY_TINT : undefined;
        sprite = createSprite(tex, this.followerSize[0], this.followerSize[1], WALKER_PX_SCALE, tint);
        if (walker.isKnight) {
          // Knights are larger
          sprite.scale.multiplyScalar(1.5);
        }
        sprite.userData = { isKnight: walker.isKnight, playerIndex: walker.playerIndex };
        this.scene.add(sprite);
        this.walkerMeshes.set(walker.id, sprite);
      }

      // Position on flat tile surface — sprite center is at its center,
      // so offset Y by half the sprite height
      const tileH = this.world.getHeight(Math.floor(walker.x), Math.floor(walker.z));
      const y = tileH * H_SCALE;
      const spriteH = this.followerSize[1] * WALKER_PX_SCALE * (walker.isKnight ? 1.5 : 1);
      sprite.position.set(walker.x, y + spriteH / 2, walker.z);

      // Scale slightly with population
      const popScale = 0.9 + (walker.population / 25) * 0.4;
      const baseScale = walker.isKnight ? 1.5 : 1.0;
      const s = Math.min(popScale, 1.5) * baseScale;
      sprite.scale.set(
        this.followerSize[0] * WALKER_PX_SCALE * s,
        this.followerSize[1] * WALKER_PX_SCALE * s,
        1
      );

      // Flash when fighting
      if (walker.state === WalkerState.FIGHTING) {
        const flash = Math.sin(Date.now() * 0.02) > 0;
        sprite.visible = flash;
      } else {
        sprite.visible = true;
      }
    }

    // Remove dead
    for (const [id, sprite] of this.walkerMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(sprite);
        this.walkerMeshes.delete(id);
      }
    }
  }

  updateSettlements(settlements: Settlement[]): void {
    const activeIds = new Set<number>();

    for (const settlement of settlements) {
      activeIds.add(settlement.id);
      let obj = this.settlementMeshes.get(settlement.id);
      const tier = settlement.getTier();

      // Map population directly to sprite level (0-7) across all 8 town sprites.
      // As population grows, the building visually upgrades: hut → house → manor → castle
      const maxPop = BUILDING_TIERS[Math.min(tier, BUILDING_TIERS.length - 1)].maxPop;
      const pop = settlement.population;
      let levelIdx: number;
      if (pop <= 3) levelIdx = 0;       // Tiny hut
      else if (pop <= 7) levelIdx = 1;   // Small hut
      else if (pop <= 12) levelIdx = 2;  // House
      else if (pop <= 18) levelIdx = 3;  // Larger house
      else if (pop <= 25) levelIdx = 4;  // Manor
      else if (pop <= 33) levelIdx = 5;  // Large manor
      else if (pop <= 42) levelIdx = 6;  // Castle
      else levelIdx = 7;                  // Grand castle

      if (!obj) {
        obj = this.createBuildingSprite(levelIdx, tier, settlement.playerIndex);
        this.scene.add(obj);
        this.settlementMeshes.set(settlement.id, obj);
      }

      // Rebuild if level changed
      if ((obj.userData as any).levelIdx !== levelIdx) {
        this.scene.remove(obj);
        obj = this.createBuildingSprite(levelIdx, tier, settlement.playerIndex);
        this.scene.add(obj);
        this.settlementMeshes.set(settlement.id, obj);
      }

      // Position on flat tile
      const y = this.world.getHeight(settlement.x, settlement.z) * H_SCALE;
      const [pw, ph] = this.townSizes[levelIdx];
      const spriteH = ph * BUILDING_PX_SCALE;
      obj.position.set(settlement.x + 0.5, y + spriteH / 2, settlement.z + 0.5);
    }

    // Remove destroyed
    for (const [id, obj] of this.settlementMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(obj);
        this.settlementMeshes.delete(id);
      }
    }
  }

  private createBuildingSprite(levelIdx: number, tier: number, playerIndex: number): THREE.Sprite {
    const tex = this.townTextures[levelIdx];
    const [pw, ph] = this.townSizes[levelIdx];
    const tint = playerIndex !== 0 ? ENEMY_TINT : undefined;
    const sprite = createSprite(tex, pw, ph, BUILDING_PX_SCALE, tint);
    sprite.userData = { tier, levelIdx };
    return sprite;
  }

  updatePapalMagnets(magnets: { x: number; z: number; playerIndex: number }[]): void {
    const activeIds = new Set<number>();

    for (let i = 0; i < magnets.length; i++) {
      const m = magnets[i];
      activeIds.add(i);
      let sprite = this.magnetMeshes.get(i);

      if (!sprite) {
        const isGood = m.playerIndex === 0;
        const tex = isGood ? this.magnetGoodTex : this.magnetEvilTex;
        const [pw, ph] = isGood ? this.magnetGoodSize : this.magnetEvilSize;
        sprite = createSprite(tex, pw, ph, MAGNET_PX_SCALE);
        this.scene.add(sprite);
        this.magnetMeshes.set(i, sprite);
      }

      const y = this.world.getHeight(Math.floor(m.x), Math.floor(m.z)) * H_SCALE;
      const isGood = m.playerIndex === 0;
      const [, ph] = isGood ? this.magnetGoodSize : this.magnetEvilSize;
      const spriteH = ph * MAGNET_PX_SCALE;
      sprite.position.set(m.x + 0.5, y + spriteH / 2, m.z + 0.5);
    }

    for (const [id, sprite] of this.magnetMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(sprite);
        this.magnetMeshes.delete(id);
      }
    }
  }

  dispose(): void {
    // Dispose textures
    for (const tex of this.townTextures) tex.dispose();
    this.wallTexA.dispose();
    this.wallTexB.dispose();
    this.followerGoodTex.dispose();
    this.followerEvilTex.dispose();
    this.magnetGoodTex.dispose();
    this.magnetEvilTex.dispose();
    // Remove meshes from scene
    for (const sprite of this.walkerMeshes.values()) this.scene.remove(sprite);
    for (const obj of this.settlementMeshes.values()) this.scene.remove(obj);
    for (const sprite of this.magnetMeshes.values()) this.scene.remove(sprite);
  }
}
