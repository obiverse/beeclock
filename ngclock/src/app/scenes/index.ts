/**
 * Scene Renderers
 *
 * Unified 2D and 3D rendering for all scenes.
 */

import { CanvasRenderer } from '../core/renderer/canvas-renderer';
import { ThreeRenderer } from '../core/renderer/three-renderer';
import {
  AppState,
  Viewport,
  NAV_ITEMS,
  FighterAction,
  FighterState,
  Particle,
  HitEffect,
  CAGrid,
  AIAgent,
  EmergentState,
} from '../core/framework/scenes';
import { FrameContext, TAU } from '../core/framework';
import { LayoutZones, renderPanelFrame } from '../core/framework/scenes/layout';

// ─────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0a0a12',
  navBg: '#0a0a12',
  navBorder: '#1a1a2e',
  text: 'rgba(255, 255, 255, 0.7)',
  textDim: 'rgba(255, 255, 255, 0.4)',
  accent: '#64c8ff',
  accent2: '#48dbfb',
  accent3: '#ff6b6b',
  hourHand: '#64c8ff',
  minHand: '#48dbfb',
  secHand: '#ff6b6b',
};

// ─────────────────────────────────────────────────────────────
// Nav and Footer
// ─────────────────────────────────────────────────────────────

export function renderNavAndFooter(
  r: CanvasRenderer,
  state: AppState,
  layout: LayoutZones
): void {
  const ctx = r.raw;
  const { nav, footer } = layout;

  // Nav background
  ctx.fillStyle = COLORS.navBg;
  ctx.fillRect(nav.x, nav.y, nav.width, nav.height);

  // Nav border
  ctx.strokeStyle = COLORS.navBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, nav.height);
  ctx.lineTo(nav.width, nav.height);
  ctx.stroke();

  // Title
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 18px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('BeeClock', 20, nav.height / 2);

  // Nav items
  const itemWidth = 100;
  const itemHeight = 40;
  const totalWidth = NAV_ITEMS.length * itemWidth + (NAV_ITEMS.length - 1) * 10;
  let startX = (nav.width - totalWidth) / 2;
  const itemY = (nav.height - itemHeight) / 2;

  for (const item of NAV_ITEMS) {
    const isActive = state.currentScene === item.id;
    const isHovered = state.hoveredNav === item.id;

    // Background
    ctx.fillStyle = isActive
      ? 'rgba(100, 200, 255, 0.15)'
      : isHovered
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(startX, itemY, itemWidth, itemHeight, 8);
    ctx.fill();

    // Active indicator
    if (isActive) {
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath();
      ctx.roundRect(startX, itemY + itemHeight - 3, itemWidth, 3, 1.5);
      ctx.fill();
    }

    // Icon + Label
    ctx.fillStyle = isActive ? COLORS.accent : COLORS.text;
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(item.icon, startX + 25, nav.height / 2);
    ctx.font = '14px system-ui';
    ctx.fillText(item.label, startX + 65, nav.height / 2);

    startX += itemWidth + 10;
  }

  // View mode indicator (top right)
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(`[V] View: ${state.viewMode.toUpperCase()}`, nav.width - 20, nav.height / 2);

  // Footer
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(footer.x, footer.y, footer.width, footer.height);

  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    '1-5: Scenes | V: Toggle View | D: Debug',
    footer.width / 2,
    footer.y + footer.height / 2
  );
}

// ─────────────────────────────────────────────────────────────
// 2D Scene Rendering
// ─────────────────────────────────────────────────────────────

export function render2DScene(
  r: CanvasRenderer,
  state: AppState,
  frame: FrameContext,
  viewport: Viewport
): void {
  const ctx = r.raw;

  // Panel frame
  renderPanelFrame(ctx, viewport, '2D Canvas', state.viewMode === '2d');

  // Save and clip to viewport
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.clip();

  switch (state.currentScene) {
    case 'home':
      render2DClock(ctx, state, frame, viewport);
      break;
    case 'anime':
      render2DAnime(ctx, state, frame, viewport);
      break;
    case 'fighter':
      render2DFighter(ctx, state, frame, viewport);
      break;
    case 'studio':
      render2DStudio(ctx, state, frame, viewport);
      break;
    case 'lab':
      render2DLab(ctx, state, frame, viewport);
      break;
    case 'about':
      render2DAbout(ctx, state, frame, viewport);
      break;
  }

  ctx.restore();
}

function render2DClock(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  frame: FrameContext,
  vp: Viewport
): void {
  const cx = vp.x + vp.width / 2;
  const cy = vp.y + vp.height / 2;
  const radius = Math.min(vp.width, vp.height) * 0.35;

  // Clock face gradient
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, '#1e1e2e');
  gradient.addColorStop(0.8, '#151521');
  gradient.addColorStop(1, '#0a0a12');

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tick marks
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * TAU - TAU / 4;
    const isMajor = i % 5 === 0;
    const len = isMajor ? 12 : 6;
    const outerR = radius - 8;
    const innerR = outerR - len;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
    ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
    ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.stroke();
  }

  // Clock hands
  const { hour, min, sec } = state.clock;
  const smoothSec = sec + frame.alpha;
  const secAngle = (smoothSec / 60) * TAU - TAU / 4;
  const minAngle = ((min + smoothSec / 60) / 60) * TAU - TAU / 4;
  const hourAngle = ((hour + (min + smoothSec / 60) / 60) / 12) * TAU - TAU / 4;

  // Hour hand
  drawHand(ctx, cx, cy, hourAngle, radius * 0.45, 6, COLORS.hourHand);

  // Minute hand
  drawHand(ctx, cx, cy, minAngle, radius * 0.65, 4, COLORS.minHand);

  // Second hand
  ctx.globalAlpha = 0.9;
  drawHand(ctx, cx, cy, secAngle, radius * 0.75, 2, COLORS.secHand, radius * 0.12);
  ctx.globalAlpha = 1;

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, TAU);
  ctx.fillStyle = COLORS.secHand;
  ctx.fill();

  // Time display
  const timeStr = `${pad(hour)}:${pad(min)}:${pad(sec)}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(timeStr, cx, cy + radius + 20);
}

function render2DLab(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  frame: FrameContext,
  vp: Viewport
): void {
  const cx = vp.x + vp.width / 2;
  const cy = vp.y + vp.height / 2;

  // Bouncing balls simulation
  const ballCount = 8;
  for (let i = 0; i < ballCount; i++) {
    const t = frame.elapsed + i * 0.5;
    const x = cx + Math.sin(t * 2 + i) * (vp.width * 0.3);
    const y = cy + Math.cos(t * 1.5 + i * 0.7) * (vp.height * 0.25);
    const r = 15 + Math.sin(t + i) * 5;

    const hue = (i / ballCount) * 360;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.2, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }

  // Label
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('2D Physics Simulation', cx, vp.y + 30);
}

function render2DAbout(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  frame: FrameContext,
  vp: Viewport
): void {
  const cx = vp.x + vp.width / 2;
  let y = vp.y + 40;

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('2D Canvas Renderer', cx, y);

  y += 40;
  ctx.fillStyle = COLORS.text;
  ctx.font = '14px system-ui';

  const features = [
    'Immediate mode rendering',
    'HiDPI/Retina support',
    'Gradient & shadow effects',
    'Alpha blending',
    `Frame: ${frame.tick} | FPS: ~${Math.round(1000 / frame.deltaMs)}`,
  ];

  for (const feat of features) {
    ctx.fillText(feat, cx, y);
    y += 25;
  }

  // Animated ring
  const ringRadius = Math.min(vp.width, vp.height) * 0.2;
  const ringY = vp.y + vp.height - ringRadius - 40;

  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, ringY, ringRadius, -TAU / 4, -TAU / 4 + frame.t * TAU);
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────
// Anime Scene - Taoist Masterpiece
// ─────────────────────────────────────────────────────────────

function render2DAnime(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  frame: FrameContext,
  vp: Viewport
): void {
  const cx = vp.x + vp.width / 2;
  const cy = vp.y + vp.height / 2;
  const t = frame.elapsed;
  const size = Math.min(vp.width, vp.height);

  // Sky gradient - deep twilight
  const skyGrad = ctx.createLinearGradient(vp.x, vp.y, vp.x, vp.y + vp.height);
  skyGrad.addColorStop(0, '#0d0221');
  skyGrad.addColorStop(0.3, '#1a0533');
  skyGrad.addColorStop(0.6, '#2d1b4e');
  skyGrad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(vp.x, vp.y, vp.width, vp.height);

  // Stars
  const starCount = 80;
  for (let i = 0; i < starCount; i++) {
    const sx = vp.x + ((i * 137.5) % vp.width);
    const sy = vp.y + ((i * 89.3) % (vp.height * 0.5));
    const twinkle = Math.sin(t * 3 + i * 0.7) * 0.5 + 0.5;
    const starSize = (1 + twinkle) * (i % 3 === 0 ? 1.5 : 1);
    ctx.beginPath();
    ctx.arc(sx, sy, starSize, 0, TAU);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.7})`;
    ctx.fill();
  }

  // Moon with glow
  const moonX = vp.x + vp.width * 0.8;
  const moonY = vp.y + vp.height * 0.15;
  const moonR = size * 0.06;

  // Moon glow
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 4);
  moonGlow.addColorStop(0, 'rgba(255, 250, 240, 0.3)');
  moonGlow.addColorStop(0.5, 'rgba(255, 220, 180, 0.1)');
  moonGlow.addColorStop(1, 'rgba(255, 200, 150, 0)');
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR * 4, 0, TAU);
  ctx.fillStyle = moonGlow;
  ctx.fill();

  // Moon body
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, TAU);
  ctx.fillStyle = '#fff8e7';
  ctx.fill();

  // Floating mountains (silhouettes)
  drawMountain(ctx, vp.x + vp.width * 0.1, vp.y + vp.height * 0.7, size * 0.25, '#1a1a2e', t);
  drawMountain(ctx, vp.x + vp.width * 0.4, vp.y + vp.height * 0.65, size * 0.35, '#151525', t * 0.7);
  drawMountain(ctx, vp.x + vp.width * 0.75, vp.y + vp.height * 0.72, size * 0.28, '#1a1a2e', t * 1.2);

  // Mist layers
  for (let layer = 0; layer < 3; layer++) {
    const mistY = vp.y + vp.height * (0.6 + layer * 0.1);
    const mistAlpha = 0.15 - layer * 0.04;
    const mistOffset = Math.sin(t * 0.3 + layer) * 20;

    ctx.beginPath();
    ctx.moveTo(vp.x, mistY);
    for (let x = 0; x <= vp.width; x += 20) {
      const wave = Math.sin((x + mistOffset) * 0.02 + t * 0.5) * 15;
      ctx.lineTo(vp.x + x, mistY + wave);
    }
    ctx.lineTo(vp.x + vp.width, vp.y + vp.height);
    ctx.lineTo(vp.x, vp.y + vp.height);
    ctx.closePath();
    ctx.fillStyle = `rgba(200, 180, 220, ${mistAlpha})`;
    ctx.fill();
  }

  // Central Yin-Yang with energy flow
  const yinYangR = size * 0.15;
  const yinYangY = cy - size * 0.05;
  const rotation = t * 0.5;

  // Energy aura around yin-yang
  for (let ring = 3; ring >= 0; ring--) {
    const auraR = yinYangR * (1.3 + ring * 0.2);
    const auraAlpha = 0.1 - ring * 0.02;
    const pulse = Math.sin(t * 2 - ring * 0.3) * 0.5 + 0.5;

    ctx.beginPath();
    ctx.arc(cx, yinYangY, auraR + pulse * 5, 0, TAU);
    ctx.strokeStyle = `rgba(100, 200, 255, ${auraAlpha + pulse * 0.05})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw yin-yang
  drawYinYang(ctx, cx, yinYangY, yinYangR, rotation);

  // Flowing energy particles (chi/qi)
  const particleCount = 40;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * TAU + t * 0.3;
    const orbitR = yinYangR * (1.5 + Math.sin(t + i) * 0.3);
    const px = cx + Math.cos(angle) * orbitR;
    const py = yinYangY + Math.sin(angle) * orbitR * 0.6;
    const pSize = 2 + Math.sin(t * 2 + i) * 1;

    // Particle with trail
    const trailLength = 5;
    for (let j = 0; j < trailLength; j++) {
      const trailAngle = angle - j * 0.05;
      const trailX = cx + Math.cos(trailAngle) * orbitR;
      const trailY = yinYangY + Math.sin(trailAngle) * orbitR * 0.6;
      const trailAlpha = (1 - j / trailLength) * 0.5;

      ctx.beginPath();
      ctx.arc(trailX, trailY, pSize * (1 - j * 0.15), 0, TAU);
      ctx.fillStyle = i % 2 === 0
        ? `rgba(255, 255, 255, ${trailAlpha})`
        : `rgba(100, 200, 255, ${trailAlpha})`;
      ctx.fill();
    }
  }

  // Sakura petals falling
  drawSakuraPetals(ctx, vp, t, 25);

  // Koi fish swimming in lower portion
  drawKoiFish(ctx, vp.x + vp.width * 0.3, vp.y + vp.height * 0.85, size * 0.04, t, '#ff6b6b');
  drawKoiFish(ctx, vp.x + vp.width * 0.7, vp.y + vp.height * 0.88, size * 0.035, t + 2, '#ffd93d');

  // Fireflies
  const fireflyCount = 15;
  for (let i = 0; i < fireflyCount; i++) {
    const fx = vp.x + ((i * 97) % vp.width);
    const fy = vp.y + vp.height * 0.5 + ((i * 61) % (vp.height * 0.4));
    const glow = Math.sin(t * 4 + i * 1.5) * 0.5 + 0.5;

    if (glow > 0.3) {
      const glowGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 8);
      glowGrad.addColorStop(0, `rgba(255, 255, 150, ${glow})`);
      glowGrad.addColorStop(1, 'rgba(255, 255, 150, 0)');
      ctx.beginPath();
      ctx.arc(fx, fy, 8, 0, TAU);
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }
  }

  // Torii gate silhouette (bottom right)
  drawToriiGate(ctx, vp.x + vp.width * 0.85, vp.y + vp.height * 0.9, size * 0.08);

  // Title text with glow
  ctx.save();
  ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size * 0.04}px "Hiragino Mincho ProN", serif`;
  ctx.textAlign = 'center';
  ctx.fillText('道 The Way', cx, vp.y + 35);
  ctx.restore();
}

function drawYinYang(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rotation: number
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // Main circle
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Black half
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();

  // White bulge (top)
  ctx.beginPath();
  ctx.arc(0, -r / 2, r / 2, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Black bulge (bottom)
  ctx.beginPath();
  ctx.arc(0, r / 2, r / 2, 0, TAU);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();

  // White dot in black
  ctx.beginPath();
  ctx.arc(0, r / 2, r / 6, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Black dot in white
  ctx.beginPath();
  ctx.arc(0, -r / 2, r / 6, 0, TAU);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawMountain(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  color: string,
  time: number
): void {
  const float = Math.sin(time * 0.2) * 3;

  ctx.beginPath();
  ctx.moveTo(x - height * 0.8, baseY + float);
  ctx.lineTo(x, baseY - height + float);
  ctx.lineTo(x + height * 0.8, baseY + float);
  ctx.closePath();

  const grad = ctx.createLinearGradient(x, baseY - height, x, baseY);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(26, 26, 46, 0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Snow cap
  ctx.beginPath();
  ctx.moveTo(x - height * 0.15, baseY - height * 0.7 + float);
  ctx.lineTo(x, baseY - height + float);
  ctx.lineTo(x + height * 0.15, baseY - height * 0.7 + float);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fill();
}

function drawSakuraPetals(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  time: number,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const seed = i * 137.5;
    const fallSpeed = 0.3 + (i % 5) * 0.1;
    const swaySpeed = 1 + (i % 3) * 0.5;

    let py = (seed + time * 30 * fallSpeed) % (vp.height + 40) - 20;
    const px = vp.x + (seed % vp.width) + Math.sin(time * swaySpeed + i) * 30;
    const rotation = time * 2 + i;
    const size = 4 + (i % 3) * 2;

    ctx.save();
    ctx.translate(px, vp.y + py);
    ctx.rotate(rotation);

    // Petal shape
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.6, 0, 0, TAU);
    ctx.fillStyle = `rgba(255, 182, 193, ${0.6 + Math.sin(time + i) * 0.2})`;
    ctx.fill();

    ctx.restore();
  }
}

function drawKoiFish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
  color: string
): void {
  const swimX = x + Math.sin(time * 0.8) * 40;
  const swimY = y + Math.sin(time * 1.2) * 10;
  const bodyWave = Math.sin(time * 3) * 0.2;

  ctx.save();
  ctx.translate(swimX, swimY);
  ctx.rotate(Math.sin(time * 0.8) * 0.1);

  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 2, size, 0, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();

  // Tail
  ctx.beginPath();
  ctx.moveTo(-size * 1.8, 0);
  ctx.quadraticCurveTo(
    -size * 3,
    -size * 0.8 + bodyWave * size,
    -size * 2.5,
    -size * 1.2
  );
  ctx.quadraticCurveTo(
    -size * 2,
    0,
    -size * 2.5,
    size * 1.2
  );
  ctx.quadraticCurveTo(
    -size * 3,
    size * 0.8 - bodyWave * size,
    -size * 1.8,
    0
  );
  ctx.fillStyle = color;
  ctx.fill();

  // Eye
  ctx.beginPath();
  ctx.arc(size * 1.2, -size * 0.2, size * 0.15, 0, TAU);
  ctx.fillStyle = '#000';
  ctx.fill();

  ctx.restore();
}

function drawToriiGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number
): void {
  const width = height * 1.2;
  const pillarW = height * 0.08;

  ctx.fillStyle = '#2a1a1a';

  // Left pillar
  ctx.fillRect(x - width / 2, baseY - height, pillarW, height);

  // Right pillar
  ctx.fillRect(x + width / 2 - pillarW, baseY - height, pillarW, height);

  // Top beam (kasagi)
  ctx.fillRect(x - width / 2 - pillarW, baseY - height, width + pillarW * 2, pillarW * 1.5);

  // Middle beam (nuki)
  ctx.fillRect(x - width / 2 + pillarW, baseY - height * 0.7, width - pillarW * 2, pillarW);
}

// ─────────────────────────────────────────────────────────────
// Fighter Scene - Game Development Techniques Demo
// ─────────────────────────────────────────────────────────────

/**
 * ACTION FRAME DATA
 * Frame data defines how long each phase of an action takes.
 * This is crucial for fighting game balance and feel.
 *
 * Startup: Wind-up before attack becomes active (vulnerable)
 * Active: Frames where hitbox is active (can hit)
 * Recovery: Cool-down after attack (vulnerable)
 */
const ACTION_DATA: Record<FighterAction, { duration: number; next: FighterAction }> = {
  idle: { duration: Infinity, next: 'idle' },
  walk_forward: { duration: Infinity, next: 'idle' },
  walk_back: { duration: Infinity, next: 'idle' },
  punch_startup: { duration: 100, next: 'punch_active' },
  punch_active: { duration: 80, next: 'punch_recovery' },
  punch_recovery: { duration: 150, next: 'idle' },
  kick_startup: { duration: 150, next: 'kick_active' },
  kick_active: { duration: 100, next: 'kick_recovery' },
  kick_recovery: { duration: 200, next: 'idle' },
  blocking: { duration: Infinity, next: 'idle' },
  hitstun: { duration: 300, next: 'idle' },
};

/**
 * HITBOX DATA
 * Defines the attack hitboxes for each active state.
 * In real fighting games, these are meticulously tuned.
 */
interface Hitbox {
  x: number;      // Offset from character center
  y: number;      // Offset from ground
  width: number;
  height: number;
  damage: number;
}

const HITBOXES: Partial<Record<FighterAction, Hitbox>> = {
  punch_active: { x: 50, y: -80, width: 60, height: 40, damage: 10 },
  kick_active: { x: 40, y: -40, width: 80, height: 50, damage: 15 },
};

/**
 * HURTBOX DATA
 * The character's vulnerable areas. Changes based on action.
 */
interface Hurtbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getHurtbox(action: FighterAction): Hurtbox {
  // Blocking reduces hurtbox
  if (action === 'blocking') {
    return { x: -20, y: -120, width: 40, height: 120 };
  }
  // Attacks extend the hurtbox
  if (action.includes('kick')) {
    return { x: -25, y: -130, width: 80, height: 130 };
  }
  // Default standing hurtbox
  return { x: -25, y: -130, width: 50, height: 130 };
}

function render2DFighter(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  frame: FrameContext,
  vp: Viewport
): void {
  const fighter = state.fighter;
  const cx = vp.x + vp.width / 2 + fighter.x;
  const groundY = vp.y + vp.height * 0.85;
  const t = frame.elapsed;

  // ─── Background: Training stage ───
  drawFighterBackground(ctx, vp, t);

  // ─── Update particles ───
  updateParticles(fighter, frame.deltaMs);

  // ─── Draw particles behind character ───
  drawParticles(ctx, fighter, vp);

  // ─── Draw hit effects ───
  drawHitEffects(ctx, fighter, cx, groundY, t);

  // ─── Draw character ───
  drawFighterCharacter(ctx, fighter, cx, groundY, t);

  // ─── Draw hitbox/hurtbox visualization ───
  drawHitboxVisualization(ctx, fighter, cx, groundY);

  // ─── UI: State Machine Visualization ───
  drawStateMachineUI(ctx, fighter, vp);

  // ─── UI: Health bar and combo counter ───
  drawFighterUI(ctx, fighter, vp);

  // ─── Controls hint ───
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(
    'J: Punch | K: Kick | ←→: Move | S: Block',
    vp.x + vp.width / 2,
    vp.y + vp.height - 15
  );
}

function drawFighterBackground(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  t: number
): void {
  // Gradient sky
  const skyGrad = ctx.createLinearGradient(vp.x, vp.y, vp.x, vp.y + vp.height);
  skyGrad.addColorStop(0, '#1a1a3e');
  skyGrad.addColorStop(0.7, '#2a2a4e');
  skyGrad.addColorStop(1, '#0a0a12');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(vp.x, vp.y, vp.width, vp.height);

  // Grid floor (perspective)
  const groundY = vp.y + vp.height * 0.85;
  const horizonY = vp.y + vp.height * 0.4;

  ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
  ctx.lineWidth = 1;

  // Horizontal lines
  for (let i = 0; i < 10; i++) {
    const ratio = i / 10;
    const y = horizonY + (groundY - horizonY) * Math.pow(ratio, 0.7);
    ctx.beginPath();
    ctx.moveTo(vp.x, y);
    ctx.lineTo(vp.x + vp.width, y);
    ctx.stroke();
  }

  // Vertical lines (converging to center)
  const centerX = vp.x + vp.width / 2;
  for (let i = -5; i <= 5; i++) {
    const topX = centerX + i * 20;
    const bottomX = centerX + i * 80;
    ctx.beginPath();
    ctx.moveTo(topX, horizonY);
    ctx.lineTo(bottomX, groundY);
    ctx.stroke();
  }

  // Ground line
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(vp.x, groundY);
  ctx.lineTo(vp.x + vp.width, groundY);
  ctx.stroke();
}

function drawFighterCharacter(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  cx: number,
  groundY: number,
  t: number
): void {
  const action = fighter.action;
  const actionT = fighter.actionTime;
  const flip = fighter.facingRight ? 1 : -1;

  ctx.save();
  ctx.translate(cx, groundY);
  ctx.scale(flip, 1);

  // ─── Body parts based on action ───
  const bodyColor = '#64c8ff';
  const limbColor = '#48dbfb';
  const headColor = '#fff';

  // Calculate pose based on action
  let torsoLean = 0;
  let armAngle = 0;
  let legAngle = 0;
  let armExtend = 0;
  let legExtend = 0;

  switch (action) {
    case 'idle': {
      // Breathing animation
      const breathe = Math.sin(t * 2) * 2;
      torsoLean = breathe * 0.01;
      break;
    }
    case 'walk_forward':
    case 'walk_back': {
      const walkCycle = Math.sin(t * 10);
      legAngle = walkCycle * 0.4;
      armAngle = -walkCycle * 0.3;
      break;
    }
    case 'punch_startup': {
      // Wind up - pull arm back
      const prog = actionT / ACTION_DATA['punch_startup'].duration;
      armAngle = -0.5 - prog * 0.3;
      torsoLean = -prog * 0.1;
      break;
    }
    case 'punch_active': {
      // Full extension
      armExtend = 50;
      torsoLean = 0.1;
      break;
    }
    case 'punch_recovery': {
      // Pulling back
      const prog = actionT / ACTION_DATA['punch_recovery'].duration;
      armExtend = 50 * (1 - prog);
      break;
    }
    case 'kick_startup': {
      const prog = actionT / ACTION_DATA['kick_startup'].duration;
      legAngle = -prog * 0.5;
      torsoLean = -prog * 0.05;
      break;
    }
    case 'kick_active': {
      legExtend = 60;
      legAngle = 0.3;
      torsoLean = -0.1;
      break;
    }
    case 'kick_recovery': {
      const prog = actionT / ACTION_DATA['kick_recovery'].duration;
      legExtend = 60 * (1 - prog);
      legAngle = 0.3 * (1 - prog);
      break;
    }
    case 'blocking': {
      armAngle = -1.2;
      torsoLean = -0.1;
      break;
    }
    case 'hitstun': {
      const shake = Math.sin(actionT * 0.05) * 5;
      ctx.translate(shake, 0);
      torsoLean = 0.2;
      break;
    }
  }

  // Apply torso lean
  ctx.rotate(torsoLean);

  // ─── Legs ───
  ctx.fillStyle = limbColor;

  // Back leg
  ctx.save();
  ctx.translate(-10, -30);
  ctx.rotate(-legAngle);
  ctx.fillRect(-8, 0, 16, 50);
  // Foot
  ctx.fillRect(-10, 45, 25, 10);
  ctx.restore();

  // Front leg
  ctx.save();
  ctx.translate(10, -30);
  ctx.rotate(legAngle);
  // Thigh
  ctx.fillRect(-8, 0, 16, 30);
  // Shin + kick extension
  ctx.translate(0, 30);
  ctx.rotate(legAngle * 0.5);
  ctx.fillRect(-8, 0, 16, 30 + legExtend * 0.5);
  // Foot
  ctx.fillRect(-5 + legExtend * 0.3, 25 + legExtend * 0.5, 20 + legExtend * 0.3, 10);
  ctx.restore();

  // ─── Torso ───
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-20, -100, 40, 70, 5);
  ctx.fill();

  // ─── Arms ───
  ctx.fillStyle = limbColor;

  // Back arm
  ctx.save();
  ctx.translate(-15, -90);
  ctx.rotate(armAngle * 0.5);
  ctx.fillRect(-6, 0, 12, 35);
  ctx.restore();

  // Front arm (attack arm)
  ctx.save();
  ctx.translate(15, -90);
  ctx.rotate(armAngle);
  // Upper arm
  ctx.fillRect(-6, 0, 12, 25);
  // Forearm + punch extension
  ctx.translate(0, 25);
  ctx.fillRect(-6, 0, 12, 25 + armExtend * 0.5);
  // Fist
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(0 + armExtend * 0.5, 25 + armExtend * 0.5, 10, 0, TAU);
  ctx.fill();
  ctx.restore();

  // ─── Head ───
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(0, -115, 18, 0, TAU);
  ctx.fill();

  // Face
  ctx.fillStyle = '#1a1a2e';
  // Eyes
  ctx.beginPath();
  ctx.arc(6, -118, 3, 0, TAU);
  ctx.fill();

  // Expression based on action
  if (action.includes('active')) {
    // Attack face - determined
    ctx.beginPath();
    ctx.moveTo(0, -108);
    ctx.lineTo(12, -110);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1a2e';
    ctx.stroke();
  } else if (action === 'hitstun') {
    // Hit face - pain
    ctx.beginPath();
    ctx.arc(6, -118, 4, 0, TAU);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawHitboxVisualization(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  cx: number,
  groundY: number
): void {
  const flip = fighter.facingRight ? 1 : -1;

  // ─── Hurtbox (green, always visible) ───
  const hurtbox = getHurtbox(fighter.action);
  ctx.strokeStyle = 'rgba(0, 255, 100, 0.6)';
  ctx.fillStyle = 'rgba(0, 255, 100, 0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(
    cx + hurtbox.x * flip - (flip < 0 ? hurtbox.width : 0),
    groundY + hurtbox.y,
    hurtbox.width,
    hurtbox.height
  );
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(0, 255, 100, 0.8)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('HURTBOX', cx + hurtbox.x * flip - (flip < 0 ? hurtbox.width : 0), groundY + hurtbox.y - 5);

  // ─── Hitbox (red, only when active) ───
  const hitbox = HITBOXES[fighter.action];
  if (hitbox) {
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(
      cx + hitbox.x * flip - (flip < 0 ? hitbox.width : 0),
      groundY + hitbox.y,
      hitbox.width,
      hitbox.height
    );
    ctx.fill();
    ctx.stroke();

    // Label with damage
    ctx.fillStyle = 'rgba(255, 50, 50, 1)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(
      `HITBOX (${hitbox.damage} DMG)`,
      cx + hitbox.x * flip - (flip < 0 ? hitbox.width : 0),
      groundY + hitbox.y - 5
    );

    // Hitbox active indicator - pulsing glow
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 15 + Math.sin(fighter.actionTime * 0.02) * 10;
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawStateMachineUI(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  vp: Viewport
): void {
  const x = vp.x + 15;
  let y = vp.y + 30;

  // Title
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('STATE MACHINE', x, y);
  y += 20;

  // All states with current highlighted
  const states: FighterAction[] = [
    'idle', 'walk_forward', 'walk_back',
    'punch_startup', 'punch_active', 'punch_recovery',
    'kick_startup', 'kick_active', 'kick_recovery',
    'blocking', 'hitstun'
  ];

  const stateColors: Record<string, string> = {
    idle: '#888',
    walk_forward: '#4a9',
    walk_back: '#4a9',
    punch_startup: '#fc0',
    punch_active: '#f33',
    punch_recovery: '#f93',
    kick_startup: '#fc0',
    kick_active: '#f33',
    kick_recovery: '#f93',
    blocking: '#39f',
    hitstun: '#f0f',
  };

  for (const state of states) {
    const isCurrent = fighter.action === state;
    const color = stateColors[state] || '#888';

    // State box
    if (isCurrent) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 10, 120, 14);
      ctx.fillStyle = '#000';
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x, y - 10, 120, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
    }

    ctx.font = `${isCurrent ? 'bold ' : ''}10px monospace`;
    ctx.fillText(state, x + 4, y);

    // Progress bar for current state
    if (isCurrent && ACTION_DATA[state].duration !== Infinity) {
      const progress = fighter.actionTime / ACTION_DATA[state].duration;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x + 122, y - 10, 40, 14);
      ctx.fillStyle = color;
      ctx.fillRect(x + 122, y - 10, 40 * Math.min(progress, 1), 14);
      ctx.fillStyle = '#000';
      ctx.font = '9px monospace';
      ctx.fillText(`${Math.floor(fighter.actionTime)}ms`, x + 125, y);
    }

    y += 16;
  }

  // Frame data legend
  y += 10;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '10px monospace';
  ctx.fillText('STARTUP = Vulnerable', x, y);
  y += 12;
  ctx.fillText('ACTIVE = Can hit', x, y);
  y += 12;
  ctx.fillText('RECOVERY = Punishable', x, y);
}

function drawFighterUI(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  vp: Viewport
): void {
  const barWidth = 200;
  const barHeight = 20;
  const x = vp.x + vp.width - barWidth - 20;
  const y = vp.y + 25;

  // Health bar background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, barWidth, barHeight);

  // Health bar fill
  const healthRatio = fighter.health / 100;
  const healthColor = healthRatio > 0.5 ? '#4f4' : healthRatio > 0.25 ? '#ff0' : '#f44';
  ctx.fillStyle = healthColor;
  ctx.fillRect(x, y, barWidth * healthRatio, barHeight);

  // Health bar border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barWidth, barHeight);

  // Health text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HP: ${fighter.health}`, x + barWidth / 2, y + 15);

  // Combo counter
  if (fighter.comboCount > 0) {
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${fighter.comboCount} HITS!`, vp.x + vp.width - 20, y + 60);
  }
}

function updateParticles(fighter: FighterState, deltaMs: number): void {
  // Update existing particles
  for (let i = fighter.particles.length - 1; i >= 0; i--) {
    const p = fighter.particles[i];
    p.x += p.vx * deltaMs * 0.001;
    p.y += p.vy * deltaMs * 0.001;
    p.vy += 500 * deltaMs * 0.001; // Gravity
    p.life -= deltaMs;

    if (p.life <= 0) {
      fighter.particles.splice(i, 1);
    }
  }

  // Update hit effects
  for (let i = fighter.hitEffects.length - 1; i >= 0; i--) {
    fighter.hitEffects[i].time += deltaMs;
    if (fighter.hitEffects[i].time > 300) {
      fighter.hitEffects.splice(i, 1);
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  vp: Viewport
): void {
  for (const p of fighter.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(vp.x + vp.width / 2 + p.x, vp.y + vp.height * 0.85 + p.y, p.size * alpha, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHitEffects(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  cx: number,
  groundY: number,
  t: number
): void {
  for (const effect of fighter.hitEffects) {
    const progress = effect.time / 300;
    const alpha = 1 - progress;

    if (effect.type === 'impact') {
      // Shockwave rings
      for (let i = 0; i < 3; i++) {
        const ringProgress = Math.min(1, progress * 2 + i * 0.1);
        const ringRadius = 20 + ringProgress * 80;
        ctx.strokeStyle = `rgba(255, 255, 100, ${alpha * (1 - i * 0.3)})`;
        ctx.lineWidth = 4 - i;
        ctx.beginPath();
        ctx.arc(cx + effect.x, groundY + effect.y, ringRadius, 0, TAU);
        ctx.stroke();
      }

      // Impact star
      ctx.save();
      ctx.translate(cx + effect.x, groundY + effect.y);
      ctx.rotate(t * 5);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(TAU / 8);
        ctx.fillRect(-3, 0, 6, 30 * (1 - progress));
      }
      ctx.restore();
    } else if (effect.type === 'speed_lines') {
      // Speed lines radiating from punch
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * TAU + t;
        const innerR = 30 * progress;
        const outerR = 60 + progress * 40;
        ctx.beginPath();
        ctx.moveTo(
          cx + effect.x + Math.cos(angle) * innerR,
          groundY + effect.y + Math.sin(angle) * innerR
        );
        ctx.lineTo(
          cx + effect.x + Math.cos(angle) * outerR,
          groundY + effect.y + Math.sin(angle) * outerR
        );
        ctx.stroke();
      }
    }
  }
}

/**
 * Spawn impact particles when attack lands
 */
export function spawnHitParticles(fighter: FighterState, x: number, y: number): void {
  const colors = ['#fff', '#ff0', '#f80', '#f00'];
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * TAU;
    const speed = 100 + Math.random() * 200;
    fighter.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      life: 300 + Math.random() * 200,
      maxLife: 500,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 3 + Math.random() * 5,
    });
  }

  // Add impact effect
  fighter.hitEffects.push({
    x,
    y,
    time: 0,
    type: 'impact',
  });
}

/**
 * Spawn speed lines for active attack
 */
export function spawnSpeedLines(fighter: FighterState, x: number, y: number): void {
  fighter.hitEffects.push({
    x,
    y,
    time: 0,
    type: 'speed_lines',
  });
}

// ─────────────────────────────────────────────────────────────
// Studio Scene - Emergent Systems Lab
// ─────────────────────────────────────────────────────────────

function render2DStudio(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  frame: FrameContext,
  vp: Viewport
): void {
  const em = state.emergent;
  const t = frame.elapsed;

  // Background
  const bgGrad = ctx.createLinearGradient(vp.x, vp.y, vp.x, vp.y + vp.height);
  bgGrad.addColorStop(0, '#0a0a18');
  bgGrad.addColorStop(1, '#0a0a12');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(vp.x, vp.y, vp.width, vp.height);

  // Draw CA grid as background layer
  if (em.showCA) {
    renderCAGrid(ctx, em.ca, vp, t);
  }

  // Ground line
  const groundY = vp.y + vp.height * 0.8;
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(vp.x, groundY);
  ctx.lineTo(vp.x + vp.width, groundY);
  ctx.stroke();

  // Draw agents
  const cx = vp.x + vp.width / 2;
  for (const agent of em.agents) {
    if (agent.health > 0) {
      renderStudioAgent(ctx, agent, cx, groundY, t, em.showDNA);
    }
  }

  // UI Panel - Evolution stats
  renderEvolutionUI(ctx, em, vp);

  // Controls hint
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Space: Pause | G: New Generation | C: Toggle CA | +/-: Speed | R: Reset',
    vp.x + vp.width / 2,
    vp.y + vp.height - 10
  );
}

function renderCAGrid(
  ctx: CanvasRenderingContext2D,
  ca: CAGrid,
  vp: Viewport,
  t: number
): void {
  const cellW = vp.width / ca.width;
  const cellH = (vp.height * 0.75) / ca.height;

  for (let y = 0; y < ca.height; y++) {
    for (let x = 0; x < ca.width; x++) {
      if (ca.cells[y * ca.width + x]) {
        const px = vp.x + x * cellW;
        const py = vp.y + y * cellH;

        // Color based on position for visual interest
        const hue = (x / ca.width * 60 + y / ca.height * 60 + t * 20) % 360;
        const alpha = 0.3 + Math.sin(t * 2 + x * 0.1 + y * 0.1) * 0.1;

        ctx.fillStyle = `hsla(${hue + 180}, 70%, 50%, ${alpha})`;
        ctx.fillRect(px, py, cellW - 1, cellH - 1);
      }
    }
  }

  // Generation counter
  ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`CA Gen: ${ca.generation}`, vp.x + 10, vp.y + 20);
}

function renderStudioAgent(
  ctx: CanvasRenderingContext2D,
  agent: AIAgent,
  cx: number,
  groundY: number,
  t: number,
  showDNA: boolean
): void {
  const x = cx + agent.x;
  const flip = agent.facingRight ? 1 : -1;

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(flip, 1);

  // Body color based on DNA (shows genetic diversity)
  const hue = agent.dna.attackBias * 60 + agent.dna.punchVsKick * 30;
  const sat = 50 + agent.dna.advanceRate * 30;
  const bodyColor = `hsl(${200 + hue}, ${sat}%, 55%)`;
  const limbColor = `hsl(${200 + hue}, ${sat}%, 45%)`;

  // Animation based on action
  let armAngle = 0;
  let legSpread = 0;
  let lean = 0;

  switch (agent.action) {
    case 'punch_startup':
      armAngle = -0.5;
      lean = -0.1;
      break;
    case 'punch_active':
      armAngle = 1.2;
      lean = 0.1;
      break;
    case 'kick_startup':
      legSpread = -0.3;
      break;
    case 'kick_active':
      legSpread = 1;
      lean = -0.15;
      break;
    case 'blocking':
      armAngle = -1;
      lean = -0.05;
      break;
    case 'hitstun':
      lean = 0.3;
      break;
    case 'walk_forward':
    case 'walk_back':
      const walk = Math.sin(t * 10);
      armAngle = walk * 0.3;
      legSpread = walk * 0.2;
      break;
  }

  ctx.rotate(lean);

  // Legs
  ctx.fillStyle = limbColor;
  ctx.fillRect(-12 - legSpread * 10, -25, 10, 35);
  ctx.fillRect(2 + legSpread * 15, -25, 10, 35 + legSpread * 10);

  // Body
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-15, -70, 30, 50, 4);
  ctx.fill();

  // Arms
  ctx.fillStyle = limbColor;
  ctx.save();
  ctx.translate(-15, -60);
  ctx.rotate(armAngle * 0.5);
  ctx.fillRect(-5, 0, 8, 25);
  ctx.restore();

  ctx.save();
  ctx.translate(15, -60);
  ctx.rotate(armAngle);
  ctx.fillRect(-3, 0, 8, 25 + Math.abs(armAngle) * 15);
  ctx.restore();

  // Head
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -82, 14, 0, TAU);
  ctx.fill();

  // Eyes (show targeting)
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(4, -84, 2.5, 0, TAU);
  ctx.fill();

  ctx.restore();

  // Health bar above agent
  const healthW = 40;
  const healthH = 4;
  const healthX = x - healthW / 2;
  const healthY = groundY - 105;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(healthX, healthY, healthW, healthH);

  const healthRatio = agent.health / 100;
  ctx.fillStyle = healthRatio > 0.5 ? '#4f4' : healthRatio > 0.25 ? '#ff0' : '#f44';
  ctx.fillRect(healthX, healthY, healthW * healthRatio, healthH);

  // Agent ID
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`#${agent.id}`, x, healthY - 3);

  // DNA trait indicators (small dots showing key traits)
  if (showDNA) {
    const dotY = healthY - 10;
    const traits = [
      { val: agent.dna.attackBias, color: '#f44' },     // Aggression
      { val: agent.dna.reactionSpeed, color: '#4f4' },  // Speed
      { val: agent.dna.caInfluence, color: '#44f' },    // CA sensitivity
    ];

    traits.forEach((trait, i) => {
      ctx.fillStyle = trait.color;
      ctx.globalAlpha = 0.3 + trait.val * 0.7;
      ctx.beginPath();
      ctx.arc(x - 8 + i * 8, dotY, 2 + trait.val * 2, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

function renderEvolutionUI(
  ctx: CanvasRenderingContext2D,
  em: EmergentState,
  vp: Viewport
): void {
  const evo = em.evolution;
  const x = vp.x + vp.width - 180;
  let y = vp.y + 25;

  // Panel background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 15, 175, 180, 8);
  ctx.fill();

  // Title
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('EVOLUTION LAB', x, y);
  y += 22;

  // Stats
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px monospace';

  ctx.fillText(`Generation: ${evo.generation}`, x, y);
  y += 16;

  ctx.fillText(`Population: ${em.agents.filter(a => a.health > 0).length}/${evo.populationSize}`, x, y);
  y += 16;

  ctx.fillText(`Best Fitness: ${evo.bestFitness.toFixed(1)}`, x, y);
  y += 16;

  ctx.fillText(`Avg Fitness: ${evo.averageFitness.toFixed(1)}`, x, y);
  y += 16;

  // Round timer
  const timeRemaining = Math.max(0, evo.roundTimer / 1000);
  ctx.fillText(`Round Time: ${timeRemaining.toFixed(1)}s`, x, y);
  y += 16;

  // Progress bar
  const progress = 1 - (evo.roundTimer / evo.roundTime);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, 150, 8);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(x, y, 150 * progress, 8);
  y += 20;

  // Speed indicator
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`Speed: ${em.speed.toFixed(1)}x`, x, y);
  y += 16;

  // Paused indicator
  if (em.paused) {
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('PAUSED', x, y);
  }

  // CA info
  y += 20;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '10px monospace';
  ctx.fillText(`CA Grid: ${em.ca.width}x${em.ca.height}`, x, y);
  y += 12;
  ctx.fillText(`Mutation Rate: ${(evo.mutationRate * 100).toFixed(0)}%`, x, y);
}

function render3DStudio(r: ThreeRenderer, state: AppState, frame: FrameContext): void {
  const em = state.emergent;
  const t = frame.elapsed;

  // Ground platform
  r.box(0, -0.5, 0, 20, 0.3, 20, { color: '#1a1a2e', metalness: 0.3 });

  // Grid lines
  for (let i = -9; i <= 9; i += 2) {
    r.box(i, -0.3, 0, 0.02, 0.02, 20, { color: '#64c8ff', emissive: '#64c8ff' });
    r.box(0, -0.3, i, 20, 0.02, 0.02, { color: '#64c8ff', emissive: '#64c8ff' });
  }

  // Render CA grid as 3D pillars
  if (em.showCA) {
    const cellW = 20 / em.ca.width;
    const cellD = 20 / em.ca.height;

    for (let y = 0; y < em.ca.height; y++) {
      for (let x = 0; x < em.ca.width; x++) {
        if (em.ca.cells[y * em.ca.width + x]) {
          const px = (x - em.ca.width / 2) * cellW + cellW / 2;
          const pz = (y - em.ca.height / 2) * cellD + cellD / 2;
          const height = 0.3 + Math.sin(t * 2 + x * 0.2 + y * 0.2) * 0.1;

          // Color based on position
          const hue = (x / em.ca.width + y / em.ca.height) * 0.5;
          const color = `hsl(${200 + hue * 60}, 60%, 40%)`;

          r.box(px, height / 2, pz, cellW * 0.8, height, cellD * 0.8, {
            color,
            emissive: color,
            metalness: 0.5,
          });
        }
      }
    }
  }

  // Render agents as 3D figures
  for (const agent of em.agents) {
    if (agent.health <= 0) continue;

    const ax = agent.x * 0.03;
    const flip = agent.facingRight ? 1 : -1;

    // Body color from DNA
    const hue = agent.dna.attackBias * 60 + agent.dna.punchVsKick * 30;
    const bodyColor = `hsl(${200 + hue}, 60%, 55%)`;
    const limbColor = `hsl(${200 + hue}, 50%, 45%)`;

    // Animation offsets
    let armX = 0;
    let legZ = 0;

    if (agent.action === 'punch_active') {
      armX = 0.8 * flip;
    } else if (agent.action === 'kick_active') {
      legZ = 0.5;
    } else if (agent.action.includes('walk')) {
      const walk = Math.sin(t * 10);
      legZ = walk * 0.2;
    }

    // Body
    r.box(ax, 1, 0, 0.5, 0.8, 0.3, { color: bodyColor, metalness: 0.4 });

    // Head
    r.sphere(ax, 1.7, 0, 0.25, { color: '#fff', metalness: 0.3 });

    // Arms
    r.box(ax - 0.4 + armX * 0.3, 1.1, 0, 0.15, 0.5, 0.15, { color: limbColor, metalness: 0.3 });
    r.box(ax + 0.4 + armX, 1.1, 0, 0.15, 0.5, 0.15, { color: limbColor, metalness: 0.3 });

    // Legs
    r.box(ax - 0.15, 0.3, -legZ * 0.3, 0.15, 0.6, 0.15, { color: limbColor, metalness: 0.3 });
    r.box(ax + 0.15, 0.3, legZ, 0.15, 0.6, 0.15, { color: limbColor, metalness: 0.3 });

    // Health indicator (floating orb)
    const healthY = 2.2;
    const healthColor = agent.health > 50 ? '#4f4' : agent.health > 25 ? '#ff0' : '#f44';
    r.sphere(ax, healthY, 0, 0.1 + (agent.health / 100) * 0.1, {
      color: healthColor,
      emissive: healthColor,
    });
  }

  // Evolution markers (pillars at corners showing generation)
  const genHeight = Math.min(5, em.evolution.generation * 0.1);
  const corners = [[-8, -8], [8, -8], [-8, 8], [8, 8]];
  for (const [cx, cz] of corners) {
    r.cylinder(cx, genHeight / 2, cz, 0.2, genHeight, {
      color: '#64c8ff',
      emissive: '#64c8ff',
      metalness: 0.6,
    });
    r.sphere(cx, genHeight + 0.3, cz, 0.3, { color: '#fff', emissive: '#fff' });
  }
}

// ─────────────────────────────────────────────────────────────
// 3D Fighter Scene
// ─────────────────────────────────────────────────────────────

function render3DFighter(r: ThreeRenderer, state: AppState, frame: FrameContext): void {
  const fighter = state.fighter;
  const t = frame.elapsed;

  // Ground plane (arena) - at y=0, extends into the distance (z negative = away from camera)
  r.box(0, -0.1, -4, 16, 0.2, 12, { color: '#1a1a2e', metalness: 0.3 });

  // Grid lines on floor
  for (let i = -7; i <= 7; i += 2) {
    r.box(i, 0.01, -4, 0.03, 0.02, 12, { color: '#64c8ff', emissive: '#64c8ff' });
  }
  for (let z = -9; z <= 1; z += 2) {
    r.box(0, 0.01, z, 16, 0.02, 0.03, { color: '#64c8ff', emissive: '#64c8ff' });
  }

  // Character position - character stands at z=0 (close to camera)
  const charX = fighter.x * 0.015;
  const flip = fighter.facingRight ? 1 : -1;

  // 3D Character (simplified block figure)
  const action = fighter.action;
  let armAngle = 0;
  let legSpread = 0;

  if (action === 'punch_active') {
    armAngle = 1.5 * flip;
  } else if (action === 'kick_active') {
    legSpread = 1;
  } else if (action === 'blocking') {
    armAngle = -0.8;
  } else if (action === 'hitstun') {
    armAngle = 0.3;
  }

  // Body
  r.box(charX, 1.5, 0, 0.8, 1.2, 0.5, { color: '#64c8ff', metalness: 0.5 });

  // Head
  r.sphere(charX, 2.5, 0, 0.35, { color: '#fff', metalness: 0.3 });

  // Arms
  const armY = 1.8;
  // Left arm
  r.box(charX - 0.6 - armAngle * 0.5, armY, 0, 0.2, 0.8, 0.2, {
    color: '#48dbfb',
    metalness: 0.4,
  });
  // Right arm (attack arm)
  r.box(charX + 0.6 + armAngle * 0.5, armY, 0, 0.2, 0.8, 0.2, {
    color: '#48dbfb',
    metalness: 0.4,
  });

  // Legs
  r.box(charX - 0.25 - legSpread * 0.3, 0.4, 0, 0.25, 0.8, 0.25, {
    color: '#48dbfb',
    metalness: 0.4,
  });
  r.box(charX + 0.25 + legSpread * 0.5, 0.4, legSpread * 0.3, 0.25, 0.8, 0.25, {
    color: '#48dbfb',
    metalness: 0.4,
  });

  // Attack effects in 3D
  if (action === 'punch_active' || action === 'kick_active') {
    // Glowing effect sphere
    const effectX = charX + (action === 'punch_active' ? 1.5 : 1.2) * flip;
    const effectY = action === 'punch_active' ? 1.8 : 0.5;
    const pulse = Math.sin(t * 20) * 0.2 + 1;

    r.sphere(effectX, effectY, 0, 0.3 * pulse, {
      color: '#ff4444',
      emissive: '#ff4444',
    });

    // Energy ring
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * TAU + t * 5;
      const ringR = 0.5;
      r.sphere(
        effectX + Math.cos(angle) * ringR,
        effectY + Math.sin(angle) * ringR * 0.5,
        Math.sin(angle) * ringR * 0.5,
        0.05,
        { color: '#ffff00', emissive: '#ffff00' }
      );
    }
  }

  // Hitbox visualization in 3D
  if (HITBOXES[fighter.action]) {
    const hitbox = HITBOXES[fighter.action]!;
    const hbX = charX + hitbox.x * 0.02 * flip;
    const hbY = 1.5 + hitbox.y * 0.01;

    // Wireframe hitbox
    r.box(hbX, hbY, 0, hitbox.width * 0.02, hitbox.height * 0.02, 0.3, {
      color: '#ff3333',
      emissive: '#ff3333',
      metalness: 0.1,
      roughness: 0.9,
    });
  }

  // Particle effects in 3D
  for (const p of fighter.particles) {
    const px = p.x * 0.02;
    const py = 1.5 - p.y * 0.01;
    const alpha = p.life / p.maxLife;

    r.sphere(px, py, 0, p.size * 0.02 * alpha, {
      color: p.color,
      emissive: p.color,
    });
  }

  // Hit effects in 3D
  for (const effect of fighter.hitEffects) {
    const progress = effect.time / 300;
    if (effect.type === 'impact') {
      // Expanding ring
      const ringR = 0.5 + progress * 2;
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * TAU + t * 3;
        r.sphere(
          charX + effect.x * 0.02 + Math.cos(angle) * ringR,
          1.5 + effect.y * 0.01,
          Math.sin(angle) * ringR,
          0.05 * (1 - progress),
          { color: '#ffff00', emissive: '#ffff00' }
        );
      }
    }
  }

  // Stage decorations - corner posts at back of arena
  const postPositions = [
    [-7, -9], [7, -9]  // Back corners only (front would block view)
  ];
  for (const [px, pz] of postPositions) {
    r.cylinder(px, 1.5, pz, 0.15, 3, { color: '#ff6b6b', metalness: 0.7 });
    r.sphere(px, 3.1, pz, 0.25, { color: '#ffff00', emissive: '#ffff00' });
  }

  // Background wall at back of stage
  r.box(0, 3, -10, 18, 7, 0.3, { color: '#151525', metalness: 0.1 });

  // Side pillars for framing
  r.box(-8, 2, -5, 0.5, 5, 0.5, { color: '#2a2a4e', metalness: 0.3 });
  r.box(8, 2, -5, 0.5, 5, 0.5, { color: '#2a2a4e', metalness: 0.3 });
}

// ─────────────────────────────────────────────────────────────
// 3D Scene Rendering
// ─────────────────────────────────────────────────────────────

export function render3DScene(
  r: ThreeRenderer,
  state: AppState,
  frame: FrameContext
): void {
  r.clear('#0a0a12');

  // Scene-specific camera setup - fixed cameras for fighter/studio, orbiting for others
  if (state.currentScene === 'fighter') {
    // Fighting game camera: side view, slightly above ground, looking at characters
    // Position camera to the side (like Tekken/SF) - low angle, facing the action
    r.setCamera(0, 2, 8, 0, 1.5, 0); // pos(x,y,z), lookAt(x,y,z)
  } else if (state.currentScene === 'studio') {
    // Studio camera: fixed angle looking down at arena, ground at bottom of screen
    r.setCamera(0, 5, 10, 0, 0, -2); // pos(x,y,z), lookAt(x,y,z)
  } else {
    // Orbit camera based on mouse for other scenes
    const camDist = 12;
    r.orbit(state.mouseNorm.x * 0.5, state.mouseNorm.y * 0.3 + 0.3, camDist);
  }

  switch (state.currentScene) {
    case 'home':
      render3DClock(r, state, frame);
      break;
    case 'anime':
      render3DAnime(r, state, frame);
      break;
    case 'fighter':
      render3DFighter(r, state, frame);
      break;
    case 'studio':
      render3DStudio(r, state, frame);
      break;
    case 'lab':
      render3DLab(r, state, frame);
      break;
    case 'about':
      render3DAbout(r, state, frame);
      break;
  }

  r.render();
}

function render3DClock(r: ThreeRenderer, state: AppState, frame: FrameContext): void {
  const { hour, min, sec } = state.clock;
  const smoothSec = sec + frame.alpha;

  // Clock face (flat disc approximated by flat box)
  r.cylinder(0, 0, -0.1, 4, 0.2, { color: '#1a1a2e' });

  // Outer ring
  r.cylinder(0, 0, 0, 4.2, 0.3, { color: '#2a2a3e' });

  // Tick marks (spheres around the edge)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU - TAU / 4;
    const x = Math.cos(angle) * 3.5;
    const y = Math.sin(angle) * 3.5;
    r.sphere(x, y, 0.1, 0.15, { color: '#64c8ff' });
  }

  // Calculate angles
  const secAngle = (smoothSec / 60) * TAU - TAU / 4;
  const minAngle = ((min + smoothSec / 60) / 60) * TAU - TAU / 4;
  const hourAngle = ((hour + (min + smoothSec / 60) / 60) / 12) * TAU - TAU / 4;

  // Hour hand
  r.hand(hourAngle, 1.8, 0.15, { color: COLORS.hourHand });

  // Minute hand
  r.hand(minAngle, 2.6, 0.1, { color: COLORS.minHand });

  // Second hand
  r.hand(secAngle, 3.0, 0.05, { color: COLORS.secHand });

  // Center sphere
  r.sphere(0, 0, 0.2, 0.25, { color: '#ffffff', metalness: 0.8 });
}

function render3DLab(r: ThreeRenderer, state: AppState, frame: FrameContext): void {
  // 3D bouncing balls
  const ballCount = 12;
  for (let i = 0; i < ballCount; i++) {
    const t = frame.elapsed + i * 0.4;
    const x = Math.sin(t * 1.5 + i) * 3;
    const y = Math.cos(t * 1.2 + i * 0.8) * 3;
    const z = Math.sin(t * 0.8 + i * 1.2) * 2;
    const radius = 0.3 + Math.sin(t + i) * 0.1;

    const hue = (i / ballCount) * 360;
    const color = `hsl(${hue}, 70%, 50%)`;

    r.sphere(x, y, z, radius, { color, metalness: 0.5, roughness: 0.3 });
  }

  // Ground plane
  r.box(0, -4, 0, 10, 0.2, 10, { color: '#1a1a2e' });
}

function render3DAbout(r: ThreeRenderer, state: AppState, frame: FrameContext): void {
  // Rotating cube
  const t = frame.elapsed;

  r.box(0, 0, 0, 2, 2, 2, { color: COLORS.accent, metalness: 0.7 });

  // Orbiting spheres
  for (let i = 0; i < 4; i++) {
    const angle = t + (i / 4) * TAU;
    const orbitRadius = 3;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = Math.sin(t * 2 + i) * 0.5;

    const colors = [COLORS.accent, COLORS.accent2, COLORS.accent3, '#feca57'];
    r.sphere(x, y, z, 0.4, { color: colors[i], emissive: colors[i] });
  }
}

function render3DAnime(r: ThreeRenderer, state: AppState, frame: FrameContext): void {
  const t = frame.elapsed;

  // Central yin-yang platform
  r.cylinder(0, -0.5, 0, 4, 0.3, { color: '#1a1a2e', metalness: 0.3 });

  // Yin-yang symbol on platform (approximated with spheres)
  // White half
  r.cylinder(0, -0.3, -1, 1, 0.1, { color: '#ffffff', metalness: 0.2 });
  // Black half
  r.cylinder(0, -0.3, 1, 1, 0.1, { color: '#1a1a2e', metalness: 0.2 });
  // Center dots
  r.sphere(0, -0.2, -1, 0.2, { color: '#1a1a2e' });
  r.sphere(0, -0.2, 1, 0.2, { color: '#ffffff' });

  // Rotating energy ring
  const ringParticles = 24;
  for (let i = 0; i < ringParticles; i++) {
    const angle = (i / ringParticles) * TAU + t;
    const ringR = 5;
    const x = Math.cos(angle) * ringR;
    const z = Math.sin(angle) * ringR;
    const y = Math.sin(t * 2 + i * 0.5) * 0.5;
    const pulse = Math.sin(t * 3 + i) * 0.5 + 0.5;

    r.sphere(x, y, z, 0.1 + pulse * 0.1, {
      color: i % 2 === 0 ? '#64c8ff' : '#ffffff',
      emissive: i % 2 === 0 ? '#64c8ff' : '#ffffff',
    });
  }

  // Floating mountains
  const mountainPositions = [
    { x: -6, z: -4, scale: 1.5, speed: 0.3 },
    { x: 7, z: -3, scale: 1.2, speed: 0.4 },
    { x: -5, z: 5, scale: 1.0, speed: 0.35 },
    { x: 6, z: 6, scale: 0.8, speed: 0.45 },
  ];

  for (const m of mountainPositions) {
    const floatY = Math.sin(t * m.speed) * 0.5 - 2;
    // Mountain as stacked boxes
    r.box(m.x, floatY, m.z, m.scale * 2, m.scale * 3, m.scale * 2, {
      color: '#2a2a3e',
      metalness: 0.1,
    });
    // Snow cap
    r.box(m.x, floatY + m.scale * 1.8, m.z, m.scale * 0.8, m.scale * 0.5, m.scale * 0.8, {
      color: '#ffffff',
      metalness: 0.3,
    });
  }

  // Koi fish (spheres following paths)
  const koiColors = ['#ff6b6b', '#ffd93d', '#ffffff'];
  for (let k = 0; k < 3; k++) {
    const fishT = t + k * 2;
    const fishAngle = fishT * 0.5;
    const fishR = 3 + k * 0.5;
    const fx = Math.cos(fishAngle) * fishR;
    const fz = Math.sin(fishAngle) * fishR;
    const fy = -3 + Math.sin(fishT) * 0.3;

    // Fish body
    r.sphere(fx, fy, fz, 0.25, { color: koiColors[k], metalness: 0.4 });
    // Fish tail
    const tailAngle = fishAngle - 0.3;
    r.sphere(
      Math.cos(tailAngle) * fishR,
      fy,
      Math.sin(tailAngle) * fishR,
      0.15,
      { color: koiColors[k], metalness: 0.4 }
    );
  }

  // Sakura petals (small pink spheres floating)
  const petalCount = 30;
  for (let i = 0; i < petalCount; i++) {
    const seed = i * 137.5;
    const px = Math.sin(seed) * 8;
    const pz = Math.cos(seed * 0.7) * 8;
    const py = ((seed + t * 20) % 12) - 6;
    const drift = Math.sin(t + i) * 0.5;

    r.sphere(px + drift, py, pz + drift, 0.08, {
      color: '#ffb6c1',
      emissive: '#ffb6c1',
    });
  }

  // Torii gate (boxes)
  const toriiX = 0;
  const toriiZ = -7;
  const toriiY = -2;
  const pillarH = 3;
  const pillarW = 0.2;
  const gateW = 2;

  // Pillars
  r.box(toriiX - gateW / 2, toriiY + pillarH / 2, toriiZ, pillarW, pillarH, pillarW, {
    color: '#8b0000',
    metalness: 0.3,
  });
  r.box(toriiX + gateW / 2, toriiY + pillarH / 2, toriiZ, pillarW, pillarH, pillarW, {
    color: '#8b0000',
    metalness: 0.3,
  });
  // Top beam
  r.box(toriiX, toriiY + pillarH, toriiZ, gateW + 0.5, pillarW * 1.5, pillarW, {
    color: '#8b0000',
    metalness: 0.3,
  });
  // Middle beam
  r.box(toriiX, toriiY + pillarH * 0.7, toriiZ, gateW - 0.2, pillarW, pillarW * 0.8, {
    color: '#8b0000',
    metalness: 0.3,
  });

  // Moon (large glowing sphere in background)
  r.sphere(8, 6, -10, 2, {
    color: '#fff8e7',
    emissive: '#fff8e7',
    metalness: 0.1,
    roughness: 0.9,
  });

  // Fireflies
  const fireflyCount = 20;
  for (let i = 0; i < fireflyCount; i++) {
    const fx = Math.sin(i * 2.3) * 6;
    const fz = Math.cos(i * 1.7) * 6;
    const fy = Math.sin(t * 2 + i) * 2;
    const glow = Math.sin(t * 4 + i * 1.5) * 0.5 + 0.5;

    if (glow > 0.3) {
      r.sphere(fx, fy, fz, 0.05 + glow * 0.05, {
        color: '#ffff99',
        emissive: '#ffff99',
      });
    }
  }

  // Water surface (flat box at bottom)
  r.box(0, -4, 0, 20, 0.1, 20, {
    color: '#1a2a4a',
    metalness: 0.8,
    roughness: 0.2,
  });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function drawHand(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  length: number,
  width: number,
  color: string,
  tail = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-tail, 0);
  ctx.lineTo(length, 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
