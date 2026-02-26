import { World } from './World';
import { Player } from './Player';
import { Walker, WalkerState } from './Walker';
import { Settlement } from './Settlement';
import { wrappedDistance } from '../utils/MathUtils';
import {
  COMBAT_DURATION, TICK_INTERVAL
} from '../utils/Constants';

export class Combat {
  /** Check for combat between opposing walkers, and merging between friendly walkers */
  static resolveInteractions(players: Player[], world: World): void {
    const allWalkers: Walker[] = [];
    for (const p of players) {
      allWalkers.push(...p.walkers);
    }

    // Check each pair
    for (let i = 0; i < allWalkers.length; i++) {
      const a = allWalkers[i];
      if (a.state === WalkerState.FIGHTING || a.state === WalkerState.SETTLING) continue;
      if (a.population <= 0) continue;

      for (let j = i + 1; j < allWalkers.length; j++) {
        const b = allWalkers[j];
        if (b.state === WalkerState.FIGHTING || b.state === WalkerState.SETTLING) continue;
        if (b.population <= 0) continue;

        const dist = wrappedDistance(a.x, a.z, b.x, b.z);
        if (dist > 1.0) continue; // Only interact when close

        if (a.playerIndex === b.playerIndex) {
          // Merge friendly walkers
          Combat.mergeWalkers(a, b, players[a.playerIndex]);
        } else {
          // Combat between enemies
          Combat.startCombat(a, b);
        }
      }
    }

    // Clean up dead walkers
    for (const p of players) {
      p.walkers = p.walkers.filter(w => w.population > 0);
    }
  }

  private static mergeWalkers(a: Walker, b: Walker, player: Player): void {
    // Merge b into a
    a.population += b.population;
    b.population = 0;
    player.removeWalker(b);
  }

  private static startCombat(a: Walker, b: Walker): void {
    if (a.state === WalkerState.FIGHTING || b.state === WalkerState.FIGHTING) return;

    a.startFight(b);
    b.startFight(a);

    // Resolve immediately — winner is the one with more population
    // Both take losses
    const aStr = a.population * (a.isKnight ? 2 : 1);
    const bStr = b.population * (b.isKnight ? 2 : 1);

    if (aStr > bStr) {
      a.population = Math.max(1, Math.floor(a.population - b.population * 0.7));
      b.population = 0;
    } else if (bStr > aStr) {
      b.population = Math.max(1, Math.floor(b.population - a.population * 0.7));
      a.population = 0;
    } else {
      // Draw — both take heavy losses
      a.population = Math.max(1, Math.floor(a.population * 0.3));
      b.population = Math.max(1, Math.floor(b.population * 0.3));
    }
  }

  /** Check if walkers are attacking enemy settlements */
  static resolveSettlementAttacks(players: Player[], world: World): void {
    for (const attacker of players) {
      for (const defender of players) {
        if (attacker === defender) continue;

        for (const walker of attacker.walkers) {
          if (walker.state === WalkerState.FIGHTING || walker.state === WalkerState.SETTLING) continue;
          if (walker.population <= 0) continue;

          for (let si = defender.settlements.length - 1; si >= 0; si--) {
            const settlement = defender.settlements[si];
            const dist = wrappedDistance(walker.x, walker.z, settlement.x + 0.5, settlement.z + 0.5);
            if (dist > 1.5) continue;

            // Walker attacks settlement
            const walkerStr = walker.population * (walker.isKnight ? 2 : 1);
            const settPop = Math.floor(settlement.population);

            if (walkerStr > settPop) {
              // Walker wins, settlement destroyed
              walker.population = Math.max(1, walker.population - Math.floor(settPop * 0.5));
              settlement.population = 0;
              defender.removeSettlement(settlement);
            } else {
              // Settlement defends
              settlement.population -= walker.population * 0.5;
              walker.population = 0;
            }
          }
        }
      }
    }

    // Clean up dead walkers
    for (const p of players) {
      p.walkers = p.walkers.filter(w => w.population > 0);
    }
  }
}
