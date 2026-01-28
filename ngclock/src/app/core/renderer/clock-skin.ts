import { CanvasRenderer } from './canvas-renderer';

/**
 * ClockState: The data a skin needs to render.
 *
 * This is the "model" that skins visualize.
 * It's framework-agnostic, pure data.
 */
export interface ClockState {
  /** Hour (0-23) */
  hour: number;
  /** Minute (0-59) */
  min: number;
  /** Second (0-59) */
  sec: number;
  /** Interpolation factor (0.0 - 1.0) for smooth animations */
  alpha: number;
  /** Global tick count */
  tick: number;
}

/**
 * ClockSkin: Interface for pluggable clock renderers.
 *
 * Each skin is a pure function: (renderer, state) → pixels
 *
 * Design principles:
 * - Skins are stateless (all state comes from ClockState)
 * - Skins don't own the canvas (CanvasRenderer does)
 * - Skins can be swapped at runtime
 * - Skins can be composed (one skin can delegate to another)
 */
export interface ClockSkin {
  /** Unique identifier */
  readonly id: string;

  /** Display name */
  readonly name: string;

  /**
   * Render one frame.
   *
   * @param r The canvas renderer
   * @param state Current clock state
   * @param t Normalized time for animations (0-1, wraps)
   */
  render(r: CanvasRenderer, state: ClockState, t: number): void;
}

/**
 * SkinRegistry: Manages available skins.
 */
export class SkinRegistry {
  private skins = new Map<string, ClockSkin>();

  register(skin: ClockSkin): void {
    this.skins.set(skin.id, skin);
  }

  get(id: string): ClockSkin | undefined {
    return this.skins.get(id);
  }

  list(): ClockSkin[] {
    return Array.from(this.skins.values());
  }

  random(): ClockSkin | undefined {
    const all = this.list();
    if (all.length === 0) return undefined;
    return all[Math.floor(Math.random() * all.length)];
  }

  randomExcept(excludeId: string): ClockSkin | undefined {
    const filtered = this.list().filter(s => s.id !== excludeId);
    if (filtered.length === 0) return this.get(excludeId);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
}

// ─────────────────────────────────────────────────────────────
// Math utilities for clock rendering
// ─────────────────────────────────────────────────────────────

/** Convert degrees to radians */
export const deg2rad = (deg: number): number => deg * (Math.PI / 180);

/** Convert radians to degrees */
export const rad2deg = (rad: number): number => rad * (180 / Math.PI);

/** Full circle in radians */
export const TAU = Math.PI * 2;

/**
 * Convert clock position to angle.
 *
 * @param value Current value (e.g., seconds 0-59)
 * @param max Maximum value (e.g., 60)
 * @param offset Angle offset (-PI/2 to start at 12 o'clock)
 * @returns Angle in radians
 */
export const clockAngle = (value: number, max: number, offset = -Math.PI / 2): number => {
  return (value / max) * TAU + offset;
};

/**
 * Smooth clock angle with interpolation.
 *
 * @param value Current value
 * @param alpha Interpolation factor (0-1)
 * @param max Maximum value
 */
export const smoothClockAngle = (
  value: number,
  alpha: number,
  max: number,
  offset = -Math.PI / 2
): number => {
  return ((value + alpha) / max) * TAU + offset;
};

/**
 * Lerp (linear interpolation).
 */
export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

/**
 * Clamp a value between min and max.
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

/**
 * Ease in-out (smooth start and end).
 */
export const easeInOut = (t: number): number => {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

/**
 * Ease out (smooth end).
 */
export const easeOut = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * Pad number to 2 digits.
 */
export const pad2 = (n: number): string => n.toString().padStart(2, '0');
