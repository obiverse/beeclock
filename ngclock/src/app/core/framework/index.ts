/**
 * Bee Framework
 *
 * A minimal, efficient rendering framework for modern web apps.
 *
 * @example
 * ```typescript
 * import { createApp, Scene, FrameContext, Renderer } from './framework';
 *
 * interface GameState {
 *   player: { x: number; y: number };
 *   score: number;
 * }
 *
 * const gameScene: Scene<GameState> = {
 *   id: 'game',
 *   name: 'Main Game',
 *   render(r, state, frame) {
 *     r.clear('#1a1a2e');
 *     r.circle(state.player.x, state.player.y, 20, { fill: '#00ff88' });
 *   }
 * };
 *
 * const app = createApp({
 *   canvas: '#canvas',
 *   initialState: { player: { x: 100, y: 100 }, score: 0 },
 *   scene: gameScene,
 *   tickRateMs: 16, // 60Hz
 * });
 *
 * app.start();
 * ```
 */

// Core types
export type {
  Renderer,
  Scene,
  FrameContext,
  Engine,
  App,
  AppConfig,
  SceneRegistry,
  InputState,
  Vec2,
  Rect,
  Color,
  StrokeOpts,
  ShapeOpts,
  TextOpts,
  EngineConfig,
} from './types';

// Math utilities
export {
  TAU,
  PI,
  deg2rad,
  rad2deg,
  lerp,
  clamp,
  easeInOut,
  easeOut,
  distance,
  normalize,
} from './types';

// Factory functions
export {
  createApp,
  createEngine,
  createSceneRegistry,
} from './create-app';

// Re-export the canvas renderer for direct use
export { CanvasRenderer } from '../renderer/canvas-renderer';
