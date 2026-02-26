import { World } from './World';
import { Player } from './Player';
import { Walker, WalkerState, resetWalkerIds } from './Walker';
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
  GRID_SIZE, POWER_COSTS
} from '../utils/Constants';
import { wrapCoord, wrappedDistance } from '../utils/MathUtils';

export interface GameAction {
  type: string;
  x?: number;
  z?: number;
  player?: number;
  power?: string;
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

    // Update walkers
    for (const player of this.players) {
      for (const walker of player.walkers) {
        walker.update(this.world, player.magnetX, player.magnetZ, dt);

        // Check if walker should settle
        if (walker.shouldSettle(this.world)) {
          this.settleWalker(walker, player);
        }

        // Kill walkers in water or swamp
        const tx = walker.getTileX();
        const tz = walker.getTileZ();
        if (this.world.isWater(tx, tz)) {
          walker.population = 0;
        }
        if (this.world.isSwamp(tx, tz) && walker.playerIndex !== -1) {
          walker.population = Math.max(0, walker.population - 1);
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
        const newWalker = settlement.update(this.world, dt);
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
        player.magnetX = action.x!;
        player.magnetZ = action.z!;
        break;
      }
      case 'USE_POWER': {
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

    // Check there isn't already a settlement here
    for (const p of this.players) {
      for (const s of p.settlements) {
        if (s.x === tx && s.z === tz) return;
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

    // Draw terrain
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const h = heightmap[x][z];
        if (h <= 0) {
          ctx.fillStyle = '#2266aa'; // water
        } else if (this.world.isSwamp(x, z)) {
          ctx.fillStyle = '#445500'; // swamp
        } else {
          const brightness = 40 + (h / 8) * 80;
          ctx.fillStyle = `rgb(${brightness * 0.5}, ${brightness}, ${brightness * 0.3})`;
        }
        ctx.fillRect(x * scale, z * scale, scale + 0.5, scale + 0.5);
      }
    }

    // Draw settlements
    for (const player of this.players) {
      ctx.fillStyle = player.playerIndex === 0 ? '#4488ff' : '#ff4444';
      for (const s of player.settlements) {
        ctx.fillRect(s.x * scale - 1, s.z * scale - 1, 3, 3);
      }
    }

    // Draw walkers as dots
    for (const player of this.players) {
      ctx.fillStyle = player.playerIndex === 0 ? '#88bbff' : '#ff8888';
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
}
