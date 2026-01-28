# BeeClock API Reference

**Complete API Documentation for Rust Core, WASM Bridge, and Angular Integration**

---

## Table of Contents

1. [Rust Core API](#rust-core-api)
2. [WASM/JavaScript API](#wasmjavascript-api)
3. [Angular Services](#angular-services)
4. [Rendering API](#rendering-api)
5. [Type Definitions](#type-definitions)

---

## Rust Core API

### Clock

The main clock struct. Advances logical time and emits pulses.

```rust
use beeclock_core::{Clock, ClockBuilder};
```

#### Construction

```rust
// Default clock (sec/min/hour at 60/60/24)
let mut clock = Clock::default();

// Custom clock via builder
let mut clock = Clock::builder()
    .least_significant_first()
    .partition("frame", 60)
    .partition("sec", 60)
    .partition("min", 60)
    .pulse_every("tick", 1)
    .pulse_when("minute", PulseCondition::PartitionEquals {
        name: "sec".into(),
        value: 0,
    })
    .build()?;
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `tick()` | `fn tick(&mut self) -> TickOutcome` | Advance time by one tick |
| `tick_count()` | `fn tick_count(&self) -> u64` | Get current tick count |
| `epoch()` | `fn epoch(&self) -> u64` | Get current epoch |
| `snapshot()` | `fn snapshot(&self) -> ClockSnapshot` | Get immutable state capture |
| `subscribe()` | `fn subscribe(&mut self) -> Receiver<TickOutcome>` | Subscribe to tick events (std only) |
| `subscribe_bounded(n)` | `fn subscribe_bounded(&mut self, capacity: usize) -> Receiver<TickOutcome>` | Bounded subscription (std only) |

### ClockBuilder

Fluent builder for clock configuration.

```rust
Clock::builder()
    .partition_order(PartitionOrder::LeastSignificantFirst)
    .partition("name", modulus)
    .pulse_every("name", period)
    .pulse_when("name", condition)
    .build()
```

#### Methods

| Method | Description |
|--------|-------------|
| `new()` | Create empty builder |
| `partition_order(order)` | Set partition significance order |
| `least_significant_first()` | Shorthand for LSF order |
| `most_significant_first()` | Shorthand for MSF order |
| `partition(name, modulus)` | Add a partition |
| `partition_chain(order, specs)` | Add multiple partitions |
| `pulse_every(name, period)` | Add periodic pulse |
| `pulse_when(name, condition)` | Add conditional pulse |
| `build()` | Build the clock (returns `Result<Clock, ClockError>`) |

### PulseCondition

Predicate algebra for pulse firing conditions.

```rust
use beeclock_core::PulseCondition;
```

#### Variants

```rust
enum PulseCondition {
    // Fire every N ticks (starting at tick N)
    Every(u64),

    // Fire when partition equals value
    PartitionEquals { name: String, value: u64 },

    // Fire when partition % modulus == remainder
    PartitionModulo { name: String, modulus: u64, remainder: u64 },

    // Fire when tick is in [start, end] inclusive
    TickRange { start: u64, end: u64 },

    // Logical NOT
    Not(Box<PulseCondition>),

    // Logical AND (all must be true)
    And(Vec<PulseCondition>),

    // Logical OR (any must be true)
    Or(Vec<PulseCondition>),
}
```

#### Examples

```rust
// Fire every 5 ticks
PulseCondition::Every(5)

// Fire at exactly noon
PulseCondition::And(vec![
    PulseCondition::PartitionEquals { name: "hour".into(), value: 12 },
    PulseCondition::PartitionEquals { name: "min".into(), value: 0 },
    PulseCondition::PartitionEquals { name: "sec".into(), value: 0 },
])

// Fire every 15 minutes
PulseCondition::PartitionModulo {
    name: "min".into(),
    modulus: 15,
    remainder: 0,
}

// Fire in first 100 ticks
PulseCondition::TickRange { start: 1, end: 100 }

// Fire when NOT at second 30
PulseCondition::Not(Box::new(
    PulseCondition::PartitionEquals { name: "sec".into(), value: 30 }
))
```

### ClockSnapshot

Immutable capture of clock state.

```rust
struct ClockSnapshot {
    pub tick: u64,
    pub epoch: u64,
    pub partitions: Vec<PartitionState>,
}
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `partition(name)` | `fn partition(&self, name: &str) -> Option<&PartitionState>` | Get partition by name |
| `get(name)` | `fn get(&self, name: &str) -> u64` | Get partition value (0 if not found) |

### TickOutcome

Result of a single tick operation.

```rust
struct TickOutcome {
    pub snapshot: ClockSnapshot,
    pub pulses: Vec<PulseFired>,
    pub overflowed: bool,
}
```

### PartitionState

Runtime state of a single partition.

```rust
struct PartitionState {
    pub name: String,
    pub value: u64,
    pub modulus: u64,
}
```

### PulseFired

Emitted when a pulse fires.

```rust
struct PulseFired {
    pub name: String,
    pub tick: u64,
    pub epoch: u64,
}
```

### ClockError

Error types for clock construction.

```rust
enum ClockError {
    ZeroModulus { name: String },
    ZeroPeriod { name: String },
    ZeroConditionModulus { pulse: String, partition: String },
    UnknownPartition { pulse: String, partition: String },
    InvalidTickRange { pulse: String, start: u64, end: u64 },
    MissingPartitionOrder,
}
```

---

## WASM/JavaScript API

### WasmClockBuilder

JavaScript-friendly clock builder.

```javascript
import { WasmClockBuilder } from './assets/wasm/beeclock_wasm.js';

const builder = new WasmClockBuilder();
```

#### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `constructor()` | none | Create new builder |
| `set_partition_order(order)` | `string` | Set order: "lsf", "msf", "least_significant_first", "most_significant_first" |
| `partition(name, modulus)` | `string, bigint` | Add partition |
| `pulse_every(name, period)` | `string, bigint` | Add periodic pulse |
| `pulse_condition(name, condition)` | `string, object` | Add conditional pulse |
| `build()` | none | Build clock (throws on error) |

#### Condition Object Format

```javascript
// Every N ticks
{ type: 'every', period: 60n }

// Partition equals
{ type: 'partition_equals', name: 'sec', value: 30n }

// Partition modulo
{ type: 'partition_modulo', name: 'min', modulus: 15n, remainder: 0n }

// Tick range
{ type: 'tick_range', start: 0n, end: 100n }

// NOT
{ type: 'not', condition: { ... } }

// AND
{ type: 'and', conditions: [{ ... }, { ... }] }

// OR
{ type: 'or', conditions: [{ ... }, { ... }] }
```

### WasmClock

The JavaScript clock instance.

```javascript
const clock = builder.build();
const outcome = clock.tick();
console.log(outcome.snapshot);
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `tick()` | `TickOutcome` | Advance time |
| `snapshot()` | `ClockSnapshot` | Get current state |
| `tick_count()` | `bigint` | Get tick count |
| `epoch()` | `bigint` | Get epoch |

---

## Angular Services

### Engine

Fixed-timestep game loop service.

```typescript
import { Engine } from './core/engine/engine';

@Component({ ... })
export class MyComponent {
    private engine = inject(Engine);

    ngOnInit() {
        this.engine.start(1000);  // 1Hz
    }

    ngOnDestroy() {
        this.engine.stop();
    }
}
```

#### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `tick` | `Signal<number>` | Current tick count |
| `alpha` | `Signal<number>` | Interpolation factor (0-1) |
| `deltaMs` | `Signal<number>` | Frame delta time in ms |
| `running` | `Signal<boolean>` | Is engine running? |

#### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `start(tickRateMs?)` | `number` (default: 1000) | Start the engine |
| `stop()` | none | Stop the engine |

#### Input Validation

`start()` throws if `tickRateMs` is:
- Not a number
- Zero or negative
- NaN or Infinity

### ClockService

WASM clock wrapper with Angular integration.

```typescript
import { ClockService } from './core/clock/clock';

@Component({ ... })
export class MyComponent {
    private clock = inject(ClockService);

    async ngOnInit() {
        await this.clock.start();
    }
}
```

#### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `ready` | `Signal<boolean>` | Is WASM loaded? |
| `snapshot` | `Signal<any>` | Latest clock snapshot |
| `pulses` | `Signal<any[]>` | Latest fired pulses |
| `alpha` | `Computed<number>` | Interpolation from engine |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `start()` | `Promise<void>` | Initialize WASM and start engine |
| `stop()` | `void` | Stop the engine |

### Wasm

WASM module loader service.

```typescript
import { Wasm } from './core/wasm/wasm';

@Component({ ... })
export class MyComponent {
    private wasm = inject(Wasm);

    async ngOnInit() {
        await this.wasm.waitUntilReady();
        // WASM is now loaded
    }
}
```

#### Signals

| Signal | Type | Description |
|--------|------|-------------|
| `ready` | `Signal<boolean>` | Is WASM loaded? |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `waitUntilReady()` | `Promise<void>` | Await WASM initialization |

---

## Rendering API

### CanvasRenderer

Low-level 2D drawing primitives.

```typescript
import { CanvasRenderer } from './core/renderer/canvas-renderer';

const renderer = new CanvasRenderer(canvasElement);
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number` | Logical width (CSS pixels) |
| `height` | `number` | Logical height (CSS pixels) |
| `cx` | `number` | Center X |
| `cy` | `number` | Center Y |
| `size` | `number` | `min(width, height)` |
| `radius` | `number` | `size / 2` |
| `raw` | `CanvasRenderingContext2D` | Raw context access |

#### Methods

**Lifecycle**

| Method | Description |
|--------|-------------|
| `resize()` | Resize canvas to fit container (HiDPI aware) |
| `clear()` | Clear entire canvas |
| `fill(color)` | Fill canvas with color |

**Transform Stack**

| Method | Description |
|--------|-------------|
| `save()` | Push current transform |
| `restore()` | Pop transform |
| `translate(x, y)` | Move origin |
| `rotate(radians)` | Rotate |
| `scale(factor)` | Scale uniformly |

**Primitives**

| Method | Parameters | Description |
|--------|------------|-------------|
| `circle(x, y, r, opts?)` | center, radius, options | Draw circle |
| `rect(x, y, w, h, opts?)` | position, size, options | Draw rectangle |
| `roundRect(x, y, w, h, r, opts?)` | position, size, corner radius, options | Draw rounded rectangle |
| `line(x1, y1, x2, y2, opts?)` | start, end, options | Draw line |
| `arc(x, y, r, start, end, opts?)` | center, radius, angles, options | Draw arc |
| `text(text, x, y, opts?)` | string, position, options | Draw text |
| `hand(angle, length, opts?)` | angle, length, options | Draw clock hand |

**Gradients**

| Method | Returns | Description |
|--------|---------|-------------|
| `radialGradient(x, y, r1, r2, stops)` | `CanvasGradient` | Create radial gradient |
| `linearGradient(x1, y1, x2, y2, stops)` | `CanvasGradient` | Create linear gradient |

**Effects**

| Property/Method | Description |
|-----------------|-------------|
| `alpha = value` | Set global alpha |
| `blendMode = mode` | Set composite operation |
| `shadow(color, blur, offsetX?, offsetY?)` | Set shadow |
| `clearShadow()` | Remove shadow |

### ClockSkin

Interface for pluggable clock renderers.

```typescript
interface ClockSkin {
    readonly id: string;
    readonly name: string;
    render(r: CanvasRenderer, state: ClockState, t: number): void;
}
```

### ClockState

State passed to skins.

```typescript
interface ClockState {
    hour: number;
    min: number;
    sec: number;
    alpha: number;  // Interpolation factor
    tick: number;   // Engine tick count
}
```

### Built-in Skins

| ID | Name | Description |
|----|------|-------------|
| `analog-classic` | Classic Analog | Traditional wall clock |
| `digital-led` | Digital LED | 7-segment display |
| `minimalist` | Minimalist | Clean, modern design |
| `neon` | Neon Glow | Glowing cyberpunk aesthetic |
| `conway` | Game of Life | Cellular automaton driven by clock |
| `generative` | Generative | Procedural patterns |

---

## Type Definitions

### ShapeOpts

```typescript
interface ShapeOpts {
    fill?: string | CanvasGradient;
    stroke?: string;
    width?: number;
    cap?: CanvasLineCap;
}
```

### TextOpts

```typescript
interface TextOpts {
    font?: string;
    fill?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
}
```

### HandOpts

```typescript
interface HandOpts {
    width?: number;
    color?: string;
    tail?: number;
    cap?: CanvasLineCap;
}
```

### FrameContext

```typescript
interface FrameContext {
    tick: number;
    deltaMs: number;
    alpha: number;
    t: number;        // Normalized time (0-1)
    elapsed: number;  // Total elapsed seconds
}
```

### Scene

```typescript
interface Scene<S = unknown> {
    readonly id: string;
    readonly name: string;
    render(r: Renderer, state: S, frame: FrameContext): void;
    onEnter?(state: S): void;
    onExit?(state: S): void;
}
```

---

## Constants

### Math Constants

```typescript
const TAU = Math.PI * 2;        // Full circle
const PI = Math.PI;             // Half circle

const deg2rad = (deg: number) => deg * (PI / 180);
const rad2deg = (rad: number) => rad * (180 / PI);
```

### Utility Functions

```typescript
// Linear interpolation
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Clamp value
const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

// Easing functions
const easeInOut = (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Distance between points
const distance = (x1: number, y1: number, x2: number, y2: number) =>
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
```

---

*This API reference is part of the BeeClock documentation.*
*MIT License | Copyright (c) 2024-2025 Obiverse LLC*
