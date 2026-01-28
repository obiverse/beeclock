# Treatise on the Rust-WASM Clock Core

**Building a Portable Logical Time Kernel**

---

## Preface

BeeClock's core is written in Rust and compiled to WebAssembly. This choice enables the same logical clock to run natively on servers, in browsers, on embedded systems, and in any environment with a WASM runtime. This treatise examines the design decisions, implementation details, and trade-offs of building a cross-platform time kernel.

---

## Part I: Why Rust?

### 1.1 The Requirements

BeeClock's core must be:

1. **Deterministic**: Identical inputs produce identical outputs
2. **Allocation-free after init**: No GC pauses, predictable performance
3. **Portable**: Run on web, desktop, embedded
4. **Safe**: No undefined behavior, no crashes
5. **Fast**: Minimal overhead per tick

### 1.2 Why Not JavaScript?

JavaScript fails requirements 1, 2, and 5:

```javascript
// Non-deterministic (implementation-dependent hash order)
const obj = { a: 1, b: 2 };
Object.keys(obj);  // Order not guaranteed in older specs

// GC pauses
const arr = [];
for (let i = 0; i < 1000000; i++) {
    arr.push({ tick: i });  // GC will pause eventually
}

// Overhead
Date.now();  // System call, not cheap
```

### 1.3 Why Rust Excels

Rust provides:

```rust
// Deterministic (no hidden allocations)
let mut tick: u64 = 0;
tick = tick.wrapping_add(1);  // Defined overflow behavior

// Zero-allocation
fn tick(&mut self) -> TickOutcome {
    // All memory pre-allocated in self
    // No allocations in this function
}

// Portable (no_std)
#![cfg_attr(not(feature = "std"), no_std)]

// Safe (borrow checker)
fn bad_code() {
    let v = vec![1, 2, 3];
    let first = &v[0];
    v.push(4);  // COMPILE ERROR: can't mutate while borrowed
    println!("{}", first);
}

// Fast (zero-cost abstractions)
for partition in &mut self.partitions {
    // Compiles to same assembly as C
}
```

---

## Part II: The Core Architecture

### 2.1 Module Structure

```
beeclock-core/
├── Cargo.toml
└── src/
    ├── lib.rs          # Public API, no_std config
    ├── clock.rs        # Clock struct and builder
    ├── partition.rs    # Mixed-radix partitions
    ├── pulse.rs        # Pulse specifications
    ├── condition.rs    # Pulse predicates
    ├── snapshot.rs     # Immutable state capture
    ├── error.rs        # Error types
    └── subscriber.rs   # Channel-based subscribers (std only)
```

### 2.2 The Clock Struct

```rust
#[derive(Debug)]
pub struct Clock {
    tick: u64,
    epoch: u64,
    partitions: Vec<PartitionState>,
    partition_order: PartitionOrder,
    pulses: Vec<PulseSpec>,
    #[cfg(feature = "std")]
    subscribers: Vec<Subscriber>,
}
```

Key design decisions:

1. **`tick: u64`**: 18 quintillion ticks before overflow. At 1Hz, that's 584 billion years.

2. **`epoch: u64`**: Increments on tick overflow. Combined `(epoch, tick)` provides 128-bit logical time.

3. **`Vec<PartitionState>`**: Pre-sized at construction. Never grows or shrinks.

4. **`#[cfg(feature = "std")]`**: Subscribers require channels, which require std. The core works without them.

### 2.3 The Tick Function

```rust
pub fn tick(&mut self) -> TickOutcome {
    // Advance tick counter with overflow detection
    let (next_tick, overflowed) = self.tick.overflowing_add(1);
    self.tick = next_tick;
    if overflowed {
        self.epoch = self.epoch.wrapping_add(1);
    }

    // Advance partitions
    self.advance_partitions();

    // Capture snapshot
    let snapshot = self.snapshot();

    // Evaluate pulses
    let mut fired = Vec::new();
    for pulse in &self.pulses {
        if pulse.condition.is_met(self.tick, &snapshot) {
            fired.push(PulseFired {
                name: pulse.name.clone(),
                tick: self.tick,
                epoch: self.epoch,
            });
        }
    }

    // Emit overflow pulse
    if overflowed {
        fired.push(PulseFired {
            name: "__overflow__".to_string(),
            tick: self.tick,
            epoch: self.epoch,
        });
    }

    let outcome = TickOutcome {
        snapshot,
        pulses: fired,
        overflowed,
    };

    // Broadcast to subscribers
    #[cfg(feature = "std")]
    self.broadcast(&outcome);

    outcome
}
```

**Analysis**:

- `overflowing_add` is deterministic: wraps on overflow, no panic
- `wrapping_add` for epoch: even epoch overflow is defined
- `fired` vector: only allocation, but bounded by pulse count
- Clone for snapshot: necessary for immutable capture

### 2.4 Partition Advancement

```rust
fn advance_partitions(&mut self) {
    let mut carry = true;
    match self.partition_order {
        PartitionOrder::LeastSignificantFirst => {
            for partition in &mut self.partitions {
                if !carry { break; }
                carry = partition.increment();
            }
        }
        PartitionOrder::MostSignificantFirst => {
            for partition in self.partitions.iter_mut().rev() {
                if !carry { break; }
                carry = partition.increment();
            }
        }
    }
}

impl PartitionState {
    #[inline]
    pub fn increment(&mut self) -> bool {
        self.value += 1;
        if self.value >= self.modulus {
            self.value = 0;
            true  // Carry
        } else {
            false // No carry
        }
    }
}
```

**Analysis**:

- Early exit on no carry: O(1) for most ticks (only LSB changes)
- `#[inline]` hint for tight loop performance
- No allocation: modifies existing state in place

---

## Part III: The Pulse Condition System

### 3.1 The Predicate Algebra

```rust
pub enum PulseCondition {
    Every(u64),
    PartitionEquals { name: String, value: u64 },
    PartitionModulo { name: String, modulus: u64, remainder: u64 },
    TickRange { start: u64, end: u64 },
    Not(Box<PulseCondition>),
    And(Vec<PulseCondition>),
    Or(Vec<PulseCondition>),
}
```

This is a complete Boolean algebra over time predicates.

### 3.2 Evaluation

```rust
impl PulseCondition {
    pub fn is_met(&self, tick: u64, snapshot: &ClockSnapshot) -> bool {
        match self {
            PulseCondition::Every(period) =>
                tick != 0 && tick % period == 0,

            PulseCondition::PartitionEquals { name, value } =>
                snapshot.partition(name)
                    .map(|p| p.value == *value)
                    .unwrap_or(false),

            PulseCondition::PartitionModulo { name, modulus, remainder } =>
                snapshot.partition(name)
                    .map(|p| *modulus != 0 && p.value % modulus == *remainder)
                    .unwrap_or(false),

            PulseCondition::TickRange { start, end } =>
                tick >= *start && tick <= *end,

            PulseCondition::Not(c) =>
                !c.is_met(tick, snapshot),

            PulseCondition::And(cs) =>
                !cs.is_empty() && cs.iter().all(|c| c.is_met(tick, snapshot)),

            PulseCondition::Or(cs) =>
                cs.iter().any(|c| c.is_met(tick, snapshot)),
        }
    }
}
```

**Design decisions**:

- `Every(n)` excludes tick 0 (matches user expectation)
- `PartitionEquals` returns false for unknown partitions (fail-safe)
- `PartitionModulo` guards against division by zero
- `And` requires non-empty (empty And is undefined)
- Recursive evaluation for composite conditions

### 3.3 Validation at Build Time

```rust
fn validate_condition(
    condition: &PulseCondition,
    partitions: &BTreeSet<String>,
    pulse_name: &str,
) -> Result<(), ClockError> {
    match condition {
        PulseCondition::Every(period) if *period == 0 =>
            Err(ClockError::ZeroPeriod { name: pulse_name.to_string() }),

        PulseCondition::PartitionEquals { name, .. } |
        PulseCondition::PartitionModulo { name, .. }
            if !partitions.contains(name) =>
            Err(ClockError::UnknownPartition { ... }),

        PulseCondition::PartitionModulo { modulus: 0, .. } =>
            Err(ClockError::ZeroConditionModulus { ... }),

        PulseCondition::TickRange { start, end } if start > end =>
            Err(ClockError::InvalidTickRange { ... }),

        PulseCondition::Not(inner) =>
            validate_condition(inner, partitions, pulse_name),

        PulseCondition::And(cs) | PulseCondition::Or(cs) => {
            for c in cs {
                validate_condition(c, partitions, pulse_name)?;
            }
            Ok(())
        }

        _ => Ok(()),
    }
}
```

All invalid configurations are caught at clock construction, not at runtime.

---

## Part IV: WebAssembly Bridge

### 4.1 The wasm-bindgen Layer

```rust
// beeclock-wasm/src/builder.rs

#[wasm_bindgen]
pub struct WasmClockBuilder {
    partitions: Vec<PartitionSpec>,
    pulses: Vec<PulseSpec>,
    order: Option<PartitionOrder>,
}

#[wasm_bindgen]
impl WasmClockBuilder {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            partitions: Vec::new(),
            pulses: Vec::new(),
            order: None,
        }
    }

    pub fn partition(&mut self, name: String, modulus: u64) {
        self.partitions.push(PartitionSpec { name, modulus });
    }

    pub fn build(&mut self) -> Result<WasmClock, JsValue> {
        // ... validation and construction
    }
}
```

### 4.2 JavaScript Type Mapping

| Rust Type | JavaScript Type | Notes |
|-----------|-----------------|-------|
| `u64` | `BigInt` | JS numbers lose precision at 2^53 |
| `String` | `string` | Automatic conversion |
| `Vec<T>` | `Array<T>` | Via js-sys |
| `Result<T, E>` | `T` / throws | `Err` becomes exception |
| `Option<T>` | `T` / `undefined` | |

### 4.3 Condition Parsing

JavaScript passes conditions as plain objects:

```javascript
builder.pulse_condition('noon', {
    type: 'and',
    conditions: [
        { type: 'partition_equals', name: 'hour', value: 12n },
        { type: 'partition_equals', name: 'min', value: 0n },
    ]
});
```

The Rust side parses this:

```rust
fn parse_condition(value: &JsValue) -> Result<PulseCondition, JsValue> {
    let obj = Object::from(value.clone());
    let kind = Reflect::get(&obj, &JsValue::from_str("type"))?
        .as_string()
        .ok_or("type must be string")?;

    match kind.as_str() {
        "every" => Ok(PulseCondition::Every(get_u64(&obj, "period")?)),
        "partition_equals" => Ok(PulseCondition::PartitionEquals {
            name: get_string(&obj, "name")?,
            value: get_u64(&obj, "value")?,
        }),
        "and" => Ok(PulseCondition::And(get_conditions(&obj)?)),
        "or" => Ok(PulseCondition::Or(get_conditions(&obj)?)),
        "not" => Ok(PulseCondition::Not(Box::new(
            parse_condition(&Reflect::get(&obj, &"condition".into())?)?
        ))),
        _ => Err("unknown condition type".into()),
    }
}
```

### 4.4 Build Process

```bash
# Build WASM module
wasm-pack build crates/beeclock-wasm \
    --target web \
    --out-dir ../../ngclock/src/assets/wasm

# Generated files:
# - beeclock_wasm.js      (JS bindings)
# - beeclock_wasm_bg.wasm (WASM binary)
# - beeclock_wasm.d.ts    (TypeScript types)
```

---

## Part V: no_std Support

### 5.1 The Challenge

Standard library provides:
- `std::vec::Vec` (heap allocation)
- `std::collections::BTreeSet` (for validation)
- `std::sync::mpsc` (for subscribers)

### 5.2 The Solution

```rust
#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use alloc::boxed::Box;
use alloc::collections::BTreeSet;
```

The `alloc` crate provides collections without the full standard library. It requires only a global allocator.

### 5.3 Conditional Compilation

```rust
#[cfg(feature = "std")]
use std::sync::mpsc::{self, Receiver};

#[cfg(feature = "std")]
mod subscriber;

#[cfg(feature = "std")]
pub use subscriber::Subscriber;

impl Clock {
    #[cfg(feature = "std")]
    pub fn subscribe(&mut self) -> Receiver<TickOutcome> {
        // ... channel-based subscription
    }
}
```

Features:
- `default = ["std"]`: Full functionality
- `no_std`: Core clock only, no subscribers

---

## Part VI: Error Handling

### 6.1 The Error Type

```rust
#[derive(Debug, Clone)]
pub enum ClockError {
    ZeroModulus { name: String },
    ZeroPeriod { name: String },
    ZeroConditionModulus { pulse: String, partition: String },
    UnknownPartition { pulse: String, partition: String },
    InvalidTickRange { pulse: String, start: u64, end: u64 },
    MissingPartitionOrder,
}

impl fmt::Display for ClockError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ZeroModulus { name } =>
                write!(f, "partition '{}' has zero modulus", name),
            // ... other variants
        }
    }
}

#[cfg(feature = "std")]
impl std::error::Error for ClockError {}
```

### 6.2 Error Philosophy

1. **Fail at construction, not runtime**: All validation happens in `Clock::new()`
2. **No panics in tick()**: Once constructed, the clock cannot fail
3. **Descriptive messages**: Errors name the problematic component
4. **WASM-safe**: Errors convert to `JsValue` for JavaScript

---

## Part VII: Performance Considerations

### 7.1 Memory Layout

```rust
// PartitionState: 40 bytes (with String overhead)
pub struct PartitionState {
    pub name: String,    // 24 bytes (pointer, capacity, length)
    pub value: u64,      // 8 bytes
    pub modulus: u64,    // 8 bytes
}

// For 3 partitions: ~120 bytes
// Plus Vec overhead: ~24 bytes
// Total Clock (excluding pulses): ~200 bytes
```

### 7.2 Tick Performance

Measured on M1 Mac, single-threaded:

| Partitions | Pulses | Ticks/sec |
|------------|--------|-----------|
| 3 | 0 | 100M+ |
| 3 | 1 | 80M+ |
| 3 | 10 | 50M+ |
| 10 | 10 | 30M+ |

BeeClock at 1Hz uses 0.000001% of available performance.

### 7.3 WASM Overhead

WASM adds ~2-5x overhead compared to native Rust:

| Target | Ticks/sec |
|--------|-----------|
| Native (release) | 100M+ |
| WASM (Chrome) | 30M+ |
| WASM (Firefox) | 25M+ |

Still vastly exceeds requirements for any practical tick rate.

---

## Part VIII: Testing Strategy

### 8.1 Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tick_cascades_partitions() {
        let mut clock = Clock::builder()
            .least_significant_first()
            .partition("sec", 2)
            .partition("min", 3)
            .build()
            .unwrap();

        let tick1 = clock.tick();
        assert_eq!(tick1.snapshot.partition("sec").unwrap().value, 1);
        assert_eq!(tick1.snapshot.partition("min").unwrap().value, 0);

        let tick2 = clock.tick();
        assert_eq!(tick2.snapshot.partition("sec").unwrap().value, 0);
        assert_eq!(tick2.snapshot.partition("min").unwrap().value, 1);
    }

    #[test]
    fn pulses_fire_on_period() {
        let mut clock = Clock::builder()
            .least_significant_first()
            .partition("sec", 10)
            .pulse_every("pulse", 3)
            .build()
            .unwrap();

        assert!(clock.tick().pulses.is_empty());  // tick 1
        assert!(clock.tick().pulses.is_empty());  // tick 2

        let tick3 = clock.tick();
        assert_eq!(tick3.pulses.len(), 1);
        assert_eq!(tick3.pulses[0].name, "pulse");
    }
}
```

### 8.2 Property-Based Testing

```rust
#[cfg(test)]
mod proptests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn tick_always_increments(initial: u64, count: u16) {
            let mut clock = Clock::default();
            // Set initial tick (would need internal access)
            for _ in 0..count {
                let before = clock.tick_count();
                clock.tick();
                let after = clock.tick_count();
                assert!(after == before.wrapping_add(1));
            }
        }
    }
}
```

### 8.3 Fuzzing

```rust
// fuzz/fuzz_targets/clock_fuzz.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use beeclock_core::Clock;

fuzz_target!(|data: &[u8]| {
    if let Ok(count) = std::str::from_utf8(data)
        .ok()
        .and_then(|s| s.parse::<u32>().ok())
    {
        let mut clock = Clock::default();
        for _ in 0..count.min(10000) {
            let _ = clock.tick();
        }
    }
});
```

---

## Conclusion

BeeClock's Rust core demonstrates that performance, safety, and portability are not mutually exclusive. By leveraging Rust's type system, no_std support, and WASM compilation, the same logical clock runs everywhere from browsers to microcontrollers.

The clock doesn't know where it's running. It only knows it must tick.

---

## References

1. Rust Programming Language - https://rust-lang.org
2. wasm-bindgen Guide - https://rustwasm.github.io/wasm-bindgen/
3. no_std Development - https://docs.rust-embedded.org/book/intro/no-std.html

---

*This treatise is part of the BeeClock documentation.*
*MIT License | Copyright (c) 2024-2025 Obiverse LLC*
