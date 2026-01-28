/**
 * BeeClock App - State Types
 *
 * Pure Bee Framework app state definitions.
 * No Angular dependencies.
 */

// ─────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────

export type SceneId = 'home' | 'lab' | 'about' | 'anime' | 'fighter' | 'studio';
export type ViewMode = '2d' | '3d' | 'split';

export interface NavItem {
  id: SceneId;
  label: string;
  icon: string;
}

export interface ClockState {
  sec: number;
  min: number;
  hour: number;
  tick: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppState {
  /** Current scene */
  currentScene: SceneId;

  /** View mode (2D, 3D, or split) */
  viewMode: ViewMode;

  /** Clock state (from WASM) */
  clock: ClockState;

  /** Mouse position (for interactions) */
  mouse: { x: number; y: number; down: boolean };

  /** Normalized mouse for 3D camera (-1 to 1) */
  mouseNorm: { x: number; y: number };

  /** Hovered nav item (for highlighting) */
  hoveredNav: SceneId | null;

  /** Selected skin index (for Home scene) */
  skinIndex: number;

  /** Show debug overlay */
  showDebug: boolean;

  /** Lab: selected example index */
  labExampleIndex: number;

  /** Canvas dimensions */
  canvasWidth: number;
  canvasHeight: number;

  /** Fighter scene state */
  fighter: FighterState;

  /** Emergent systems state (CA, AI agents, evolution) */
  emergent: EmergentState;
}

// ─────────────────────────────────────────────────────────────
// Fighter State Machine
// ─────────────────────────────────────────────────────────────

export type FighterAction =
  | 'idle'
  | 'walk_forward'
  | 'walk_back'
  | 'punch_startup'
  | 'punch_active'
  | 'punch_recovery'
  | 'kick_startup'
  | 'kick_active'
  | 'kick_recovery'
  | 'blocking'
  | 'hitstun';

export interface FighterState {
  action: FighterAction;
  actionTime: number;      // Time in current action (ms)
  x: number;               // Horizontal position
  facingRight: boolean;
  health: number;
  comboCount: number;
  particles: Particle[];
  hitEffects: HitEffect[];
  inputBuffer: string[];   // Recent inputs for combos
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface HitEffect {
  x: number;
  y: number;
  time: number;
  type: 'impact' | 'block' | 'speed_lines';
}

// ─────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: '⏰' },
  { id: 'anime', label: 'Anime', icon: '☯' },
  { id: 'fighter', label: 'Fighter', icon: '👊' },
  { id: 'studio', label: 'Studio', icon: '🧬' },
  { id: 'lab', label: 'Lab', icon: '🔬' },
  { id: 'about', label: 'About', icon: '📖' },
];

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

export function createAppState(): AppState {
  return {
    currentScene: 'home',
    viewMode: 'split',
    clock: { sec: 0, min: 0, hour: 0, tick: 0 },
    mouse: { x: 0, y: 0, down: false },
    mouseNorm: { x: 0, y: 0 },
    hoveredNav: null,
    skinIndex: 0,
    showDebug: false,
    labExampleIndex: 0,
    canvasWidth: 800,
    canvasHeight: 600,
    fighter: createFighterState(),
    emergent: createEmergentState(),
  };
}

export function createFighterState(): FighterState {
  return {
    action: 'idle',
    actionTime: 0,
    x: 0,
    facingRight: true,
    health: 100,
    comboCount: 0,
    particles: [],
    hitEffects: [],
    inputBuffer: [],
  };
}

// ─────────────────────────────────────────────────────────────
// Emergent Systems - Agentic Loops
// ─────────────────────────────────────────────────────────────

/**
 * Cellular Automata Grid (Conway's Game of Life style)
 * This acts as a "substrate" that influences agent behavior.
 * The grid evolves according to CA rules and provides
 * environmental pressure on the agents.
 */
export interface CAGrid {
  width: number;
  height: number;
  cells: boolean[];        // Current state
  nextCells: boolean[];    // Buffer for next state
  tickRate: number;        // How often to evolve (ms)
  lastTick: number;        // Last evolution time
  generation: number;      // How many evolutions
}

/**
 * Agent DNA - Behavioral genes that determine how an AI fighter acts.
 * These are the "weights" that get evolved through genetic algorithms.
 */
export interface AgentDNA {
  // Aggression genes (0-1)
  attackDistance: number;      // Preferred distance to attack
  attackBias: number;          // Prefers attacking vs defending
  punchVsKick: number;         // Prefers punch (0) vs kick (1)

  // Movement genes (0-1)
  advanceRate: number;         // How quickly to advance
  retreatThreshold: number;    // Health % to start retreating

  // Timing genes (0-1)
  reactionSpeed: number;       // How fast to react
  patience: number;            // Wait time before acting

  // Environmental sensitivity (0-1)
  caInfluence: number;         // How much CA grid affects behavior
}

/**
 * Autonomous AI Agent - A fighter controlled by DNA
 */
export interface AIAgent {
  id: number;
  x: number;
  y: number;
  health: number;
  action: FighterAction;
  actionTime: number;
  facingRight: boolean;
  dna: AgentDNA;

  // Performance tracking for evolution
  damageDealt: number;
  damageTaken: number;
  survivalTime: number;
  fitness: number;

  // Decision state
  decisionTimer: number;       // Time until next decision
  targetId: number | null;     // Current target agent
}

/**
 * Evolution state - Tracks generations and selection
 */
export interface EvolutionState {
  generation: number;
  roundTime: number;           // Time per evolution round (ms)
  roundTimer: number;          // Current round time remaining
  bestFitness: number;
  averageFitness: number;
  mutationRate: number;        // 0-1, how much to mutate DNA
  populationSize: number;
}

/**
 * Complete emergent system state
 */
export interface EmergentState {
  ca: CAGrid;
  agents: AIAgent[];
  evolution: EvolutionState;
  paused: boolean;
  showCA: boolean;            // Toggle CA visualization
  showDNA: boolean;           // Toggle DNA stats
  speed: number;              // Simulation speed multiplier
}

// ─────────────────────────────────────────────────────────────
// Emergent System Factories
// ─────────────────────────────────────────────────────────────

export function createCAGrid(width = 40, height = 30): CAGrid {
  const size = width * height;
  const cells = new Array(size).fill(false);

  // Random initial state (about 30% alive)
  for (let i = 0; i < size; i++) {
    cells[i] = Math.random() < 0.3;
  }

  return {
    width,
    height,
    cells,
    nextCells: new Array(size).fill(false),
    tickRate: 200,
    lastTick: 0,
    generation: 0,
  };
}

export function createRandomDNA(): AgentDNA {
  return {
    attackDistance: Math.random(),
    attackBias: Math.random(),
    punchVsKick: Math.random(),
    advanceRate: Math.random(),
    retreatThreshold: Math.random() * 0.5, // 0-50% health
    reactionSpeed: Math.random(),
    patience: Math.random(),
    caInfluence: Math.random(),
  };
}

export function createAIAgent(id: number, x: number, facingRight: boolean): AIAgent {
  return {
    id,
    x,
    y: 0,
    health: 100,
    action: 'idle',
    actionTime: 0,
    facingRight,
    dna: createRandomDNA(),
    damageDealt: 0,
    damageTaken: 0,
    survivalTime: 0,
    fitness: 0,
    decisionTimer: 0,
    targetId: null,
  };
}

export function createEmergentState(): EmergentState {
  // Create initial population of agents
  const agents: AIAgent[] = [];
  const populationSize = 6;

  for (let i = 0; i < populationSize; i++) {
    const x = (i - populationSize / 2) * 60;
    const facingRight = i < populationSize / 2;
    agents.push(createAIAgent(i, x, facingRight));
  }

  return {
    ca: createCAGrid(40, 30),
    agents,
    evolution: {
      generation: 1,
      roundTime: 15000,      // 15 seconds per round
      roundTimer: 15000,
      bestFitness: 0,
      averageFitness: 0,
      mutationRate: 0.15,
      populationSize,
    },
    paused: false,
    showCA: true,
    showDNA: true,
    speed: 1,
  };
}
