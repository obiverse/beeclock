/**
 * Bee Framework - Core Types
 *
 * The minimal set of types needed for tick-driven rendering.
 */

import { Signal } from '@angular/core';

// ─────────────────────────────────────────────────────────────
// Renderer Types
// ─────────────────────────────────────────────────────────────

export interface StrokeOpts {
  stroke?: string;
  width?: number;
  cap?: CanvasLineCap;
}

export interface ShapeOpts extends StrokeOpts {
  fill?: string | CanvasGradient;
}

export interface TextOpts {
  font?: string;
  fill?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

/**
 * Renderer: Drawing primitives for canvas.
 *
 * This is the "pen" your scenes draw with.
 * Immediate mode - call methods, pixels appear.
 */
export interface Renderer {
  // Dimensions
  readonly width: number;
  readonly height: number;
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly radius: number;

  // Lifecycle
  resize(): void;
  clear(color?: string): void;

  // Transform stack
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(factor: number): void;

  // Primitives
  circle(x: number, y: number, r: number, opts?: ShapeOpts): void;
  rect(x: number, y: number, w: number, h: number, opts?: ShapeOpts): void;
  roundRect(x: number, y: number, w: number, h: number, r: number, opts?: ShapeOpts): void;
  line(x1: number, y1: number, x2: number, y2: number, opts?: StrokeOpts): void;
  arc(x: number, y: number, r: number, start: number, end: number, opts?: StrokeOpts): void;
  text(text: string, x: number, y: number, opts?: TextOpts): void;

  // Gradients
  radialGradient(x: number, y: number, r1: number, r2: number, stops: [number, string][]): CanvasGradient;
  linearGradient(x1: number, y1: number, x2: number, y2: number, stops: [number, string][]): CanvasGradient;

  // Effects
  set alpha(value: number);
  set blendMode(mode: GlobalCompositeOperation);
  shadow(color: string, blur: number, offsetX?: number, offsetY?: number): void;
  clearShadow(): void;

  // Raw access (escape hatch)
  readonly raw: CanvasRenderingContext2D;
}

// ─────────────────────────────────────────────────────────────
// Scene Types
// ─────────────────────────────────────────────────────────────

/**
 * FrameContext: What the scene knows about the current frame.
 */
export interface FrameContext {
  /** Current tick count */
  tick: number;

  /** Time since last frame (ms) */
  deltaMs: number;

  /** Interpolation factor (0-1) for smooth animations */
  alpha: number;

  /** Normalized animation time (0-1, wraps every second) */
  t: number;

  /** Total elapsed time (seconds) */
  elapsed: number;
}

/**
 * Scene: A pure render function with identity.
 *
 * Scenes are stateless - all state comes from your app state.
 * Think of them as "views" of your data.
 *
 * @template S Your app's state type
 */
export interface Scene<S = unknown> {
  /** Unique identifier */
  readonly id: string;

  /** Display name */
  readonly name: string;

  /**
   * Render one frame.
   *
   * This is called ~60 times per second.
   * Keep it fast - no allocations, no async, no side effects.
   *
   * @param r The renderer to draw with
   * @param state Your current app state
   * @param frame Frame timing context
   */
  render(r: Renderer, state: S, frame: FrameContext): void;

  /**
   * Optional: Called when scene becomes active.
   */
  onEnter?(state: S): void;

  /**
   * Optional: Called when scene becomes inactive.
   */
  onExit?(state: S): void;
}

// ─────────────────────────────────────────────────────────────
// Engine Types
// ─────────────────────────────────────────────────────────────

/**
 * EngineConfig: How the engine runs.
 */
export interface EngineConfig {
  /** Ticks per second (default: 60 for games, 1 for clocks) */
  tickRate?: number;

  /** Max ticks per frame to prevent spiral of death (default: 5) */
  maxTicksPerFrame?: number;
}

/**
 * Engine: The heartbeat of your app.
 *
 * Provides:
 * - Fixed timestep ticks (deterministic)
 * - Frame delta time (for physics)
 * - Alpha interpolation (for smooth rendering)
 */
export interface Engine {
  /** Current tick count (increments at tickRate) */
  readonly tick: Signal<number>;

  /** Interpolation factor 0-1 */
  readonly alpha: Signal<number>;

  /** Delta time in ms since last frame */
  readonly deltaMs: Signal<number>;

  /** Is the engine running? */
  readonly running: Signal<boolean>;

  /** Start the engine */
  start(tickRateMs?: number): void;

  /** Stop the engine */
  stop(): void;
}

// ─────────────────────────────────────────────────────────────
// App Types
// ─────────────────────────────────────────────────────────────

/**
 * AppConfig: Configuration for creating an app.
 *
 * @template S Your app's state type
 */
export interface AppConfig<S> {
  /** Canvas element or selector */
  canvas: HTMLCanvasElement | string;

  /** Initial state */
  initialState: S;

  /** Initial scene */
  scene: Scene<S>;

  /** Tick rate in ms (default: 1000 for 1Hz, use 16 for 60Hz) */
  tickRateMs?: number;

  /** Called each tick to update state */
  onTick?: (state: S, tick: number) => S;

  /** Called on each render frame */
  onFrame?: (state: S, frame: FrameContext) => void;
}

/**
 * App: A running application instance.
 *
 * @template S Your app's state type
 */
export interface App<S> {
  /** Current state (reactive) */
  readonly state: Signal<S>;

  /** Current scene */
  readonly scene: Signal<Scene<S>>;

  /** The engine */
  readonly engine: Engine;

  /** The renderer */
  readonly renderer: Renderer;

  /** Start the app */
  start(): void;

  /** Stop the app */
  stop(): void;

  /** Update state */
  setState(updater: (state: S) => S): void;

  /** Switch to a different scene */
  setScene(scene: Scene<S>): void;
}

// ─────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────

/**
 * SceneRegistry: Manages available scenes.
 */
export interface SceneRegistry<S> {
  register(scene: Scene<S>): void;
  get(id: string): Scene<S> | undefined;
  list(): Scene<S>[];
  random(): Scene<S> | undefined;
}

/**
 * InputState: Common input handling.
 */
export interface InputState {
  mouse: { x: number; y: number; down: boolean };
  keys: Set<string>;
  touches: Array<{ x: number; y: number; id: number }>;
}

/**
 * Vec2: Simple 2D vector.
 */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Rect: Simple rectangle.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Color: Color utilities.
 */
export type Color = string | CanvasGradient;

// ─────────────────────────────────────────────────────────────
// Math Constants
// ─────────────────────────────────────────────────────────────

/** Full circle in radians */
export const TAU = Math.PI * 2;

/** Half circle in radians */
export const PI = Math.PI;

/** Degrees to radians */
export const deg2rad = (deg: number): number => deg * (PI / 180);

/** Radians to degrees */
export const rad2deg = (rad: number): number => rad * (180 / PI);

/** Linear interpolation */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Clamp value between min and max */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Ease in-out (smooth start and end) */
export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Ease out (smooth end) */
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Distance between two points */
export const distance = (x1: number, y1: number, x2: number, y2: number): number =>
  Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

/** Normalize a vector */
export const normalize = (x: number, y: number): Vec2 => {
  const len = Math.sqrt(x * x + y * y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
};
