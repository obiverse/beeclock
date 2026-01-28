# Beeclock WASM demo

Build the wasm package:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
wasm-pack build --target web --out-dir web/pkg
```

Run the static demo:

```sh
cd web
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser. Re-run `wasm-pack` after Rust changes.

The JS demo sets an explicit partition order (`lsf`) and mixes periodic pulses with predicate pulses.
Predicate forms: `every`, `partition_equals`, `partition_modulo`, `tick_range`, `not`, `and`, `or`.

WASM snapshots and pulses include `tick_str` and `epoch_str` for full precision; numeric fields are still provided.

Zero-alloc fast path
- `raw_snapshot_len()` returns required `Uint32Array` length.
- `snapshot_raw(out)` writes: `[tick_lo, tick_hi, epoch_lo, epoch_hi, overflowed, partition_count, p0_lo, p0_hi, ...]`.
- `raw_pulse_words()` returns required bitset words (includes `__overflow__` bit).
- `tick_raw(snapshot_out, pulse_bits_out)` advances time and fills both arrays.
- `partition_moduli_raw(out)` writes `u64` moduli as `[m0_lo, m0_hi, m1_lo, m1_hi, ...]`.

Profiling
- Add `?profile=1` to enable the on-screen FPS/tick/draw timing panel.
- Add `?trace=1` to emit `console.time` markers for tick/draw (sampled).
- Use `trace_every=N` to control sampling (default 60).

WASM builder notes
- `WasmClockBuilder.partition` and `pulse_every` expect BigInt values in JS (`60n`, `5n`).
