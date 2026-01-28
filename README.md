# BeeClock

**A Logical Time Kernel for Deterministic Systems**

BeeClock is a tick-driven clock with partitioned time representation and predicate-based event emission. Written in Rust with WebAssembly support, it enables deterministic, reproducible time handling for games, simulations, embedded systems, and reactive UIs.

---

## Features

- **Partitioned Time**: Mixed-radix representation (e.g., sec/min/hour at 60/60/24)
- **Predicate Pulses**: Fire events based on configurable conditions
- **Fixed Timestep**: Glenn Fiedler's "Fix Your Timestep" pattern built-in
- **Zero Allocation**: No heap allocation after initialization
- **no_std Compatible**: Works in embedded and WASM environments
- **Angular Integration**: Ready-to-use services and components
- **Pluggable Skins**: Multiple visual representations included

---

## Quick Start

### Rust

```rust
use beeclock_core::{Clock, PulseCondition};

let mut clock = Clock::builder()
    .least_significant_first()
    .partition("sec", 60)
    .partition("min", 60)
    .partition("hour", 24)
    .pulse_every("tick", 1)
    .pulse_when("noon", PulseCondition::And(vec![
        PulseCondition::PartitionEquals { name: "hour".into(), value: 12 },
        PulseCondition::PartitionEquals { name: "min".into(), value: 0 },
    ]))
    .build()
    .unwrap();

let outcome = clock.tick();
println!("Tick: {}, Pulses: {:?}", outcome.snapshot.tick, outcome.pulses);
```

### JavaScript/TypeScript (WASM)

```typescript
import { WasmClockBuilder } from './assets/wasm/beeclock_wasm.js';

const builder = new WasmClockBuilder();
builder.set_partition_order('lsf');
builder.partition('sec', 60n);
builder.partition('min', 60n);
builder.partition('hour', 24n);

const clock = builder.build();
const outcome = clock.tick();
console.log(outcome.snapshot);
```

### Angular

```typescript
@Component({
  template: `<clock-canvas [skinId]="'analog-classic'"></clock-canvas>`
})
export class ClockPage {
  private clock = inject(ClockService);

  async ngOnInit() {
    await this.clock.start();
  }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    beeclock-core (Rust)                     │
│  - Clock, ClockBuilder                                      │
│  - Partitions (mixed-radix)                                 │
│  - Pulses (predicate algebra)                               │
│  - no_std compatible                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                    wasm-pack / wasm-bindgen
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   beeclock-wasm (WASM)                      │
│  - WasmClock, WasmClockBuilder                              │
│  - JavaScript condition parsing                             │
│  - BigInt for u64 precision                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                           import
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ngclock (Angular)                        │
│  - Engine (fixed-timestep loop)                             │
│  - ClockService (WASM integration)                          │
│  - CanvasRenderer (2D drawing)                              │
│  - Pluggable Skins                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
beeclock/
├── crates/
│   ├── beeclock-core/     # Rust core library
│   └── beeclock-wasm/     # WASM bindings
├── ngclock/               # Angular application
│   └── src/app/core/
│       ├── engine/        # Fixed-timestep game loop
│       ├── clock/         # WASM clock service
│       ├── renderer/      # Canvas rendering
│       │   └── skins/     # Clock skins
│       └── framework/     # Scene/app framework
├── docs/                  # Documentation
└── web/                   # Vanilla JS demo
```

---

## Documentation

### Core Concepts

- [**Whitepaper**](docs/whitepaper.md) - Architecture and theory
- [**Semantics**](docs/clock.md) - Clock behavior specification

### Deep Dives

- [**Fixed-Timestep Treatise**](docs/treatise-fixed-timestep.md) - The Engine pattern
- [**Rust-WASM Treatise**](docs/treatise-rust-wasm.md) - Cross-platform implementation

### Reference

- [**API Reference**](docs/api-reference.md) - Complete API documentation

### Applications

- [**Five Deep Applications**](docs/applications.md)
  1. Pomodoro Focus Timer
  2. Deterministic Game Loop with Replay
  3. Conway's Game of Life Loading Screen
  4. Meditation Timer with Mindful Intervals
  5. Real-Time Dashboard with Tick-Aligned Updates

---

## Built-in Skins

| Skin | Description |
|------|-------------|
| `analog-classic` | Traditional wall clock with smooth hands |
| `digital-led` | 7-segment LED display |
| `minimalist` | Clean, modern design |
| `neon` | Glowing cyberpunk aesthetic |
| `conway` | Game of Life driven by clock ticks |
| `generative` | Procedural patterns |

---

## Building

### Prerequisites

- Rust 1.70+
- wasm-pack
- Node.js 18+
- Angular CLI 21+

### Build WASM

```bash
cd crates/beeclock-wasm
wasm-pack build --target web --out-dir ../../ngclock/src/assets/wasm
```

### Run Angular App

```bash
cd ngclock
npm install
npm start
```

### Run Tests

```bash
# Rust tests
cd crates/beeclock-core
cargo test

# Angular tests
cd ngclock
npm test
```

---

## Design Principles

1. **Determinism over convenience** - Same inputs, same outputs, always
2. **Composition over inheritance** - Pulses compose, skins compose, engines compose
3. **Zero runtime overhead** - No GC, no allocations in hot paths
4. **Progressive disclosure** - Simple by default, powerful when needed

---

## The Philosophy

> The clock doesn't know what time it is. It only knows it must tick.

BeeClock separates the concept of "time" from wall-clock reality. A tick is just an increment. Partitions are just counters that cascade. Pulses are just predicates that fire. What you build with these primitives is up to you.

---

## License

MIT License - Copyright (c) 2024-2025 Obiverse LLC

See [LICENSE](LICENSE) for details.

---

## Contributing

Contributions welcome! Please read the documentation first to understand the design philosophy.

---

*BeeClock: Time, distilled to its essence.*
