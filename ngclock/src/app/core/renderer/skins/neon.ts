import { CanvasRenderer } from '../canvas-renderer';
import { ClockSkin, ClockState, smoothClockAngle, TAU, pad2 } from '../clock-skin';

/**
 * NeonSkin: Cyberpunk neon aesthetic.
 *
 * Demonstrates:
 * - Multiple glow layers
 * - Arc progress indicators
 * - Color mixing
 * - Retro-futuristic design
 */
export const NeonSkin: ClockSkin = {
  id: 'neon',
  name: 'Neon',

  render(r: CanvasRenderer, state: ClockState, t: number): void {
    const { cx, cy, radius } = r;

    // Dark background
    r.fill('#0d0d1a');

    const ringRadius = radius * 0.85;
    const ringWidth = radius * 0.08;

    r.save();
    r.translate(cx, cy);

    // ─────────────────────────────────────────────────────────
    // Progress rings
    // ─────────────────────────────────────────────────────────

    // Hour ring (outer) - magenta
    drawProgressRing(
      r,
      ringRadius,
      ringWidth,
      (state.hour % 12) / 12,
      '#ff00ff',
      'rgba(255, 0, 255, 0.3)'
    );

    // Minute ring (middle) - cyan
    drawProgressRing(
      r,
      ringRadius - ringWidth * 1.5,
      ringWidth,
      state.min / 60,
      '#00ffff',
      'rgba(0, 255, 255, 0.3)'
    );

    // Second ring (inner) - with smooth animation
    const smoothSec = state.sec + state.alpha;
    drawProgressRing(
      r,
      ringRadius - ringWidth * 3,
      ringWidth,
      smoothSec / 60,
      '#ff6600',
      'rgba(255, 102, 0, 0.3)'
    );

    // ─────────────────────────────────────────────────────────
    // Digital time in center
    // ─────────────────────────────────────────────────────────
    const timeStr = `${pad2(state.hour)}:${pad2(state.min)}`;
    const secStr = pad2(state.sec);

    // Main time glow
    r.shadow('#00ffff', 20, 0, 0);
    r.text(timeStr, 0, -radius * 0.05, {
      font: `bold ${radius * 0.22}px 'Courier New', monospace`,
      fill: '#00ffff',
    });

    // Seconds below (smaller, different color)
    r.shadow('#ff00ff', 15, 0, 0);
    r.text(secStr, 0, radius * 0.18, {
      font: `${radius * 0.12}px 'Courier New', monospace`,
      fill: '#ff00ff',
    });

    r.clearShadow();

    // ─────────────────────────────────────────────────────────
    // Animated pulse dots
    // ─────────────────────────────────────────────────────────
    const pulseAlpha = 0.3 + Math.sin(t * TAU * 2) * 0.2;
    r.alpha = pulseAlpha;

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * TAU - Math.PI / 2;
      const dotRadius = ringRadius + ringWidth;
      const x = Math.cos(angle) * dotRadius;
      const y = Math.sin(angle) * dotRadius;

      r.circle(x, y, 3, { fill: '#ffffff' });
    }

    r.alpha = 1;
    r.restore();
  },
};

function drawProgressRing(
  r: CanvasRenderer,
  radius: number,
  width: number,
  progress: number,
  color: string,
  bgColor: string
): void {
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + TAU;
  const progressAngle = startAngle + progress * TAU;

  // Background ring
  r.arc(0, 0, radius, startAngle, endAngle, {
    stroke: bgColor,
    width,
    cap: 'round',
  });

  // Progress arc with glow
  r.shadow(color, 15, 0, 0);
  r.arc(0, 0, radius, startAngle, progressAngle, {
    stroke: color,
    width,
    cap: 'round',
  });
  r.clearShadow();
}
