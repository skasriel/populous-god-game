import { Walker, BehaviorMode } from './Walker';
import { Settlement } from './Settlement';
import { STARTING_MANA, MAX_MANA, MANA_PER_POPULATION, INITIAL_WALKER_POPULATION } from '../utils/Constants';
import { World } from './World';

export class Player {
  readonly playerIndex: number; // 0 = human, 1 = AI
  mana: number;
  walkers: Walker[] = [];
  settlements: Settlement[] = [];
  magnetX: number | null = null;
  magnetZ: number | null = null;
  isHuman: boolean;

  // Leader — the first walker to touch the papal magnet (per manual)
  leaderId: number | null = null;

  // Behavior mode — controls how all walkers behave (per manual)
  behaviorMode: BehaviorMode = BehaviorMode.SETTLE;

  constructor(playerIndex: number, isHuman: boolean) {
    this.playerIndex = playerIndex;
    this.isHuman = isHuman;
    this.mana = STARTING_MANA;
  }

  /** Get the current leader walker, or null */
  getLeader(): Walker | null {
    if (this.leaderId === null) return null;
    return this.walkers.find(w => w.id === this.leaderId) || null;
  }

  /** Check if a walker has touched the papal magnet, making them leader */
  checkLeaderMagnet(): void {
    if (this.magnetX === null || this.magnetZ === null) return;
    if (this.getLeader()) return; // Already have a leader

    for (const walker of this.walkers) {
      if (walker.isKnight) continue;
      const dx = Math.abs(walker.x - this.magnetX);
      const dz = Math.abs(walker.z - this.magnetZ!);
      if (dx < 1.5 && dz < 1.5) {
        this.setLeader(walker);
        return;
      }
    }
  }

  setLeader(walker: Walker): void {
    const oldLeader = this.getLeader();
    if (oldLeader) oldLeader.isLeader = false;
    walker.isLeader = true;
    this.leaderId = walker.id;
  }

  /** Called when the leader dies — magnet moves to death location (per manual) */
  onLeaderDeath(deathX: number, deathZ: number): void {
    this.magnetX = Math.floor(deathX);
    this.magnetZ = Math.floor(deathZ);
    this.leaderId = null;
  }

  getTotalPopulation(): number {
    let pop = 0;
    for (const w of this.walkers) pop += w.population;
    for (const s of this.settlements) pop += Math.floor(s.population);
    return pop;
  }

  getWalkerPopulation(): number {
    let pop = 0;
    for (const w of this.walkers) pop += w.population;
    return pop;
  }

  getSettlementPopulation(): number {
    let pop = 0;
    for (const s of this.settlements) pop += Math.floor(s.population);
    return pop;
  }

  updateMana(dt: number): void {
    const totalPop = this.getTotalPopulation();
    this.mana = Math.min(MAX_MANA, this.mana + totalPop * MANA_PER_POPULATION * dt);
  }

  spendMana(cost: number): boolean {
    if (this.mana >= cost) {
      this.mana -= cost;
      return true;
    }
    return false;
  }

  addWalker(walker: Walker): void {
    this.walkers.push(walker);
  }

  removeWalker(walker: Walker): void {
    // If the leader dies, handle magnet movement (per manual)
    if (walker.id === this.leaderId) {
      this.onLeaderDeath(walker.x, walker.z);
    }
    const idx = this.walkers.indexOf(walker);
    if (idx >= 0) this.walkers.splice(idx, 1);
  }

  addSettlement(settlement: Settlement): void {
    this.settlements.push(settlement);
  }

  removeSettlement(settlement: Settlement): void {
    const idx = this.settlements.indexOf(settlement);
    if (idx >= 0) this.settlements.splice(idx, 1);
  }

  spawnInitialWalkers(world: World): void {
    const quarter = world.size / 4;
    const regionMinX = this.playerIndex === 0 ? 0 : world.size / 2;
    const regionMaxX = this.playerIndex === 0 ? world.size / 2 : world.size;
    const regionMinZ = 0;
    const regionMaxZ = world.size;

    // Spawn 3 initial walkers
    for (let i = 0; i < 3; i++) {
      const pos = world.findLandInRegion(regionMinX, regionMaxX, regionMinZ, regionMaxZ);
      if (pos) {
        const walker = new Walker(this.playerIndex, pos.x + 0.5, pos.z + 0.5, INITIAL_WALKER_POPULATION);
        this.addWalker(walker);
        // First walker starts as leader (per manual)
        if (i === 0) {
          this.setLeader(walker);
        }
      }
    }

    // Set initial papal magnet roughly in center of territory
    const magnetPos = world.findLandInRegion(
      regionMinX + quarter / 2, regionMaxX - quarter / 2,
      world.size / 4, world.size * 3 / 4
    );
    if (magnetPos) {
      this.magnetX = magnetPos.x;
      this.magnetZ = magnetPos.z;
    }
  }

  isDefeated(): boolean {
    return this.walkers.length === 0 && this.settlements.length === 0;
  }
}
