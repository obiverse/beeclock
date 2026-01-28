/**
 * Lab Scene - Framework Examples
 *
 * Showcases the Bee Framework's capabilities:
 * - Bouncing balls (physics simulation)
 * - Particle system (object pooling)
 * - Custom renderers
 */

import { Scene, Renderer, FrameContext, TAU, lerp } from '../index';
import { AppState } from './types';
import { renderNavBar, getNavHeight } from './nav-bar';
import {
  BouncingBallsState,
  createBouncingBallsState,
  updateBouncingBalls,
} from '../examples/bouncing-balls';
import {
  ParticleSystemState,
  createParticleSystemState,
  updateParticleSystem,
} from '../examples/particle-system';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const EXAMPLES = ['Bouncing Balls', 'Particle System', 'Waveform', 'Grid'];
const COLORS = {
  bg: '#0a0a12',
  text: 'rgba(255, 255, 255, 0.5)',
  accent: '#64c8ff',
  panel: 'rgba(255, 255, 255, 0.03)',
  border: 'rgba(255, 255, 255, 0.1)',
};

// ─────────────────────────────────────────────────────────────
// Example State (persistent across frames)
// ─────────────────────────────────────────────────────────────

let ballsState: BouncingBallsState | null = null;
let particleState: ParticleSystemState | null = null;
let lastContentSize = { w: 0, h: 0 };

// ─────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────

export const LabScene: Scene<AppState> = {
  id: 'lab',
  name: 'Lab',

  onEnter(state: AppState) {
    // Reset example states on enter
    ballsState = null;
    particleState = null;
  },

  render(r: Renderer, state: AppState, frame: FrameContext) {
    const navHeight = getNavHeight();
    const contentHeight = r.height - navHeight;
    const contentWidth = r.width;

    // Background
    r.rect(0, 0, r.width, r.height, { fill: COLORS.bg });

    // Nav bar
    renderNavBar(r, state, frame);

    // Content area
    r.save();
    r.translate(0, navHeight);

    // Title
    r.text('Framework Lab', contentWidth / 2, 30, {
      font: 'bold 24px system-ui',
      fill: COLORS.accent,
      align: 'center',
    });

    // Example selector
    const selectorY = 60;
    const exampleWidth = 120;
    const totalWidth = EXAMPLES.length * exampleWidth;
    let startX = (contentWidth - totalWidth) / 2;

    for (let i = 0; i < EXAMPLES.length; i++) {
      const isSelected = state.labExampleIndex === i;
      const bg = isSelected ? 'rgba(100, 200, 255, 0.15)' : COLORS.panel;
      const textColor = isSelected ? COLORS.accent : COLORS.text;

      r.roundRect(startX, selectorY, exampleWidth - 10, 30, 4, { fill: bg });
      r.text(EXAMPLES[i], startX + (exampleWidth - 10) / 2, selectorY + 15, {
        font: '12px system-ui',
        fill: textColor,
        align: 'center',
      });

      startX += exampleWidth;
    }

    // Example viewport
    const viewportY = 110;
    const viewportHeight = contentHeight - viewportY - 60;
    const viewportPadding = 40;
    const viewportWidth = contentWidth - viewportPadding * 2;

    // Viewport background
    r.roundRect(viewportPadding, viewportY, viewportWidth, viewportHeight, 8, {
      fill: COLORS.panel,
      stroke: COLORS.border,
      width: 1,
    });

    // Render selected example
    r.save();
    r.translate(viewportPadding, viewportY);

    // Check for resize
    if (lastContentSize.w !== viewportWidth || lastContentSize.h !== viewportHeight) {
      ballsState = null;
      particleState = null;
      lastContentSize = { w: viewportWidth, h: viewportHeight };
    }

    switch (state.labExampleIndex) {
      case 0:
        renderBouncingBalls(r, viewportWidth, viewportHeight, frame);
        break;
      case 1:
        renderParticleSystem(r, viewportWidth, viewportHeight, frame);
        break;
      case 2:
        renderWaveform(r, viewportWidth, viewportHeight, frame);
        break;
      case 3:
        renderGrid(r, viewportWidth, viewportHeight, frame, state);
        break;
    }

    r.restore();

    // Instructions
    r.text('1-4 to switch examples | Space to reset', contentWidth / 2, contentHeight - 25, {
      font: '12px system-ui',
      fill: 'rgba(255, 255, 255, 0.3)',
      align: 'center',
    });

    r.restore();
  },
};

// ─────────────────────────────────────────────────────────────
// Example Renderers
// ─────────────────────────────────────────────────────────────

function renderBouncingBalls(r: Renderer, w: number, h: number, frame: FrameContext): void {
  // Initialize if needed
  if (!ballsState) {
    ballsState = createBouncingBallsState(w, h, 12);
  }

  // Update physics (once per tick)
  ballsState = updateBouncingBalls(ballsState);

  // Render balls
  for (const ball of ballsState.balls) {
    // Interpolate position
    const x = lerp(ball.prevX, ball.x, frame.alpha);
    const y = lerp(ball.prevY, ball.y, frame.alpha);

    // Shadow
    r.save();
    r.alpha = 0.3;
    r.circle(x + 4, y + 4, ball.radius, { fill: '#000' });
    r.restore();

    // Ball with gradient
    const gradient = r.radialGradient(
      x - ball.radius * 0.3,
      y - ball.radius * 0.3,
      0,
      ball.radius * 1.2,
      [
        [0, lighten(ball.color, 40)],
        [0.5, ball.color],
        [1, darken(ball.color, 30)],
      ]
    );
    r.circle(x, y, ball.radius, { fill: gradient });

    // Highlight
    r.save();
    r.alpha = 0.5;
    r.circle(x - ball.radius * 0.3, y - ball.radius * 0.3, ball.radius * 0.2, {
      fill: '#fff',
    });
    r.restore();
  }

  // Stats
  r.text(`Balls: ${ballsState.balls.length}`, 15, 20, {
    font: '12px monospace',
    fill: COLORS.text,
    align: 'left',
  });
}

function renderParticleSystem(r: Renderer, w: number, h: number, frame: FrameContext): void {
  // Initialize if needed
  if (!particleState) {
    particleState = createParticleSystemState(w / 2, h * 0.7, 300);
  }

  // Update particles
  particleState = updateParticleSystem(particleState, frame.deltaMs / 1000);

  // Trail effect (semi-transparent background)
  r.save();
  r.alpha = 0.15;
  r.rect(0, 0, w, h, { fill: '#0a0a12' });
  r.restore();

  // Count active
  let activeCount = 0;

  // Render particles
  for (const p of particleState.particles) {
    if (!p.active) continue;
    activeCount++;

    r.save();
    r.alpha = p.life * 0.8;
    r.shadow(p.color, 8, 0, 0);
    r.circle(p.x, p.y, p.size, { fill: p.color });
    r.restore();
  }

  // Emitter indicator
  r.save();
  r.alpha = 0.4;
  r.circle(particleState.emitterX, particleState.emitterY, 6, {
    stroke: '#fff',
    width: 2,
  });
  r.restore();

  // Stats
  r.clearShadow();
  r.text(`Particles: ${activeCount}/${particleState.maxParticles}`, 15, 20, {
    font: '12px monospace',
    fill: COLORS.text,
    align: 'left',
  });
}

function renderWaveform(r: Renderer, w: number, h: number, frame: FrameContext): void {
  const cy = h / 2;
  const amplitude = h * 0.3;
  const waves = 3;

  // Multiple layered waves
  for (let wave = 0; wave < waves; wave++) {
    const offset = wave * 0.3;
    const alpha = 0.3 + (waves - wave) * 0.2;
    const color = wave === 0 ? '#64c8ff' : wave === 1 ? '#48dbfb' : '#ff6b6b';

    r.save();
    r.alpha = alpha;

    const ctx = r.raw;
    ctx.beginPath();
    ctx.moveTo(0, cy);

    for (let x = 0; x <= w; x += 2) {
      const t = frame.t + offset;
      const y =
        cy +
        Math.sin((x / w) * TAU * 2 + t * TAU) * amplitude * 0.5 +
        Math.sin((x / w) * TAU * 4 + t * TAU * 1.5) * amplitude * 0.3;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    r.restore();
  }

  // Center line
  r.line(0, cy, w, cy, {
    stroke: 'rgba(255, 255, 255, 0.1)',
    width: 1,
  });

  r.text('Audio Waveform Simulation', 15, 20, {
    font: '12px monospace',
    fill: COLORS.text,
    align: 'left',
  });
}

function renderGrid(r: Renderer, w: number, h: number, frame: FrameContext, state: AppState): void {
  const cellSize = 30;
  const cols = Math.floor(w / cellSize);
  const rows = Math.floor(h / cellSize);

  // Offset for centering
  const offsetX = (w - cols * cellSize) / 2;
  const offsetY = (h - rows * cellSize) / 2;

  // Draw grid cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * cellSize;
      const y = offsetY + row * cellSize;

      // Animated color based on position and time
      const t = frame.t;
      const distFromCenter = Math.sqrt(
        Math.pow((col - cols / 2) / cols, 2) + Math.pow((row - rows / 2) / rows, 2)
      );
      const wave = Math.sin(distFromCenter * TAU * 2 - t * TAU) * 0.5 + 0.5;

      const hue = (col / cols) * 60 + (row / rows) * 60 + t * 360;
      const sat = 70;
      const light = 20 + wave * 30;

      r.rect(x + 1, y + 1, cellSize - 2, cellSize - 2, {
        fill: `hsl(${hue % 360}, ${sat}%, ${light}%)`,
      });
    }
  }

  // Clock overlay in center
  const cx = w / 2;
  const cy = h / 2;
  const { hour, min, sec } = state.clock;
  const smoothSec = sec + frame.alpha;

  const secAngle = (smoothSec / 60) * TAU - TAU / 4;
  const minAngle = ((min + smoothSec / 60) / 60) * TAU - TAU / 4;
  const hourAngle = ((hour + (min + smoothSec / 60) / 60) / 12) * TAU - TAU / 4;

  r.save();
  r.translate(cx, cy);

  // Semi-transparent background
  r.save();
  r.alpha = 0.7;
  r.circle(0, 0, 60, { fill: '#0a0a12' });
  r.restore();

  // Clock hands
  r.save();
  r.rotate(hourAngle);
  r.line(0, 0, 25, 0, { stroke: '#64c8ff', width: 4, cap: 'round' });
  r.restore();

  r.save();
  r.rotate(minAngle);
  r.line(0, 0, 35, 0, { stroke: '#48dbfb', width: 3, cap: 'round' });
  r.restore();

  r.save();
  r.rotate(secAngle);
  r.line(-8, 0, 45, 0, { stroke: '#ff6b6b', width: 2, cap: 'round' });
  r.restore();

  r.circle(0, 0, 4, { fill: '#fff' });

  r.restore();

  r.text('Animated Grid + Clock', 15, 20, {
    font: '12px monospace',
    fill: COLORS.text,
    align: 'left',
  });
}

// ─────────────────────────────────────────────────────────────
// Color Utilities
// ─────────────────────────────────────────────────────────────

function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + percent);
  const b = Math.min(255, (num & 0x0000ff) + percent);
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - percent);
  const b = Math.max(0, (num & 0x0000ff) - percent);
  return `rgb(${r},${g},${b})`;
}
