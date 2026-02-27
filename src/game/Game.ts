import { World } from './World';
import { Player } from './Player';
import { Walker, WalkerState, BehaviorMode, resetWalkerIds } from './Walker';
import { Settlement, resetSettlementIds } from './Settlement';
import { Combat } from './Combat';
import { AIPlayer } from './AIPlayer';
import { Powers, PowerType } from './Powers';
import { SceneManager } from '../renderer/SceneManager';
import { TerrainRenderer } from '../renderer/TerrainRenderer';
import { EntityRenderer } from '../renderer/EntityRenderer';
import { UIOverlay } from '../renderer/UIOverlay';
import { InputManager, InteractionMode } from '../input/InputManager';
import {
  TICK_INTERVAL, TERRAIN_RAISE_COST, TERRAIN_LOWER_COST,
  GRID_SIZE, POWER_COSTS, MIN_SETTLEMENT_DISTANCE
} from '../utils/Constants';
import { wrapCoord, wrappedDistance } from '../utils/MathUtils';

export interface GameAction {
  type: string;
  x?: number;
  z?: number;
  player?: number;
  power?: string;
  behaviorMode?: BehaviorMode;
  [key: string]: any;
}

export class Game {
  private world: World;
  private players: Player[];
  private aiPlayer: AIPlayer;
  private sceneManager: SceneManager;
  private terrainRenderer: TerrainRenderer;
  private entityRenderer: EntityRenderer;
  private uiOverlay!: UIOverlay;
  private inputManager!: InputManager;

  private gameTime: number = 0;
  private accumulator: number = 0;
  private lastTimestamp: number = 0;
  private running: boolean = false;
  private gameOver: boolean = false;
  private armageddonActive: boolean = false;

  // Action queue for multiplayer-ready architecture
  private actionQueue: GameAction[] = [];

  constructor(canvas: HTMLCanvasElement) {
    // Initialize world
    this.world = new World(GRID_SIZE);
    this.world.generate();

    // Initialize players
    this.players = [
      new Player(0, true),  // Human player
      new Player(1, false), // AI player
    ];

    // Spawn initial walkers
    this.players[0].spawnInitialWalkers(this.world);
    this.players[1].spawnInitialWalkers(this.world);

    // Initialize AI
    this.aiPlayer = new AIPlayer(this.players[1], this.world);

    // Initialize rendering
    this.sceneManager = new SceneManager(canvas);
    this.terrainRenderer = new TerrainRenderer(this.sceneManager.scene, this.world);
    this.entityRenderer = new EntityRenderer(this.sceneManager.scene, this.world);

    // Input manager needs terrain renderer for raycasting
    this.inputManager = new InputManager(this, this.sceneManager, this.terrainRenderer);

    // UI overlay
    this.uiOverlay = new UIOverlay(this);
  }

  start(): void {
    this.running = true;
    this.lastTimestamp = performance.now();
    this.gameLoop(this.lastTimestamp);
  }

  restart(): void {
    // Reset IDs
    resetWalkerIds();
    resetSettlementIds();

    // Reset world
    this.world = new World(GRID_SIZE);
    this.world.generate();

    // Reset players
    this.players = [
      new Player(0, true),
      new Player(1, false),
    ];
    this.players[0].spawnInitialWalkers(this.world);
    this.players[1].spawnInitialWalkers(this.world);

    // Reset AI
    this.aiPlayer = new AIPlayer(this.players[1], this.world);

    // Rebuild terrain
    this.terrainRenderer.dispose();
    this.entityRenderer.dispose();
    this.terrainRenderer = new TerrainRenderer(this.sceneManager.scene, this.world);
    this.entityRenderer = new EntityRenderer(this.sceneManager.scene, this.world);

    // Reset input manager
    this.inputManager = new InputManager(this, this.sceneManager, this.terrainRenderer);

    this.gameTime = 0;
    this.accumulator = 0;
    this.gameOver = false;
    this.armageddonActive = false;
    this.actionQueue = [];
    this.running = true;
  }

  private gameLoop = (timestamp: number): void => {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1); // cap dt
    this.lastTimestamp = timestamp;

    // Fixed timestep for game logic
    this.accumulator += dt;
    while (this.accumulator >= TICK_INTERVAL) {
      this.updateGameLogic(TICK_INTERVAL);
      this.accumulator -= TICK_INTERVAL;
    }

    // Variable framerate rendering
    this.render(dt);

    requestAnimationFrame(this.gameLoop);
  }

  private updateGameLogic(dt: number): void {
    if (this.gameOver) return;

    this.gameTime += dt;

    // Process action queue
    this.processActions();

    // Update mana for all players
    for (const player of this.players) {
      player.updateMana(dt);
    }

    // Update AI
    this.aiPlayer.update(dt, this.players[0]);

    // Check leader mechanic — first walker to touch papal magnet becomes leader
    for (const player of this.players) {
      player.checkLeaderMagnet();
    }

    // Build list of all walkers for spatial queries
    const allWalkers: Walker[] = [];
    for (const p of this.players) {
      allWalkers.push(...p.walkers);
    }

    // Update walkers with behavior mode awareness
    for (const player of this.players) {
      const opponent = this.players[player.playerIndex === 0 ? 1 : 0];

      // Collect all settlement positions (both players) for settle distance checks
      const allSettlementPositions: { x: number; z: number }[] = [];
      for (const p of this.players) {
        for (const s of p.settlements) {
          allSettlementPositions.push({ x: s.x, z: s.z });
        }
      }

      for (const walker of player.walkers) {
        // In SETTLE mode, assign a settle target if walker doesn't have one
        if ((player.behaviorMode === BehaviorMode.SETTLE ||
             player.behaviorMode === BehaviorMode.FIGHT_THEN_SETTLE ||
             player.behaviorMode === BehaviorMode.GATHER_THEN_SETTLE) &&
            !walker.isKnight && !walker.isLeader &&
            walker.settleTargetX === null) {
          const target = this.world.findNearestFlatTile(
            walker.x, walker.z, 2, allSettlementPositions, MIN_SETTLEMENT_DISTANCE
          );
          if (target) {
            walker.settleTargetX = target.x;
            walker.settleTargetZ = target.z;
          }
        }

        // In GO_TO_MAGNET mode, clear settle target
        if (player.behaviorMode === BehaviorMode.GO_TO_MAGNET) {
          walker.settleTargetX = null;
          walker.settleTargetZ = null;
        }

        // Find nearby enemies (within 15 tiles) for behavior targeting
        const nearbyEnemies = opponent.walkers
          .filter(e => wrappedDistance(walker.x, walker.z, e.x, e.z) < 15)
          .sort((a, b) =>
            wrappedDistance(walker.x, walker.z, a.x, a.z) -
            wrappedDistance(walker.x, walker.z, b.x, b.z)
          );

        // Find nearby friendlies (within 10 tiles) for gather mode
        const nearbyFriendlies = player.walkers
          .filter(f => f.id !== walker.id && wrappedDistance(walker.x, walker.z, f.x, f.z) < 10)
          .sort((a, b) =>
            wrappedDistance(walker.x, walker.z, a.x, a.z) -
            wrappedDistance(walker.x, walker.z, b.x, b.z)
          );

        // Knights also target enemy settlements
        if (walker.isKnight && nearbyEnemies.length === 0) {
          // Point knight toward nearest enemy settlement
          let nearestSettDist = Infinity;
          let nearestSettX = walker.x;
          let nearestSettZ = walker.z;
          for (const s of opponent.settlements) {
            const d = wrappedDistance(walker.x, walker.z, s.x + 0.5, s.z + 0.5);
            if (d < nearestSettDist) {
              nearestSettDist = d;
              nearestSettX = s.x + 0.5;
              nearestSettZ = s.z + 0.5;
            }
          }
          if (nearestSettDist < Infinity) {
            // Create a fake "enemy" at the settlement location
            const fakeTarget = new Walker(opponent.playerIndex, nearestSettX, nearestSettZ, 0);
            nearbyEnemies.push(fakeTarget);
          }
        }

        walker.update(
          this.world,
          player.magnetX,
          player.magnetZ,
          dt,
          player.behaviorMode,
          nearbyEnemies,
          nearbyFriendlies
        );

        // Check if walker should settle
        if (walker.shouldSettle(this.world, player.behaviorMode)) {
          this.settleWalker(walker, player);
        }

        // Kill walkers in water or swamp
        const tx = walker.getTileX();
        const tz = walker.getTileZ();
        if (this.world.isWater(tx, tz)) {
          walker.population = 0;
        }
        if (this.world.isSwamp(tx, tz)) {
          walker.population = Math.max(0, walker.population - 2);
        }
      }

      // Remove dead walkers
      player.walkers = player.walkers.filter(w => w.population > 0);
    }

    // Update settlements
    for (const player of this.players) {
      const newWalkers: Walker[] = [];
      for (const settlement of player.settlements) {
        settlement.updateFlatArea(this.world, this.gameTime);
        const newWalker = settlement.update(this.world, dt, player.behaviorMode);
        if (newWalker) {
          newWalkers.push(newWalker);
        }

        // Settlement destroyed if on water or swamp
        if (this.world.isWater(settlement.x, settlement.z) ||
            this.world.isSwamp(settlement.x, settlement.z)) {
          settlement.population = 0;
        }
      }

      // Add new walkers
      for (const w of newWalkers) {
        player.addWalker(w);
      }

      // Remove destroyed settlements
      player.settlements = player.settlements.filter(s => !s.isDestroyed());
    }

    // Resolve combat and interactions
    Combat.resolveInteractions(this.players, this.world);
    Combat.resolveSettlementAttacks(this.players, this.world);

    // Check win/lose
    this.checkGameOver();
  }

  private processActions(): void {
    while (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift()!;
      this.handleAction(action);
    }
  }

  private handleAction(action: GameAction): void {
    const player = this.players[action.player || 0];

    switch (action.type) {
      case 'RAISE_TERRAIN': {
        if (player.spendMana(TERRAIN_RAISE_COST)) {
          const changed = this.world.raiseTerrain(action.x!, action.z!);
          this.terrainRenderer.updateTiles(changed);
        }
        break;
      }
      case 'LOWER_TERRAIN': {
        if (player.spendMana(TERRAIN_LOWER_COST)) {
          const changed = this.world.lowerTerrain(action.x!, action.z!);
          this.terrainRenderer.updateTiles(changed);
        }
        break;
      }
      case 'PLACE_MAGNET': {
        // Per manual: can only move papal magnet if you have a leader
        const leader = player.getLeader();
        if (leader || player.walkers.length === 0) {
          // Allow magnet placement if has leader OR has no walkers (initial setup)
          player.magnetX = action.x!;
          player.magnetZ = action.z!;
        }
        break;
      }
      case 'SET_BEHAVIOR': {
        if (!this.armageddonActive) {
          player.behaviorMode = action.behaviorMode!;
        }
        break;
      }
      case 'USE_POWER': {
        if (this.armageddonActive) break; // No powers during Armageddon

        const powerType = action.power as PowerType;
        const opponent = this.players[action.player === 0 ? 1 : 0];
        const success = Powers.usePower(powerType, action.x!, action.z!, player, opponent, this.world);
        if (success) {
          this.terrainRenderer.buildFullMesh();
          if (powerType === 'ARMAGEDDON') {
            this.armageddonActive = true;
          }
        }
        break;
      }
    }
  }

  private settleWalker(walker: Walker, player: Player): void {
    const tx = walker.getTileX();
    const tz = walker.getTileZ();

    // Check there isn't already a settlement on this tile or too close
    for (const p of this.players) {
      for (const s of p.settlements) {
        if (s.x === tx && s.z === tz) return;
        // Enforce minimum distance between settlements
        const dist = wrappedDistance(tx + 0.5, tz + 0.5, s.x + 0.5, s.z + 0.5);
        if (dist < MIN_SETTLEMENT_DISTANCE) return;
      }
    }

    // Create settlement
    walker.state = WalkerState.SETTLING;
    const settlement = new Settlement(player.playerIndex, tx, tz, walker.population);
    settlement.updateFlatArea(this.world, this.gameTime);
    player.addSettlement(settlement);
    player.removeWalker(walker);
  }

  private checkGameOver(): void {
    // Don't check in the first 10 seconds
    if (this.gameTime < 10) return;

    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].isDefeated()) {
        this.gameOver = true;
        const humanWon = i === 1; // player 1 (AI) is defeated
        this.uiOverlay.showGameOver(humanWon);
        return;
      }
    }
  }

  private render(dt: number): void {
    // Update camera
    this.sceneManager.updateCamera(dt);

    // Update entity visuals
    const allWalkers = [...this.players[0].walkers, ...this.players[1].walkers];
    this.entityRenderer.updateWalkers(allWalkers, 0);

    const allSettlements = [...this.players[0].settlements, ...this.players[1].settlements];
    this.entityRenderer.updateSettlements(allSettlements);

    // Update papal magnets
    const magnets: { x: number; z: number; playerIndex: number }[] = [];
    for (const p of this.players) {
      if (p.magnetX !== null && p.magnetZ !== null) {
        magnets.push({ x: p.magnetX, z: p.magnetZ, playerIndex: p.playerIndex });
      }
    }
    this.entityRenderer.updatePapalMagnets(magnets);

    // Update minimap
    this.updateMinimap();

    // Update UI
    this.uiOverlay.update();

    // Render scene
    this.sceneManager.render();
  }

  private updateMinimap(): void {
    const canvas = document.getElementById('minimap') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const scale = size / GRID_SIZE;
    const heightmap = this.world.getHeightmap();

    // Draw terrain — Populous style: uniform green land, blue water
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const h = heightmap[x][z];
        if (h <= 0) {
          ctx.fillStyle = '#1848b0'; // deep blue water
        } else if (this.world.isSwamp(x, z)) {
          ctx.fillStyle = '#445500'; // swamp
        } else {
          // Uniform bright green with very slight height variation
          const g = 160 + Math.min(h * 8, 40);
          ctx.fillStyle = `rgb(48, ${g}, 48)`;
        }
        ctx.fillRect(x * scale, z * scale, scale + 0.5, scale + 0.5);
      }
    }

    // Draw settlements (white for good, dark grey for evil — per manual)
    for (const player of this.players) {
      ctx.fillStyle = player.playerIndex === 0 ? '#ffffff' : '#666666';
      for (const s of player.settlements) {
        ctx.fillRect(s.x * scale - 1, s.z * scale - 1, 3, 3);
      }
    }

    // Draw walkers as dots (blue for good, red for evil — per manual)
    for (const player of this.players) {
      ctx.fillStyle = player.playerIndex === 0 ? '#4488ff' : '#ff4444';
      for (const w of player.walkers) {
        ctx.fillRect(w.x * scale, w.z * scale, 2, 2);
      }
    }

    // Draw papal magnets
    for (const player of this.players) {
      if (player.magnetX !== null && player.magnetZ !== null) {
        ctx.fillStyle = player.playerIndex === 0 ? '#ffffff' : '#ffaa00';
        ctx.fillRect(player.magnetX * scale - 2, player.magnetZ! * scale - 2, 5, 5);
      }
    }
  }

  /** Queue an action (multiplayer-ready) */
  executeAction(action: GameAction): void {
    this.actionQueue.push(action);
  }

  /** Select a divine power */
  selectPower(powerId: string): void {
    const player = this.players[0];
    const cost = POWER_COSTS[powerId as keyof typeof POWER_COSTS];
    if (player.mana >= cost) {
      this.inputManager.selectPower(powerId);
    }
  }

  /** Set behavior mode for human player */
  setBehaviorMode(mode: BehaviorMode): void {
    this.executeAction({ type: 'SET_BEHAVIOR', player: 0, behaviorMode: mode });
  }

  getHumanPlayer(): Player {
    return this.players[0];
  }

  getEnemyPlayer(): Player {
    return this.players[1];
  }

  getInteractionMode(): InteractionMode {
    return this.inputManager.getMode();
  }

  getSelectedPower(): string | null {
    return this.inputManager.getSelectedPower();
  }

  getWorld(): World {
    return this.world;
  }

  isArmageddonActive(): boolean {
    return this.armageddonActive;
  }

  zoomCamera(delta: number): void {
    this.sceneManager.zoom(delta);
  }
}
