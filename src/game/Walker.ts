import { World } from './World';
import { wrapCoord, wrappedDirection, wrappedDistance, randomFloat } from '../utils/MathUtils';
import {
  WALKER_SPEED, WALKER_SETTLE_CHANCE, GRID_SIZE,
  TICK_INTERVAL, COMBAT_DURATION, TILE_SIZE, MIN_SETTLEMENT_DISTANCE
} from '../utils/Constants';

export enum WalkerState {
  WANDERING = 'WANDERING',
  SETTLING = 'SETTLING',
  FIGHTING = 'FIGHTING',
  MERGING = 'MERGING',
  KNIGHT = 'KNIGHT',
}

/**
 * Influence Behavior modes from the original Populous manual:
 * - GO_TO_MAGNET: Walkers follow leader toward papal magnet, won't settle
 * - SETTLE: Walkers seek flat land and build settlements
 * - FIGHT_THEN_SETTLE: Walkers look for enemies first, then settle
 * - GATHER_THEN_SETTLE: Walkers merge with friendly walkers, then settle
 */
export enum BehaviorMode {
  GO_TO_MAGNET = 'GO_TO_MAGNET',
  SETTLE = 'SETTLE',
  FIGHT_THEN_SETTLE = 'FIGHT_THEN_SETTLE',
  GATHER_THEN_SETTLE = 'GATHER_THEN_SETTLE',
}

let nextWalkerId = 1;

export class Walker {
  readonly id: number;
  playerIndex: number;
  x: number;
  z: number;
  population: number;
  state: WalkerState;
  isKnight: boolean;
  isLeader: boolean;

  // Walker exhaustion — walkers lose strength over time while walking
  stamina: number;

  // Movement
  private targetX: number;
  private targetZ: number;
  private moveTimer: number = 0;

  // Settle target — when in SETTLE mode, actively go to this flat tile
  settleTargetX: number | null = null;
  settleTargetZ: number | null = null;

  // Combat
  fightTimer: number = 0;
  fightOpponent: Walker | null = null;

  // Settling
  private settleTimer: number = 0;

  constructor(playerIndex: number, x: number, z: number, population: number) {
    this.id = nextWalkerId++;
    this.playerIndex = playerIndex;
    this.x = x;
    this.z = z;
    this.population = population;
    this.state = WalkerState.WANDERING;
    this.isKnight = false;
    this.isLeader = false;
    this.stamina = 100;
    this.targetX = x;
    this.targetZ = z;
  }

  update(
    world: World,
    magnetX: number | null,
    magnetZ: number | null,
    dt: number,
    behaviorMode: BehaviorMode = BehaviorMode.SETTLE,
    nearbyEnemies: Walker[] = [],
    nearbyFriendlies: Walker[] = []
  ): void {
    switch (this.state) {
      case WalkerState.WANDERING:
      case WalkerState.KNIGHT:
        this.updateWandering(world, magnetX, magnetZ, dt, behaviorMode, nearbyEnemies, nearbyFriendlies);
        break;
      case WalkerState.FIGHTING:
        this.updateFighting(dt);
        break;
      case WalkerState.SETTLING:
        break;
      case WalkerState.MERGING:
        break;
    }

    // Walker exhaustion: lose stamina while walking, die when depleted
    if (this.state === WalkerState.WANDERING && !this.isKnight) {
      this.stamina -= dt * 0.3; // Lose stamina slowly while walking
      if (this.stamina <= 0) {
        // Population decays when exhausted
        this.population -= 1;
        this.stamina = 20; // Reset some stamina after losing a person
      }
    }
  }

  private updateWandering(
    world: World,
    magnetX: number | null,
    magnetZ: number | null,
    dt: number,
    behaviorMode: BehaviorMode,
    nearbyEnemies: Walker[],
    nearbyFriendlies: Walker[]
  ): void {
    this.moveTimer -= dt;

    if (this.moveTimer <= 0) {
      this.pickNewTarget(world, magnetX, magnetZ, behaviorMode, nearbyEnemies, nearbyFriendlies);
      this.moveTimer = 0.5 + Math.random() * 0.5;
    }

    // Move toward target
    const dir = wrappedDirection(this.x, this.z, this.targetX, this.targetZ);
    const speed = WALKER_SPEED * dt;

    let newX = this.x + dir.dx * speed;
    let newZ = this.z + dir.dz * speed;

    // Wrap coordinates
    newX = ((newX % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
    newZ = ((newZ % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;

    // Check if new position is passable
    const tileX = Math.floor(newX);
    const tileZ = Math.floor(newZ);
    if (world.isPassable(tileX, tileZ)) {
      this.x = newX;
      this.z = newZ;
    } else {
      this.moveTimer = 0;
    }
  }

  private pickNewTarget(
    world: World,
    magnetX: number | null,
    magnetZ: number | null,
    behaviorMode: BehaviorMode,
    nearbyEnemies: Walker[],
    nearbyFriendlies: Walker[]
  ): void {
    if (this.isKnight) {
      // Knights seek nearest enemy settlement or walker — handled externally
      // but they also wander toward enemies
      if (nearbyEnemies.length > 0) {
        const target = nearbyEnemies[0];
        this.targetX = target.x;
        this.targetZ = target.z;
      } else {
        this.targetX = this.x + randomFloat(-10, 10);
        this.targetZ = this.z + randomFloat(-10, 10);
      }
      return;
    }

    switch (behaviorMode) {
      case BehaviorMode.GO_TO_MAGNET:
        // Walk toward papal magnet, don't settle
        if (magnetX !== null && magnetZ !== null) {
          this.targetX = magnetX + randomFloat(-2, 2);
          this.targetZ = magnetZ + randomFloat(-2, 2);
        } else {
          this.targetX = this.x + randomFloat(-5, 5);
          this.targetZ = this.z + randomFloat(-5, 5);
        }
        break;

      case BehaviorMode.SETTLE:
        // Actively go to settle target if we have one
        if (this.settleTargetX !== null && this.settleTargetZ !== null) {
          this.targetX = this.settleTargetX + 0.5;
          this.targetZ = this.settleTargetZ + 0.5;
        } else if (magnetX !== null && magnetZ !== null && Math.random() < 0.3) {
          this.targetX = magnetX + randomFloat(-8, 8);
          this.targetZ = magnetZ + randomFloat(-8, 8);
        } else {
          this.targetX = this.x + randomFloat(-5, 5);
          this.targetZ = this.z + randomFloat(-5, 5);
        }
        break;

      case BehaviorMode.FIGHT_THEN_SETTLE:
        // Seek enemies first, then settle
        if (nearbyEnemies.length > 0) {
          const target = nearbyEnemies[0];
          this.targetX = target.x;
          this.targetZ = target.z;
        } else if (this.settleTargetX !== null && this.settleTargetZ !== null) {
          this.targetX = this.settleTargetX + 0.5;
          this.targetZ = this.settleTargetZ + 0.5;
        } else if (magnetX !== null && magnetZ !== null && Math.random() < 0.4) {
          this.targetX = magnetX + randomFloat(-5, 5);
          this.targetZ = magnetZ + randomFloat(-5, 5);
        } else {
          this.targetX = this.x + randomFloat(-5, 5);
          this.targetZ = this.z + randomFloat(-5, 5);
        }
        break;

      case BehaviorMode.GATHER_THEN_SETTLE:
        // Seek friendly walkers to merge with, then settle
        if (nearbyFriendlies.length > 0) {
          const target = nearbyFriendlies[0];
          this.targetX = target.x;
          this.targetZ = target.z;
        } else if (magnetX !== null && magnetZ !== null && Math.random() < 0.4) {
          this.targetX = magnetX + randomFloat(-5, 5);
          this.targetZ = magnetZ + randomFloat(-5, 5);
        } else {
          this.targetX = this.x + randomFloat(-5, 5);
          this.targetZ = this.z + randomFloat(-5, 5);
        }
        break;
    }
  }

  private updateFighting(dt: number): void {
    this.fightTimer -= dt;
    if (this.fightTimer <= 0) {
      this.state = WalkerState.WANDERING;
      this.fightOpponent = null;
    }
  }

  /** Check if this walker should attempt to settle */
  shouldSettle(world: World, behaviorMode: BehaviorMode): boolean {
    if (this.state !== WalkerState.WANDERING) return false;
    if (this.isKnight) return false;
    if (this.isLeader) return false;
    if (behaviorMode === BehaviorMode.GO_TO_MAGNET) return false;

    const tileX = Math.floor(this.x);
    const tileZ = Math.floor(this.z);
    if (!world.isPassable(tileX, tileZ)) return false;

    const flatArea = world.countFlatArea(tileX, tileZ);
    if (flatArea < 2) return false;

    // If we have a settle target and we've arrived, settle immediately
    if (this.settleTargetX !== null && this.settleTargetZ !== null) {
      if (tileX === this.settleTargetX && tileZ === this.settleTargetZ) {
        return true; // Arrived at target — settle now
      }
    }

    // Otherwise, small random chance per tick (for walkers without a target)
    return Math.random() < WALKER_SETTLE_CHANCE;
  }

  /** Restore stamina when entering a settlement */
  restoreStamina(): void {
    this.stamina = 100;
  }

  startFight(opponent: Walker): void {
    this.state = WalkerState.FIGHTING;
    this.fightTimer = COMBAT_DURATION;
    this.fightOpponent = opponent;
  }

  getTileX(): number { return Math.floor(this.x); }
  getTileZ(): number { return Math.floor(this.z); }
}

export function resetWalkerIds(): void {
  nextWalkerId = 1;
}
