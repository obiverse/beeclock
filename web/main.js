import init, { WasmClockBuilder } from "./pkg/beeclock.js";

const PARTITIONS = [
  { name: "sec", modulus: 60n },
  { name: "min", modulus: 60n },
  { name: "hour", modulus: 24n },
];

const PULSES_EVERY = [
  { name: "fast", period: 5n },
  { name: "wireguard", period: 21n },
  { name: "slow", period: 1234n },
];

const PULSES_CONDITION = [
  {
    name: "top_of_hour",
    condition: and([
      partitionEquals("sec", 0),
      partitionEquals("min", 0),
    ]),
  },
];

const canvas = document.getElementById("clock");
const timeEl = document.getElementById("time");
const tickEl = document.getElementById("tick");
const pulsesEl = document.getElementById("pulses");
const perfEl = document.getElementById("perf");
const perfBlockEl = document.getElementById("perf-block");
const ctx = canvas.getContext("2d");

const TAU = Math.PI * 2;
const tickIntervalMs = 1000;

let clock = null;
let state = null;
let lastTickMs = 0;
let lastFrameMs = 0;
let lastPulses = [];
let canvasSize = 0;
let colors = null;
let perf = null;
const params = new URLSearchParams(window.location.search);
const profileEnabled = params.has("profile");
const traceEnabled = params.has("trace");
const traceEvery = Number(params.get("trace_every")) || 60;
let traceFrame = 0;
let resizeObserver = null;

function buildClock() {
  const builder = new WasmClockBuilder();
  builder.set_partition_order("lsf");
  for (const part of PARTITIONS) {
    builder.partition(part.name, part.modulus);
  }
  for (const pulse of PULSES_EVERY) {
    builder.pulse_every(pulse.name, pulse.period);
  }
  for (const pulse of PULSES_CONDITION) {
    builder.pulse_condition(pulse.name, pulse.condition);
  }
  return builder.build();
}

function every(period) {
  return { type: "every", period };
}

function partitionEquals(name, value) {
  return { type: "partition_equals", name, value };
}

function partitionModulo(name, modulus, remainder) {
  return { type: "partition_modulo", name, modulus, remainder };
}

function tickRange(start, end) {
  return { type: "tick_range", start, end };
}

function not(condition) {
  return { type: "not", condition };
}

function and(conditions) {
  return { type: "and", conditions };
}

function or(conditions) {
  return { type: "or", conditions };
}

function readColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    ink: styles.getPropertyValue("--ink").trim() || "#1c2b30",
    inkSoft: styles.getPropertyValue("--ink-soft").trim() || "#40545c",
    accent: styles.getPropertyValue("--accent").trim() || "#d0703c",
    accent2: styles.getPropertyValue("--accent-2").trim() || "#b23b2f",
    face: styles.getPropertyValue("--face").trim() || "#f8eada",
  };
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(size * dpr);
  canvas.height = Math.floor(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasSize = size;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getPartition(name) {
  if (!state || !state.partitions) {
    return { value: 0, modulus: 1 };
  }
  return state.partitions.find((part) => part.name === name) || {
    value: 0,
    modulus: 1,
  };
}

function updateReadout() {
  if (!state) {
    return;
  }
  const hh = getPartition("hour").value;
  const mm = getPartition("min").value;
  const ss = getPartition("sec").value;
  timeEl.textContent = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  tickEl.textContent = state.tick;
}

function updatePulses(pulses) {
  if (!pulses || pulses.length === 0) {
    return;
  }
  for (const pulse of pulses) {
    lastPulses.unshift(`${pulse.name} @ ${pulse.tick}`);
  }
  lastPulses = lastPulses.slice(0, 4);
  pulsesEl.textContent = lastPulses.join(" | ");
}

function drawClock() {
  if (!state || !canvasSize) {
    return;
  }
  const size = canvasSize;
  const radius = size / 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(radius, radius);

  const faceGrad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  faceGrad.addColorStop(0, colors.face);
  faceGrad.addColorStop(1, "#efdbc5");
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 6, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 3;
  ctx.stroke();

  for (let i = 0; i < 60; i += 1) {
    const angle = (i / 60) * TAU - Math.PI / 2;
    const longMark = i % 5 === 0;
    const markLength = longMark ? 14 : 6;
    const markWidth = longMark ? 3 : 1.5;
    const x1 = Math.cos(angle) * (radius - 18);
    const y1 = Math.sin(angle) * (radius - 18);
    const x2 = Math.cos(angle) * (radius - 18 - markLength);
    const y2 = Math.sin(angle) * (radius - 18 - markLength);
    ctx.strokeStyle = longMark ? colors.ink : colors.inkSoft;
    ctx.lineWidth = markWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const sec = getPartition("sec").value;
  const min = getPartition("min").value;
  const hour = getPartition("hour").value;
  const hour12 = hour % 12;

  const hourAngle = ((hour12 + min / 60) / 12) * TAU - Math.PI / 2;
  const minAngle = ((min + sec / 60) / 60) * TAU - Math.PI / 2;
  const secAngle = (sec / 60) * TAU - Math.PI / 2;

  drawHand(hourAngle, radius * 0.5, 6, colors.ink);
  drawHand(minAngle, radius * 0.72, 4, colors.ink);
  drawHand(secAngle, radius * 0.78, 2, colors.accent2);

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawHand(angle, length, width, color) {
  ctx.save();
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-length * 0.12, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();
  ctx.restore();
}

function frame(now) {
  const frameMs = lastFrameMs ? now - lastFrameMs : 0;
  lastFrameMs = now;
  let tickMs = 0;
  let ticksThisFrame = 0;
  const trace = traceEnabled && traceFrame % traceEvery === 0;
  if (trace) {
    console.time("tick");
  }
  while (now - lastTickMs >= tickIntervalMs) {
    const tickStart = performance.now();
    const outcome = clock.tick();
    tickMs += performance.now() - tickStart;
    ticksThisFrame += 1;
    state = outcome.snapshot;
    updateReadout();
    updatePulses(outcome.pulses);
    lastTickMs += tickIntervalMs;
  }
  if (trace) {
    console.timeEnd("tick");
    console.time("draw");
  }
  const renderStart = performance.now();
  drawClock();
  const renderMs = performance.now() - renderStart;
  if (trace) {
    console.timeEnd("draw");
  }
  if (perf) {
    perf.record({
      frameMs,
      renderMs,
      tickMs,
      ticks: ticksThisFrame,
    });
  }
  traceFrame += 1;
  requestAnimationFrame(frame);
}

async function start() {
  await init();
  colors = readColors();
  clock = buildClock();
  state = clock.snapshot();
  updateReadout();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  const container = canvas.parentElement;
  if (container && "ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(container);
  }
  lastTickMs = performance.now();
  lastFrameMs = lastTickMs;
  if (perfBlockEl) {
    perfBlockEl.style.display = profileEnabled ? "block" : "none";
  }
  if (profileEnabled && perfEl) {
    perf = new PerfMeter(perfEl);
  }
  requestAnimationFrame(frame);
}

class PerfMeter {
  constructor(el) {
    this.el = el;
    this.frames = [];
    this.ticks = [];
    this.renders = [];
  }

  record({ frameMs, renderMs, tickMs, ticks }) {
    if (frameMs > 0) {
      this.push(this.frames, 1000 / frameMs);
    }
    if (ticks > 0) {
      this.push(this.ticks, tickMs / ticks);
    }
    if (renderMs >= 0) {
      this.push(this.renders, renderMs);
    }
    this.render(ticks);
  }

  render(ticksThisFrame) {
    const fps = this.stats(this.frames);
    const tick = this.stats(this.ticks);
    const render = this.stats(this.renders);
    this.el.textContent = [
      `fps   ${this.formatStats(fps)}`,
      `tick  ${this.formatStats(tick)} ms`,
      `draw  ${this.formatStats(render)} ms`,
      `ticks ${ticksThisFrame}`,
    ].join("\n");
  }

  stats(values) {
    if (!values.length) {
      return { latest: 0, min: 0, max: 0, avg: 0 };
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const value of values) {
      sum += value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    return {
      latest: values[values.length - 1],
      min,
      max,
      avg: sum / values.length,
    };
  }

  formatStats(stat) {
    return `l:${stat.latest.toFixed(1)} a:${stat.avg.toFixed(1)} min:${stat.min.toFixed(1)} max:${stat.max.toFixed(1)}`;
  }

  push(list, value) {
    list.push(value);
    if (list.length > 120) {
      list.shift();
    }
  }
}

start();
