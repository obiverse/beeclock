import { CanvasRenderer } from '../canvas-renderer';
import { ClockSkin, ClockState, TAU, pad2 } from '../clock-skin';

/**
 * ConwaySkin: Game of Life driven by clock ticks.
 *
 * The Tao of Conway:
 *   "From simple rules, complexity emerges.
 *    Each second, a generation passes.
 *    Life, death, rebirth - the eternal cycle."
 *
 * Architecture:
 *   - Grid state persists across frames
 *   - Each clock TICK (1Hz) advances one generation
 *   - 60fps rendering interpolates cell transitions
 *   - Time display integrated into the living grid
 *
 * This pattern can be generalized:
 *   - Any cellular automaton
 *   - App loaders (run N generations, then callback)
 *   - Visualizations driven by clock pulses
 */

// ─────────────────────────────────────────────────────────────
// Grid Configuration
// ─────────────────────────────────────────────────────────────

const GRID_SIZE = 40;           // Cells per side
const CELL_ALIVE_COLOR = '#00ffaa';
const CELL_DYING_COLOR = '#005533';
const CELL_BORN_COLOR = '#88ffcc';
const BACKGROUND_COLOR = '#0a0a12';

// ─────────────────────────────────────────────────────────────
// State (persists across renders)
// ─────────────────────────────────────────────────────────────

interface ConwayState {
  grid: boolean[][];
  prevGrid: boolean[][];
  lastTick: number;
  generation: number;
  initialized: boolean;
}

const state: ConwayState = {
  grid: [],
  prevGrid: [],
  lastTick: -1,
  generation: 0,
  initialized: false,
};

// ─────────────────────────────────────────────────────────────
// Core Conway Logic
// ─────────────────────────────────────────────────────────────

function createGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
}

function copyGrid(grid: boolean[][]): boolean[][] {
  return grid.map(row => [...row]);
}

/**
 * Seed the grid with a pattern based on current time.
 * Creates interesting starting configurations.
 */
function seedGrid(grid: boolean[][], hour: number, min: number, sec: number): void {
  const size = grid.length;
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);

  // Clear grid
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid[y][x] = false;
    }
  }

  // Seed based on time - creates unique patterns
  const seed = hour * 3600 + min * 60 + sec;

  // Add some classic patterns based on time components

  // Glider gun position based on hour
  const gunX = 2 + (hour % 6);
  const gunY = 2 + Math.floor(hour / 6);
  addGosperGliderGun(grid, gunX, gunY);

  // Random soup in center based on minute
  const soupRadius = 5 + (min % 5);
  for (let dy = -soupRadius; dy <= soupRadius; dy++) {
    for (let dx = -soupRadius; dx <= soupRadius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) {
        // Use time-based pseudo-random
        const hash = ((x * 31 + y * 17 + seed) * 2654435761) >>> 0;
        grid[y][x] = (hash % 100) < 35; // ~35% density
      }
    }
  }

  // Add pulsars based on seconds (creates rhythmic patterns)
  if (sec % 15 < 5) {
    addPulsar(grid, cx - 12, cy - 12);
  }
  if (sec % 15 >= 5 && sec % 15 < 10) {
    addPulsar(grid, cx + 8, cy - 12);
  }
  if (sec % 15 >= 10) {
    addPulsar(grid, cx - 2, cy + 10);
  }
}

/**
 * Add a Gosper Glider Gun - creates infinite gliders.
 */
function addGosperGliderGun(grid: boolean[][], x: number, y: number): void {
  const pattern = [
    [0, 4], [0, 5], [1, 4], [1, 5],                    // Left square
    [10, 4], [10, 5], [10, 6],                         // Left part of gun
    [11, 3], [11, 7],
    [12, 2], [12, 8], [13, 2], [13, 8],
    [14, 5],
    [15, 3], [15, 7],
    [16, 4], [16, 5], [16, 6],
    [17, 5],
    [20, 2], [20, 3], [20, 4],                         // Right part
    [21, 2], [21, 3], [21, 4],
    [22, 1], [22, 5],
    [24, 0], [24, 1], [24, 5], [24, 6],
    [34, 2], [34, 3], [35, 2], [35, 3],               // Right square
  ];

  const size = grid.length;
  for (const [dx, dy] of pattern) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      grid[ny][nx] = true;
    }
  }
}

/**
 * Add a Pulsar - period 3 oscillator.
 */
function addPulsar(grid: boolean[][], x: number, y: number): void {
  const pattern = [
    // Top
    [2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0],
    // Upper sides
    [0, 2], [0, 3], [0, 4], [5, 2], [7, 2], [12, 2], [12, 3], [12, 4],
    [0, 8], [0, 9], [0, 10], [5, 10], [7, 10], [12, 8], [12, 9], [12, 10],
    // Middle
    [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5],
    [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7],
    // Inner
    [5, 3], [5, 4], [7, 3], [7, 4],
    [5, 8], [5, 9], [7, 8], [7, 9],
    // Bottom
    [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12],
  ];

  const size = grid.length;
  for (const [dx, dy] of pattern) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      grid[ny][nx] = true;
    }
  }
}

/**
 * Count live neighbors (toroidal wrap).
 */
function countNeighbors(grid: boolean[][], x: number, y: number): number {
  const size = grid.length;
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      // Toroidal wrap
      const nx = (x + dx + size) % size;
      const ny = (y + dy + size) % size;

      if (grid[ny][nx]) count++;
    }
  }

  return count;
}

/**
 * Advance one generation using Conway's rules:
 *   - Live cell with 2-3 neighbors survives
 *   - Dead cell with exactly 3 neighbors is born
 *   - All other cells die
 */
function nextGeneration(grid: boolean[][]): boolean[][] {
  const size = grid.length;
  const next = createGrid(size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const neighbors = countNeighbors(grid, x, y);
      const alive = grid[y][x];

      if (alive) {
        next[y][x] = neighbors === 2 || neighbors === 3;
      } else {
        next[y][x] = neighbors === 3;
      }
    }
  }

  return next;
}

/**
 * Check if grid is stagnant (no changes) or empty.
 */
function isStagnant(grid: boolean[][], prevGrid: boolean[][]): boolean {
  const size = grid.length;
  let same = true;
  let hasLife = false;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x]) hasLife = true;
      if (grid[y][x] !== prevGrid[y][x]) same = false;
      if (hasLife && !same) return false; // Early exit
    }
  }

  return !hasLife || same;
}

// ─────────────────────────────────────────────────────────────
// The Skin
// ─────────────────────────────────────────────────────────────

export const ConwaySkin: ClockSkin = {
  id: 'conway',
  name: 'Game of Life',

  render(r: CanvasRenderer, clockState: ClockState, t: number): void {
    const { width, height, cx, cy } = r;

    // Background
    r.fill(BACKGROUND_COLOR);

    // Initialize or reseed if needed
    if (!state.initialized) {
      state.grid = createGrid(GRID_SIZE);
      state.prevGrid = createGrid(GRID_SIZE);
      seedGrid(state.grid, clockState.hour, clockState.min, clockState.sec);
      state.prevGrid = copyGrid(state.grid);
      state.lastTick = clockState.tick;
      state.generation = 0;
      state.initialized = true;
    }

    // Advance generation on clock tick
    if (clockState.tick !== state.lastTick) {
      state.prevGrid = copyGrid(state.grid);
      state.grid = nextGeneration(state.grid);
      state.generation++;
      state.lastTick = clockState.tick;

      // Reseed if stagnant (every minute or when dead)
      if (state.generation % 60 === 0 || isStagnant(state.grid, state.prevGrid)) {
        seedGrid(state.grid, clockState.hour, clockState.min, clockState.sec);
        state.prevGrid = copyGrid(state.grid);
        state.generation = 0;
      }
    }

    // Calculate cell size
    const gridPixels = Math.min(width, height) * 0.85;
    const cellSize = gridPixels / GRID_SIZE;
    const offsetX = cx - gridPixels / 2;
    const offsetY = cy - gridPixels / 2;

    // Interpolation for smooth transitions
    const alpha = clockState.alpha;

    // Render grid
    r.save();

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const alive = state.grid[y][x];
        const wasAlive = state.prevGrid[y][x];

        const px = offsetX + x * cellSize;
        const py = offsetY + y * cellSize;
        const padding = cellSize * 0.1;
        const size = cellSize - padding * 2;

        if (alive || wasAlive) {
          let color: string;
          let scale: number;

          if (alive && wasAlive) {
            // Stable - full brightness
            color = CELL_ALIVE_COLOR;
            scale = 1;
          } else if (alive && !wasAlive) {
            // Born - fade in
            color = CELL_BORN_COLOR;
            scale = 0.3 + alpha * 0.7;
          } else {
            // Dying - fade out
            color = CELL_DYING_COLOR;
            scale = 1 - alpha * 0.8;
          }

          const actualSize = size * scale;
          const offset = (size - actualSize) / 2;

          r.alpha = scale;
          r.roundRect(
            px + padding + offset,
            py + padding + offset,
            actualSize,
            actualSize,
            actualSize * 0.2,
            { fill: color }
          );
        }
      }
    }

    r.alpha = 1;
    r.restore();

    // Render time overlay in center
    renderTimeOverlay(r, clockState, cx, cy, gridPixels);

    // Generation counter (subtle, bottom right)
    r.text(`Gen ${state.generation}`, width - 12, height - 12, {
      font: '10px system-ui',
      fill: 'rgba(255, 255, 255, 0.3)',
      align: 'right',
      baseline: 'bottom',
    });
  },
};

/**
 * Render time display as a glowing overlay.
 */
function renderTimeOverlay(
  r: CanvasRenderer,
  state: ClockState,
  cx: number,
  cy: number,
  gridSize: number
): void {
  const timeStr = `${pad2(state.hour)}:${pad2(state.min)}:${pad2(state.sec)}`;

  // Glowing backdrop
  r.save();
  r.alpha = 0.7;
  r.shadow('rgba(0, 255, 170, 0.5)', 20, 0, 0);

  r.text(timeStr, cx, cy, {
    font: `bold ${gridSize * 0.12}px "SF Mono", monospace`,
    fill: '#ffffff',
    align: 'center',
    baseline: 'middle',
  });

  r.clearShadow();
  r.alpha = 1;
  r.restore();
}

// ─────────────────────────────────────────────────────────────
// Loader Interface (for future generalization)
// ─────────────────────────────────────────────────────────────

/**
 * Reset Conway state (useful for loaders).
 */
export function resetConway(): void {
  state.initialized = false;
  state.generation = 0;
}

/**
 * Get current generation count.
 */
export function getGeneration(): number {
  return state.generation;
}

/**
 * Check if simulation is running (has active cells).
 */
export function isAlive(): boolean {
  if (!state.initialized) return false;
  return state.grid.some(row => row.some(cell => cell));
}
