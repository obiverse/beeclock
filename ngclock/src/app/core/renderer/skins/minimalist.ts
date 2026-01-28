import { CanvasRenderer } from '../canvas-renderer';
import { ClockSkin, ClockState, smoothClockAngle, TAU } from '../clock-skin';

/**
 * MinimalistSkin: Ultra-clean, modern design.
 *
 * Demonstrates:
 * - Negative space
 * - Thin lines
 * - Absence as design element
 * - Elegant typography
 */
export const MinimalistSkin: ClockSkin = {
  id: 'minimalist',
  name: 'Minimalist',

  render(r: CanvasRenderer, state: ClockState): void {
    const { cx, cy, radius } = r;

    // Soft background
    r.fill('#fafafa');

    const clockRadius = radius * 0.85;

    r.save();
    r.translate(cx, cy);

    // Only 4 markers (12, 3, 6, 9)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * TAU - Math.PI / 2;
      const innerR = clockRadius * 0.9;
      const outerR = clockRadius * 0.95;

      const x1 = Math.cos(angle) * innerR;
      const y1 = Math.sin(angle) * innerR;
      const x2 = Math.cos(angle) * outerR;
      const y2 = Math.sin(angle) * outerR;

      r.line(x1, y1, x2, y2, { stroke: '#333', width: 2, cap: 'round' });
    }

    // Hands - no seconds, just hour and minute
    const hour12 = state.hour % 12;
    const hourAngle = smoothClockAngle(hour12 + state.min / 60, 0, 12);
    const minAngle = smoothClockAngle(state.min + state.sec / 60, 0, 60);

    // Hour
    r.hand(hourAngle, clockRadius * 0.45, {
      width: 4,
      color: '#222',
    });

    // Minute
    r.hand(minAngle, clockRadius * 0.7, {
      width: 2,
      color: '#222',
    });

    // Tiny center dot
    r.circle(0, 0, 3, { fill: '#222' });

    r.restore();
  },
};
