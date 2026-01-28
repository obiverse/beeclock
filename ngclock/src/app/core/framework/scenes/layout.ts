/**
 * Layout utilities for responsive zones.
 *
 * Calculates viewport regions for 2D/3D split views.
 */

import { Viewport, ViewMode } from './types';

export interface LayoutZones {
  nav: Viewport;
  content: Viewport;
  left: Viewport;   // 2D viewport
  right: Viewport;  // 3D viewport
  footer: Viewport;
}

const NAV_HEIGHT = 60;
const FOOTER_HEIGHT = 40;
const MIN_PANEL_WIDTH = 300;
const PADDING = 20;

/**
 * Calculate layout zones based on canvas size and view mode.
 */
export function calculateLayout(
  width: number,
  height: number,
  viewMode: ViewMode
): LayoutZones {
  const contentHeight = height - NAV_HEIGHT - FOOTER_HEIGHT;

  const nav: Viewport = {
    x: 0,
    y: 0,
    width,
    height: NAV_HEIGHT,
  };

  const footer: Viewport = {
    x: 0,
    y: height - FOOTER_HEIGHT,
    width,
    height: FOOTER_HEIGHT,
  };

  const content: Viewport = {
    x: 0,
    y: NAV_HEIGHT,
    width,
    height: contentHeight,
  };

  // Split view calculations
  let left: Viewport;
  let right: Viewport;

  if (viewMode === 'split') {
    // Side by side if wide enough, stacked if narrow
    const isWide = width >= MIN_PANEL_WIDTH * 2 + PADDING * 3;

    if (isWide) {
      // Horizontal split
      const panelWidth = (width - PADDING * 3) / 2;
      left = {
        x: PADDING,
        y: NAV_HEIGHT + PADDING,
        width: panelWidth,
        height: contentHeight - PADDING * 2,
      };
      right = {
        x: PADDING * 2 + panelWidth,
        y: NAV_HEIGHT + PADDING,
        width: panelWidth,
        height: contentHeight - PADDING * 2,
      };
    } else {
      // Vertical split (stacked)
      const panelHeight = (contentHeight - PADDING * 3) / 2;
      left = {
        x: PADDING,
        y: NAV_HEIGHT + PADDING,
        width: width - PADDING * 2,
        height: panelHeight,
      };
      right = {
        x: PADDING,
        y: NAV_HEIGHT + PADDING * 2 + panelHeight,
        width: width - PADDING * 2,
        height: panelHeight,
      };
    }
  } else if (viewMode === '2d') {
    // Full width for 2D
    left = {
      x: PADDING,
      y: NAV_HEIGHT + PADDING,
      width: width - PADDING * 2,
      height: contentHeight - PADDING * 2,
    };
    right = { x: 0, y: 0, width: 0, height: 0 };
  } else {
    // Full width for 3D
    left = { x: 0, y: 0, width: 0, height: 0 };
    right = {
      x: PADDING,
      y: NAV_HEIGHT + PADDING,
      width: width - PADDING * 2,
      height: contentHeight - PADDING * 2,
    };
  }

  return { nav, content, left, right, footer };
}

/**
 * Check if a point is within a viewport.
 */
export function isInViewport(x: number, y: number, vp: Viewport): boolean {
  return x >= vp.x && x <= vp.x + vp.width && y >= vp.y && y <= vp.y + vp.height;
}

/**
 * Get normalized coordinates within a viewport (-1 to 1).
 */
export function normalizeInViewport(
  x: number,
  y: number,
  vp: Viewport
): { x: number; y: number } {
  return {
    x: ((x - vp.x) / vp.width) * 2 - 1,
    y: -(((y - vp.y) / vp.height) * 2 - 1), // Flip Y for 3D
  };
}

/**
 * Render a panel frame (border + label).
 */
export function renderPanelFrame(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  label: string,
  active = false,
  options: { skipBackground?: boolean } = {}
): void {
  const borderColor = active ? 'rgba(100, 200, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)';

  // Background (optional - skip for transparent overlay on 3D)
  if (!options.skipBackground) {
    const bgColor = 'rgba(0, 0, 0, 0.3)';
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(vp.x, vp.y, vp.width, vp.height, 8);
    ctx.fill();
  }

  // Border
  ctx.beginPath();
  ctx.roundRect(vp.x, vp.y, vp.width, vp.height, 8);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();

  // Label with background for visibility
  const labelText = label;
  ctx.font = '12px system-ui';
  const labelWidth = ctx.measureText(labelText).width + 16;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(vp.x + 6, vp.y + 4, labelWidth, 20);
  ctx.fillStyle = active ? '#64c8ff' : 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(labelText, vp.x + 10, vp.y + 8);
}

export function getNavHeight(): number {
  return NAV_HEIGHT;
}

export function getFooterHeight(): number {
  return FOOTER_HEIGHT;
}
