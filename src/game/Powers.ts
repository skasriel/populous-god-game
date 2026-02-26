import { World } from './World';
import { Player } from './Player';
import { Walker } from './Walker';
import { Settlement } from './Settlement';
import { wrapCoord, randomInt } from '../utils/MathUtils';
import { POWER_COSTS, GRID_SIZE, MAX_HEIGHT } from '../utils/Constants';

export type PowerType = 'SWAMP' | 'EARTHQUAKE' | 'VOLCANO' | 'FLOOD' | 'KNIGHT' | 'ARMAGEDDON';

export class Powers {
  static usePower(
    power: PowerType,
    x: number,
    z: number,
    caster: Player,
    opponent: Player,
    world: World
  ): boolean {
    const cost = POWER_COSTS[power];
    if (!caster.spendMana(cost)) return false;

    switch (power) {
      case 'SWAMP':
        return Powers.swamp(x, z, world);
      case 'EARTHQUAKE':
        return Powers.earthquake(x, z, world, opponent);
      case 'VOLCANO':
        return Powers.volcano(x, z, world, opponent);
      case 'FLOOD':
        return Powers.flood(world, opponent);
      case 'KNIGHT':
        return Powers.knight(caster);
      case 'ARMAGEDDON':
        return Powers.armageddon(caster, opponent, world);
      default:
        return false;
    }
  }

  /** Create swamp tiles that trap and kill enemy walkers */
  private static swamp(cx: number, cz: number, world: World): boolean {
    const radius = 2;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= radius) {
          world.setSwamp(wrapCoord(cx + dx), wrapCoord(cz + dz), true);
        }
      }
    }
    return true;
  }

  /** Randomize terrain heights in an area, destroying settlements */
  private static earthquake(cx: number, cz: number, world: World, opponent: Player): boolean {
    const radius = 4;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz <= radius * radius) {
          const tx = wrapCoord(cx + dx);
          const tz = wrapCoord(cz + dz);
          const currentH = world.getHeight(tx, tz);
          const newH = currentH + randomInt(-3, 3);
          world.setHeight(tx, tz, Math.max(0, Math.min(MAX_HEIGHT, newH)));
        }
      }
    }

    // Destroy settlements in the area
    opponent.settlements = opponent.settlements.filter(s => {
      const dx = Math.abs(s.x - cx);
      const dz = Math.abs(s.z - cz);
      return dx * dx + dz * dz > radius * radius;
    });

    return true;
  }

  /** Raise a massive peak, destroying everything nearby */
  private static volcano(cx: number, cz: number, world: World, opponent: Player): boolean {
    const radius = 5;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radius) {
          const tx = wrapCoord(cx + dx);
          const tz = wrapCoord(cz + dz);
          const height = Math.round(MAX_HEIGHT * (1 - dist / radius));
          world.setHeight(tx, tz, Math.max(world.getHeight(tx, tz), height));
        }
      }
    }

    // Destroy settlements in the area
    opponent.settlements = opponent.settlements.filter(s => {
      const dx = s.x - cx;
      const dz = s.z - cz;
      return Math.sqrt(dx * dx + dz * dz) > radius * 0.7;
    });

    // Kill walkers caught in it
    opponent.walkers = opponent.walkers.filter(w => {
      const dx = w.x - cx;
      const dz = w.z - cz;
      return Math.sqrt(dx * dx + dz * dz) > radius * 0.5;
    });

    return true;
  }

  /** Lower all terrain by 1, drowning low-lying settlements */
  private static flood(world: World, opponent: Player): boolean {
    // Raise water effectively by lowering terrain
    for (let x = 0; x < world.size; x++) {
      for (let z = 0; z < world.size; z++) {
        const h = world.getHeight(x, z);
        if (h > 0 && h <= 2) {
          world.setHeight(x, z, Math.max(0, h - 1));
        }
      }
    }

    // Destroy settlements on tiles that are now water
    opponent.settlements = opponent.settlements.filter(s => {
      return !world.isWater(s.x, s.z);
    });

    // Kill walkers in water
    opponent.walkers = opponent.walkers.filter(w => {
      return !world.isWater(Math.floor(w.x), Math.floor(w.z));
    });

    return true;
  }

  /** Transform the strongest walker into a knight */
  private static knight(caster: Player): boolean {
    if (caster.walkers.length === 0) return false;

    // Find strongest walker
    let best = caster.walkers[0];
    for (const w of caster.walkers) {
      if (w.population > best.population) best = w;
    }

    best.isKnight = true;
    best.population = Math.floor(best.population * 1.5); // bonus strength
    return true;
  }

  /** All walkers converge at center for final battle */
  private static armageddon(caster: Player, opponent: Player, world: World): boolean {
    const centerX = world.size / 2;
    const centerZ = world.size / 2;

    // Set all magnets to center
    caster.magnetX = centerX;
    caster.magnetZ = centerZ;
    opponent.magnetX = centerX;
    opponent.magnetZ = centerZ;

    // Release all walkers from settlements
    for (const player of [caster, opponent]) {
      for (const s of player.settlements) {
        const walker = new Walker(player.playerIndex, s.x + 0.5, s.z + 0.5, Math.floor(s.population));
        player.addWalker(walker);
      }
      player.settlements = [];
    }

    // Flatten center area for the battle
    const radius = 6;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz <= radius * radius) {
          world.setHeight(wrapCoord(centerX + dx), wrapCoord(centerZ + dz), 3);
        }
      }
    }

    return true;
  }
}
