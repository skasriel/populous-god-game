import { Game } from '../game/Game';
import {
  MAX_MANA, POWER_COSTS
} from '../utils/Constants';

export class UIOverlay {
  private game: Game;
  private manaBar: HTMLElement;
  private manaValue: HTMLElement;
  private playerPop: HTMLElement;
  private enemyPop: HTMLElement;
  private playerPopBar: HTMLElement;
  private enemyPopBar: HTMLElement;
  private powersBar: HTMLElement;
  private modeIndicator: HTMLElement;
  private gameOverScreen: HTMLElement;
  private gameOverText: HTMLElement;
  private gameOverSub: HTMLElement;
  private restartBtn: HTMLElement;

  constructor(game: Game) {
    this.game = game;

    this.manaBar = document.getElementById('mana-bar')!;
    this.manaValue = document.getElementById('mana-value')!;
    this.playerPop = document.getElementById('player-pop')!;
    this.enemyPop = document.getElementById('enemy-pop')!;
    this.playerPopBar = document.getElementById('player-pop-bar')!;
    this.enemyPopBar = document.getElementById('enemy-pop-bar')!;
    this.powersBar = document.getElementById('powers-bar')!;
    this.modeIndicator = document.getElementById('mode-indicator')!;
    this.gameOverScreen = document.getElementById('game-over-screen')!;
    this.gameOverText = document.getElementById('game-over-text')!;
    this.gameOverSub = document.getElementById('game-over-sub')!;
    this.restartBtn = document.getElementById('restart-btn')!;

    this.restartBtn.addEventListener('click', () => {
      this.gameOverScreen.classList.remove('visible');
      this.game.restart();
    });

    this.createPowerButtons();
    this.setupCommandButtons();
  }

  private createPowerButtons(): void {
    // Divine powers — Populous-style icons on the shelf
    // Using symbols that evoke the original game's ankh/deity aesthetic
    const powers = [
      { id: 'SWAMP', icon: '\u2237', label: 'Swamp', cost: POWER_COSTS.SWAMP },        // ∷ (dots = marsh)
      { id: 'EARTHQUAKE', icon: '\u2947', label: 'Quake', cost: POWER_COSTS.EARTHQUAKE }, // concentric
      { id: 'VOLCANO', icon: '\u2206', label: 'Volcano', cost: POWER_COSTS.VOLCANO },   // △ (mountain)
      { id: 'FLOOD', icon: '\u224B', label: 'Flood', cost: POWER_COSTS.FLOOD },         // ≋ (waves)
      { id: 'KNIGHT', icon: '\u2694', label: 'Knight', cost: POWER_COSTS.KNIGHT },      // ⚔ (crossed swords)
      { id: 'ARMAGEDDON', icon: '\u2620', label: 'Armgdn', cost: POWER_COSTS.ARMAGEDDON }, // ☠ (skull)
    ];

    this.powersBar.innerHTML = '';
    for (const power of powers) {
      const btn = document.createElement('button');
      btn.className = 'power-btn';
      btn.id = `power-${power.id}`;
      btn.innerHTML = `<span class="icon">${power.icon}</span><span class="pname">${power.label}</span><span class="cost">${power.cost}</span>`;
      btn.addEventListener('click', () => {
        this.game.selectPower(power.id);
      });
      this.powersBar.appendChild(btn);
    }
  }

  private setupCommandButtons(): void {
    // Wire up the command panel buttons
    const cmdRaise = document.getElementById('cmd-raise');
    const cmdLower = document.getElementById('cmd-lower');
    const cmdMagnet = document.getElementById('cmd-magnet');
    const cmdZoomIn = document.getElementById('cmd-zoom-in');
    const cmdZoomOut = document.getElementById('cmd-zoom-out');

    // Raise/Lower are informational — they highlight active mode
    cmdRaise?.addEventListener('click', () => {
      // Clear any selected power, return to terrain mode
      this.game.selectPower('');
    });
    cmdLower?.addEventListener('click', () => {
      this.game.selectPower('');
    });
    cmdMagnet?.addEventListener('click', () => {
      // Trigger magnet mode (same as pressing M)
      const event = new KeyboardEvent('keydown', { key: 'm' });
      window.dispatchEvent(event);
    });

    // Zoom buttons
    cmdZoomIn?.addEventListener('click', () => {
      this.game.zoomCamera(-3);
    });
    cmdZoomOut?.addEventListener('click', () => {
      this.game.zoomCamera(3);
    });
  }

  update(): void {
    const player = this.game.getHumanPlayer();
    const enemy = this.game.getEnemyPlayer();

    // Mana
    const manaPercent = (player.mana / MAX_MANA) * 100;
    this.manaBar.style.width = `${manaPercent}%`;
    this.manaValue.textContent = Math.floor(player.mana).toString();

    // Population
    const playerPop = player.getTotalPopulation();
    const enemyPop = enemy.getTotalPopulation();
    this.playerPop.textContent = playerPop.toString();
    this.enemyPop.textContent = enemyPop.toString();

    // Population bars (relative to max of both)
    const maxPop = Math.max(playerPop, enemyPop, 1);
    this.playerPopBar.style.width = `${(playerPop / maxPop) * 100}%`;
    this.enemyPopBar.style.width = `${(enemyPop / maxPop) * 100}%`;

    // Power buttons - enable/disable based on mana
    for (const [id, cost] of Object.entries(POWER_COSTS)) {
      const btn = document.getElementById(`power-${id}`);
      if (btn) {
        btn.classList.toggle('disabled', player.mana < cost);
        btn.classList.toggle('active', this.game.getSelectedPower() === id);
      }
    }

    // Update command button active states
    const mode = this.game.getInteractionMode();
    const power = this.game.getSelectedPower();

    document.getElementById('cmd-raise')?.classList.toggle('active', !power && mode === 'terrain');
    document.getElementById('cmd-lower')?.classList.toggle('active', !power && mode === 'terrain');
    document.getElementById('cmd-magnet')?.classList.toggle('active', mode === 'magnet');

    // Mode indicator
    if (power) {
      this.modeIndicator.textContent = `POWER: ${power} (click target, ESC cancel)`;
    } else if (mode === 'magnet') {
      this.modeIndicator.textContent = 'PAPAL MAGNET — click to place, ESC cancel';
    } else {
      this.modeIndicator.textContent = 'LEFT: Raise | RIGHT: Lower | M: Magnet';
    }
  }

  showGameOver(victory: boolean): void {
    this.gameOverText.textContent = victory ? 'VICTORY' : 'DEFEAT';
    this.gameOverText.style.color = victory ? '#44ff44' : '#ff4444';
    this.gameOverSub.textContent = victory
      ? 'You have vanquished the enemy god!'
      : 'Your followers have been destroyed...';
    this.gameOverScreen.classList.add('visible');
  }
}
