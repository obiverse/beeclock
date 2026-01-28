import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Wasm, WASM_PATH } from '../wasm/wasm';
import { Engine } from '../engine/engine';

/**
 * ClockService: WASM clock driven by the Engine's heartbeat.
 *
 * The clock doesn't tick itself. The Engine ticks.
 * The clock observes and advances.
 */
@Injectable({
  providedIn: 'root',
})
export class ClockService {
  private clock: any = null;
  private wasmClock = inject(Wasm);
  private engine = inject(Engine);

  /** Is the WASM clock initialized? */
  readonly ready = signal(false);

  /** Latest clock snapshot (updates on each engine tick) */
  readonly snapshot = signal<any>(null);

  /** Latest fired pulses */
  readonly pulses = signal<any[]>([]);

  /** Interpolation alpha from engine (0.0 → 1.0) */
  readonly alpha = computed(() => this.engine.alpha());

  constructor() {
    // React to engine ticks
    effect(() => {
      const tick = this.engine.tick();
      if (this.clock && tick > 0) {
        const outcome = this.clock.tick();
        this.snapshot.set(outcome.snapshot);
        this.pulses.set(outcome.pulses || []);
      }
    });
  }

  /** Initialize WASM and start the engine */
  async start() {
    await this.wasmClock.waitUntilReady();
    const { WasmClockBuilder } = await import(/* @vite-ignore */ WASM_PATH);

    const builder = new WasmClockBuilder();
    builder.set_partition_order('lsf');
    builder.partition('sec', 60n);
    builder.partition('min', 60n);
    builder.partition('hour', 24n);
    this.clock = builder.build();

    // Initial snapshot
    this.snapshot.set(this.clock.snapshot());
    this.ready.set(true);

    // Start the engine (1 tick per second)
    this.engine.start(1000);
  }

  /** Stop the engine */
  stop() {
    this.engine.stop();
  }
}
