import { CanvasRenderer } from '../canvas-renderer';
import { ClockSkin, ClockState, TAU, lerp } from '../clock-skin';

/**
 * GenerativeSkin: Algorithmic, ever-changing patterns.
 *
 * Demonstrates:
 * - Procedural generation
 * - Time-based animation
 * - Mathematical patterns
 * - Blend modes
 */
export const GenerativeSkin: ClockSkin = {
  id: 'generative',
  name: 'Generative',

  render(r: CanvasRenderer, state: ClockState, t: number): void {
    const { cx, cy, radius, width, height } = r;

    // Dark gradient background
    const bgGradient = r.radialGradient(cx, cy, 0, radius * 1.5, [
      [0, '#1a1a2e'],
      [1, '#0f0f1a'],
    ]);
    r.rect(0, 0, width, height, { fill: bgGradient });

    r.save();
    r.translate(cx, cy);

    // ─────────────────────────────────────────────────────────
    // Time-based parameters
    // ─────────────────────────────────────────────────────────
    const hourPhase = (state.hour % 12) / 12;
    const minPhase = state.min / 60;
    const secPhase = (state.sec + state.alpha) / 60;

    // Number of elements based on time
    const numRings = 3 + Math.floor(hourPhase * 5);
    const numDots = 12 + state.min % 12;

    // ─────────────────────────────────────────────────────────
    // Rotating rings
    // ─────────────────────────────────────────────────────────
    for (let i = 0; i < numRings; i++) {
      const ringRadius = radius * (0.3 + i * 0.15);
      const ringAlpha = 0.1 + (i / numRings) * 0.3;
      const rotation = t * TAU * (i % 2 === 0 ? 1 : -1) * (0.5 + i * 0.2);

      r.save();
      r.rotate(rotation);
      r.alpha = ringAlpha;

      // Ring color based on position
      const hue = (hourPhase * 360 + i * 30) % 360;
      const color = `hsl(${hue}, 70%, 60%)`;

      r.circle(0, 0, ringRadius, { stroke: color, width: 1 });
      r.restore();
    }

    r.alpha = 1;

    // ─────────────────────────────────────────────────────────
    // Orbiting particles
    // ─────────────────────────────────────────────────────────
    for (let i = 0; i < numDots; i++) {
      const angle = (i / numDots) * TAU + t * TAU + secPhase * TAU;
      const orbitRadius = radius * (0.4 + (i % 3) * 0.2);
      const dotSize = 2 + (i % 4);

      const x = Math.cos(angle) * orbitRadius;
      const y = Math.sin(angle) * orbitRadius;

      // Color varies with minute
      const hue = (minPhase * 360 + i * 20) % 360;
      const color = `hsl(${hue}, 80%, 65%)`;

      r.circle(x, y, dotSize, { fill: color });
    }

    // ─────────────────────────────────────────────────────────
    // Central time display
    // ─────────────────────────────────────────────────────────
    const timeHue = (t * 360) % 360;
    const timeColor = `hsl(${timeHue}, 70%, 80%)`;

    // Pulsing glow
    const glowIntensity = 10 + Math.sin(t * TAU * 4) * 5;
    r.shadow(timeColor, glowIntensity, 0, 0);

    const hourStr = state.hour.toString().padStart(2, '0');
    const minStr = state.min.toString().padStart(2, '0');
    const secStr = state.sec.toString().padStart(2, '0');

    r.text(`${hourStr}:${minStr}`, 0, -radius * 0.05, {
      font: `300 ${radius * 0.2}px system-ui`,
      fill: timeColor,
    });

    r.text(secStr, 0, radius * 0.15, {
      font: `200 ${radius * 0.1}px system-ui`,
      fill: timeColor,
    });

    r.clearShadow();

    // ─────────────────────────────────────────────────────────
    // Breathing circle
    // ─────────────────────────────────────────────────────────
    const breathScale = 1 + Math.sin(t * TAU) * 0.1;
    const breathRadius = radius * 0.25 * breathScale;
    const breathAlpha = 0.1 + Math.sin(t * TAU) * 0.05;

    r.alpha = breathAlpha;
    r.circle(0, 0, breathRadius, {
      stroke: timeColor,
      width: 2,
    });
    r.alpha = 1;

    r.restore();
  },
};
