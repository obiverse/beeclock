# Bee Framework

A minimal, efficient rendering framework for modern web apps.

## Philosophy

```
"The framework does less so your app can do more."
```

**Core Principles:**
1. **Tick-driven** - Discrete, deterministic state updates
2. **Signal-based** - Fine-grained reactivity without dirty checking
3. **Zone-isolated** - Render loop outside Angular for performance
4. **Skin pattern** - Pure render functions, hot-swappable
5. **Immediate mode** - No scene graph, just draw commands

## Architecture

```
┌─────────────────────────────────────────────┐
│              Your App                        │
├─────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │  Scene  │  │  State  │  │   Renderer  │ │
│  │ (skin)  │  │(signals)│  │  (canvas)   │ │
│  └────┬────┘  └────┬────┘  └──────┬──────┘ │
│       │            │              │         │
│       └────────────┼──────────────┘         │
│                    │                        │
│              ┌─────▼─────┐                  │
│              │   Engine  │                  │
│              │  (loop)   │                  │
│              └───────────┘                  │
└─────────────────────────────────────────────┘
```

## Usage

```typescript
// 1. Define your state
interface GameState {
  player: { x: number; y: number };
  score: number;
  tick: number;
}

// 2. Create a scene (pure render function)
const gameScene: Scene<GameState> = {
  id: 'game',
  name: 'Main Game',

  render(r: Renderer, state: GameState, dt: number) {
    r.clear('#1a1a2e');
    r.circle(state.player.x, state.player.y, 20, { fill: '#00ff88' });
    r.text(`Score: ${state.score}`, 20, 20, { fill: '#fff' });
  }
};

// 3. Create app and run
const app = createApp({
  canvas: document.getElementById('canvas'),
  initialState: { player: { x: 100, y: 100 }, score: 0, tick: 0 },
  scene: gameScene,
  tickRate: 60, // 60 ticks per second for games
});

app.start();
```

## Core Concepts

### Engine
The heartbeat. Fires ticks at a fixed rate, provides delta time and alpha for interpolation.

### State
Reactive signals that trigger renders. Update state, UI follows.

### Scene
Pure function that draws to canvas. No side effects, just pixels.

### Renderer
Thin wrapper over Canvas 2D API with conveniences for common patterns.

## Why This Works

| Problem | Solution |
|---------|----------|
| Angular CD spam | Zone isolation |
| Unpredictable frame times | Fixed timestep |
| Complex state sync | Signal-based reactivity |
| Render logic coupling | Scene abstraction |
| Performance overhead | Immediate mode rendering |
