# BeeClock: A Logical Time Kernel for Deterministic Systems

**Version 1.0 | January 2025**

---

## Abstract

BeeClock is a logical time kernel that decouples the concept of "time" from wall-clock reality. It provides a deterministic, tick-driven clock with partitioned time representation and predicate-based event emission (pulses). This whitepaper describes the theoretical foundations, architecture, and design principles that make BeeClock suitable for games, simulations, embedded systems, and reactive user interfaces.

---

## 1. The Problem with Time

Wall-clock time is fundamentally hostile to deterministic systems:

1. **Non-determinism**: Two runs of the same program will have different timestamps
2. **Variable granularity**: System clocks vary in precision across platforms
3. **External dependency**: Network time sync, daylight saving, and leap seconds inject chaos
4. **Rendering coupling**: Naive implementations tie logic to frame rate

BeeClock solves these problems by introducing **logical time**—a monotonic counter that advances only when explicitly told to, producing identical behavior across runs, platforms, and time zones.

---

## 2. Core Concepts

### 2.1 The Tick

The fundamental unit of BeeClock is the **tick**—an atomic, indivisible step of logical time.

```
tick(0) → tick(1) → tick(2) → ... → tick(n)
```

Properties of a tick:
- **Monotonic**: Always increases (wraps at u64::MAX)
- **Deterministic**: Same inputs produce same outputs
- **Discrete**: No "between" states exist
- **External-driven**: Advances only when `clock.tick()` is called

### 2.2 Partitions (Mixed-Radix Representation)

Time can be represented as partitions—cascading counters with different moduli:

```
[sec: 0..59] → [min: 0..59] → [hour: 0..23]
```

When `sec` overflows (59 → 0), it carries to `min`. When `min` overflows, it carries to `hour`. This is a **mixed-radix numeral system** where each digit has a different base.

Partition order determines which partition advances on each tick:
- **Least Significant First (LSF)**: First partition advances every tick (sec, min, hour)
- **Most Significant First (MSF)**: Last partition advances every tick (hour, min, sec)

### 2.3 Pulses (Predicate Events)

Pulses are named events that fire when conditions are met:

```rust
pulse_every("heartbeat", 60)        // Fire every 60 ticks
pulse_when("noon", And([
    PartitionEquals("hour", 12),
    PartitionEquals("min", 0),
    PartitionEquals("sec", 0),
]))
```

Pulse conditions form a complete predicate algebra:
- `Every(n)` - Periodic firing
- `PartitionEquals` - Exact value match
- `PartitionModulo` - Modular arithmetic
- `TickRange` - Bounded time windows
- `Not`, `And`, `Or` - Boolean composition

### 2.4 Epochs (Overflow Handling)

When the tick counter overflows (u64::MAX → 0), the epoch increments:

```
tick: u64::MAX, epoch: 0
    ↓ overflow
tick: 0, epoch: 1
```

An `__overflow__` pulse is emitted, and `TickOutcome.overflowed` is set to `true`.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     External Driver                          │
│         (Game Loop, RAF, Hardware Timer, Test Harness)       │
└─────────────────────────────┬───────────────────────────────┘
                              │ tick()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      BeeClock Core                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ Tick Counter │  │  Partitions  │  │ Pulse Evaluator   │   │
│  │   (u64)      │  │ (Vec<State>) │  │ (Vec<Condition>)  │   │
│  └─────────────┘  └──────────────┘  └───────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │ TickOutcome
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Subscribers                             │
│            (Channels, Callbacks, Reactive Signals)           │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Zero-Allocation After Init

All memory is allocated at clock construction:
- Partition states: `Vec<PartitionState>` sized at build time
- Pulse specs: `Vec<PulseSpec>` sized at build time
- No heap allocation during `tick()`

This makes BeeClock suitable for real-time and embedded systems.

### 3.2 no_std Compatibility

The core library compiles without the standard library:

```rust
#![cfg_attr(not(feature = "std"), no_std)]
```

This enables use in:
- WebAssembly (browser and edge)
- Embedded systems (microcontrollers)
- Kernel modules
- Custom runtimes

---

## 4. The Fixed-Timestep Pattern

BeeClock is designed to integrate with Glenn Fiedler's "Fix Your Timestep" pattern for game loops.

### 4.1 The Problem with Variable Timesteps

```javascript
// Naive game loop (BAD)
while (running) {
    const delta = now - lastTime;
    update(delta);  // Physics varies with frame rate!
    render();
}
```

At 60fps, `delta ≈ 16ms`. At 30fps, `delta ≈ 33ms`. Physics becomes non-deterministic.

### 4.2 The Fixed-Timestep Solution

```javascript
// Fixed timestep (GOOD)
const TICK_RATE = 1000; // 1 tick per second
let accumulator = 0;

while (running) {
    const delta = now - lastTime;
    accumulator += delta;

    while (accumulator >= TICK_RATE) {
        clock.tick();           // Deterministic!
        accumulator -= TICK_RATE;
    }

    const alpha = accumulator / TICK_RATE;
    render(alpha);              // Interpolate for smoothness
}
```

### 4.3 Spiral of Death Protection

If the system lags (tab sleep, CPU spike), accumulated time can grow unbounded:

```
Sleep for 10 seconds at 1Hz → 10 ticks queued
```

BeeClock's Engine component caps ticks per frame:

```typescript
const MAX_TICKS_PER_FRAME = 5;

while (accumulator >= tickRate && ticksThisFrame < MAX_TICKS_PER_FRAME) {
    tick();
    accumulator -= tickRate;
    ticksThisFrame++;
}

// Clamp excess time (drop it)
if (accumulator > tickRate) {
    accumulator = tickRate;
}
```

---

## 5. The Rendering Layer

### 5.1 Separation of Concerns

```
Logic (1Hz)     →  tick()      →  Deterministic state changes
Rendering (60Hz) →  RAF        →  Visual interpolation
```

The clock ticks at a fixed rate (e.g., 1Hz for a clock face). The renderer runs at display refresh rate (typically 60Hz), interpolating between states using the **alpha** value.

### 5.2 Alpha Interpolation

```typescript
const alpha = accumulator / tickRateMs;  // 0.0 to 1.0

// For smooth second hand movement:
const smoothSecAngle = (sec + alpha) * (TAU / 60);
```

At alpha=0.0, render the previous state. At alpha=1.0, render the current state. Values between create smooth transitions.

### 5.3 Skin Architecture

Rendering is delegated to pluggable **skins**:

```typescript
interface ClockSkin {
    id: string;
    name: string;
    render(r: CanvasRenderer, state: ClockState, t: number): void;
}
```

This enables:
- Multiple visual representations of the same logical time
- Hot-swappable themes
- Custom domain visualizations (gauges, progress bars, game UIs)

---

## 6. WebAssembly Bridge

BeeClock's core is written in Rust and compiled to WebAssembly for browser use.

### 6.1 Build Chain

```
beeclock-core (Rust)
    ↓ wasm-pack
beeclock-wasm (wasm-bindgen)
    ↓ build
beeclock_wasm.js + beeclock_wasm_bg.wasm
    ↓ import
Angular/TypeScript application
```

### 6.2 JavaScript API

```typescript
import { WasmClockBuilder } from './assets/wasm/beeclock_wasm.js';

const builder = new WasmClockBuilder();
builder.set_partition_order('lsf');
builder.partition('sec', 60n);
builder.partition('min', 60n);
builder.partition('hour', 24n);
builder.pulse_every('tick', 1n);

const clock = builder.build();
const outcome = clock.tick();
console.log(outcome.snapshot.partitions);
```

### 6.3 BigInt for u64

JavaScript numbers are IEEE 754 doubles with 53 bits of integer precision. For u64 tick counters, we use BigInt:

```typescript
builder.partition('sec', 60n);  // Note the 'n' suffix
```

---

## 7. Design Principles

### 7.1 Determinism Over Convenience

Every operation produces identical results given identical inputs. No random number generators, no system time queries, no external state.

### 7.2 Composition Over Inheritance

Pulses compose via `And`, `Or`, `Not`. Skins compose via registry. Engine composes with Angular via signals.

### 7.3 Zero Runtime Overhead

- No garbage collection pressure (pre-allocated vectors)
- No virtual dispatch in hot paths
- No string parsing at runtime (all configuration at build time)

### 7.4 Progressive Disclosure

Simple use cases require minimal code:

```rust
let mut clock = Clock::default();
clock.tick();
```

Advanced use cases reveal more API surface:

```rust
let mut clock = Clock::builder()
    .least_significant_first()
    .partition("frame", 60)
    .partition("sec", 60)
    .pulse_when("custom", PulseCondition::And(vec![...]))
    .build()?;
```

---

## 8. Use Cases

### 8.1 Game Development

- Frame-independent physics simulation
- Deterministic replays and netcode
- Tick-based turn systems

### 8.2 Embedded Systems

- no_std compatibility for microcontrollers
- Predictable memory usage
- Hardware timer integration

### 8.3 User Interfaces

- Clock faces and timers
- Progress indicators
- Animation timing

### 8.4 Simulation

- Discrete event simulation
- Agent-based modeling
- Cellular automata (see Conway skin)

---

## 9. Future Directions

### 9.1 Planned Features

- **Time travel**: Save/restore clock state for debugging
- **Networking**: Synchronized clocks across distributed systems
- **Scripting**: Runtime pulse configuration via JSON/YAML

### 9.2 Research Areas

- **Hierarchical clocks**: Parent-child relationships for nested simulations
- **Branching time**: Multiple parallel timelines for what-if analysis
- **Continuous time**: Hybrid discrete/continuous models

---

## 10. Conclusion

BeeClock provides a rigorous foundation for deterministic time-dependent systems. By separating logical time from wall-clock time, fixed-rate logic from variable-rate rendering, and core mechanics from visual presentation, it enables robust, testable, and portable applications.

The clock doesn't care what time it is. It only cares that it ticks.

---

## References

1. Fiedler, G. (2004). "Fix Your Timestep!" - https://gafferongames.com/post/fix_your_timestep/
2. Lamport, L. (1978). "Time, Clocks, and the Ordering of Events in a Distributed System"
3. Mixed-radix numeral systems - https://en.wikipedia.org/wiki/Mixed_radix

---

*BeeClock is open source under the MIT License.*
*Copyright (c) 2024-2025 Obiverse LLC*
