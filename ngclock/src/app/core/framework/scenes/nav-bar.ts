/**
 * NavBar - Canvas-rendered navigation
 *
 * A horizontal nav bar rendered entirely with canvas primitives.
 * Supports hover states and click detection.
 */

import { Renderer, FrameContext, lerp, easeOut } from '../index';
import { AppState, NAV_ITEMS, SceneId } from './types';

// ─────────────────────────────────────────────────────────────
// Layout Constants
// ─────────────────────────────────────────────────────────────

const NAV_HEIGHT = 60;
const NAV_PADDING = 20;
const ITEM_WIDTH = 100;
const ITEM_HEIGHT = 40;
const ITEM_RADIUS = 8;
const ICON_SIZE = 20;

// Colors
const NAV_BG = '#0a0a12';
const NAV_BORDER = '#1a1a2e';
const ITEM_BG = 'rgba(255, 255, 255, 0.05)';
const ITEM_BG_HOVER = 'rgba(255, 255, 255, 0.1)';
const ITEM_BG_ACTIVE = 'rgba(100, 200, 255, 0.15)';
const TEXT_COLOR = 'rgba(255, 255, 255, 0.7)';
const TEXT_COLOR_ACTIVE = '#64c8ff';

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────

export function renderNavBar(
  r: Renderer,
  state: AppState,
  frame: FrameContext
): void {
  const { width } = r;

  // Background
  r.rect(0, 0, width, NAV_HEIGHT, { fill: NAV_BG });

  // Bottom border
  r.line(0, NAV_HEIGHT, width, NAV_HEIGHT, {
    stroke: NAV_BORDER,
    width: 1,
  });

  // Title
  r.text('BeeClock', NAV_PADDING, NAV_HEIGHT / 2, {
    font: 'bold 18px system-ui',
    fill: TEXT_COLOR_ACTIVE,
    align: 'left',
    baseline: 'middle',
  });

  // Nav items (centered)
  const totalItemsWidth = NAV_ITEMS.length * ITEM_WIDTH + (NAV_ITEMS.length - 1) * 10;
  let startX = (width - totalItemsWidth) / 2;

  for (const item of NAV_ITEMS) {
    const isActive = state.currentScene === item.id;
    const isHovered = state.hoveredNav === item.id;

    const itemY = (NAV_HEIGHT - ITEM_HEIGHT) / 2;

    // Background
    let bg = ITEM_BG;
    if (isActive) bg = ITEM_BG_ACTIVE;
    else if (isHovered) bg = ITEM_BG_HOVER;

    r.roundRect(startX, itemY, ITEM_WIDTH, ITEM_HEIGHT, ITEM_RADIUS, {
      fill: bg,
    });

    // Active indicator
    if (isActive) {
      r.roundRect(startX, itemY + ITEM_HEIGHT - 3, ITEM_WIDTH, 3, 1.5, {
        fill: TEXT_COLOR_ACTIVE,
      });
    }

    // Icon + Label
    const textColor = isActive ? TEXT_COLOR_ACTIVE : TEXT_COLOR;
    const centerX = startX + ITEM_WIDTH / 2;

    r.text(item.icon, centerX - 20, NAV_HEIGHT / 2, {
      font: `${ICON_SIZE}px system-ui`,
      fill: textColor,
      align: 'center',
      baseline: 'middle',
    });

    r.text(item.label, centerX + 10, NAV_HEIGHT / 2, {
      font: '14px system-ui',
      fill: textColor,
      align: 'center',
      baseline: 'middle',
    });

    startX += ITEM_WIDTH + 10;
  }
}

// ─────────────────────────────────────────────────────────────
// Hit Testing
// ─────────────────────────────────────────────────────────────

export function getNavHeight(): number {
  return NAV_HEIGHT;
}

/**
 * Check if mouse is within nav bar bounds
 */
export function isInNavBar(y: number): boolean {
  return y < NAV_HEIGHT;
}

/**
 * Get which nav item is at the given position
 */
export function getNavItemAt(x: number, y: number, width: number): SceneId | null {
  if (!isInNavBar(y)) return null;

  const totalItemsWidth = NAV_ITEMS.length * ITEM_WIDTH + (NAV_ITEMS.length - 1) * 10;
  let startX = (width - totalItemsWidth) / 2;
  const itemY = (NAV_HEIGHT - ITEM_HEIGHT) / 2;

  for (const item of NAV_ITEMS) {
    if (
      x >= startX &&
      x <= startX + ITEM_WIDTH &&
      y >= itemY &&
      y <= itemY + ITEM_HEIGHT
    ) {
      return item.id;
    }
    startX += ITEM_WIDTH + 10;
  }

  return null;
}
