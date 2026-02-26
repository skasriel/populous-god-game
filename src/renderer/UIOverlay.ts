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
  }

  private createPowerButtons(): void {
    const powers = [
      { id: 'SWAMP', icon: '~', label: 'Swamp', cost: POWER_COSTS.SWAMP },
      { id: 'EARTHQUAKE', icon: '⚡', label: 'Quake', cost: POWER_COSTS.EARTHQUAKE },
      { id: 'VOLCANO', icon: '▲', label: 'Volcano', cost: POWER_COSTS.VOLCANO },
      { id: 'FLOOD', icon: '≈', label: 'Flood', cost: POWER_COSTS.FLOOD },
      { id: 'KNIGHT', icon: '♞', label: 'Knight', cost: POWER_COSTS.KNIGHT },
      { id: 'ARMAGEDDON', icon: '☠', label: 'Armagdn', cost: POWER_COSTS.ARMAGEDDON },
    ];

    this.powersBar.innerHTML = '';
    for (const power of powers) {
      const btn = document.createElement('button');
      btn.className = 'power-btn';
      btn.id = `power-${power.id}`;
      btn.innerHTML = `<span class="icon">${power.icon}</span><span>${power.label}</span><span class="cost">${power.cost}</span>`;
      btn.addEventListener('click', () => {
        this.game.selectPower(power.id);
      });
      this.powersBar.appendChild(btn);
    }
  }

  update(): void {
    const player = this.game.getHumanPlayer();
    const enemy = this.game.getEnemyPlayer();

    // Mana
    const manaPercent = (player.mana / MAX_MANA) * 100;
    this.manaBar.style.width = `${manaPercent}%`;
    this.manaValue.textContent = Math.floor(player.mana).toString();

    // Population
    this.playerPop.textContent = player.getTotalPopulation().toString();
    this.enemyPop.textContent = enemy.getTotalPopulation().toString();

    // Power buttons - enable/disable based on mana
    for (const [id, cost] of Object.entries(POWER_COSTS)) {
      const btn = document.getElementById(`power-${id}`);
      if (btn) {
        btn.classList.toggle('disabled', player.mana < cost);
        btn.classList.toggle('active', this.game.getSelectedPower() === id);
      }
    }

    // Mode indicator
    const mode = this.game.getInteractionMode();
    const power = this.game.getSelectedPower();
    if (power) {
      this.modeIndicator.textContent = `POWER: ${power} (click to use, ESC to cancel)`;
    } else if (mode === 'magnet') {
      this.modeIndicator.textContent = 'PLACE PAPAL MAGNET (click on map)';
    } else {
      this.modeIndicator.textContent = 'TERRAIN (Left-click: raise | Right-click: lower | M: place magnet)';
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
