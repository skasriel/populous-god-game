import { World } from './World';
import { Walker } from './Walker';
import {
  SETTLEMENT_SPAWN_INTERVAL, SETTLEMENT_SPAWN_MIN_POP,
  SETTLEMENT_GROWTH_RATE, MAX_SETTLEMENT_POPULATION,
  BUILDING_TIERS, WALKER_SPAWN_POPULATION
} from '../utils/Constants';

let nextSettlementId = 1;

export class Settlement {
  readonly id: number;
  playerIndex: number;
  x: number;
  z: number;
  population: number;
  private spawnTimer: number;
  private cachedFlatArea: number = 1;
  private flatAreaCacheTime: number = 0;

  constructor(playerIndex: number, x: number, z: number, initialPopulation: number) {
    this.id = nextSettlementId++;
    this.playerIndex = playerIndex;
    this.x = x;
    this.z = z;
    this.population = initialPopulation;
    this.spawnTimer = SETTLEMENT_SPAWN_INTERVAL;
  }

  update(world: World, dt: number): Walker | null {
    // Grow population
    const tier = this.getTier();
    const maxPop = BUILDING_TIERS[tier].maxPop;
    if (this.population < maxPop) {
      this.population = Math.min(maxPop, this.population + SETTLEMENT_GROWTH_RATE * dt);
    }

    // Spawn walkers periodically
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.population >= SETTLEMENT_SPAWN_MIN_POP) {
      this.spawnTimer = SETTLEMENT_SPAWN_INTERVAL / (tier + 1); // Higher tier = faster spawning
      const spawnPop = Math.min(WALKER_SPAWN_POPULATION, Math.floor(this.population / 2));
      this.population -= spawnPop;

      // Spawn walker adjacent to settlement
      const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dz] of offsets) {
        const sx = this.x + dx;
        const sz = this.z + dz;
        if (world.isPassable(sx, sz)) {
          return new Walker(this.playerIndex, sx + 0.5, sz + 0.5, spawnPop);
        }
      }
      // All adjacent tiles blocked, try the settlement tile itself
      return new Walker(this.playerIndex, this.x + 0.5, this.z + 0.5, spawnPop);
    }

    return null;
  }

  /** Refresh the flat area cache (called less frequently) */
  updateFlatArea(world: World, gameTime: number): void {
    if (gameTime - this.flatAreaCacheTime > 2.0) { // refresh every 2 seconds
      this.cachedFlatArea = world.countFlatArea(this.x, this.z);
      this.flatAreaCacheTime = gameTime;
    }
  }

  /** Get the building tier based on flat area */
  getTier(): number {
    for (let i = BUILDING_TIERS.length - 1; i >= 0; i--) {
      if (this.cachedFlatArea >= BUILDING_TIERS[i].minFlat) {
        return i;
      }
    }
    return 0;
  }

  isDestroyed(): boolean {
    return this.population <= 0;
  }
}

export function resetSettlementIds(): void {
  nextSettlementId = 1;
}
