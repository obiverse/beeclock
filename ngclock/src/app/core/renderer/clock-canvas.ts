import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CanvasRenderer } from './canvas-renderer';
import { ClockSkin, ClockState, SkinRegistry, pad2 } from './clock-skin';
import { createSkinRegistry, DEFAULT_SKIN_ID } from './skins';
import { Engine } from '../engine/engine';
import { ClockService } from '../clock/clock';

/**
 * ClockCanvas: The magical clock renderer.
 *
 * Architecture:
 *   Engine (60fps) → ClockService (1Hz ticks) → ClockCanvas (render)
 *
 * Features:
 * - Pluggable skins via SkinRegistry
 * - Auto skin rotation with configurable interval
 * - Smooth 60fps rendering with interpolation
 * - HiDPI support via CanvasRenderer
 *
 * The Tao of Rendering:
 *   "The canvas is empty. The skin fills it.
 *    The engine ticks. The clock observes.
 *    All is flow."
 */
@Component({
  selector: 'clock-canvas',
  standalone: true,
  template: `
    <canvas #canvas class="clock-canvas"></canvas>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .clock-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `],
})
export class ClockCanvasComponent implements OnInit, OnDestroy {
  private engine = inject(Engine);
  private clockService = inject(ClockService);

  /** Canvas element reference */
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Skin registry (all available skins) */
  private registry: SkinRegistry = createSkinRegistry();

  /** Current active skin */
  readonly currentSkin = signal<ClockSkin | null>(null);

  /** Skin ID (for external control) */
  @Input() set skinId(id: string) {
    const skin = this.registry.get(id);
    if (skin) this.currentSkin.set(skin);
  }

  /** Auto-rotate skins (interval in seconds, 0 = disabled) */
  @Input() rotateInterval = 0;

  /** Show debug overlay */
  @Input() showDebug = false;

  /** Canvas renderer instance */
  private renderer: CanvasRenderer | null = null;

  /** FPS tracking */
  private frameCount = 0;
  private fpsUpdateTime = 0;
  private currentFps = 0;

  /** Animation frame ID for render loop */
  private rafId: number | null = null;

  /** Rotation timer ID */
  private rotationTimer: ReturnType<typeof setInterval> | null = null;

  /** Resize observer for responsive canvas */
  private resizeObserver: ResizeObserver | null = null;
  private resizeRaf: number | null = null;

  /** Normalized time for animations (0-1, wraps every second) */
  private animationTime = 0;

  /** Last frame timestamp for delta calculation */
  private lastFrameTime = 0;

  constructor() {
    // Initialize with default skin
    const defaultSkin = this.registry.get(DEFAULT_SKIN_ID);
    if (defaultSkin) this.currentSkin.set(defaultSkin);
  }

  ngOnInit(): void {
    // Wait for view to be ready
    setTimeout(() => this.initCanvas(), 0);
  }

  ngOnDestroy(): void {
    this.stopRenderLoop();
    this.stopRotation();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeRaf !== null) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
  }

  /**
   * Initialize canvas and start rendering.
   */
  private initCanvas(): void {
    const canvas = this.canvasRef().nativeElement;
    this.renderer = new CanvasRenderer(canvas);

    // Handle resize
    const target = canvas.parentElement ?? canvas;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleResize();
    });
    this.resizeObserver.observe(target);

    // Start render loop
    this.startRenderLoop();

    // Start rotation if configured
    if (this.rotateInterval > 0) {
      this.startRotation();
    }
  }

  /**
   * Start the 60fps render loop.
   *
   * This runs outside Angular's zone for performance.
   * The loop reads from Engine.alpha() for smooth interpolation.
   */
  private startRenderLoop(): void {
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = this.lastFrameTime;

    const render = (now: DOMHighResTimeStamp) => {
      // Calculate delta time
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // FPS tracking (update every 500ms)
      this.frameCount++;
      if (now - this.fpsUpdateTime >= 500) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsUpdateTime));
        this.frameCount = 0;
        this.fpsUpdateTime = now;
      }

      // Update animation time (wraps every second)
      this.animationTime += delta / 1000;
      if (this.animationTime > 1) this.animationTime -= 1;

      // Render current frame
      this.renderFrame();

      // Schedule next frame
      this.rafId = requestAnimationFrame(render);
    };

    this.rafId = requestAnimationFrame(render);
  }

  /**
   * Stop the render loop.
   */
  private stopRenderLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleResize(): void {
    if (this.resizeRaf !== null) {
      return;
    }
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.renderer?.resize();
    });
  }

  /**
   * Render a single frame.
   */
  private renderFrame(): void {
    const renderer = this.renderer;
    const skin = this.currentSkin();
    if (!renderer || !skin) return;

    // Build clock state from service
    const snapshot = this.clockService.snapshot();
    const alpha = this.clockService.alpha();

    const state = this.buildClockState(snapshot, alpha);

    // Clear and render
    renderer.clear();
    skin.render(renderer, state, this.animationTime);

    // Render debug overlay if enabled
    if (this.showDebug) {
      this.renderDebugOverlay(renderer, state, skin);
    }
  }

  /**
   * Render beautiful debug overlay with grid layout.
   */
  private renderDebugOverlay(r: CanvasRenderer, state: ClockState, skin: ClockSkin): void {
    const { width, height } = r;
    const padding = 12;
    const lineHeight = 18;
    const cellWidth = 90;

    // Semi-transparent panel background
    const panelHeight = lineHeight * 5 + padding * 2;
    const panelY = height - panelHeight - padding;

    r.save();
    r.alpha = 0.85;
    r.roundRect(padding, panelY, width - padding * 2, panelHeight, 8, {
      fill: 'rgba(0, 0, 0, 0.7)',
    });
    r.alpha = 1;

    // Grid layout for debug info
    const startY = panelY + padding + lineHeight * 0.7;
    const col1 = padding + 12;
    const col2 = col1 + cellWidth;
    const col3 = col2 + cellWidth;
    const col4 = col3 + cellWidth + 20;

    // Row 1: Time values
    this.debugLabel(r, col1, startY, 'HOUR');
    this.debugValue(r, col1, startY + lineHeight, pad2(state.hour));

    this.debugLabel(r, col2, startY, 'MIN');
    this.debugValue(r, col2, startY + lineHeight, pad2(state.min));

    this.debugLabel(r, col3, startY, 'SEC');
    this.debugValue(r, col3, startY + lineHeight, pad2(state.sec));

    // Row 2: Engine values
    const row2Y = startY + lineHeight * 2.5;

    this.debugLabel(r, col1, row2Y, 'ALPHA');
    this.debugValue(r, col1, row2Y + lineHeight, state.alpha.toFixed(3));

    this.debugLabel(r, col2, row2Y, 'TICK');
    this.debugValue(r, col2, row2Y + lineHeight, state.tick.toString());

    this.debugLabel(r, col3, row2Y, 'FPS');
    this.debugValue(r, col3, row2Y + lineHeight, this.currentFps.toString(), this.getFpsColor());

    // Skin name (right side)
    this.debugLabel(r, col4, startY, 'SKIN');
    this.debugValue(r, col4, startY + lineHeight, skin.name, '#00ffcc');

    // Alpha progress bar
    const barY = row2Y + lineHeight + 4;
    const barWidth = width - padding * 2 - 24;
    const barHeight = 4;

    r.roundRect(col1, barY, barWidth, barHeight, 2, {
      fill: 'rgba(255, 255, 255, 0.1)',
    });
    r.roundRect(col1, barY, barWidth * state.alpha, barHeight, 2, {
      fill: 'rgba(0, 255, 200, 0.6)',
    });

    r.restore();
  }

  private debugLabel(r: CanvasRenderer, x: number, y: number, text: string): void {
    r.text(text, x, y, {
      font: '10px system-ui',
      fill: 'rgba(255, 255, 255, 0.5)',
      align: 'left',
      baseline: 'middle',
    });
  }

  private debugValue(r: CanvasRenderer, x: number, y: number, text: string, color = '#fff'): void {
    r.text(text, x, y, {
      font: 'bold 14px "SF Mono", monospace',
      fill: color,
      align: 'left',
      baseline: 'middle',
    });
  }

  private getFpsColor(): string {
    if (this.currentFps >= 55) return '#00ff88';
    if (this.currentFps >= 30) return '#ffcc00';
    return '#ff4444';
  }

  /**
   * Build ClockState from service snapshot.
   */
  private buildClockState(snapshot: any, alpha: number): ClockState {
    if (!snapshot?.partitions) {
      // Default state if not ready
      const now = new Date();
      return {
        hour: now.getHours(),
        min: now.getMinutes(),
        sec: now.getSeconds(),
        alpha: 0,
        tick: 0,
      };
    }

    const get = (name: string) =>
      snapshot.partitions.find((p: any) => p.name === name)?.value ?? 0;

    return {
      hour: get('hour'),
      min: get('min'),
      sec: get('sec'),
      alpha,
      tick: this.engine.tick(),
    };
  }

  /**
   * Start auto-rotation of skins.
   */
  private startRotation(): void {
    this.stopRotation();
    this.rotationTimer = setInterval(() => {
      this.nextSkin();
    }, this.rotateInterval * 1000);
  }

  /**
   * Stop auto-rotation.
   */
  private stopRotation(): void {
    if (this.rotationTimer !== null) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  /**
   * Switch to next random skin (excluding current).
   */
  nextSkin(): void {
    const current = this.currentSkin();
    const next = current
      ? this.registry.randomExcept(current.id)
      : this.registry.random();
    if (next) this.currentSkin.set(next);
  }

  /**
   * Switch to a specific skin by ID.
   */
  setSkin(id: string): void {
    const skin = this.registry.get(id);
    if (skin) this.currentSkin.set(skin);
  }

  /**
   * Get all available skins.
   */
  getSkins(): ClockSkin[] {
    return this.registry.list();
  }

  /**
   * Update rotation interval.
   */
  setRotationInterval(seconds: number): void {
    this.rotateInterval = seconds;
    if (seconds > 0) {
      this.startRotation();
    } else {
      this.stopRotation();
    }
  }
}
