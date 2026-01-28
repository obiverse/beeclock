/**
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2024-2025 Obiverse LLC
 *
 * Fixed-timestep game loop engine for Angular applications.
 * Implements Glenn Fiedler's "Fix Your Timestep" pattern.
 */

import { inject, Injectable, NgZone, signal } from '@angular/core';

/**
 * The Engine: A fixed-timestep game loop for Angular.
 *
 * Architecture:
 *   RAF (60fps) → accumulator → fixed ticks → signals
 *
 * Invariants:
 *   - Logic runs in discrete, deterministic steps (tick)
 *   - Rendering interpolates between steps (alpha)
 *   - No memory growth, no drift, infinite runtime safe
 *   - Angular CD only fires on tick change
 *
 * This is the canonical "Fix Your Timestep" pattern (Glenn Fiedler).
 */
@Injectable({
  providedIn: 'root',
})
export class Engine {
  private zone = inject(NgZone);

  /** Current tick count (increments at tickRate) */
  readonly tick = signal(0);

  /**
   * Interpolation factor 0.0 → 1.0 (updates every frame).
   * Use for smooth visuals between discrete ticks.
   * Read from canvas/animation code, not Angular templates.
   */
  readonly alpha = signal(0);

  /**
   * Delta time in ms since last frame.
   * Use for frame-rate-independent animations.
   * Read from canvas/animation code, not Angular templates.
   */
  readonly deltaMs = signal(0);

  /** Is the engine running? */
  readonly running = signal(false);

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private accumulator = 0;
  private tickCount = 0;
  private tickRateMs = 1000;

  /**
   * Maximum ticks per frame to prevent "spiral of death".
   * If tab sleeps for 10 seconds at 1Hz, we'd have 10 ticks queued.
   * Cap prevents CPU spike on wake.
   */
  private readonly MAX_TICKS_PER_FRAME = 5;

  /**
   * Start the engine loop.
   * @param tickRateMs Fixed timestep interval in milliseconds (default 1000ms, must be > 0)
   * @throws {Error} If tickRateMs is not a positive finite number
   */
  start(tickRateMs = 1000) {
    if (this.running()) return;

    if (typeof tickRateMs !== 'number' || tickRateMs <= 0 || !Number.isFinite(tickRateMs)) {
      throw new Error(`tickRateMs must be a positive finite number, got: ${tickRateMs}`);
    }

    this.tickRateMs = tickRateMs;
    this.tickCount = 0;
    this.accumulator = 0;

    this.zone.runOutsideAngular(() => {
      this.running.set(true);
      this.lastFrameTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    });
  }

  /** Stop the engine loop */
  stop() {
    this.running.set(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * The frame callback. Runs at display refresh rate (~60fps).
   *
   * Fixed-step logic ticks are decoupled from render rate:
   *   - accumulator collects real elapsed time
   *   - while loop drains accumulator in fixed chunks
   *   - alpha = leftover / tickRate (for interpolation)
   */
  private frame = (now: DOMHighResTimeStamp) => {
    if (!this.running()) return;

    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.accumulator += delta;

    // Fixed timestep with spiral-of-death protection
    let ticksThisFrame = 0;
    while (
      this.accumulator >= this.tickRateMs &&
      ticksThisFrame < this.MAX_TICKS_PER_FRAME
    ) {
      this.tickCount++;
      this.accumulator -= this.tickRateMs;
      ticksThisFrame++;
    }

    // Clamp accumulator if we hit the cap (drop excess time)
    if (this.accumulator > this.tickRateMs) {
      this.accumulator = this.tickRateMs;
    }

    // Only enter Angular zone when tick changes
    if (ticksThisFrame > 0) {
      this.zone.run(() => {
        this.tick.set(this.tickCount);
      });
    }

    // Alpha updates every frame (outside Angular zone for performance)
    // These are for canvas/animation code, not Angular templates
    const alpha = this.accumulator / this.tickRateMs;
    this.alpha.set(alpha);
    this.deltaMs.set(delta);

    this.rafId = requestAnimationFrame(this.frame);
  };
}
