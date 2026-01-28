import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CanvasRenderer } from './canvas-renderer';
import { ClockState } from './clock-skin';
import { AnimatedLoader, createAnimatedLoader } from './animated-loader';
import { Engine } from '../engine/engine';
import { ClockService } from '../clock/clock';

/**
 * LoaderCanvas: Renders an AnimatedLoader in a canvas.
 *
 * Smaller, self-contained canvas that shows a skin
 * running as a timed loader with progress tracking.
 */
@Component({
  selector: 'loader-canvas',
  standalone: true,
  template: `
    <div class="loader-wrapper">
      <canvas #canvas class="loader-canvas"></canvas>
      <div class="loader-info">
        <span class="loader-name">{{ loaderName() }}</span>
        <span class="loader-status" [class.complete]="isComplete()">
          {{ isComplete() ? 'Complete!' : (progress() * 100).toFixed(0) + '%' }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .loader-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .loader-canvas {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 0.5rem;
    }
    .loader-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .loader-name {
      font-weight: 500;
    }
    .loader-status {
      font-family: 'SF Mono', monospace;
    }
    .loader-status.complete {
      color: #00ff88;
    }
  `],
})
export class LoaderCanvasComponent implements OnInit, OnDestroy {
  private engine = inject(Engine);
  private clockService = inject(ClockService);

  /** Canvas element reference */
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** The animated loader to render */
  @Input() loader!: AnimatedLoader;

  /** Emitted when loader completes */
  @Output() complete = new EventEmitter<void>();

  /** Canvas renderer instance */
  private renderer: CanvasRenderer | null = null;

  /** Animation frame ID */
  private rafId: number | null = null;

  /** Animation time */
  private animationTime = 0;
  private lastFrameTime = 0;

  /** Reactive state */
  readonly loaderName = signal('');
  readonly progress = signal(0);
  readonly isComplete = signal(false);

  ngOnInit(): void {
    setTimeout(() => this.initCanvas(), 0);
  }

  ngOnDestroy(): void {
    this.stopRenderLoop();
  }

  private initCanvas(): void {
    const canvas = this.canvasRef().nativeElement;
    this.renderer = new CanvasRenderer(canvas);

    const resizeObserver = new ResizeObserver(() => {
      this.renderer?.resize();
    });
    resizeObserver.observe(canvas);

    if (this.loader) {
      this.loaderName.set(this.loader.name);
    }

    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    this.lastFrameTime = performance.now();

    const render = (now: DOMHighResTimeStamp) => {
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      this.animationTime += delta / 1000;
      if (this.animationTime > 1) this.animationTime -= 1;

      this.renderFrame();
      this.rafId = requestAnimationFrame(render);
    };

    this.rafId = requestAnimationFrame(render);
  }

  private stopRenderLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private renderFrame(): void {
    const renderer = this.renderer;
    if (!renderer || !this.loader) return;

    const snapshot = this.clockService.snapshot();
    const alpha = this.clockService.alpha();
    const state = this.buildClockState(snapshot, alpha);

    renderer.clear();
    this.loader.render(renderer, state, this.animationTime);

    // Update reactive state
    this.progress.set(this.loader.getProgress());

    if (this.loader.isCompleted() && !this.isComplete()) {
      this.isComplete.set(true);
      this.complete.emit();
    }
  }

  private buildClockState(snapshot: any, alpha: number): ClockState {
    if (!snapshot?.partitions) {
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

  /** Reset the loader */
  reset(): void {
    this.loader?.reset();
    this.isComplete.set(false);
    this.progress.set(0);
  }
}
