import { World } from './World';
import { Player } from './Player';
import { Walker, BehaviorMode } from './Walker';
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
        return Powers.earthquake(x, z, world, caster, opponent);
      case 'VOLCANO':
        return Powers.volcano(x, z, world, caster, opponent);
      case 'FLOOD':
        return Powers.flood(world, caster, opponent);
      case 'KNIGHT':
        return Powers.knight(caster);
      case 'ARMAGEDDON':
        return Powers.armageddon(caster, opponent, world);
      default:
        return false;
    }
  }

  /**
   * Swamp: Creates swamp on flat land that traps and kills walkers.
   * Per manual: "only works on flat land", "anyone falling in will drown"
   */
  private static swamp(cx: number, cz: number, world: World): boolean {
    const radius = 2;
    let placed = false;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= radius) {
          const tx = wrapCoord(cx + dx);
          const tz = wrapCoord(cz + dz);
          // Swamps can only exist on flat land (per manual)
          const h = world.getHeight(tx, tz);
          if (h > 0) {
            // Check if it's relatively flat
            let isFlat = true;
            for (const [ndx, ndz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
              const nh = world.getHeight(wrapCoord(tx+ndx), wrapCoord(tz+ndz));
              if (Math.abs(nh - h) > 1) { isFlat = false; break; }
            }
            if (isFlat) {
              world.setSwamp(tx, tz, true);
              placed = true;
            }
          }
        }
      }
    }
    return placed;
  }

  /**
   * Earthquake: Shakes up terrain, destroying buildings and drowning people.
   * Per manual: "shakes up the area, often destroying buildings and drowning people"
   * Affects BOTH sides (per manual: "Be sure not to devastate your own people")
   */
  private static earthquake(cx: number, cz: number, world: World, caster: Player, opponent: Player): boolean {
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

    // Destroy settlements in the area for BOTH players (per manual)
    for (const player of [caster, opponent]) {
      player.settlements = player.settlements.filter(s => {
        const dx = Math.abs(s.x - cx);
        const dz = Math.abs(s.z - cz);
        return dx * dx + dz * dz > radius * radius;
      });
    }

    return true;
  }

  /**
   * Volcano: Raises a massive peak, destroying everything nearby and scattering rocks.
   * Per manual: "raises the area to a considerable height, destroying settlements
   * and creating rocks over the affected area"
   */
  private static volcano(cx: number, cz: number, world: World, caster: Player, opponent: Player): boolean {
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

    // Destroy settlements in the area for BOTH players
    for (const player of [caster, opponent]) {
      player.settlements = player.settlements.filter(s => {
        const dx = s.x - cx;
        const dz = s.z - cz;
        return Math.sqrt(dx * dx + dz * dz) > radius * 0.7;
      });

      // Kill walkers caught in it
      player.walkers = player.walkers.filter(w => {
        const dx = w.x - cx;
        const dz = w.z - cz;
        return Math.sqrt(dx * dx + dz * dz) > radius * 0.5;
      });
    }

    return true;
  }

  /**
   * Flood: Raises the water level one increment over the entire landscape.
   * Per manual: "Raises the sea level one increment over the entire landscape"
   * Affects BOTH sides.
   */
  private static flood(world: World, caster: Player, opponent: Player): boolean {
    // Lower all terrain by 1 (effectively raising water level)
    for (let x = 0; x < world.size; x++) {
      for (let z = 0; z < world.size; z++) {
        const h = world.getHeight(x, z);
        if (h > 0) {
          world.setHeight(x, z, Math.max(0, h - 1));
        }
      }
    }

    // Destroy settlements on tiles that are now water (BOTH players)
    for (const player of [caster, opponent]) {
      player.settlements = player.settlements.filter(s => {
        return !world.isWater(s.x, s.z);
      });

      // Kill walkers in water
      player.walkers = player.walkers.filter(w => {
        return !world.isWater(Math.floor(w.x), Math.floor(w.z));
      });
    }

    return true;
  }

  /**
   * Knight: Transform the leader into a knight.
   * Per manual: "You must have a leader AND enough manna to use the effect"
   * "When you create a Knight, you lose your Leader (and the building if Leader was in one)"
   * "Knights are fighting machines. They look for the nearest enemy settlement,
   * kill whoever is there, and burn it down."
   */
  private static knight(caster: Player): boolean {
    // Must have a leader (per manual)
    const leader = caster.getLeader();
    if (!leader) return false;

    leader.isKnight = true;
    leader.isLeader = false;
    leader.population = Math.floor(leader.population * 1.5); // bonus strength
    caster.leaderId = null;
    // Note: the leader's building destruction is handled in Game.ts if leader was in a building
    return true;
  }

  /**
   * Armageddon: Both papal magnets move to center, all people leave homes
   * and march to center for final battle. Player cannot intervene.
   * Per manual: "Once you select Armageddon, you cannot alter the flow of events"
   */
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
      // Force GO_TO_MAGNET mode so everyone marches to center
      player.behaviorMode = BehaviorMode.GO_TO_MAGNET;
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
