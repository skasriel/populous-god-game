import { World } from './World';
import { wrapCoord, wrappedDirection, wrappedDistance, randomFloat } from '../utils/MathUtils';
import {
  WALKER_SPEED, WALKER_SETTLE_CHANCE, GRID_SIZE,
  TICK_INTERVAL, COMBAT_DURATION, TILE_SIZE
} from '../utils/Constants';

export enum WalkerState {
  WANDERING = 'WANDERING',
  SETTLING = 'SETTLING',
  FIGHTING = 'FIGHTING',
  MERGING = 'MERGING',
  KNIGHT = 'KNIGHT',
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

  // Movement
  private targetX: number;
  private targetZ: number;
  private moveTimer: number = 0;

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
    this.targetX = x;
    this.targetZ = z;
  }

  update(
    world: World,
    magnetX: number | null,
    magnetZ: number | null,
    dt: number
  ): void {
    switch (this.state) {
      case WalkerState.WANDERING:
      case WalkerState.KNIGHT:
        this.updateWandering(world, magnetX, magnetZ, dt);
        break;
      case WalkerState.FIGHTING:
        this.updateFighting(dt);
        break;
      case WalkerState.SETTLING:
        // Settling is handled externally
        break;
      case WalkerState.MERGING:
        // Merging is instant
        break;
    }
  }

  private updateWandering(
    world: World,
    magnetX: number | null,
    magnetZ: number | null,
    dt: number
  ): void {
    this.moveTimer -= dt;

    if (this.moveTimer <= 0) {
      this.pickNewTarget(world, magnetX, magnetZ);
      this.moveTimer = 0.5 + Math.random() * 0.5; // re-evaluate every 0.5-1s
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
      // Pick a new direction if blocked
      this.moveTimer = 0;
    }
  }

  private pickNewTarget(
    world: World,
    magnetX: number | null,
    magnetZ: number | null
  ): void {
    if (this.isKnight) {
      // Knights ignore the magnet and just wander aggressively (combat handled externally)
      this.targetX = this.x + randomFloat(-10, 10);
      this.targetZ = this.z + randomFloat(-10, 10);
      return;
    }

    if (magnetX !== null && magnetZ !== null) {
      // 70% chance to move toward magnet, 30% random wander
      if (Math.random() < 0.7) {
        // Add some randomness to prevent all walkers bunching up
        this.targetX = magnetX + randomFloat(-3, 3);
        this.targetZ = magnetZ + randomFloat(-3, 3);
        return;
      }
    }

    // Random wander
    this.targetX = this.x + randomFloat(-5, 5);
    this.targetZ = this.z + randomFloat(-5, 5);
  }

  private updateFighting(dt: number): void {
    this.fightTimer -= dt;
    if (this.fightTimer <= 0) {
      this.state = WalkerState.WANDERING;
      this.fightOpponent = null;
    }
  }

  /** Check if this walker should attempt to settle */
  shouldSettle(world: World): boolean {
    if (this.state !== WalkerState.WANDERING) return false;
    if (this.isKnight) return false;

    // Don't settle too eagerly
    if (Math.random() > WALKER_SETTLE_CHANCE) return false;

    const tileX = Math.floor(this.x);
    const tileZ = Math.floor(this.z);

    // Need at least 1 flat tile
    const flatArea = world.countFlatArea(tileX, tileZ);
    return flatArea >= 1 && world.isPassable(tileX, tileZ);
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
