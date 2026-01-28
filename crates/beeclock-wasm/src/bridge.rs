//! JS/WASM bridge utilities.
//!
//! Converts Rust types to JavaScript objects efficiently.

use beeclock_core::{ClockSnapshot, PartitionState, PulseFired, TickOutcome};
use js_sys::{Array, Object, Reflect, Uint32Array};
use wasm_bindgen::prelude::*;

// ─────────────────────────────────────────────────────────────
// Cached Keys (thread-local for performance)
// ─────────────────────────────────────────────────────────────

pub struct Keys {
    pub tick: JsValue,
    pub tick_str: JsValue,
    pub epoch: JsValue,
    pub epoch_str: JsValue,
    pub snapshot: JsValue,
    pub partitions: JsValue,
    pub pulses: JsValue,
    pub overflowed: JsValue,
    pub name: JsValue,
    pub value: JsValue,
    pub modulus: JsValue,
}

impl Keys {
    pub fn new() -> Self {
        Self {
            tick: JsValue::from_str("tick"),
            tick_str: JsValue::from_str("tick_str"),
            epoch: JsValue::from_str("epoch"),
            epoch_str: JsValue::from_str("epoch_str"),
            snapshot: JsValue::from_str("snapshot"),
            partitions: JsValue::from_str("partitions"),
            pulses: JsValue::from_str("pulses"),
            overflowed: JsValue::from_str("overflowed"),
            name: JsValue::from_str("name"),
            value: JsValue::from_str("value"),
            modulus: JsValue::from_str("modulus"),
        }
    }
}

thread_local! {
    pub static KEYS: Keys = Keys::new();
}

// ─────────────────────────────────────────────────────────────
// Raw Buffer Layout
// ─────────────────────────────────────────────────────────────

pub const RAW_HEADER_WORDS: u32 = 6;
pub const RAW_TICK_LO: u32 = 0;
pub const RAW_EPOCH_LO: u32 = 2;
pub const RAW_OVERFLOWED: u32 = 4;
pub const RAW_PARTITION_COUNT: u32 = 5;

// ─────────────────────────────────────────────────────────────
// Conversion Functions
// ─────────────────────────────────────────────────────────────

pub fn outcome_to_js(outcome: &TickOutcome) -> JsValue {
    KEYS.with(|keys| outcome_to_js_with_keys(outcome, keys))
}

fn outcome_to_js_with_keys(outcome: &TickOutcome, keys: &Keys) -> JsValue {
    let obj = Object::new();
    let snapshot = snapshot_to_js_with_keys(&outcome.snapshot, keys);
    set(&obj, &keys.snapshot, &snapshot);
    set(
        &obj,
        &keys.overflowed,
        &JsValue::from_bool(outcome.overflowed),
    );
    let pulses = pulses_to_js_with_keys(&outcome.pulses, keys);
    set(&obj, &keys.pulses, &pulses);
    obj.into()
}

pub fn snapshot_to_js(snapshot: &ClockSnapshot) -> JsValue {
    KEYS.with(|keys| snapshot_to_js_with_keys(snapshot, keys))
}

fn snapshot_to_js_with_keys(snapshot: &ClockSnapshot, keys: &Keys) -> JsValue {
    let obj = Object::new();
    let tick = JsValue::from_f64(snapshot.tick as f64);
    let tick_str = JsValue::from_str(&snapshot.tick.to_string());
    let epoch = JsValue::from_f64(snapshot.epoch as f64);
    let epoch_str = JsValue::from_str(&snapshot.epoch.to_string());

    set(&obj, &keys.tick, &tick);
    set(&obj, &keys.tick_str, &tick_str);
    set(&obj, &keys.epoch, &epoch);
    set(&obj, &keys.epoch_str, &epoch_str);

    let parts = Array::new();
    for part in &snapshot.partitions {
        parts.push(&partition_to_js_with_keys(part, keys));
    }
    set(&obj, &keys.partitions, &parts);
    obj.into()
}

fn partition_to_js_with_keys(partition: &PartitionState, keys: &Keys) -> JsValue {
    let obj = Object::new();
    let name = JsValue::from_str(&partition.name);
    let value = JsValue::from_f64(partition.value as f64);
    let modulus = JsValue::from_f64(partition.modulus as f64);
    set(&obj, &keys.name, &name);
    set(&obj, &keys.value, &value);
    set(&obj, &keys.modulus, &modulus);
    obj.into()
}

fn pulses_to_js_with_keys(pulses: &[PulseFired], keys: &Keys) -> JsValue {
    let list = Array::new();
    for pulse in pulses {
        let obj = Object::new();
        let name = JsValue::from_str(&pulse.name);
        let tick = JsValue::from_f64(pulse.tick as f64);
        let tick_str = JsValue::from_str(&pulse.tick.to_string());
        let epoch = JsValue::from_f64(pulse.epoch as f64);
        let epoch_str = JsValue::from_str(&pulse.epoch.to_string());
        set(&obj, &keys.name, &name);
        set(&obj, &keys.tick, &tick);
        set(&obj, &keys.tick_str, &tick_str);
        set(&obj, &keys.epoch, &epoch);
        set(&obj, &keys.epoch_str, &epoch_str);
        list.push(&obj);
    }
    list.into()
}

// ─────────────────────────────────────────────────────────────
// Raw Buffer Operations
// ─────────────────────────────────────────────────────────────

pub fn ensure_len(out: &Uint32Array, required: u32, name: &str) -> Result<(), JsValue> {
    if out.length() < required {
        return Err(JsValue::from_str(&format!(
            "{name} requires Uint32Array length >= {required}"
        )));
    }
    Ok(())
}

pub fn fill_snapshot(out: &Uint32Array, snapshot: &ClockSnapshot, overflowed: bool) {
    write_u64(out, RAW_TICK_LO, snapshot.tick);
    write_u64(out, RAW_EPOCH_LO, snapshot.epoch);
    out.set_index(RAW_OVERFLOWED, if overflowed { 1 } else { 0 });
    out.set_index(RAW_PARTITION_COUNT, snapshot.partitions.len() as u32);

    let mut index = RAW_HEADER_WORDS;
    for part in &snapshot.partitions {
        index = write_u64(out, index, part.value);
    }
}

pub fn write_u64(out: &Uint32Array, index: u32, value: u64) -> u32 {
    out.set_index(index, value as u32);
    out.set_index(index + 1, (value >> 32) as u32);
    index + 2
}

pub fn clear_bits(out: &Uint32Array) {
    for idx in 0..out.length() {
        out.set_index(idx, 0);
    }
}

pub fn fill_pulse_bits(out: &Uint32Array, pulse_names: &[String], outcome: &TickOutcome) {
    for pulse in &outcome.pulses {
        if pulse.name == "__overflow__" {
            continue;
        }
        for (idx, name) in pulse_names.iter().enumerate() {
            if name == &pulse.name {
                set_bit(out, idx);
            }
        }
    }

    if outcome.overflowed {
        set_bit(out, pulse_names.len());
    }
}

fn set_bit(out: &Uint32Array, bit_index: usize) {
    let word = (bit_index / 32) as u32;
    let bit = (bit_index % 32) as u32;
    let value = out.get_index(word);
    out.set_index(word, value | (1u32 << bit));
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

pub fn set(obj: &Object, key: &JsValue, value: &JsValue) {
    let _ = Reflect::set(obj, key, value);
}

pub fn get_string(obj: &Object, key: &str) -> Result<String, JsValue> {
    let value = Reflect::get(obj, &JsValue::from_str(key))
        .map_err(|_| JsValue::from_str(key))?;
    value
        .as_string()
        .ok_or_else(|| JsValue::from_str("expected string"))
}

pub fn get_u64(obj: &Object, key: &str) -> Result<u64, JsValue> {
    let value = Reflect::get(obj, &JsValue::from_str(key))
        .map_err(|_| JsValue::from_str(key))?;
    let number = value
        .as_f64()
        .ok_or_else(|| JsValue::from_str("expected number"))?;
    if number < 0.0 {
        return Err(JsValue::from_str("expected non-negative number"));
    }
    Ok(number as u64)
}
