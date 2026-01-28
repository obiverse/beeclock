import { signal, Signal } from '@angular/core';
import {
  App,
  AppConfig,
  Engine,
  FrameContext,
  Renderer,
  Scene,
} from './types';
import { CanvasRenderer } from '../renderer/canvas-renderer';

/**
 * createApp: The main entry point for the Bee Framework.
 *
 * Creates a fully-wired app with:
 * - Engine (fixed timestep loop)
 * - Renderer (canvas primitives)
 * - State management (signals)
 * - Scene rendering
 *
 * @example
 * ```typescript
 * const app = createApp({
 *   canvas: '#game-canvas',
 *   initialState: { score: 0, player: { x: 100, y: 100 } },
 *   scene: myGameScene,
 *   tickRateMs: 16, // 60 ticks/sec
 *   onTick: (state, tick) => ({
 *     ...state,
 *     player: updatePhysics(state.player)
 *   })
 * });
 *
 * app.start();
 * ```
 */
export function createApp<S>(config: AppConfig<S>): App<S> {
  // Resolve canvas element
  const canvas = typeof config.canvas === 'string'
    ? document.querySelector<HTMLCanvasElement>(config.canvas)
    : config.canvas;

  if (!canvas) {
    throw new Error(`Canvas not found: ${config.canvas}`);
  }

  // Create renderer
  const renderer = new CanvasRenderer(canvas) as unknown as Renderer;

  // Create engine
  const engine = createEngine();

  // State signal
  const state = signal<S>(config.initialState);

  // Scene signal
  const scene = signal<Scene<S>>(config.scene);

  // Animation tracking
  let animationTime = 0;
  let lastFrameTime = 0;
  let startTime = 0;
  let rafId: number | null = null;
  let lastTick = 0;

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    renderer.resize();
  });
  resizeObserver.observe(canvas);

  /**
   * The main render loop.
   * Runs at display refresh rate (~60fps).
   */
  function renderLoop(now: DOMHighResTimeStamp) {
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    // Update animation time (wraps every second)
    animationTime += delta / 1000;
    if (animationTime > 1) animationTime -= 1;

    // Check for tick changes and update state
    const currentTick = engine.tick();
    if (currentTick !== lastTick && config.onTick) {
      const newState = config.onTick(state(), currentTick);
      state.set(newState);
      lastTick = currentTick;
    }

    // Build frame context
    const frame: FrameContext = {
      tick: currentTick,
      deltaMs: delta,
      alpha: engine.alpha(),
      t: animationTime,
      elapsed: (now - startTime) / 1000,
    };

    // Optional frame callback
    if (config.onFrame) {
      config.onFrame(state(), frame);
    }

    // Render
    renderer.clear();
    scene().render(renderer, state(), frame);

    // Schedule next frame
    rafId = requestAnimationFrame(renderLoop);
  }

  // The app instance
  const app: App<S> = {
    state,
    scene,
    engine,
    renderer,

    start() {
      if (engine.running()) return;

      startTime = performance.now();
      lastFrameTime = startTime;
      lastTick = 0;

      // Notify scene of activation
      const currentScene = scene();
      if (currentScene.onEnter) {
        currentScene.onEnter(state());
      }

      // Start engine
      engine.start(config.tickRateMs ?? 1000);

      // Start render loop
      rafId = requestAnimationFrame(renderLoop);
    },

    stop() {
      engine.stop();

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Notify scene of deactivation
      const currentScene = scene();
      if (currentScene.onExit) {
        currentScene.onExit(state());
      }
    },

    setState(updater: (s: S) => S) {
      state.set(updater(state()));
    },

    setScene(newScene: Scene<S>) {
      const oldScene = scene();

      // Notify old scene
      if (oldScene.onExit) {
        oldScene.onExit(state());
      }

      // Switch
      scene.set(newScene);

      // Notify new scene
      if (newScene.onEnter) {
        newScene.onEnter(state());
      }
    },
  };

  return app;
}

/**
 * Creates a standalone engine (for advanced use).
 *
 * Most apps should use createApp() instead.
 */
export function createEngine(): Engine {
  const tick = signal(0);
  const alpha = signal(0);
  const deltaMs = signal(0);
  const running = signal(false);

  let rafId: number | null = null;
  let lastFrameTime = 0;
  let accumulator = 0;
  let tickCount = 0;
  let tickRateMs = 1000;

  const MAX_TICKS_PER_FRAME = 5;

  function frame(now: DOMHighResTimeStamp) {
    if (!running()) return;

    const delta = now - lastFrameTime;
    lastFrameTime = now;
    accumulator += delta;

    // Fixed timestep with spiral-of-death protection
    let ticksThisFrame = 0;
    while (
      accumulator >= tickRateMs &&
      ticksThisFrame < MAX_TICKS_PER_FRAME
    ) {
      tickCount++;
      accumulator -= tickRateMs;
      ticksThisFrame++;
    }

    // Clamp accumulator if we hit the cap
    if (accumulator > tickRateMs) {
      accumulator = tickRateMs;
    }

    // Update signals
    if (ticksThisFrame > 0) {
      tick.set(tickCount);
    }
    alpha.set(accumulator / tickRateMs);
    deltaMs.set(delta);

    rafId = requestAnimationFrame(frame);
  }

  return {
    tick,
    alpha,
    deltaMs,
    running,

    start(rate = 1000) {
      if (running()) return;

      tickRateMs = rate;
      tickCount = 0;
      accumulator = 0;

      running.set(true);
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    stop() {
      running.set(false);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}

/**
 * Creates a scene registry for managing multiple scenes.
 */
export function createSceneRegistry<S>() {
  const scenes = new Map<string, Scene<S>>();

  return {
    register(scene: Scene<S>) {
      scenes.set(scene.id, scene);
    },

    get(id: string): Scene<S> | undefined {
      return scenes.get(id);
    },

    list(): Scene<S>[] {
      return Array.from(scenes.values());
    },

    random(): Scene<S> | undefined {
      const all = this.list();
      if (all.length === 0) return undefined;
      return all[Math.floor(Math.random() * all.length)];
    },

    randomExcept(excludeId: string): Scene<S> | undefined {
      const filtered = this.list().filter(s => s.id !== excludeId);
      if (filtered.length === 0) return this.get(excludeId);
      return filtered[Math.floor(Math.random() * filtered.length)];
    },
  };
}
