# Beeclock Semantics

This clock is a logical time kernel. It is not wall-clock time.

Core concepts
- `tick()` advances logical time by one step and produces a `TickOutcome`.
- `ClockSnapshot` is immutable state: `tick`, `epoch`, and partition values.
- Partitions are mixed-radix digits. Order is explicit and significant.
- Pulses are predicates over time and partitions.
- Subscribers receive `TickOutcome` events.

Tick and epoch
- `tick` is a monotonic `u64` that wraps on overflow.
- `epoch` increments on tick overflow.
- An overflow emits a `__overflow__` pulse and sets `TickOutcome.overflowed = true`.

Partition order
- `LeastSignificantFirst`: first partition advances every tick (sec, min, hour).
- `MostSignificantFirst`: last partition advances every tick (hour, min, sec).

Pulse conditions
- `Every(n)` fires when `tick % n == 0` and `tick != 0`.
- `PartitionEquals { name, value }` fires when a partition equals a value.
- `PartitionModulo { name, modulus, remainder }` fires on partition value modulo.
- `TickRange { start, end }` fires for inclusive tick range.
- `Not`, `And`, `Or` compose predicates.

Subscribers
- `subscribe()` is unbounded; it never applies backpressure.
- `subscribe_bounded(n)` drops events when full to avoid unbounded memory.

Usage pattern
- Drive `tick()` from an external scheduler (game loop, OS tick, hardware timer).
- Treat `TickOutcome` as your deterministic “world step” event.
