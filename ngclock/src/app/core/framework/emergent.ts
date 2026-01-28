/**
 * Emergent Systems Engine
 *
 * Implements:
 * 1. Cellular Automata (Conway's Game of Life)
 * 2. AI Agent decision making with DNA-based behavior
 * 3. Genetic algorithm for evolution
 *
 * The CA grid creates environmental patterns that influence
 * agent behavior. Agents compete, and the fittest are selected
 * for reproduction with mutation, creating emergent fighting styles.
 */

import {
  CAGrid,
  AgentDNA,
  AIAgent,
  EmergentState,
  FighterAction,
  createRandomDNA,
  createAIAgent,
} from './scenes/types';

// ─────────────────────────────────────────────────────────────
// Cellular Automata Engine
// ─────────────────────────────────────────────────────────────

/**
 * Evolve the CA grid one generation using Conway's rules:
 * - Any live cell with 2 or 3 neighbors survives
 * - Any dead cell with exactly 3 neighbors becomes alive
 * - All other cells die or stay dead
 */
export function evolveCA(ca: CAGrid): void {
  const { width, height, cells, nextCells } = ca;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const neighbors = countNeighbors(ca, x, y);
      const alive = cells[idx];

      if (alive) {
        nextCells[idx] = neighbors === 2 || neighbors === 3;
      } else {
        nextCells[idx] = neighbors === 3;
      }
    }
  }

  // Swap buffers
  for (let i = 0; i < cells.length; i++) {
    cells[i] = nextCells[i];
  }

  ca.generation++;
}

function countNeighbors(ca: CAGrid, x: number, y: number): number {
  const { width, height, cells } = ca;
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      // Wrap around (toroidal grid)
      const nx = (x + dx + width) % width;
      const ny = (y + dy + height) % height;

      if (cells[ny * width + nx]) count++;
    }
  }

  return count;
}

/**
 * Sample the CA grid at a world position.
 * Returns the density of live cells in a local area.
 */
export function sampleCADensity(
  ca: CAGrid,
  worldX: number,
  worldY: number,
  worldWidth: number,
  worldHeight: number,
  radius = 3
): number {
  // Map world coordinates to grid coordinates
  const gridX = Math.floor(((worldX + worldWidth / 2) / worldWidth) * ca.width);
  const gridY = Math.floor(((worldY + worldHeight / 2) / worldHeight) * ca.height);

  let alive = 0;
  let total = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = (gridX + dx + ca.width) % ca.width;
      const ny = (gridY + dy + ca.height) % ca.height;

      if (ca.cells[ny * ca.width + nx]) alive++;
      total++;
    }
  }

  return alive / total;
}

/**
 * Add some chaos to the CA grid (gliders, oscillators, etc.)
 */
export function injectCAPattern(ca: CAGrid, pattern: 'glider' | 'blinker' | 'random'): void {
  const cx = Math.floor(Math.random() * (ca.width - 10)) + 5;
  const cy = Math.floor(Math.random() * (ca.height - 10)) + 5;

  const setCell = (dx: number, dy: number) => {
    const x = (cx + dx + ca.width) % ca.width;
    const y = (cy + dy + ca.height) % ca.height;
    ca.cells[y * ca.width + x] = true;
  };

  switch (pattern) {
    case 'glider':
      // Classic glider
      setCell(1, 0);
      setCell(2, 1);
      setCell(0, 2);
      setCell(1, 2);
      setCell(2, 2);
      break;
    case 'blinker':
      // Simple oscillator
      setCell(0, 0);
      setCell(1, 0);
      setCell(2, 0);
      break;
    case 'random':
      // Random 5x5 block
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          if (Math.random() < 0.5) setCell(dx, dy);
        }
      }
      break;
  }
}

// ─────────────────────────────────────────────────────────────
// AI Agent Decision Making
// ─────────────────────────────────────────────────────────────

/**
 * Make a decision for an AI agent based on its DNA and environment.
 */
export function agentDecide(
  agent: AIAgent,
  agents: AIAgent[],
  ca: CAGrid,
  worldWidth: number,
  worldHeight: number
): FighterAction {
  const dna = agent.dna;

  // Can only decide if in idle or walking state
  const canAct = agent.action === 'idle' ||
                 agent.action === 'walk_forward' ||
                 agent.action === 'walk_back';

  if (!canAct) return agent.action;

  // Find nearest enemy (different facing direction = enemy)
  const enemies = agents.filter(a =>
    a.id !== agent.id &&
    a.health > 0 &&
    a.facingRight !== agent.facingRight
  );

  if (enemies.length === 0) {
    // No enemies, wander
    return Math.random() < 0.5 ? 'walk_forward' : 'idle';
  }

  // Target closest enemy
  let closest = enemies[0];
  let closestDist = Math.abs(closest.x - agent.x);
  for (const e of enemies) {
    const d = Math.abs(e.x - agent.x);
    if (d < closestDist) {
      closest = e;
      closestDist = d;
    }
  }

  agent.targetId = closest.id;

  // Sample CA density at agent position (environmental influence)
  const caDensity = sampleCADensity(ca, agent.x, 0, worldWidth, worldHeight);
  const caBoost = caDensity * dna.caInfluence;

  // Distance thresholds (influenced by DNA)
  const attackRange = 50 + dna.attackDistance * 100; // 50-150
  const retreatHealthThreshold = dna.retreatThreshold * 100;

  // Retreat if low health (modified by CA)
  if (agent.health < retreatHealthThreshold * (1 - caBoost * 0.5)) {
    // Face away from enemy and walk back
    const shouldRetreat = Math.random() < (1 - dna.attackBias);
    if (shouldRetreat) {
      agent.facingRight = closest.x < agent.x;
      return 'walk_back';
    }
  }

  // Attack if in range
  if (closestDist < attackRange) {
    // Decide attack type based on DNA
    const attackRoll = Math.random();
    const attackThreshold = dna.attackBias + caBoost * 0.3;

    if (attackRoll < attackThreshold) {
      // Attack!
      if (Math.random() < dna.punchVsKick) {
        return 'kick_startup';
      } else {
        return 'punch_startup';
      }
    } else {
      // Block instead
      return 'blocking';
    }
  }

  // Move towards enemy
  const advanceChance = dna.advanceRate + caBoost * 0.2;
  if (Math.random() < advanceChance) {
    agent.facingRight = closest.x > agent.x;
    return 'walk_forward';
  }

  return 'idle';
}

/**
 * Update agent state machine (similar to fighter state machine)
 */
export function updateAgent(
  agent: AIAgent,
  agents: AIAgent[],
  ca: CAGrid,
  deltaMs: number,
  worldWidth: number,
  worldHeight: number
): void {
  if (agent.health <= 0) return;

  agent.actionTime += deltaMs;
  agent.survivalTime += deltaMs;
  agent.decisionTimer -= deltaMs;

  // State machine durations
  const actionDurations: Record<FighterAction, number> = {
    idle: Infinity,
    walk_forward: Infinity,
    walk_back: Infinity,
    punch_startup: 100,
    punch_active: 80,
    punch_recovery: 150,
    kick_startup: 150,
    kick_active: 100,
    kick_recovery: 200,
    blocking: Infinity,
    hitstun: 300,
  };

  const actionTransitions: Record<FighterAction, FighterAction> = {
    idle: 'idle',
    walk_forward: 'idle',
    walk_back: 'idle',
    punch_startup: 'punch_active',
    punch_active: 'punch_recovery',
    punch_recovery: 'idle',
    kick_startup: 'kick_active',
    kick_active: 'kick_recovery',
    kick_recovery: 'idle',
    blocking: 'idle',
    hitstun: 'idle',
  };

  const duration = actionDurations[agent.action];

  // Transition on duration end
  if (agent.actionTime >= duration) {
    agent.action = actionTransitions[agent.action];
    agent.actionTime = 0;
  }

  // Movement
  const moveSpeed = 0.15;
  if (agent.action === 'walk_forward') {
    agent.x += (agent.facingRight ? 1 : -1) * moveSpeed * deltaMs;
  } else if (agent.action === 'walk_back') {
    agent.x += (agent.facingRight ? -1 : 1) * moveSpeed * deltaMs;
  }

  // Clamp position
  agent.x = Math.max(-worldWidth / 2 + 30, Math.min(worldWidth / 2 - 30, agent.x));

  // Decision making (rate limited by DNA reaction speed)
  const decisionInterval = 200 + (1 - agent.dna.reactionSpeed) * 500;
  if (agent.decisionTimer <= 0) {
    agent.decisionTimer = decisionInterval + agent.dna.patience * 300;

    // Only decide if in decidable state
    const canDecide = agent.action === 'idle' ||
                      agent.action === 'walk_forward' ||
                      agent.action === 'walk_back' ||
                      agent.action === 'blocking';

    if (canDecide) {
      const newAction = agentDecide(agent, agents, ca, worldWidth, worldHeight);
      if (newAction !== agent.action) {
        agent.action = newAction;
        agent.actionTime = 0;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Combat Resolution
// ─────────────────────────────────────────────────────────────

interface HitResult {
  attackerId: number;
  defenderId: number;
  damage: number;
}

/**
 * Check for hits between agents and apply damage.
 */
export function resolveAgentCombat(agents: AIAgent[]): HitResult[] {
  const hits: HitResult[] = [];

  for (const attacker of agents) {
    if (attacker.health <= 0) continue;

    // Check if in active attack frame
    const isAttacking = attacker.action === 'punch_active' || attacker.action === 'kick_active';
    if (!isAttacking) continue;

    // Attack just started (first frame)
    if (attacker.actionTime > 20) continue; // Only hit on first 20ms

    // Hitbox
    const hitboxX = attacker.x + (attacker.facingRight ? 50 : -50);
    const hitboxWidth = attacker.action === 'kick_active' ? 80 : 60;
    const damage = attacker.action === 'kick_active' ? 15 : 10;

    for (const defender of agents) {
      if (defender.id === attacker.id) continue;
      if (defender.health <= 0) continue;

      // Simple hitbox collision
      const defenderLeft = defender.x - 25;
      const defenderRight = defender.x + 25;
      const hitboxLeft = hitboxX - hitboxWidth / 2;
      const hitboxRight = hitboxX + hitboxWidth / 2;

      const overlaps = hitboxLeft < defenderRight && hitboxRight > defenderLeft;

      if (overlaps) {
        // Check if blocking
        if (defender.action === 'blocking') {
          // Blocked - reduced damage
          defender.health -= damage * 0.2;
          attacker.damageDealt += damage * 0.2;
          defender.damageTaken += damage * 0.2;
        } else {
          // Hit!
          defender.health -= damage;
          defender.action = 'hitstun';
          defender.actionTime = 0;
          attacker.damageDealt += damage;
          defender.damageTaken += damage;

          hits.push({
            attackerId: attacker.id,
            defenderId: defender.id,
            damage,
          });
        }
      }
    }
  }

  return hits;
}

// ─────────────────────────────────────────────────────────────
// Genetic Algorithm / Evolution
// ─────────────────────────────────────────────────────────────

/**
 * Calculate fitness score for an agent.
 * Higher is better.
 */
export function calculateFitness(agent: AIAgent): number {
  // Fitness = damage dealt + survival bonus - damage taken penalty
  const damageScore = agent.damageDealt * 2;
  const survivalScore = (agent.survivalTime / 1000) * 0.5;
  const healthBonus = agent.health > 0 ? agent.health : 0;
  const damagePenalty = agent.damageTaken * 0.5;

  return Math.max(0, damageScore + survivalScore + healthBonus - damagePenalty);
}

/**
 * Crossover two parent DNAs to create child DNA.
 */
export function crossoverDNA(parent1: AgentDNA, parent2: AgentDNA): AgentDNA {
  const child: AgentDNA = { ...parent1 };

  // Random crossover for each gene
  for (const key of Object.keys(child) as (keyof AgentDNA)[]) {
    child[key] = Math.random() < 0.5 ? parent1[key] : parent2[key];
  }

  return child;
}

/**
 * Mutate DNA with given rate.
 */
export function mutateDNA(dna: AgentDNA, mutationRate: number): AgentDNA {
  const mutated: AgentDNA = { ...dna };

  for (const key of Object.keys(mutated) as (keyof AgentDNA)[]) {
    if (Math.random() < mutationRate) {
      // Gaussian-like mutation
      const delta = (Math.random() - 0.5) * 0.4;
      mutated[key] = Math.max(0, Math.min(1, mutated[key] + delta));
    }
  }

  return mutated;
}

/**
 * Evolve the population - select fittest, crossover, mutate.
 */
export function evolvePopulation(state: EmergentState): void {
  const { agents, evolution } = state;

  // Calculate fitness for all agents
  for (const agent of agents) {
    agent.fitness = calculateFitness(agent);
  }

  // Sort by fitness (descending)
  const ranked = [...agents].sort((a, b) => b.fitness - a.fitness);

  // Stats
  evolution.bestFitness = ranked[0].fitness;
  evolution.averageFitness = agents.reduce((sum, a) => sum + a.fitness, 0) / agents.length;
  evolution.generation++;

  // Selection: top 50% survive as parents
  const numParents = Math.max(2, Math.floor(agents.length / 2));
  const parents = ranked.slice(0, numParents);

  // Create new generation
  const newAgents: AIAgent[] = [];

  // Elitism: keep best agent unchanged
  const elite = createAIAgent(0, ranked[0].x, ranked[0].facingRight);
  elite.dna = { ...ranked[0].dna };
  newAgents.push(elite);

  // Breed the rest
  for (let i = 1; i < evolution.populationSize; i++) {
    // Tournament selection
    const p1 = parents[Math.floor(Math.random() * parents.length)];
    const p2 = parents[Math.floor(Math.random() * parents.length)];

    // Crossover
    let childDNA = crossoverDNA(p1.dna, p2.dna);

    // Mutate
    childDNA = mutateDNA(childDNA, evolution.mutationRate);

    // Create new agent
    const x = (i - evolution.populationSize / 2) * 60;
    const facingRight = i < evolution.populationSize / 2;
    const child = createAIAgent(i, x, facingRight);
    child.dna = childDNA;
    newAgents.push(child);
  }

  // Replace population
  state.agents = newAgents;

  // Reset round
  evolution.roundTimer = evolution.roundTime;

  // Occasionally inject CA patterns to keep things interesting
  if (Math.random() < 0.3) {
    const patterns: ('glider' | 'blinker' | 'random')[] = ['glider', 'blinker', 'random'];
    injectCAPattern(state.ca, patterns[Math.floor(Math.random() * patterns.length)]);
  }
}

// ─────────────────────────────────────────────────────────────
// Main Update Loop
// ─────────────────────────────────────────────────────────────

/**
 * Update the entire emergent system.
 */
export function updateEmergentSystem(
  state: EmergentState,
  deltaMs: number,
  worldWidth: number,
  worldHeight: number
): HitResult[] {
  if (state.paused) return [];

  const effectiveDelta = deltaMs * state.speed;

  // Update CA grid
  state.ca.lastTick += effectiveDelta;
  if (state.ca.lastTick >= state.ca.tickRate) {
    evolveCA(state.ca);
    state.ca.lastTick = 0;
  }

  // Update all agents
  for (const agent of state.agents) {
    updateAgent(agent, state.agents, state.ca, effectiveDelta, worldWidth, worldHeight);
  }

  // Resolve combat
  const hits = resolveAgentCombat(state.agents);

  // Evolution timer
  state.evolution.roundTimer -= effectiveDelta;
  if (state.evolution.roundTimer <= 0) {
    evolvePopulation(state);
  }

  return hits;
}
