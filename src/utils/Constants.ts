// ── Game Constants ──

export const GRID_SIZE = 64;
export const MAX_HEIGHT = 8;
export const SEA_LEVEL = 0;
export const TILE_SIZE = 1; // world units per tile

// ── Terrain ──
export const TERRAIN_RAISE_COST = 2;
export const TERRAIN_LOWER_COST = 2;
export const MAX_HEIGHT_DIFF = 1; // max height difference between adjacent tiles

// ── Walkers ──
export const WALKER_SPEED = 1.5; // tiles per second
export const WALKER_SETTLE_CHANCE = 0.02; // chance per tick to attempt settling
export const INITIAL_WALKER_POPULATION = 5;
export const WALKER_SPAWN_POPULATION = 3; // population of newly spawned walkers

// ── Settlements ──
export const SETTLEMENT_SPAWN_INTERVAL = 8; // seconds between spawning walkers
export const SETTLEMENT_SPAWN_MIN_POP = 4; // minimum population to spawn a walker
export const SETTLEMENT_GROWTH_RATE = 0.3; // population gained per second
export const MAX_SETTLEMENT_POPULATION = 50;

// Building tiers by flat area
export const BUILDING_TIERS = [
  { name: 'Hut', minFlat: 1, maxPop: 8, color: 0x8B7355 },
  { name: 'House', minFlat: 2, maxPop: 16, color: 0x9B8365 },
  { name: 'Manor', minFlat: 4, maxPop: 30, color: 0xAB9375 },
  { name: 'Castle', minFlat: 7, maxPop: 50, color: 0xBBA385 },
];

// ── Mana ──
export const MANA_PER_POPULATION = 0.1; // mana gained per population per second
export const MAX_MANA = 500;
export const STARTING_MANA = 50;

// ── Combat ──
export const COMBAT_DURATION = 1.0; // seconds a combat takes

// ── Divine Powers ──
export const POWER_COSTS = {
  SWAMP: 40,
  EARTHQUAKE: 80,
  VOLCANO: 150,
  FLOOD: 120,
  KNIGHT: 100,
  ARMAGEDDON: 400,
};

// ── Game Loop ──
export const TICK_RATE = 10; // game logic ticks per second
export const TICK_INTERVAL = 1 / TICK_RATE;

// ── Camera ──
export const CAMERA_ZOOM = 20;
export const CAMERA_PAN_SPEED = 20;

// ── AI ──
export const AI_THINK_INTERVAL = 2.0; // seconds between AI decisions
export const AI_TERRAIN_ACTIONS_PER_THINK = 3;

// ── Colors ──
export const PLAYER_COLOR = 0x4488ff;
export const ENEMY_COLOR = 0xff4444;
export const WATER_COLOR = 0x2266aa;
export const TERRAIN_COLORS = [
  0x2d5a1e, // height 0 (at sea level - beach)
  0x3a7028, // height 1
  0x4a8530, // height 2
  0x5a9a38, // height 3
  0x6aaf40, // height 4
  0x7abf50, // height 5
  0x8aaa60, // height 6
  0x9a9570, // height 7
  0xaa8a7a, // height 8 (peaks)
];
