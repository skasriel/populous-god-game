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
export const WALKER_SETTLE_CHANCE = 0.003; // chance per tick to attempt settling (much slower)
export const INITIAL_WALKER_POPULATION = 5;
export const WALKER_SPAWN_POPULATION = 3; // population of newly spawned walkers
export const MIN_SETTLEMENT_DISTANCE = 4; // minimum tiles between settlements

// ── Settlements ──
export const SETTLEMENT_SPAWN_INTERVAL = 12; // seconds between spawning walkers
export const SETTLEMENT_SPAWN_MIN_POP = 6; // minimum population to spawn a walker
export const SETTLEMENT_GROWTH_RATE = 0.15; // population gained per second (slow growth)
export const MAX_SETTLEMENT_POPULATION = 50;

// Building tiers by flat area — per Populous manual, larger settlements
// need much more contiguous flat land for crops
export const BUILDING_TIERS = [
  { name: 'Hut', minFlat: 2, maxPop: 10, color: 0x8B7355 },
  { name: 'House', minFlat: 5, maxPop: 20, color: 0x9B8365 },
  { name: 'Manor', minFlat: 9, maxPop: 35, color: 0xAB9375 },
  { name: 'Castle', minFlat: 12, maxPop: 50, color: 0xBBA385 },
];

// ── Mana ──
export const MANA_PER_POPULATION = 0.05; // mana gained per population per second
export const MAX_MANA = 500;
export const STARTING_MANA = 30;

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
export const CAMERA_ZOOM = 12;
export const CAMERA_PAN_SPEED = 20;

// ── AI ──
export const AI_THINK_INTERVAL = 2.0; // seconds between AI decisions
export const AI_TERRAIN_ACTIONS_PER_THINK = 3;

// ── Colors ──
export const PLAYER_COLOR = 0x4488ff;
export const ENEMY_COLOR = 0xff4444;
export const WATER_COLOR = 0x1848b0;  // Brighter Populous blue
export const TERRAIN_COLORS = [
  0xc2b280, // height 0 (sand/beach at sea level)
  0x30b830, // height 1 — bright green
  0x30b830, // height 2 — bright green (Populous uses uniform green)
  0x30b830, // height 3
  0x30b830, // height 4
  0x30b830, // height 5
  0x30b830, // height 6
  0x30b830, // height 7 — still green (Populous doesn't vary by height)
  0x30b830, // height 8
];
