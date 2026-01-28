/**
 * Example: Particle System
 *
 * Demonstrates:
 * - Object pooling for efficiency
 * - Time-based spawning
 * - Alpha/lifecycle management
 * - Performance with many objects
 */

import { Scene, FrameContext, Renderer, TAU } from '../index';

// ─────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;      // 0-1, decreases over time
  maxLife: number;   // total lifetime in seconds
  size: number;
  color: string;
  active: boolean;   // for object pooling
}

export interface ParticleSystemState {
  particles: Particle[];
  emitterX: number;
  emitterY: number;
  spawnRate: number;  // particles per tick
  maxParticles: number;
}

// ─────────────────────────────────────────────────────────────
// State Factory
// ─────────────────────────────────────────────────────────────

export function createParticleSystemState(
  emitterX: number,
  emitterY: number,
  maxParticles = 500
): ParticleSystemState {
  // Pre-allocate particle pool
  const particles: Particle[] = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 5,
      color: '#fff',
      active: false,
    });
  }

  return {
    particles,
    emitterX,
    emitterY,
    spawnRate: 5,
    maxParticles,
  };
}

// ─────────────────────────────────────────────────────────────
// Physics Update (called each tick)
// ─────────────────────────────────────────────────────────────

const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'];

export function updateParticleSystem(
  state: ParticleSystemState,
  deltaSeconds: number
): ParticleSystemState {
  const { particles, emitterX, emitterY, spawnRate } = state;

  // Update existing particles
  for (const p of particles) {
    if (!p.active) continue;

    p.life -= deltaSeconds / p.maxLife;

    if (p.life <= 0) {
      p.active = false;
      continue;
    }

    // Apply gravity
    p.vy += 2 * deltaSeconds;

    // Update position
    p.x += p.vx;
    p.y += p.vy;

    // Shrink over time
    p.size = p.size * 0.99;
  }

  // Spawn new particles
  let spawned = 0;
  for (const p of particles) {
    if (spawned >= spawnRate) break;
    if (p.active) continue;

    // Reuse inactive particle
    const angle = Math.random() * TAU;
    const speed = 1 + Math.random() * 3;

    p.x = emitterX;
    p.y = emitterY;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - 2; // bias upward
    p.life = 1;
    p.maxLife = 1 + Math.random() * 2;
    p.size = 3 + Math.random() * 8;
    p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    p.active = true;

    spawned++;
  }

  return state; // mutated in place for performance
}

// ─────────────────────────────────────────────────────────────
// Scene (render function)
// ─────────────────────────────────────────────────────────────

export const ParticleSystemScene: Scene<ParticleSystemState> = {
  id: 'particle-system',
  name: 'Particle System',

  render(r: Renderer, state: ParticleSystemState, frame: FrameContext) {
    // Dark background with subtle fade (trails effect)
    r.save();
    r.alpha = 0.2;
    r.rect(0, 0, r.width, r.height, { fill: '#0a0a12' });
    r.restore();

    // Count active particles for stats
    let activeCount = 0;

    // Render particles
    for (const p of state.particles) {
      if (!p.active) continue;
      activeCount++;

      // Alpha based on life
      r.save();
      r.alpha = p.life * 0.8;

      // Glow effect
      r.shadow(p.color, 10, 0, 0);
      r.circle(p.x, p.y, p.size, { fill: p.color });

      r.restore();
    }

    // Emitter indicator
    r.save();
    r.alpha = 0.5;
    r.circle(state.emitterX, state.emitterY, 8, {
      stroke: '#fff',
      width: 2,
    });
    r.restore();

    // Stats
    r.clearShadow();
    r.text(`Particles: ${activeCount}/${state.maxParticles}`, 20, 30, {
      font: '14px system-ui',
      fill: 'rgba(255,255,255,0.5)',
      align: 'left',
    });
    r.text(`Tick: ${frame.tick}`, 20, 50, {
      font: '14px system-ui',
      fill: 'rgba(255,255,255,0.5)',
      align: 'left',
    });
  },
};
