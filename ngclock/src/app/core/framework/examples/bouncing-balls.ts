/**
 * Example: Bouncing Balls
 *
 * Demonstrates:
 * - Physics simulation
 * - Multiple entities
 * - State updates on tick
 * - Smooth rendering with interpolation
 */

import { Scene, FrameContext, Renderer, Vec2, lerp } from '../index';

// ─────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  // Previous position for interpolation
  prevX: number;
  prevY: number;
}

export interface BouncingBallsState {
  balls: Ball[];
  gravity: number;
  friction: number;
  bounds: { width: number; height: number };
}

// ─────────────────────────────────────────────────────────────
// State Factory
// ─────────────────────────────────────────────────────────────

export function createBouncingBallsState(
  width: number,
  height: number,
  numBalls = 10
): BouncingBallsState {
  const balls: Ball[] = [];
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'];

  for (let i = 0; i < numBalls; i++) {
    const radius = 15 + Math.random() * 25;
    const x = radius + Math.random() * (width - radius * 2);
    const y = radius + Math.random() * (height - radius * 2);

    balls.push({
      id: i,
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      radius,
      color: colors[i % colors.length],
      prevX: x,
      prevY: y,
    });
  }

  return {
    balls,
    gravity: 0.5,
    friction: 0.99,
    bounds: { width, height },
  };
}

// ─────────────────────────────────────────────────────────────
// Physics Update (called each tick)
// ─────────────────────────────────────────────────────────────

export function updateBouncingBalls(state: BouncingBallsState): BouncingBallsState {
  const { balls, gravity, friction, bounds } = state;

  const updatedBalls = balls.map(ball => {
    // Store previous position for interpolation
    const prevX = ball.x;
    const prevY = ball.y;

    // Apply gravity
    let vy = ball.vy + gravity;

    // Apply friction
    let vx = ball.vx * friction;
    vy = vy * friction;

    // Update position
    let x = ball.x + vx;
    let y = ball.y + vy;

    // Bounce off walls
    if (x - ball.radius < 0) {
      x = ball.radius;
      vx = -vx * 0.8;
    } else if (x + ball.radius > bounds.width) {
      x = bounds.width - ball.radius;
      vx = -vx * 0.8;
    }

    if (y - ball.radius < 0) {
      y = ball.radius;
      vy = -vy * 0.8;
    } else if (y + ball.radius > bounds.height) {
      y = bounds.height - ball.radius;
      vy = -vy * 0.8;
    }

    return { ...ball, x, y, vx, vy, prevX, prevY };
  });

  return { ...state, balls: updatedBalls };
}

// ─────────────────────────────────────────────────────────────
// Scene (render function)
// ─────────────────────────────────────────────────────────────

export const BouncingBallsScene: Scene<BouncingBallsState> = {
  id: 'bouncing-balls',
  name: 'Bouncing Balls',

  render(r: Renderer, state: BouncingBallsState, frame: FrameContext) {
    // Dark background
    r.clear('#1a1a2e');

    // Render each ball with interpolation
    for (const ball of state.balls) {
      // Interpolate position for smooth rendering
      const x = lerp(ball.prevX, ball.x, frame.alpha);
      const y = lerp(ball.prevY, ball.y, frame.alpha);

      // Shadow
      r.save();
      r.alpha = 0.3;
      r.circle(x + 5, y + 5, ball.radius, { fill: '#000' });
      r.restore();

      // Ball with gradient
      const gradient = r.radialGradient(
        x - ball.radius * 0.3,
        y - ball.radius * 0.3,
        0,
        ball.radius * 1.2,
        [
          [0, lightenColor(ball.color, 40)],
          [0.5, ball.color],
          [1, darkenColor(ball.color, 30)],
        ]
      );
      r.circle(x, y, ball.radius, { fill: gradient });

      // Highlight
      r.save();
      r.alpha = 0.6;
      r.circle(
        x - ball.radius * 0.3,
        y - ball.radius * 0.3,
        ball.radius * 0.2,
        { fill: '#fff' }
      );
      r.restore();
    }

    // Stats
    r.text(`Balls: ${state.balls.length}`, 20, 30, {
      font: '14px system-ui',
      fill: 'rgba(255,255,255,0.5)',
      align: 'left',
    });
    r.text(`FPS: ~${Math.round(1000 / frame.deltaMs)}`, 20, 50, {
      font: '14px system-ui',
      fill: 'rgba(255,255,255,0.5)',
      align: 'left',
    });
  },
};

// ─────────────────────────────────────────────────────────────
// Color Utilities
// ─────────────────────────────────────────────────────────────

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + percent);
  const b = Math.min(255, (num & 0x0000ff) + percent);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - percent);
  const b = Math.max(0, (num & 0x0000ff) - percent);
  return `rgb(${r},${g},${b})`;
}
