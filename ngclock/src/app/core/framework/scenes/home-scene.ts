/**
 * Home Scene - Main Clock Display
 *
 * Renders the main clock with skin selection.
 * Pure Bee Framework scene, no Angular dependencies.
 */

import { Scene, Renderer, FrameContext, TAU, lerp, easeOut } from '../index';
import { AppState } from './types';
import { renderNavBar, getNavHeight } from './nav-bar';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SKIN_NAMES = ['Minimalist', 'Neon', 'Conway', 'Generative', 'LED'];
const COLORS = {
  bg: '#0a0a12',
  face: '#1a1a2e',
  tick: 'rgba(255, 255, 255, 0.3)',
  tickMajor: 'rgba(255, 255, 255, 0.7)',
  hourHand: '#64c8ff',
  minHand: '#48dbfb',
  secHand: '#ff6b6b',
  center: '#fff',
  text: 'rgba(255, 255, 255, 0.5)',
  accent: '#64c8ff',
};

// ─────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────

export const HomeScene: Scene<AppState> = {
  id: 'home',
  name: 'Home',

  render(r: Renderer, state: AppState, frame: FrameContext) {
    const navHeight = getNavHeight();
    const contentHeight = r.height - navHeight;

    // Background
    r.rect(0, 0, r.width, r.height, { fill: COLORS.bg });

    // Nav bar
    renderNavBar(r, state, frame);

    // Clock area
    r.save();
    r.translate(0, navHeight);

    // Clock face
    const size = Math.min(r.width, contentHeight) * 0.7;
    const radius = size / 2;
    const cx = r.width / 2;
    const cy = contentHeight / 2;

    // Clock background
    const gradient = r.radialGradient(cx, cy, 0, radius, [
      [0, '#1e1e2e'],
      [0.8, '#151521'],
      [1, '#0a0a12'],
    ]);
    r.circle(cx, cy, radius, { fill: gradient });

    // Outer ring
    r.circle(cx, cy, radius, {
      stroke: 'rgba(100, 200, 255, 0.3)',
      width: 2,
    });

    // Tick marks
    r.save();
    r.translate(cx, cy);
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * TAU - TAU / 4;
      const isMajor = i % 5 === 0;
      const length = isMajor ? 15 : 8;
      const width = isMajor ? 2 : 1;
      const color = isMajor ? COLORS.tickMajor : COLORS.tick;

      const outerR = radius - 10;
      const innerR = outerR - length;

      r.line(
        Math.cos(angle) * innerR,
        Math.sin(angle) * innerR,
        Math.cos(angle) * outerR,
        Math.sin(angle) * outerR,
        { stroke: color, width, cap: 'round' }
      );
    }
    r.restore();

    // Clock hands
    const { hour, min, sec } = state.clock;
    const alpha = frame.alpha;

    // Smooth second (interpolated)
    const smoothSec = sec + alpha;

    // Calculate angles (12 o'clock = -TAU/4)
    const secAngle = (smoothSec / 60) * TAU - TAU / 4;
    const minAngle = ((min + smoothSec / 60) / 60) * TAU - TAU / 4;
    const hourAngle = ((hour + (min + smoothSec / 60) / 60) / 12) * TAU - TAU / 4;

    r.save();
    r.translate(cx, cy);

    // Hour hand
    drawHand(r, hourAngle, radius * 0.45, 6, COLORS.hourHand);

    // Minute hand
    drawHand(r, minAngle, radius * 0.65, 4, COLORS.minHand);

    // Second hand
    r.save();
    r.alpha = 0.9;
    drawHand(r, secAngle, radius * 0.75, 2, COLORS.secHand, radius * 0.15);
    r.restore();

    // Center dot
    r.circle(0, 0, 6, { fill: COLORS.center });
    r.circle(0, 0, 3, { fill: COLORS.secHand });

    r.restore();

    // Time display
    const timeStr = formatTime(hour, min, sec);
    r.text(timeStr, cx, cy + radius + 40, {
      font: '24px monospace',
      fill: COLORS.text,
      align: 'center',
    });

    // Skin selector
    const skinY = contentHeight - 50;
    r.text(`Skin: ${SKIN_NAMES[state.skinIndex]}`, cx, skinY, {
      font: '14px system-ui',
      fill: COLORS.text,
      align: 'center',
    });
    r.text('← →  to change', cx, skinY + 20, {
      font: '12px system-ui',
      fill: 'rgba(255, 255, 255, 0.3)',
      align: 'center',
    });

    r.restore();

    // Debug overlay
    if (state.showDebug) {
      renderDebug(r, state, frame);
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function drawHand(
  r: Renderer,
  angle: number,
  length: number,
  width: number,
  color: string,
  tail = 0
): void {
  r.save();
  r.rotate(angle);
  r.line(-tail, 0, length, 0, {
    stroke: color,
    width,
    cap: 'round',
  });
  r.restore();
}

function formatTime(h: number, m: number, s: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function renderDebug(r: Renderer, state: AppState, frame: FrameContext): void {
  r.save();
  r.alpha = 0.8;
  r.roundRect(10, r.height - 100, 200, 90, 8, {
    fill: 'rgba(0, 0, 0, 0.7)',
  });
  r.restore();

  const debugY = r.height - 85;
  const debugOpts = { font: '12px monospace', fill: '#64c8ff', align: 'left' as const };

  r.text(`Tick: ${frame.tick}`, 20, debugY, debugOpts);
  r.text(`Alpha: ${frame.alpha.toFixed(3)}`, 20, debugY + 15, debugOpts);
  r.text(`Delta: ${frame.deltaMs.toFixed(1)}ms`, 20, debugY + 30, debugOpts);
  r.text(`FPS: ~${Math.round(1000 / frame.deltaMs)}`, 20, debugY + 45, debugOpts);
  r.text(`Scene: ${state.currentScene}`, 20, debugY + 60, debugOpts);
}
