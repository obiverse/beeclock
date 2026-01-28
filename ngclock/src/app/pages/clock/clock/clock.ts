import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ClockService } from '../../../core/clock/clock';
import { ClockCanvasComponent } from '../../../core/renderer/clock-canvas';
import { ClockSkin } from '../../../core/renderer/clock-skin';
import { LoaderCanvasComponent } from '../../../core/renderer/loader-canvas';
import { AnimatedLoader, demoLoader } from '../../../core/renderer/animated-loader';
import {
  MinimalistSkin,
  NeonSkin,
  ConwaySkin,
  GenerativeSkin,
} from '../../../core/renderer/skins';

/**
 * ClockComponent: Pure observer + skin playground.
 *
 * The component doesn't tick. The engine ticks.
 * The component observes and renders.
 *
 * Features:
 * - Canvas-based rendering with pluggable skins
 * - Auto-rotation between skins
 * - Manual skin selection
 * - Example loaders demonstrating AnimatedLoader pattern
 */
@Component({
  selector: 'app-clock',
  imports: [CommonModule, ClockCanvasComponent, LoaderCanvasComponent],
  templateUrl: './clock.html',
  styleUrl: './clock.scss',
})
export class ClockComponent {
  private clockService = inject(ClockService);

  /** Reference to the canvas component */
  readonly clockCanvas = viewChild<ClockCanvasComponent>('clockCanvas');

  /** Clock snapshot (from service) */
  readonly snapshot = this.clockService.snapshot;

  /** Interpolation alpha (for smooth animations) */
  readonly alpha = this.clockService.alpha;

  /** Available skins (populated after init) */
  readonly skins = signal<ClockSkin[]>([]);

  /** Current skin name */
  readonly currentSkinName = signal('');

  /** Auto-rotate enabled */
  readonly autoRotate = signal(false);

  /** Rotation interval in seconds */
  readonly rotationInterval = signal(10);

  /** Show debug overlay on canvas */
  readonly showDebug = signal(false);

  /** Example loaders - demonstrating AnimatedLoader pattern */
  readonly exampleLoaders: AnimatedLoader[] = [
    demoLoader(MinimalistSkin, 15),
    demoLoader(NeonSkin, 20),
    demoLoader(ConwaySkin, 30),
    demoLoader(GenerativeSkin, 25),
  ];

  /** Convenience: extract partition values */
  readonly time = computed(() => {
    const snap = this.snapshot();
    if (!snap?.partitions) return { sec: 0, min: 0, hour: 0 };
    const get = (name: string) =>
      snap.partitions.find((p: any) => p.name === name)?.value ?? 0;
    return {
      sec: get('sec'),
      min: get('min'),
      hour: get('hour'),
    };
  });

  /** Smooth second value (discrete + interpolation) */
  readonly smoothSec = computed(() => this.time().sec + this.alpha());

  async ngOnInit() {
    await this.clockService.start();

    // Populate skins list after view init
    setTimeout(() => {
      const canvas = this.clockCanvas();
      if (canvas) {
        this.skins.set(canvas.getSkins());
        this.updateCurrentSkinName();
      }
    }, 0);
  }

  ngOnDestroy() {
    this.clockService.stop();
  }

  /** Select a skin by ID */
  selectSkin(id: string): void {
    const canvas = this.clockCanvas();
    if (canvas) {
      canvas.setSkin(id);
      this.updateCurrentSkinName();
    }
  }

  /** Go to next random skin */
  nextSkin(): void {
    const canvas = this.clockCanvas();
    if (canvas) {
      canvas.nextSkin();
      this.updateCurrentSkinName();
    }
  }

  /** Toggle auto-rotation */
  toggleAutoRotate(): void {
    const canvas = this.clockCanvas();
    if (!canvas) return;

    const newValue = !this.autoRotate();
    this.autoRotate.set(newValue);
    canvas.setRotationInterval(newValue ? this.rotationInterval() : 0);
  }

  /** Update rotation interval */
  setRotationInterval(seconds: number): void {
    this.rotationInterval.set(seconds);
    if (this.autoRotate()) {
      const canvas = this.clockCanvas();
      if (canvas) canvas.setRotationInterval(seconds);
    }
  }

  private updateCurrentSkinName(): void {
    const canvas = this.clockCanvas();
    if (canvas) {
      const current = canvas.currentSkin();
      this.currentSkinName.set(current?.name ?? '');
    }
  }

  /** Toggle debug overlay */
  toggleDebug(): void {
    this.showDebug.set(!this.showDebug());
  }
}
