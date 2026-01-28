# BeeClock Crates

This directory contains the Rust crates for BeeClock.

## Structure

```
crates/
├── beeclock-core/     # Pure Rust clock logic (no_std compatible)
│   ├── src/
│   │   ├── lib.rs         # Public API exports
│   │   ├── clock.rs       # Clock and ClockBuilder
│   │   ├── condition.rs   # PulseCondition predicates
│   │   ├── error.rs       # ClockError types
│   │   ├── partition.rs   # Partition types
│   │   ├── pulse.rs       # Pulse types
│   │   ├── snapshot.rs    # ClockSnapshot, TickOutcome
│   │   └── subscriber.rs  # Subscriber (std only)
│   └── Cargo.toml
│
└── beeclock-wasm/     # WASM bindings for web
    ├── src/
    │   ├── lib.rs         # WASM exports
    │   ├── bridge.rs      # JS/Rust conversion utilities
    │   ├── builder.rs     # WasmClockBuilder
    │   └── clock.rs       # WasmClock wrapper
    └── Cargo.toml
```

## Usage

### Pure Rust (beeclock-core)

```rust
use beeclock_core::{Clock, PulseCondition};

let mut clock = Clock::builder()
    .least_significant_first()
    .partition("sec", 60)
    .partition("min", 60)
    .partition("hour", 24)
    .pulse_every("tick", 1)
    .build()
    .unwrap();

let outcome = clock.tick();
println!("Time: {}:{}:{}",
    outcome.snapshot.get("hour"),
    outcome.snapshot.get("min"),
    outcome.snapshot.get("sec")
);
```

### WASM (beeclock-wasm)

Build with wasm-pack:

```bash
cd crates/beeclock-wasm
wasm-pack build --target web
```

Use in JavaScript:

```javascript
import init, { WasmClockBuilder } from './pkg/beeclock_wasm.js';

await init();

const builder = new WasmClockBuilder();
builder.set_partition_order('lsf');
builder.partition('sec', 60n);
builder.partition('min', 60n);
builder.partition('hour', 24n);
const clock = builder.build();

const outcome = clock.tick();
console.log(outcome.snapshot);
```

## Features

### beeclock-core

- `std` (default): Enables std-dependent features (subscribers, Error trait)
- No features: Pure no_std mode (requires `alloc`)

### beeclock-wasm

- No features (WASM-only crate)

## Building

```bash
# Build core library
cargo build -p beeclock-core

# Run tests
cargo test -p beeclock-core

# Build WASM
cd crates/beeclock-wasm
wasm-pack build --target web --out-dir ../../web/pkg
```
