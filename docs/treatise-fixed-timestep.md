# Treatise on Fixed-Timestep Game Loops

**A Deep Dive into Deterministic Time for Interactive Systems**

---

## Preface

The fixed-timestep pattern is one of the most important—and most misunderstood—patterns in interactive software development. This treatise provides a comprehensive examination of why variable timesteps fail, how fixed timesteps solve the problem, and the subtle implementation details that separate robust systems from fragile ones.

---

## Part I: The Nature of Time in Interactive Systems

### 1.1 The Illusion of Continuous Time

Computers do not experience time continuously. They experience it as a sequence of discrete moments: frames, ticks, cycles. The question is not *whether* to discretize time, but *how*.

Consider a bouncing ball simulation:

```javascript
// Position update
ball.y += ball.velocity * deltaTime;

// Velocity update (gravity)
ball.velocity += GRAVITY * deltaTime;

// Collision detection
if (ball.y > floor) {
    ball.y = floor;
    ball.velocity *= -0.8;  // Bounce with energy loss
}
```

At 60fps (dt=16.67ms), this produces one behavior. At 30fps (dt=33.33ms), it produces another. At variable frame rates, it produces chaos.

### 1.2 The Variable Timestep Trap

Many developers begin with:

```javascript
function gameLoop(timestamp) {
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    update(delta);
    render();

    requestAnimationFrame(gameLoop);
}
```

This seems reasonable: "Use the actual elapsed time for updates." But it introduces several catastrophic problems.

**Problem 1: Non-Determinism**

Two runs of the same simulation produce different results based on system load, browser tab visibility, and hardware performance.

**Problem 2: Tunneling**

At low frame rates, objects can move so far in a single step that they "tunnel" through thin barriers:

```
Frame 1: ball at y=10
Frame 2: ball at y=150 (skipped y=100 where the wall was!)
```

**Problem 3: Numerical Instability**

Large time deltas cause integration errors to compound:

```
Small dt: position += velocity * 0.016   // Accurate
Large dt: position += velocity * 0.500   // Overshoots
```

**Problem 4: Irreproducibility**

Debugging becomes impossible. "It worked on my machine" becomes the norm.

---

## Part II: The Fixed-Timestep Solution

### 2.1 The Core Insight

Separate logical time from rendering time.

```
Logic:     tick(0) → tick(1) → tick(2) → ...  (fixed rate)
Rendering: frame_0 → frame_1 → frame_2 → ... (variable rate)
```

The simulation always advances by the same amount (e.g., 16.67ms per tick). The renderer runs as fast as possible, interpolating between simulation states.

### 2.2 The Accumulator Pattern

```typescript
class Engine {
    private accumulator = 0;
    private tickRateMs = 16.67;  // 60Hz logic

    frame(now: DOMHighResTimeStamp) {
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.accumulator += delta;

        // Drain accumulator in fixed chunks
        while (this.accumulator >= this.tickRateMs) {
            this.tick();
            this.accumulator -= this.tickRateMs;
        }

        // Interpolation factor for rendering
        const alpha = this.accumulator / this.tickRateMs;
        this.render(alpha);

        requestAnimationFrame(this.frame);
    }
}
```

The accumulator collects real elapsed time. We drain it in fixed-size chunks, each chunk being one logical tick. The remainder becomes the interpolation factor.

### 2.3 Interpolation: The Key to Smoothness

Without interpolation:

```
tick=0 → render at tick=0
tick=0 → render at tick=0
tick=1 → render at tick=1  // Jarring snap!
```

With interpolation:

```
tick=0, alpha=0.0 → render at 0.0
tick=0, alpha=0.5 → render at 0.5
tick=0, alpha=0.9 → render at 0.9
tick=1, alpha=0.0 → render at 1.0  // Smooth transition
```

For a clock second hand:

```typescript
const smoothSecAngle = (sec + alpha) / 60 * TAU;
```

At tick=30, alpha=0.5, the hand appears at 30.5 seconds—halfway between tick 30 and tick 31.

---

## Part III: The Spiral of Death

### 3.1 The Problem

Imagine a browser tab is backgrounded for 10 seconds. When it returns:

```
accumulator = 10,000ms
tickRateMs = 16.67ms
pending ticks = 10,000 / 16.67 = 600 ticks!
```

Processing 600 ticks in one frame causes:
- CPU spike
- Frame drop
- More accumulation
- More ticks needed
- System never recovers

This is the **spiral of death**.

### 3.2 The Solution: Capping

```typescript
const MAX_TICKS_PER_FRAME = 5;

let ticksThisFrame = 0;
while (this.accumulator >= this.tickRateMs &&
       ticksThisFrame < MAX_TICKS_PER_FRAME) {
    this.tick();
    this.accumulator -= this.tickRateMs;
    ticksThisFrame++;
}

// Drop excess time
if (this.accumulator > this.tickRateMs) {
    this.accumulator = this.tickRateMs;
}
```

We accept that simulation time will slow down during heavy load, but the system remains responsive.

### 3.3 Choosing MAX_TICKS_PER_FRAME

The optimal value depends on tick rate and acceptable latency:

| Tick Rate | Max Ticks | Max Catch-Up |
|-----------|-----------|--------------|
| 60Hz      | 5         | 83ms         |
| 30Hz      | 5         | 167ms        |
| 1Hz       | 5         | 5000ms       |

For BeeClock's 1Hz tick rate, 5 ticks allows catching up from a 5-second pause—reasonable for browser tab backgrounding.

---

## Part IV: Implementation in BeeClock

### 4.1 The Engine Service

BeeClock's `Engine` class implements the complete pattern:

```typescript
@Injectable({ providedIn: 'root' })
export class Engine {
    private zone = inject(NgZone);

    readonly tick = signal(0);
    readonly alpha = signal(0);
    readonly deltaMs = signal(0);
    readonly running = signal(false);

    private rafId: number | null = null;
    private lastFrameTime = 0;
    private accumulator = 0;
    private tickCount = 0;
    private tickRateMs = 1000;
    private readonly MAX_TICKS_PER_FRAME = 5;

    start(tickRateMs = 1000) {
        if (this.running()) return;

        // Input validation
        if (typeof tickRateMs !== 'number' ||
            tickRateMs <= 0 ||
            !Number.isFinite(tickRateMs)) {
            throw new Error(`tickRateMs must be positive finite`);
        }

        this.tickRateMs = tickRateMs;
        this.tickCount = 0;
        this.accumulator = 0;

        // Run outside Angular zone for performance
        this.zone.runOutsideAngular(() => {
            this.running.set(true);
            this.lastFrameTime = performance.now();
            this.rafId = requestAnimationFrame(this.frame);
        });
    }

    private frame = (now: DOMHighResTimeStamp) => {
        if (!this.running()) return;

        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.accumulator += delta;

        // Fixed timestep with spiral-of-death protection
        let ticksThisFrame = 0;
        while (this.accumulator >= this.tickRateMs &&
               ticksThisFrame < this.MAX_TICKS_PER_FRAME) {
            this.tickCount++;
            this.accumulator -= this.tickRateMs;
            ticksThisFrame++;
        }

        // Clamp excess
        if (this.accumulator > this.tickRateMs) {
            this.accumulator = this.tickRateMs;
        }

        // Enter Angular zone only on tick change
        if (ticksThisFrame > 0) {
            this.zone.run(() => {
                this.tick.set(this.tickCount);
            });
        }

        // Update interpolation (outside zone)
        const alpha = this.accumulator / this.tickRateMs;
        this.alpha.set(alpha);
        this.deltaMs.set(delta);

        this.rafId = requestAnimationFrame(this.frame);
    };
}
```

### 4.2 Angular Zone Optimization

A critical detail: we run the RAF loop **outside Angular's zone** and only enter the zone when a tick occurs.

Why?
- At 60fps, we'd trigger 60 change detection cycles per second
- Most frames have no tick (just alpha updates)
- Canvas rendering doesn't need change detection
- Only tick changes need to propagate to Angular templates

This is the difference between a responsive app and a sluggish one.

### 4.3 Signals Over Observables

BeeClock uses Angular signals rather than RxJS observables:

```typescript
readonly tick = signal(0);
readonly alpha = signal(0);
```

Signals provide:
- Synchronous reads (no subscription boilerplate)
- Automatic dependency tracking
- Better performance for high-frequency updates
- Simpler mental model

---

## Part V: Advanced Topics

### 5.1 Multiple Clock Rates

Some applications need multiple tick rates:

```typescript
const physicsEngine = new Engine();
physicsEngine.start(16);  // 60Hz physics

const gameLogic = new Engine();
gameLogic.start(100);     // 10Hz game updates

const clockDisplay = new Engine();
clockDisplay.start(1000); // 1Hz clock
```

Each engine maintains its own accumulator and tick count.

### 5.2 Deterministic Replays

Fixed timesteps enable perfect replay:

```typescript
// Recording
const inputs: Array<{ tick: number; action: string }> = [];

function onInput(action: string) {
    inputs.push({ tick: engine.tick(), action });
}

// Replay
function replay(recording: typeof inputs) {
    engine.reset();
    for (const { tick, action } of recording) {
        while (engine.tick() < tick) {
            engine.tick();
        }
        applyAction(action);
    }
}
```

Since ticks are deterministic, identical inputs produce identical outputs.

### 5.3 Networked Synchronization

Fixed timesteps simplify multiplayer:

```
Server: tick=1000, state={...}
Client: tick=998

Client advances 2 ticks to synchronize
```

Without fixed timesteps, clients cannot "catch up" to server state.

### 5.4 Time Dilation

For slow-motion or fast-forward effects:

```typescript
const SPEED = 2.0;  // 2x speed

private frame = (now: DOMHighResTimeStamp) => {
    const delta = (now - this.lastFrameTime) * SPEED;
    this.accumulator += delta;
    // ... rest unchanged
};
```

The simulation runs faster or slower while maintaining determinism.

---

## Part VI: Common Pitfalls

### 6.1 Forgetting to Clamp Accumulator

**Bug:**
```typescript
while (accumulator >= tickRate) {
    tick();
    accumulator -= tickRate;
}
// No clamp! Accumulator can grow unbounded during sleep.
```

**Fix:**
```typescript
if (accumulator > tickRate) {
    accumulator = tickRate;
}
```

### 6.2 Using Floating-Point Tick Rates

**Bug:**
```typescript
tickRateMs = 16.666666666...;  // 1000/60
```

Floating-point errors compound. After millions of frames, drift becomes noticeable.

**Fix:**
Use integer milliseconds or accept slight imprecision:
```typescript
tickRateMs = 16;  // Slightly fast, but consistent
// Or
tickRateMs = 1000;  // For clock applications, 1Hz is exact
```

### 6.3 Tick Logic Depending on Frame Time

**Bug:**
```typescript
tick() {
    position += velocity * this.deltaMs;  // Wrong!
}
```

**Fix:**
```typescript
tick() {
    position += velocity * TICK_RATE_MS;  // Always same value
}
```

Tick logic must use the fixed timestep, not the variable frame time.

### 6.4 Rendering at Tick Rate

**Bug:**
```typescript
if (ticksThisFrame > 0) {
    render();  // Rendering tied to tick rate
}
```

**Fix:**
```typescript
// Always render (at frame rate, not tick rate)
render(alpha);
```

---

## Part VII: The Philosophy of Determinism

### 7.1 Why Determinism Matters

Beyond technical benefits, determinism has philosophical implications:

1. **Testability**: Any bug can be reproduced exactly
2. **Fairness**: Competitive games work identically for all players
3. **Understandability**: Behavior can be reasoned about
4. **Composability**: Systems can be combined without unexpected interactions

### 7.2 The Cost of Determinism

Determinism isn't free:

1. **Latency**: Input doesn't affect state until next tick
2. **Complexity**: Extra code for accumulator and interpolation
3. **Memory**: Must store previous state for interpolation

BeeClock's design accepts these costs for the benefits gained.

### 7.3 When to Break Determinism

Sometimes determinism must yield:

1. **User experience**: Immediate visual feedback before tick confirms
2. **Performance**: Adaptive quality based on frame rate
3. **External systems**: Real-world time for deadlines

BeeClock provides the deterministic foundation; applications can layer non-deterministic elements atop it.

---

## Conclusion

The fixed-timestep pattern transforms chaotic, frame-rate-dependent systems into predictable, testable, reproducible ones. BeeClock's Engine embodies this pattern with Angular-aware optimizations, spiral-of-death protection, and clean signal-based reactivity.

The clock doesn't know what time it is. It only knows it must tick.

---

## References

1. Fiedler, G. "Fix Your Timestep!" (2004)
2. Blow, J. "Fundamental Conflicts in Game Architecture" (2010)
3. Carmack, J. "Time Delta and Drift" (Usenet, 1998)

---

*This treatise is part of the BeeClock documentation.*
*MIT License | Copyright (c) 2024-2025 Obiverse LLC*
