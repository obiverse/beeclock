/**
 * About Scene - Architecture Information
 *
 * Displays information about the Bee Framework architecture.
 * Fully canvas-rendered with animated elements.
 */

import { Scene, Renderer, FrameContext, TAU, lerp, easeOut } from '../index';
import { AppState } from './types';
import { renderNavBar, getNavHeight } from './nav-bar';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0a0a12',
  text: 'rgba(255, 255, 255, 0.7)',
  textDim: 'rgba(255, 255, 255, 0.4)',
  accent: '#64c8ff',
  accent2: '#48dbfb',
  accent3: '#ff6b6b',
  panel: 'rgba(255, 255, 255, 0.03)',
  border: 'rgba(255, 255, 255, 0.1)',
};

const ARCHITECTURE = [
  {
    title: 'Engine',
    desc: 'Fixed timestep loop (Glenn Fiedler)',
    icon: '⚙️',
    color: '#64c8ff',
  },
  {
    title: 'Renderer',
    desc: 'Canvas 2D with HiDPI support',
    icon: '🎨',
    color: '#48dbfb',
  },
  {
    title: 'Scenes',
    desc: 'Pure render functions, no state',
    icon: '🖼️',
    color: '#ff6b6b',
  },
  {
    title: 'State',
    desc: 'Angular Signals (reactive)',
    icon: '📊',
    color: '#feca57',
  },
];

const FEATURES = [
  '60fps smooth rendering',
  'Alpha interpolation',
  'Zone-isolated RAF',
  'Object pooling',
  'Tick-driven updates',
  'Pure scene functions',
];

// ─────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────

export const AboutScene: Scene<AppState> = {
  id: 'about',
  name: 'About',

  render(r: Renderer, state: AppState, frame: FrameContext) {
    const navHeight = getNavHeight();
    const contentHeight = r.height - navHeight;
    const contentWidth = r.width;

    // Background
    r.rect(0, 0, r.width, r.height, { fill: COLORS.bg });

    // Animated background particles
    renderBackgroundParticles(r, contentWidth, contentHeight, navHeight, frame);

    // Nav bar
    renderNavBar(r, state, frame);

    // Content area
    r.save();
    r.translate(0, navHeight);

    // Title with animated underline
    const titleY = 50;
    r.text('Bee Framework', contentWidth / 2, titleY, {
      font: 'bold 32px system-ui',
      fill: COLORS.accent,
      align: 'center',
    });

    // Animated underline
    const underlineWidth = 180;
    const underlineProgress = (Math.sin(frame.t * TAU) + 1) / 2;
    const underlineX = (contentWidth - underlineWidth) / 2;

    r.save();
    r.alpha = 0.5 + underlineProgress * 0.5;
    r.line(
      underlineX + underlineWidth * (1 - underlineProgress) / 2,
      titleY + 20,
      underlineX + underlineWidth - underlineWidth * (1 - underlineProgress) / 2,
      titleY + 20,
      { stroke: COLORS.accent, width: 2, cap: 'round' }
    );
    r.restore();

    // Subtitle
    r.text('A minimal, efficient rendering framework', contentWidth / 2, titleY + 45, {
      font: '16px system-ui',
      fill: COLORS.textDim,
      align: 'center',
    });

    // Architecture cards
    const cardWidth = 180;
    const cardHeight = 80;
    const cardGap = 20;
    const totalCardsWidth = ARCHITECTURE.length * cardWidth + (ARCHITECTURE.length - 1) * cardGap;
    let cardX = (contentWidth - totalCardsWidth) / 2;
    const cardY = titleY + 90;

    for (let i = 0; i < ARCHITECTURE.length; i++) {
      const arch = ARCHITECTURE[i];
      const hoverPhase = Math.sin(frame.t * TAU + i * 0.5) * 3;

      // Card background
      r.roundRect(cardX, cardY + hoverPhase, cardWidth, cardHeight, 8, {
        fill: COLORS.panel,
        stroke: arch.color,
        width: 1,
      });

      // Icon
      r.text(arch.icon, cardX + 20, cardY + hoverPhase + cardHeight / 2, {
        font: '24px system-ui',
        fill: arch.color,
        align: 'center',
      });

      // Title
      r.text(arch.title, cardX + 50, cardY + hoverPhase + 25, {
        font: 'bold 14px system-ui',
        fill: arch.color,
        align: 'left',
      });

      // Description
      r.text(arch.desc, cardX + 50, cardY + hoverPhase + 50, {
        font: '11px system-ui',
        fill: COLORS.textDim,
        align: 'left',
      });

      cardX += cardWidth + cardGap;
    }

    // Features section
    const featuresY = cardY + cardHeight + 60;

    r.text('Features', contentWidth / 2, featuresY, {
      font: 'bold 18px system-ui',
      fill: COLORS.text,
      align: 'center',
    });

    // Feature list (two columns)
    const colWidth = 200;
    const featuresPerCol = Math.ceil(FEATURES.length / 2);
    const col1X = contentWidth / 2 - colWidth - 20;
    const col2X = contentWidth / 2 + 20;

    for (let i = 0; i < FEATURES.length; i++) {
      const col = i < featuresPerCol ? 0 : 1;
      const row = i < featuresPerCol ? i : i - featuresPerCol;
      const x = col === 0 ? col1X : col2X;
      const y = featuresY + 35 + row * 25;

      // Checkmark
      r.text('✓', x, y, {
        font: '14px system-ui',
        fill: COLORS.accent,
        align: 'left',
      });

      // Feature text
      r.text(FEATURES[i], x + 20, y, {
        font: '14px system-ui',
        fill: COLORS.text,
        align: 'left',
      });
    }

    // Stats section
    const statsY = featuresY + 35 + featuresPerCol * 25 + 40;
    const statWidth = 120;
    const stats = [
      { label: 'Tick', value: frame.tick.toString() },
      { label: 'FPS', value: `~${Math.round(1000 / frame.deltaMs)}` },
      { label: 'Alpha', value: frame.alpha.toFixed(2) },
      { label: 'Elapsed', value: `${frame.elapsed.toFixed(1)}s` },
    ];

    const totalStatsWidth = stats.length * statWidth;
    let statX = (contentWidth - totalStatsWidth) / 2;

    for (const stat of stats) {
      // Background
      r.roundRect(statX, statsY, statWidth - 10, 50, 6, {
        fill: COLORS.panel,
      });

      // Value
      r.text(stat.value, statX + (statWidth - 10) / 2, statsY + 18, {
        font: 'bold 18px monospace',
        fill: COLORS.accent,
        align: 'center',
      });

      // Label
      r.text(stat.label, statX + (statWidth - 10) / 2, statsY + 38, {
        font: '11px system-ui',
        fill: COLORS.textDim,
        align: 'center',
      });

      statX += statWidth;
    }

    // Footer
    r.text('Built with Rust/WASM + Angular + Canvas 2D', contentWidth / 2, contentHeight - 30, {
      font: '12px system-ui',
      fill: 'rgba(255, 255, 255, 0.3)',
      align: 'center',
    });

    r.restore();
  },
};

// ─────────────────────────────────────────────────────────────
// Background Animation
// ─────────────────────────────────────────────────────────────

function renderBackgroundParticles(
  r: Renderer,
  w: number,
  h: number,
  navHeight: number,
  frame: FrameContext
): void {
  r.save();
  r.translate(0, navHeight);

  const particleCount = 20;
  const t = frame.elapsed;

  for (let i = 0; i < particleCount; i++) {
    // Deterministic "random" positions based on index
    const seed = i * 1234.5678;
    const x = ((seed * 7) % w);
    const baseY = ((seed * 13) % (h - navHeight));

    // Slow floating motion
    const floatY = Math.sin(t * 0.3 + seed) * 20;
    const floatX = Math.cos(t * 0.2 + seed * 0.5) * 10;

    // Pulsing alpha
    const alpha = 0.1 + Math.sin(t * 0.5 + seed * 0.3) * 0.05;

    // Size variation
    const size = 2 + (seed % 3);

    r.save();
    r.alpha = alpha;
    r.circle(x + floatX, baseY + floatY, size, {
      fill: i % 3 === 0 ? COLORS.accent : i % 3 === 1 ? COLORS.accent2 : COLORS.accent3,
    });
    r.restore();
  }

  r.restore();
}
