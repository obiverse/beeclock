import { ClockSkin, ClockState } from './clock-skin';
import { CanvasRenderer } from './canvas-renderer';

/**
 * AnimatedLoader: A skin that runs for a fixed duration.
 *
 * The Tao of Loading:
 *   "The loader is not waiting.
 *    The loader is showing time passing.
 *    Each tick, progress. Each frame, beauty."
 *
 * Use Cases:
 *   - App startup animations
 *   - Processing indicators
 *   - Transition effects between views
 *   - Timed demonstrations
 *
 * Architecture:
 *   AnimatedLoader wraps any ClockSkin and adds:
 *   - Duration (in ticks/seconds)
 *   - Progress tracking (0.0 → 1.0)
 *   - Completion callback
 *   - Optional progress bar overlay
 */

export interface LoaderConfig {
  /** The skin to render */
  skin: ClockSkin;

  /** Duration in ticks (1 tick = 1 second by default) */
  durationTicks: number;

  /** Called when loader completes */
  onComplete?: () => void;

  /** Called each tick with progress (0-1) */
  onProgress?: (progress: number) => void;

  /** Show progress bar overlay */
  showProgress?: boolean;

  /** Progress bar position */
  progressPosition?: 'top' | 'bottom';

  /** Progress bar color */
  progressColor?: string;

  /** Auto-restart when complete */
  loop?: boolean;
}

export interface LoaderState {
  startTick: number;
  currentTick: number;
  progress: number;
  completed: boolean;
  running: boolean;
}

/**
 * Create an animated loader from a skin.
 */
export function createAnimatedLoader(config: LoaderConfig): AnimatedLoader {
  return new AnimatedLoader(config);
}

/**
 * AnimatedLoader class - wraps a skin with duration tracking.
 */
export class AnimatedLoader implements ClockSkin {
  readonly id: string;
  readonly name: string;

  private config: Required<LoaderConfig>;
  private state: LoaderState = {
    startTick: -1,
    currentTick: 0,
    progress: 0,
    completed: false,
    running: false,
  };

  constructor(config: LoaderConfig) {
    this.config = {
      skin: config.skin,
      durationTicks: config.durationTicks,
      onComplete: config.onComplete ?? (() => {}),
      onProgress: config.onProgress ?? (() => {}),
      showProgress: config.showProgress ?? true,
      progressPosition: config.progressPosition ?? 'bottom',
      progressColor: config.progressColor ?? 'rgba(0, 255, 200, 0.8)',
      loop: config.loop ?? false,
    };

    this.id = `loader-${config.skin.id}`;
    this.name = `${config.skin.name} (Loader)`;
  }

  /**
   * Start the loader from current tick.
   */
  start(currentTick: number): void {
    this.state = {
      startTick: currentTick,
      currentTick,
      progress: 0,
      completed: false,
      running: true,
    };
  }

  /**
   * Stop the loader.
   */
  stop(): void {
    this.state.running = false;
  }

  /**
   * Reset the loader.
   */
  reset(): void {
    this.state = {
      startTick: -1,
      currentTick: 0,
      progress: 0,
      completed: false,
      running: false,
    };
  }

  /**
   * Get current progress (0-1).
   */
  getProgress(): number {
    return this.state.progress;
  }

  /**
   * Check if loader has completed.
   */
  isCompleted(): boolean {
    return this.state.completed;
  }

  /**
   * Check if loader is running.
   */
  isRunning(): boolean {
    return this.state.running;
  }

  /**
   * Render the loader.
   */
  render(r: CanvasRenderer, clockState: ClockState, t: number): void {
    // Auto-start on first render
    if (this.state.startTick === -1) {
      this.start(clockState.tick);
    }

    // Update progress on tick change
    if (clockState.tick !== this.state.currentTick && this.state.running) {
      this.state.currentTick = clockState.tick;

      const elapsed = clockState.tick - this.state.startTick;
      this.state.progress = Math.min(1, elapsed / this.config.durationTicks);

      // Notify progress
      this.config.onProgress(this.state.progress);

      // Check completion
      if (this.state.progress >= 1 && !this.state.completed) {
        this.state.completed = true;
        this.config.onComplete();

        // Loop if configured
        if (this.config.loop) {
          this.start(clockState.tick);
        } else {
          this.state.running = false;
        }
      }
    }

    // Render the underlying skin
    this.config.skin.render(r, clockState, t);

    // Render progress overlay
    if (this.config.showProgress && this.state.running) {
      this.renderProgressBar(r, clockState);
    }
  }

  /**
   * Render progress bar overlay.
   */
  private renderProgressBar(r: CanvasRenderer, clockState: ClockState): void {
    const { width, height } = r;
    const barHeight = 4;
    const padding = 20;

    // Smooth progress with alpha interpolation
    const smoothProgress = Math.min(
      1,
      this.state.progress + clockState.alpha / this.config.durationTicks
    );

    const barWidth = width - padding * 2;
    const y = this.config.progressPosition === 'top'
      ? padding
      : height - padding - barHeight;

    // Background track
    r.roundRect(padding, y, barWidth, barHeight, barHeight / 2, {
      fill: 'rgba(255, 255, 255, 0.1)',
    });

    // Progress fill
    if (smoothProgress > 0) {
      r.roundRect(padding, y, barWidth * smoothProgress, barHeight, barHeight / 2, {
        fill: this.config.progressColor,
      });
    }

    // Time remaining (subtle)
    const remaining = Math.ceil(
      (1 - this.state.progress) * this.config.durationTicks
    );
    if (remaining > 0) {
      r.text(`${remaining}s`, width - padding, y - 8, {
        font: '10px system-ui',
        fill: 'rgba(255, 255, 255, 0.4)',
        align: 'right',
        baseline: 'bottom',
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Functions for Common Patterns
// ─────────────────────────────────────────────────────────────

/**
 * Create a simple timed loader.
 */
export function timedLoader(
  skin: ClockSkin,
  seconds: number,
  onComplete?: () => void
): AnimatedLoader {
  return createAnimatedLoader({
    skin,
    durationTicks: seconds,
    onComplete,
    showProgress: true,
  });
}

/**
 * Create a looping demo loader.
 */
export function demoLoader(skin: ClockSkin, seconds: number): AnimatedLoader {
  return createAnimatedLoader({
    skin,
    durationTicks: seconds,
    loop: true,
    showProgress: true,
    progressPosition: 'top',
  });
}

/**
 * Create a progress-reporting loader.
 */
export function progressLoader(
  skin: ClockSkin,
  seconds: number,
  onProgress: (progress: number) => void
): AnimatedLoader {
  return createAnimatedLoader({
    skin,
    durationTicks: seconds,
    onProgress,
    showProgress: true,
  });
}
