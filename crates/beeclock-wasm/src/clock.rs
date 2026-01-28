//! WASM Clock wrapper.

use beeclock_core::Clock;
use js_sys::Uint32Array;
use wasm_bindgen::prelude::*;

use crate::bridge::{
    clear_bits, ensure_len, fill_pulse_bits, fill_snapshot, outcome_to_js, snapshot_to_js,
    write_u64, RAW_HEADER_WORDS,
};

/// WASM-friendly clock wrapper.
#[wasm_bindgen]
pub struct WasmClock {
    pub(crate) inner: Clock,
    pub(crate) partition_count: usize,
    pub(crate) partition_moduli: Vec<u64>,
    pub(crate) pulse_names: Vec<String>,
}

#[wasm_bindgen]
impl WasmClock {
    /// Create a default clock (sec/min/hour).
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmClock, JsValue> {
        let inner = Clock::default();
        let snapshot = inner.snapshot();
        let partition_moduli = snapshot
            .partitions
            .iter()
            .map(|part| part.modulus)
            .collect::<Vec<_>>();
        Ok(WasmClock {
            inner,
            partition_count: partition_moduli.len(),
            partition_moduli,
            pulse_names: Vec::new(),
        })
    }

    /// Advance the clock by one tick, returning the outcome as a JS object.
    pub fn tick(&mut self) -> JsValue {
        let outcome = self.inner.tick();
        outcome_to_js(&outcome)
    }

    /// Get the current snapshot as a JS object.
    pub fn snapshot(&self) -> JsValue {
        snapshot_to_js(&self.inner.snapshot())
    }

    /// Get the required length for raw snapshot buffer.
    pub fn raw_snapshot_len(&self) -> u32 {
        RAW_HEADER_WORDS + (self.partition_count as u32) * 2
    }

    /// Get the number of u32 words needed for pulse bits.
    pub fn raw_pulse_words(&self) -> u32 {
        let bits = self.pulse_names.len() as u32 + 1;
        (bits + 31) / 32
    }

    /// Write snapshot to a raw Uint32Array (zero-copy path).
    pub fn snapshot_raw(&self, out: &Uint32Array) -> Result<(), JsValue> {
        let snapshot = self.inner.snapshot();
        ensure_len(out, self.raw_snapshot_len(), "snapshot_raw")?;
        fill_snapshot(out, &snapshot, false);
        Ok(())
    }

    /// Tick and write results to raw buffers (zero-copy path).
    pub fn tick_raw(
        &mut self,
        snapshot_out: &Uint32Array,
        pulse_bits_out: &Uint32Array,
    ) -> Result<(), JsValue> {
        let outcome = self.inner.tick();
        ensure_len(snapshot_out, self.raw_snapshot_len(), "tick_raw")?;
        ensure_len(pulse_bits_out, self.raw_pulse_words(), "tick_raw")?;
        fill_snapshot(snapshot_out, &outcome.snapshot, outcome.overflowed);
        clear_bits(pulse_bits_out);
        fill_pulse_bits(pulse_bits_out, &self.pulse_names, &outcome);
        Ok(())
    }

    /// Write partition moduli to a raw buffer.
    pub fn partition_moduli_raw(&self, out: &Uint32Array) -> Result<(), JsValue> {
        let required = (self.partition_count as u32) * 2;
        ensure_len(out, required, "partition_moduli_raw")?;
        let mut index = 0;
        for modulus in &self.partition_moduli {
            index = write_u64(out, index, *modulus);
        }
        Ok(())
    }
}
