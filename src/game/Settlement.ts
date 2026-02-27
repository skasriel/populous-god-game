import { World } from './World';
import { Walker, BehaviorMode } from './Walker';
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
  private releaseTimer: number = 0; // Timer for releasing walkers in non-SETTLE modes
  cachedFlatArea: number = 1;
  private flatAreaCacheTime: number = 0;

  constructor(playerIndex: number, x: number, z: number, initialPopulation: number) {
    this.id = nextSettlementId++;
    this.playerIndex = playerIndex;
    this.x = x;
    this.z = z;
    this.population = initialPopulation;
    this.spawnTimer = SETTLEMENT_SPAWN_INTERVAL;
  }

  update(world: World, dt: number, behaviorMode: BehaviorMode = BehaviorMode.SETTLE): Walker | null {
    const tier = this.getTier();
    const maxPop = BUILDING_TIERS[tier].maxPop;

    // In SETTLE mode, population grows over time
    if (behaviorMode === BehaviorMode.SETTLE || behaviorMode === BehaviorMode.FIGHT_THEN_SETTLE) {
      if (this.population < maxPop) {
        const growthMultiplier = 0.5 + (this.cachedFlatArea / 12) * 1.5;
        this.population = Math.min(maxPop, this.population + SETTLEMENT_GROWTH_RATE * growthMultiplier * dt);
      }

      // Natural spawning — only when settlement is nearly full
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.population >= maxPop * 0.8) {
        this.spawnTimer = SETTLEMENT_SPAWN_INTERVAL / (tier + 1);
        const spawnPop = Math.min(WALKER_SPAWN_POPULATION, Math.floor(this.population / 3));
        if (spawnPop >= 1) {
          this.population -= spawnPop;
          return this.spawnWalkerAdjacent(world, spawnPop);
        }
      }
    } else {
      // In GO_TO_MAGNET or GATHER mode: release one person periodically
      // Population still grows slowly but people leave toward the magnet
      if (this.population < maxPop) {
        this.population = Math.min(maxPop, this.population + SETTLEMENT_GROWTH_RATE * 0.3 * dt);
      }

      this.releaseTimer -= dt;
      if (this.releaseTimer <= 0 && this.population >= 2) {
        this.releaseTimer = 3.0; // Release one person every 3 seconds
        this.population -= 1;
        return this.spawnWalkerAdjacent(world, 1);
      }
    }

    return null;
  }

  private spawnWalkerAdjacent(world: World, pop: number): Walker {
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dz] of offsets) {
      const sx = this.x + dx;
      const sz = this.z + dz;
      if (world.isPassable(sx, sz)) {
        return new Walker(this.playerIndex, sx + 0.5, sz + 0.5, pop);
      }
    }
    return new Walker(this.playerIndex, this.x + 0.5, this.z + 0.5, pop);
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
