/**
 * BeeApp: The main Bee Framework application component.
 *
 * Features:
 * - Dual canvas (2D + 3D) with split view
 * - Responsive layout with proper zones
 * - WASM clock integration
 * - Keyboard/mouse input handling
 */

import {
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';
import { Wasm, WASM_PATH } from './core/wasm/wasm';
import { CanvasRenderer } from './core/renderer/canvas-renderer';
import { ThreeRenderer } from './core/renderer/three-renderer';
import {
  AppState,
  createAppState,
  SceneId,
  ViewMode,
  NAV_ITEMS,
} from './core/framework/scenes';
import { FrameContext } from './core/framework';
import {
  calculateLayout,
  LayoutZones,
  isInViewport,
  normalizeInViewport,
  getNavHeight,
  renderPanelFrame,
} from './core/framework/scenes/layout';
import {
  render2DScene,
  render3DScene,
  renderNavAndFooter,
  spawnHitParticles,
  spawnSpeedLines,
} from './scenes';
import {
  updateEmergentSystem,
  evolvePopulation,
  injectCAPattern,
} from './core/framework/emergent';
import { createEmergentState } from './core/framework/scenes';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div class="app-container" (window:resize)="onResize()">
      <canvas
        #canvas2d
        class="canvas-2d"
        (mousemove)="onMouseMove($event)"
        (mousedown)="onMouseDown($event)"
        (mouseup)="onMouseUp($event)"
        (click)="onClick($event)"
      ></canvas>
      <canvas
        #canvas3d
        class="canvas-3d"
      ></canvas>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #0a0a12;
    }
    .app-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .canvas-2d {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
    }
    .canvas-3d {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }
  `],
})
export class BeeApp implements OnInit, OnDestroy {
  private readonly canvas2d = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas2d');
  private readonly canvas3d = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas3d');
  private readonly zone = inject(NgZone);
  private readonly wasm = inject(Wasm);

  private renderer2d!: CanvasRenderer;
  private renderer3d: ThreeRenderer | null = null;
  private clock: any = null;
  private state: AppState = createAppState();
  private layout: LayoutZones = calculateLayout(800, 600, 'split');
  private resizeObserver: ResizeObserver | null = null;
  private resizeRaf: number | null = null;

  // Engine state
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private accumulator = 0;
  private tickCount = 0;
  private readonly tickRateMs = 1000;

  // Frame context
  private animationTime = 0;
  private startTime = 0;

  async ngOnInit() {
    // Initialize 2D renderer
    const canvas2dEl = this.canvas2d().nativeElement;
    this.renderer2d = new CanvasRenderer(canvas2dEl);

    // Initialize 3D renderer (optional - may fail if WebGL unavailable)
    const canvas3dEl = this.canvas3d().nativeElement;
    try {
      this.renderer3d = new ThreeRenderer({ canvas: canvas3dEl });
    } catch (e) {
      console.warn('WebGL not available, 3D rendering disabled:', e);
      this.renderer3d = null;
      // Force 2D-only mode if WebGL fails
      this.state.viewMode = '2d';
    }

    // Initial layout
    this.updateLayout();

    // Handle resize
    const target = canvas2dEl.parentElement ?? canvas2dEl;
    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleResize();
    });
    this.resizeObserver.observe(target);

    // Initialize WASM clock
    await this.initClock();

    // Add keyboard listeners
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Start render loop
    this.zone.runOutsideAngular(() => {
      this.startTime = performance.now();
      this.lastFrameTime = this.startTime;
      this.rafId = requestAnimationFrame(this.renderLoop);
    });
  }

  ngOnDestroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeRaf !== null) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
    this.renderer3d?.dispose();
  }

  private updateLayout(): void {
    this.state.canvasWidth = this.renderer2d.width;
    this.state.canvasHeight = this.renderer2d.height;
    this.layout = calculateLayout(
      this.state.canvasWidth,
      this.state.canvasHeight,
      this.state.viewMode
    );
  }

  onResize(): void {
    this.scheduleResize();
  }

  private scheduleResize(): void {
    if (this.resizeRaf !== null) {
      return;
    }
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.renderer2d.resize();
      this.renderer3d?.resize();
      this.updateLayout();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WASM Clock
  // ─────────────────────────────────────────────────────────────

  private async initClock() {
    await this.wasm.waitUntilReady();
    const { WasmClockBuilder } = await import(/* @vite-ignore */ WASM_PATH);

    const builder = new WasmClockBuilder();
    builder.set_partition_order('lsf');
    builder.partition('sec', 60n);
    builder.partition('min', 60n);
    builder.partition('hour', 24n);
    this.clock = builder.build();

    this.updateClockState();
  }

  private updateClockState() {
    if (!this.clock) return;

    const snapshot = this.clock.snapshot();
    const get = (name: string) =>
      snapshot.partitions.find((p: any) => p.name === name)?.value ?? 0;

    this.state.clock = {
      sec: get('sec'),
      min: get('min'),
      hour: get('hour'),
      tick: this.tickCount,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Render Loop
  // ─────────────────────────────────────────────────────────────

  private renderLoop = (now: DOMHighResTimeStamp) => {
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.accumulator += delta;

    // Fixed timestep updates
    let ticksThisFrame = 0;
    const maxTicks = 5;

    while (this.accumulator >= this.tickRateMs && ticksThisFrame < maxTicks) {
      if (this.clock) {
        this.clock.tick();
        this.tickCount++;
        this.updateClockState();
      }
      this.accumulator -= this.tickRateMs;
      ticksThisFrame++;
    }

    if (this.accumulator > this.tickRateMs) {
      this.accumulator = this.tickRateMs;
    }

    // Animation time
    this.animationTime += delta / 1000;
    if (this.animationTime > 1) this.animationTime -= 1;

    // Update fighter state machine
    if (this.state.currentScene === 'fighter') {
      this.updateFighterState(delta);
    }

    // Update emergent systems (Studio scene)
    if (this.state.currentScene === 'studio') {
      const worldWidth = this.layout.left.width || 800;
      const worldHeight = this.layout.left.height || 600;
      updateEmergentSystem(this.state.emergent, delta, worldWidth, worldHeight);
    }

    // Build frame context
    const frame: FrameContext = {
      tick: this.tickCount,
      deltaMs: delta,
      alpha: this.accumulator / this.tickRateMs,
      t: this.animationTime,
      elapsed: (now - this.startTime) / 1000,
    };

    // Clear both canvases
    this.renderer2d.clear();
    this.renderer2d.fill('#0a0a12');

    // Render nav and footer (always on 2D canvas)
    renderNavAndFooter(this.renderer2d, this.state, this.layout);

    // Render 2D content
    if (this.state.viewMode !== '3d' && this.layout.left.width > 0) {
      render2DScene(this.renderer2d, this.state, frame, this.layout.left);
    }

    // Render 3D content (only if WebGL available)
    if (this.renderer3d && this.state.viewMode !== '2d' && this.layout.right.width > 0) {
      // Set viewport for 3D rendering
      this.renderer3d.setViewport(
        this.layout.right.x,
        this.layout.right.y,
        this.layout.right.width,
        this.layout.right.height
      );
      render3DScene(this.renderer3d, this.state, frame);
      this.renderer3d.resetViewport();

      // Clear the 3D viewport area on the 2D canvas so 3D shows through
      this.renderer2d.clearRect(
        this.layout.right.x,
        this.layout.right.y,
        this.layout.right.width,
        this.layout.right.height
      );

      // Draw 3D panel frame on 2D canvas (border and label only, no background)
      const ctx = this.renderer2d.raw;
      renderPanelFrame(ctx, this.layout.right, '3D WebGL', this.state.viewMode === '3d', { skipBackground: true });
    }

    // Schedule next frame
    this.rafId = requestAnimationFrame(this.renderLoop);
  };

  // ─────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────

  onMouseMove(e: MouseEvent) {
    const rect = this.canvas2d().nativeElement.getBoundingClientRect();
    this.state.mouse.x = e.clientX - rect.left;
    this.state.mouse.y = e.clientY - rect.top;

    // Update normalized mouse for 3D camera
    if (this.layout.right.width > 0 && isInViewport(this.state.mouse.x, this.state.mouse.y, this.layout.right)) {
      const norm = normalizeInViewport(this.state.mouse.x, this.state.mouse.y, this.layout.right);
      this.state.mouseNorm = norm;
    }

    // Check nav hover
    this.state.hoveredNav = this.getNavItemAt(this.state.mouse.x, this.state.mouse.y);

    // Update cursor
    const canvas = this.canvas2d().nativeElement;
    canvas.style.cursor = this.state.hoveredNav ? 'pointer' : 'default';
  }

  onMouseDown(e: MouseEvent) {
    this.state.mouse.down = true;
  }

  onMouseUp(e: MouseEvent) {
    this.state.mouse.down = false;
  }

  onClick(e: MouseEvent) {
    if (this.state.hoveredNav) {
      this.switchScene(this.state.hoveredNav);
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Scene shortcuts
    if (e.key === '1') this.switchScene('home');
    else if (e.key === '2') this.switchScene('anime');
    else if (e.key === '3') this.switchScene('fighter');
    else if (e.key === '4') this.switchScene('studio');
    else if (e.key === '5') this.switchScene('lab');
    else if (e.key === '6') this.switchScene('about');

    // View mode toggle
    else if (e.key === 'v') {
      // Only allow 3D modes if WebGL is available
      const modes: ViewMode[] = this.renderer3d ? ['split', '2d', '3d'] : ['2d'];
      const idx = modes.indexOf(this.state.viewMode);
      this.state.viewMode = modes[(idx + 1) % modes.length];
      this.updateLayout();
    }

    // Debug toggle
    else if (e.key === 'd') {
      this.state.showDebug = !this.state.showDebug;
    }

    // Scene-specific keys
    else if (this.state.currentScene === 'home') {
      if (e.key === 'ArrowLeft') {
        this.state.skinIndex = Math.max(0, this.state.skinIndex - 1);
      } else if (e.key === 'ArrowRight') {
        this.state.skinIndex = Math.min(4, this.state.skinIndex + 1);
      }
    } else if (this.state.currentScene === 'lab') {
      if (e.key >= '6' && e.key <= '9') {
        this.state.labExampleIndex = parseInt(e.key) - 6;
      }
    } else if (this.state.currentScene === 'fighter') {
      this.handleFighterInput(e.key);
    } else if (this.state.currentScene === 'studio') {
      this.handleStudioInput(e.key);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Studio Scene Controls
  // ─────────────────────────────────────────────────────────────

  private handleStudioInput(key: string): void {
    const em = this.state.emergent;

    switch (key) {
      case ' ':
        // Toggle pause
        em.paused = !em.paused;
        break;
      case 'g':
      case 'G':
        // Force new generation
        evolvePopulation(em);
        break;
      case 'c':
      case 'C':
        // Toggle CA visualization
        em.showCA = !em.showCA;
        break;
      case 'n':
      case 'N':
        // Toggle DNA visualization
        em.showDNA = !em.showDNA;
        break;
      case '+':
      case '=':
        // Increase speed
        em.speed = Math.min(5, em.speed + 0.5);
        break;
      case '-':
      case '_':
        // Decrease speed
        em.speed = Math.max(0.1, em.speed - 0.5);
        break;
      case 'r':
      case 'R':
        // Reset simulation
        this.state.emergent = createEmergentState();
        break;
      case 'p':
      case 'P':
        // Inject random CA pattern
        const patterns: ('glider' | 'blinker' | 'random')[] = ['glider', 'blinker', 'random'];
        injectCAPattern(em.ca, patterns[Math.floor(Math.random() * patterns.length)]);
        break;
      case 'm':
      case 'M':
        // Increase mutation rate
        em.evolution.mutationRate = Math.min(0.5, em.evolution.mutationRate + 0.05);
        break;
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.state.currentScene === 'fighter') {
      const fighter = this.state.fighter;
      // Return to idle from walk states
      if (e.key === 'ArrowRight' && fighter.action === 'walk_forward') {
        fighter.action = 'idle';
        fighter.actionTime = 0;
      } else if (e.key === 'ArrowLeft' && fighter.action === 'walk_back') {
        fighter.action = 'idle';
        fighter.actionTime = 0;
      } else if ((e.key === 's' || e.key === 'S') && fighter.action === 'blocking') {
        fighter.action = 'idle';
        fighter.actionTime = 0;
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Fighter Game Logic
  // ─────────────────────────────────────────────────────────────

  private handleFighterInput(key: string): void {
    const fighter = this.state.fighter;
    const canAct = fighter.action === 'idle' ||
                   fighter.action === 'walk_forward' ||
                   fighter.action === 'walk_back';

    if (key === 'j' || key === 'J') {
      // Punch
      if (canAct) {
        fighter.action = 'punch_startup';
        fighter.actionTime = 0;
        fighter.inputBuffer.push('punch');
        if (fighter.inputBuffer.length > 10) fighter.inputBuffer.shift();
      }
    } else if (key === 'k' || key === 'K') {
      // Kick
      if (canAct) {
        fighter.action = 'kick_startup';
        fighter.actionTime = 0;
        fighter.inputBuffer.push('kick');
        if (fighter.inputBuffer.length > 10) fighter.inputBuffer.shift();
      }
    } else if (key === 's' || key === 'S') {
      // Block
      if (canAct) {
        fighter.action = 'blocking';
        fighter.actionTime = 0;
      }
    } else if (key === 'ArrowRight') {
      if (canAct) {
        fighter.action = 'walk_forward';
        fighter.facingRight = true;
      }
    } else if (key === 'ArrowLeft') {
      if (canAct) {
        fighter.action = 'walk_back';
        fighter.facingRight = false;
      }
    } else if (key === ' ') {
      // Space: simulate getting hit (for demo)
      if (canAct) {
        fighter.action = 'hitstun';
        fighter.actionTime = 0;
        fighter.health = Math.max(0, fighter.health - 10);
        spawnHitParticles(fighter, 0, -80);
      }
    } else if (key === 'r' || key === 'R') {
      // Reset fighter
      fighter.action = 'idle';
      fighter.actionTime = 0;
      fighter.health = 100;
      fighter.x = 0;
      fighter.comboCount = 0;
      fighter.particles = [];
      fighter.hitEffects = [];
    }
  }

  private updateFighterState(deltaMs: number): void {
    const fighter = this.state.fighter;

    // Update action time
    fighter.actionTime += deltaMs;

    // State machine transitions
    const actionData = this.getActionData(fighter.action);
    if (fighter.actionTime >= actionData.duration) {
      // Transition to next state
      const prevAction = fighter.action;
      fighter.action = actionData.next;
      fighter.actionTime = 0;

      // Spawn effects on transition to active
      if (fighter.action === 'punch_active' || fighter.action === 'kick_active') {
        const effectX = fighter.facingRight ? 60 : -60;
        const effectY = fighter.action === 'punch_active' ? -80 : -40;
        spawnSpeedLines(fighter, effectX, effectY);
        fighter.comboCount++;
      }

      // Reset combo on return to idle
      if (fighter.action === 'idle' && prevAction.includes('recovery')) {
        // Keep combo for a bit
      }
    }

    // Movement during walk states
    if (fighter.action === 'walk_forward') {
      fighter.x += deltaMs * 0.3;
      fighter.x = Math.min(200, fighter.x);
    } else if (fighter.action === 'walk_back') {
      fighter.x -= deltaMs * 0.3;
      fighter.x = Math.max(-200, fighter.x);
    }

    // Return to idle from walk if key released
    // (We'd need keyup handling for proper implementation)
  }

  private getActionData(action: string): { duration: number; next: any } {
    const data: Record<string, { duration: number; next: string }> = {
      idle: { duration: Infinity, next: 'idle' },
      walk_forward: { duration: Infinity, next: 'idle' },
      walk_back: { duration: Infinity, next: 'idle' },
      punch_startup: { duration: 100, next: 'punch_active' },
      punch_active: { duration: 80, next: 'punch_recovery' },
      punch_recovery: { duration: 150, next: 'idle' },
      kick_startup: { duration: 150, next: 'kick_active' },
      kick_active: { duration: 100, next: 'kick_recovery' },
      kick_recovery: { duration: 200, next: 'idle' },
      blocking: { duration: Infinity, next: 'idle' },
      hitstun: { duration: 300, next: 'idle' },
    };
    return data[action] || { duration: 0, next: 'idle' };
  }

  private switchScene(sceneId: SceneId) {
    if (this.state.currentScene === sceneId) return;
    this.state.currentScene = sceneId;
  }

  private getNavItemAt(x: number, y: number): SceneId | null {
    if (y > getNavHeight()) return null;

    const itemWidth = 100;
    const totalWidth = NAV_ITEMS.length * itemWidth + (NAV_ITEMS.length - 1) * 10;
    let startX = (this.state.canvasWidth - totalWidth) / 2;
    const itemY = (getNavHeight() - 40) / 2;

    for (const item of NAV_ITEMS) {
      if (x >= startX && x <= startX + itemWidth && y >= itemY && y <= itemY + 40) {
        return item.id;
      }
      startX += itemWidth + 10;
    }
    return null;
  }
}
