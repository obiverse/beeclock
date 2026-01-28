import { CanvasRenderer } from '../canvas-renderer';
import { ClockSkin, ClockState, smoothClockAngle, TAU } from '../clock-skin';

/**
 * AnalogClassicSkin: Traditional wall clock.
 *
 * Demonstrates:
 * - Radial gradients for depth
 * - Transform stack (save/restore)
 * - Smooth hand movement with interpolation
 * - Minute markers
 * - Drop shadows
 */
export const AnalogClassicSkin: ClockSkin = {
  id: 'analog-classic',
  name: 'Classic Analog',

  render(r: CanvasRenderer, state: ClockState): void {
    const { cx, cy, radius } = r;
    const faceRadius = radius * 0.9;

    // ─────────────────────────────────────────────────────────
    // Face with gradient
    // ─────────────────────────────────────────────────────────
    const faceGradient = r.radialGradient(cx, cy, 0, faceRadius, [
      [0, '#ffffff'],
      [0.8, '#f8f4e8'],
      [1, '#e8e0d0'],
    ]);

    r.circle(cx, cy, faceRadius, { fill: faceGradient });
    r.circle(cx, cy, faceRadius, { stroke: '#1c2b30', width: 3 });

    // ─────────────────────────────────────────────────────────
    // Minute markers
    // ─────────────────────────────────────────────────────────
    r.save();
    r.translate(cx, cy);

    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * TAU;
      const isHour = i % 5 === 0;
      const innerR = faceRadius * (isHour ? 0.8 : 0.88);
      const outerR = faceRadius * 0.92;
      const width = isHour ? 3 : 1;
      const color = isHour ? '#1c2b30' : '#888';

      const x1 = Math.cos(angle) * innerR;
      const y1 = Math.sin(angle) * innerR;
      const x2 = Math.cos(angle) * outerR;
      const y2 = Math.sin(angle) * outerR;

      r.line(x1, y1, x2, y2, { stroke: color, width, cap: 'round' });
    }

    // ─────────────────────────────────────────────────────────
    // Hour numbers
    // ─────────────────────────────────────────────────────────
    for (let i = 1; i <= 12; i++) {
      const angle = (i / 12) * TAU - Math.PI / 2;
      const numRadius = faceRadius * 0.68;
      const x = Math.cos(angle) * numRadius;
      const y = Math.sin(angle) * numRadius;

      r.text(i.toString(), x, y, {
        font: `bold ${faceRadius * 0.12}px 'Georgia', serif`,
        fill: '#1c2b30',
      });
    }

    // ─────────────────────────────────────────────────────────
    // Hands (drawn at origin, already translated to center)
    // ─────────────────────────────────────────────────────────

    // Calculate smooth angles
    const hour12 = state.hour % 12;
    const hourAngle = smoothClockAngle(
      hour12 + state.min / 60,
      0,
      12
    );
    const minAngle = smoothClockAngle(
      state.min + state.sec / 60,
      0,
      60
    );
    const secAngle = smoothClockAngle(
      state.sec,
      state.alpha,
      60
    );

    // Hour hand
    r.shadow('rgba(0,0,0,0.2)', 4, 2, 2);
    r.hand(hourAngle, faceRadius * 0.5, {
      width: 6,
      color: '#1c2b30',
      tail: faceRadius * 0.08,
    });

    // Minute hand
    r.hand(minAngle, faceRadius * 0.72, {
      width: 4,
      color: '#1c2b30',
      tail: faceRadius * 0.1,
    });

    // Second hand (red, sweeping)
    r.clearShadow();
    r.hand(secAngle, faceRadius * 0.78, {
      width: 2,
      color: '#c0392b',
      tail: faceRadius * 0.15,
    });

    // Center cap
    r.circle(0, 0, 6, { fill: '#c0392b' });
    r.circle(0, 0, 3, { fill: '#1c2b30' });

    r.restore();
  },
};
