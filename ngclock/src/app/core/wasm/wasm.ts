import { Injectable, signal } from '@angular/core';

export const WASM_BASE_PATH = '/assets/wasm/';
export const WASM_PATH = `${WASM_BASE_PATH}beeclock_wasm.js`;

@Injectable({
  providedIn: 'root',
})
export class Wasm {
  ready = signal(false);
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
    this.loadWasm();
  }

  /** Await until WASM module is initialized */
  waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  private async loadWasm() {
    try {
      const wasmModule = await import(/* @vite-ignore */ WASM_PATH);
      await wasmModule.default();
      this.ready.set(true);
      this.resolveReady();
    } catch (error) {
      console.error('Failed to load WASM module:', error);
    }
  }
}
