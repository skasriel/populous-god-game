import { World } from './World';
import { Player } from './Player';
import { Walker, WalkerState } from './Walker';
import {
  AI_THINK_INTERVAL, AI_TERRAIN_ACTIONS_PER_THINK,
  TERRAIN_RAISE_COST, GRID_SIZE, POWER_COSTS
} from '../utils/Constants';
import { wrapCoord, wrappedDistance, randomInt } from '../utils/MathUtils';

export class AIPlayer {
  private player: Player;
  private world: World;
  private thinkTimer: number = 0;

  constructor(player: Player, world: World) {
    this.player = player;
    this.world = world;
  }

  update(dt: number, enemyPlayer: Player): void {
    this.thinkTimer -= dt;

    if (this.thinkTimer <= 0) {
      this.thinkTimer = AI_THINK_INTERVAL;
      this.think(enemyPlayer);
    }
  }

  private think(enemy: Player): void {
    // Strategy priorities:
    // 1. Flatten terrain near own settlements for growth
    // 2. Move papal magnet strategically
    // 3. Use divine powers when available

    this.flattenNearSettlements();
    this.updateMagnet(enemy);
    this.usePowers(enemy);
  }

  private flattenNearSettlements(): void {
    // Find settlements and try to flatten surrounding terrain
    for (const settlement of this.player.settlements) {
      let actionsLeft = AI_TERRAIN_ACTIONS_PER_THINK;

      for (let dx = -2; dx <= 2 && actionsLeft > 0; dx++) {
        for (let dz = -2; dz <= 2 && actionsLeft > 0; dz++) {
          const tx = wrapCoord(settlement.x + dx);
          const tz = wrapCoord(settlement.z + dz);
          const targetHeight = this.world.getHeight(settlement.x, settlement.z);
          const currentHeight = this.world.getHeight(tx, tz);

          if (currentHeight !== targetHeight && this.player.spendMana(TERRAIN_RAISE_COST)) {
            if (currentHeight < targetHeight) {
              this.world.raiseTerrain(tx, tz);
            } else {
              this.world.lowerTerrain(tx, tz);
            }
            actionsLeft--;
          }
        }
      }
    }

    // If we have no settlements but have walkers, try to flatten where walkers are
    if (this.player.settlements.length === 0 && this.player.walkers.length > 0) {
      const walker = this.player.walkers[0];
      const tx = Math.floor(walker.x);
      const tz = Math.floor(walker.z);
      const h = this.world.getHeight(tx, tz);

      // Flatten a small area at walker height
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nx = wrapCoord(tx + dx);
          const nz = wrapCoord(tz + dz);
          const nh = this.world.getHeight(nx, nz);
          if (nh !== h && this.player.spendMana(TERRAIN_RAISE_COST)) {
            if (nh < h) this.world.raiseTerrain(nx, nz);
            else this.world.lowerTerrain(nx, nz);
          }
        }
      }
    }
  }

  private updateMagnet(enemy: Player): void {
    // Move magnet based on strategy

    if (this.player.settlements.length > 0 && enemy.settlements.length > 0) {
      // If we're stronger, move toward enemy
      const ourPop = this.player.getTotalPopulation();
      const enemyPop = enemy.getTotalPopulation();

      if (ourPop > enemyPop * 1.5) {
        // Attack! Move magnet toward enemy settlements
        const target = enemy.settlements[Math.floor(Math.random() * enemy.settlements.length)];
        this.player.magnetX = target.x;
        this.player.magnetZ = target.z;
      } else {
        // Defensive — magnet near our settlements to consolidate
        const s = this.player.settlements[Math.floor(Math.random() * this.player.settlements.length)];
        this.player.magnetX = s.x + randomInt(-5, 5);
        this.player.magnetZ = s.z + randomInt(-5, 5);
      }
    } else if (this.player.settlements.length === 0) {
      // No settlements — send walkers to explore
      const pos = this.world.findRandomLandTile();
      if (pos) {
        this.player.magnetX = pos.x;
        this.player.magnetZ = pos.z;
      }
    }
  }

  private usePowers(enemy: Player): void {
    // Use earthquake on enemy settlements if we have enough mana
    if (this.player.mana >= POWER_COSTS.EARTHQUAKE && enemy.settlements.length > 0) {
      // 20% chance per think cycle to use earthquake
      if (Math.random() < 0.2) {
        const target = enemy.settlements[Math.floor(Math.random() * enemy.settlements.length)];
        this.useEarthquake(target.x, target.z);
      }
    }

    // Use swamp occasionally
    if (this.player.mana >= POWER_COSTS.SWAMP && enemy.walkers.length > 0) {
      if (Math.random() < 0.15) {
        const target = enemy.walkers[Math.floor(Math.random() * enemy.walkers.length)];
        this.useSwamp(Math.floor(target.x), Math.floor(target.z));
      }
    }
  }

  private useEarthquake(cx: number, cz: number): void {
    if (!this.player.spendMana(POWER_COSTS.EARTHQUAKE)) return;

    const radius = 3;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz <= radius * radius) {
          const tx = wrapCoord(cx + dx);
          const tz = wrapCoord(cz + dz);
          const newH = randomInt(0, 6);
          this.world.setHeight(tx, tz, newH);
        }
      }
    }
  }

  private useSwamp(x: number, z: number): void {
    if (!this.player.spendMana(POWER_COSTS.SWAMP)) return;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        this.world.setSwamp(wrapCoord(x + dx), wrapCoord(z + dz), true);
      }
    }
  }
}
