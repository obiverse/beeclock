import { CanvasRenderer } from '../canvas-renderer';
import { ClockSkin, ClockState, pad2 } from '../clock-skin';

/**
 * DigitalLEDSkin: Seven-segment LED display.
 *
 * Demonstrates:
 * - Path-based custom shapes
 * - Glow effects with shadows
 * - Color theming
 * - Retro aesthetic
 */

// Seven-segment display encoding
// Each segment: [startX, startY, endX, endY] relative to digit bounds
//
//  ─0─
// │   │
// 1   2
// │   │
//  ─3─
// │   │
// 4   5
// │   │
//  ─6─
//
const SEGMENTS = [
  [0.1, 0, 0.9, 0],       // 0: top
  [0, 0.05, 0, 0.45],     // 1: top-left
  [1, 0.05, 1, 0.45],     // 2: top-right
  [0.1, 0.5, 0.9, 0.5],   // 3: middle
  [0, 0.55, 0, 0.95],     // 4: bottom-left
  [1, 0.55, 1, 0.95],     // 5: bottom-right
  [0.1, 1, 0.9, 1],       // 6: bottom
];

// Which segments are on for each digit (0-9)
const DIGITS: boolean[][] = [
  [true, true, true, false, true, true, true],    // 0
  [false, false, true, false, false, true, false], // 1
  [true, false, true, true, true, false, true],   // 2
  [true, false, true, true, false, true, true],   // 3
  [false, true, true, true, false, true, false],  // 4
  [true, true, false, true, false, true, true],   // 5
  [true, true, false, true, true, true, true],    // 6
  [true, false, true, false, false, true, false], // 7
  [true, true, true, true, true, true, true],     // 8
  [true, true, true, true, false, true, true],    // 9
];

export const DigitalLEDSkin: ClockSkin = {
  id: 'digital-led',
  name: 'LED Display',

  render(r: CanvasRenderer, state: ClockState): void {
    const { width, height, cx, cy } = r;

    // Background
    r.fill('#0a0a0a');

    // ─────────────────────────────────────────────────────────
    // Calculate digit dimensions to FIT within canvas bounds
    // Layout: [D][D]:[D][D]:[D][D] = 6 digits, 2 colons, 7 gaps
    // ─────────────────────────────────────────────────────────

    // Aspect ratio constants
    const digitAspect = 0.6;      // width/height of a digit
    const colonAspect = 0.3;      // width/height of colon
    const gapRatio = 0.2;         // gap as fraction of digit width

    // Calculate based on fitting width (with padding)
    const padding = width * 0.08;
    const availableWidth = width - padding * 2;

    // Total relative width units:
    // 6 digits + 2 colons + 7 gaps
    // = 6*(digitAspect) + 2*(colonAspect*digitAspect) + 7*(gapRatio*digitAspect)
    // = digitAspect * (6 + 2*colonAspect + 7*gapRatio)
    // Let's define: totalUnits = 6 + 2*0.3 + 7*0.2 = 6 + 0.6 + 1.4 = 8.0
    const totalUnits = 6 + 2 * colonAspect + 7 * gapRatio;

    // Digit height based on width constraint
    const digitHeightFromWidth = availableWidth / (totalUnits * digitAspect);

    // Also constrain by height (with padding)
    const maxDigitHeight = height * 0.5;

    // Use the smaller to ensure fit
    const digitHeight = Math.min(digitHeightFromWidth, maxDigitHeight);
    const digitWidth = digitHeight * digitAspect;
    const gap = digitWidth * gapRatio;
    const colonWidth = digitWidth * colonAspect;

    // Recalculate actual total width for centering
    const totalWidth = digitWidth * 6 + colonWidth * 2 + gap * 7;
    const startX = cx - totalWidth / 2;
    const startY = cy - digitHeight / 2;

    // Colors
    const onColor = '#00ff88';
    const offColor = '#0a1a10';
    const glowColor = 'rgba(0, 255, 136, 0.5)';

    // Format time
    const timeStr = `${pad2(state.hour)}${pad2(state.min)}${pad2(state.sec)}`;

    let x = startX;

    for (let i = 0; i < 6; i++) {
      const digit = parseInt(timeStr[i], 10);
      drawDigit(r, x, startY, digitWidth, digitHeight, digit, onColor, offColor, glowColor);
      x += digitWidth + gap;

      // Draw colon after hours and minutes
      if (i === 1 || i === 3) {
        drawColon(r, x, startY, colonWidth, digitHeight, onColor, glowColor, state.alpha);
        x += colonWidth + gap;
      }
    }
  },
};

function drawDigit(
  r: CanvasRenderer,
  x: number,
  y: number,
  w: number,
  h: number,
  digit: number,
  onColor: string,
  offColor: string,
  glowColor: string
): void {
  const pattern = DIGITS[digit];
  const segmentWidth = w * 0.15;

  for (let i = 0; i < 7; i++) {
    const isOn = pattern[i];
    const [x1r, y1r, x2r, y2r] = SEGMENTS[i];

    const sx = x + x1r * w;
    const sy = y + y1r * h;
    const ex = x + x2r * w;
    const ey = y + y2r * h;

    if (isOn) {
      // Glow effect
      r.shadow(glowColor, 10, 0, 0);
    }

    r.line(sx, sy, ex, ey, {
      stroke: isOn ? onColor : offColor,
      width: segmentWidth,
      cap: 'round',
    });

    r.clearShadow();
  }
}

function drawColon(
  r: CanvasRenderer,
  x: number,
  y: number,
  w: number,
  h: number,
  onColor: string,
  glowColor: string,
  alpha: number
): void {
  const dotRadius = w * 0.25;
  const cx = x + w / 2;

  // Blink colon (on for first half of second)
  const isOn = alpha < 0.5;

  if (isOn) {
    r.shadow(glowColor, 8, 0, 0);
  }

  const color = isOn ? onColor : '#0a1a10';
  r.circle(cx, y + h * 0.3, dotRadius, { fill: color });
  r.circle(cx, y + h * 0.7, dotRadius, { fill: color });

  r.clearShadow();
}
