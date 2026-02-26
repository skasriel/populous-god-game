import { Game } from '../game/Game';
import { Raycaster } from './Raycaster';
import { SceneManager } from '../renderer/SceneManager';
import { TerrainRenderer } from '../renderer/TerrainRenderer';

export type InteractionMode = 'terrain' | 'magnet' | 'power';

export class InputManager {
  private game: Game;
  private raycaster: Raycaster;
  private sceneManager: SceneManager;
  private terrainRenderer: TerrainRenderer;
  private canvas: HTMLCanvasElement;

  private mode: InteractionMode = 'terrain';
  private selectedPower: string | null = null;

  // Track mouse for continuous terrain editing
  private isLeftDown = false;
  private isRightDown = false;
  private lastEditTile: { x: number; z: number } | null = null;
  private editCooldown = 0;

  constructor(
    game: Game,
    sceneManager: SceneManager,
    terrainRenderer: TerrainRenderer
  ) {
    this.game = game;
    this.sceneManager = sceneManager;
    this.terrainRenderer = terrainRenderer;
    this.raycaster = new Raycaster(sceneManager);
    this.canvas = sceneManager.getCanvas();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onMouseDown(e: MouseEvent): void {
    const tile = this.raycaster.screenToTile(
      e.clientX, e.clientY,
      this.terrainRenderer.getTerrainMesh()
    );
    if (!tile) return;

    if (this.mode === 'magnet') {
      this.game.executeAction({ type: 'PLACE_MAGNET', x: tile.x, z: tile.z, player: 0 });
      this.mode = 'terrain';
      return;
    }

    if (this.mode === 'power' && this.selectedPower) {
      this.game.executeAction({
        type: 'USE_POWER',
        power: this.selectedPower,
        x: tile.x,
        z: tile.z,
        player: 0,
      });
      this.selectedPower = null;
      this.mode = 'terrain';
      return;
    }

    // Terrain mode
    if (e.button === 0) {
      this.isLeftDown = true;
      this.game.executeAction({ type: 'RAISE_TERRAIN', x: tile.x, z: tile.z, player: 0 });
      this.lastEditTile = tile;
    } else if (e.button === 2) {
      this.isRightDown = true;
      this.game.executeAction({ type: 'LOWER_TERRAIN', x: tile.x, z: tile.z, player: 0 });
      this.lastEditTile = tile;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.isLeftDown = false;
    if (e.button === 2) this.isRightDown = false;
    this.lastEditTile = null;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isLeftDown && !this.isRightDown) return;
    if (this.mode !== 'terrain') return;

    const tile = this.raycaster.screenToTile(
      e.clientX, e.clientY,
      this.terrainRenderer.getTerrainMesh()
    );
    if (!tile) return;

    // Don't edit the same tile repeatedly
    if (this.lastEditTile && tile.x === this.lastEditTile.x && tile.z === this.lastEditTile.z) {
      return;
    }

    if (this.isLeftDown) {
      this.game.executeAction({ type: 'RAISE_TERRAIN', x: tile.x, z: tile.z, player: 0 });
    } else if (this.isRightDown) {
      this.game.executeAction({ type: 'LOWER_TERRAIN', x: tile.x, z: tile.z, player: 0 });
    }
    this.lastEditTile = tile;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 2 : -2;
    this.sceneManager.zoom(delta);
  }

  private onKeyDown(e: KeyboardEvent): void {
    switch (e.key.toLowerCase()) {
      case 'm':
        this.mode = 'magnet';
        this.selectedPower = null;
        break;
      case 'escape':
        this.mode = 'terrain';
        this.selectedPower = null;
        break;
    }
  }

  setMode(mode: InteractionMode): void {
    this.mode = mode;
  }

  getMode(): InteractionMode {
    return this.mode;
  }

  selectPower(power: string): void {
    this.mode = 'power';
    this.selectedPower = power;
  }

  getSelectedPower(): string | null {
    return this.selectedPower;
  }
}
