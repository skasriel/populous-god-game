import { Game } from '../game/Game';
import { BehaviorMode } from '../game/Walker';
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
    const powers = [
      { id: 'SWAMP', icon: '\u2237', label: 'Swamp', cost: POWER_COSTS.SWAMP },
      { id: 'EARTHQUAKE', icon: '\u2947', label: 'Quake', cost: POWER_COSTS.EARTHQUAKE },
      { id: 'VOLCANO', icon: '\u2206', label: 'Volcano', cost: POWER_COSTS.VOLCANO },
      { id: 'FLOOD', icon: '\u224B', label: 'Flood', cost: POWER_COSTS.FLOOD },
      { id: 'KNIGHT', icon: '\u2694', label: 'Knight', cost: POWER_COSTS.KNIGHT },
      { id: 'ARMAGEDDON', icon: '\u2620', label: 'Armgdn', cost: POWER_COSTS.ARMAGEDDON },
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
    const cmdRaise = document.getElementById('cmd-raise');
    const cmdLower = document.getElementById('cmd-lower');
    const cmdMagnet = document.getElementById('cmd-magnet');
    const cmdZoomIn = document.getElementById('cmd-zoom-in');
    const cmdZoomOut = document.getElementById('cmd-zoom-out');
    const cmdCenter = document.getElementById('cmd-center');

    // Behavior mode buttons (per Populous manual: 4 behavior modes)
    const cmdFight = document.getElementById('cmd-fight');
    const cmdGather = document.getElementById('cmd-gather');
    const cmdSettle = document.getElementById('cmd-settle');

    cmdRaise?.addEventListener('click', () => {
      this.game.selectPower('');
    });
    cmdLower?.addEventListener('click', () => {
      this.game.selectPower('');
    });
    cmdMagnet?.addEventListener('click', () => {
      // Set GO_TO_MAGNET behavior and trigger magnet placement mode
      this.game.setBehaviorMode(BehaviorMode.GO_TO_MAGNET);
      const event = new KeyboardEvent('keydown', { key: 'm' });
      window.dispatchEvent(event);
    });

    // Behavior buttons
    cmdFight?.addEventListener('click', () => {
      this.game.setBehaviorMode(BehaviorMode.FIGHT_THEN_SETTLE);
    });
    cmdGather?.addEventListener('click', () => {
      this.game.setBehaviorMode(BehaviorMode.GATHER_THEN_SETTLE);
    });
    cmdSettle?.addEventListener('click', () => {
      this.game.setBehaviorMode(BehaviorMode.SETTLE);
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
    // Knight requires a leader (per manual)
    for (const [id, cost] of Object.entries(POWER_COSTS)) {
      const btn = document.getElementById(`power-${id}`);
      if (btn) {
        let disabled = player.mana < cost;
        // Knight additionally requires a leader
        if (id === 'KNIGHT' && !player.getLeader()) disabled = true;
        btn.classList.toggle('disabled', disabled);
        btn.classList.toggle('active', this.game.getSelectedPower() === id);
      }
    }

    // Update command button active states — behavior modes
    const mode = this.game.getInteractionMode();
    const power = this.game.getSelectedPower();
    const behavior = player.behaviorMode;

    document.getElementById('cmd-raise')?.classList.toggle('active', !power && mode === 'terrain');
    document.getElementById('cmd-lower')?.classList.toggle('active', !power && mode === 'terrain');
    document.getElementById('cmd-magnet')?.classList.toggle('active',
      mode === 'magnet' || behavior === BehaviorMode.GO_TO_MAGNET);
    document.getElementById('cmd-fight')?.classList.toggle('active',
      behavior === BehaviorMode.FIGHT_THEN_SETTLE);
    document.getElementById('cmd-gather')?.classList.toggle('active',
      behavior === BehaviorMode.GATHER_THEN_SETTLE);
    document.getElementById('cmd-settle')?.classList.toggle('active',
      behavior === BehaviorMode.SETTLE);

    // Mode indicator
    if (this.game.isArmageddonActive()) {
      this.modeIndicator.textContent = 'ARMAGEDDON — The final battle has begun!';
    } else if (power) {
      this.modeIndicator.textContent = `POWER: ${power} (click target, ESC cancel)`;
    } else if (mode === 'magnet') {
      this.modeIndicator.textContent = 'PAPAL MAGNET — click to place, ESC cancel';
    } else {
      const behaviorLabels: Record<string, string> = {
        [BehaviorMode.GO_TO_MAGNET]: 'Go to Magnet',
        [BehaviorMode.SETTLE]: 'Settle',
        [BehaviorMode.FIGHT_THEN_SETTLE]: 'Fight then Settle',
        [BehaviorMode.GATHER_THEN_SETTLE]: 'Gather then Settle',
      };
      const leaderStatus = player.getLeader() ? 'Leader: Yes' : 'Leader: None';
      this.modeIndicator.textContent =
        `${behaviorLabels[behavior]} | ${leaderStatus} | LEFT: Raise | RIGHT: Lower`;
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
