/**
 * CanvasRenderer: Low-level 2D drawing primitives.
 *
 * This is not Angular-specific. It's a pure rendering utility.
 * Think of it as a tiny game engine's rendering layer.
 *
 * Key Concepts:
 * - Canvas uses an immediate-mode API (draw commands, not retained objects)
 * - Coordinate system: (0,0) at top-left, Y increases downward
 * - We often translate to center for clock rendering
 * - devicePixelRatio handles Retina/HiDPI displays
 */
export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private _width = 0;
  private _height = 0;
  private _dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
    this.resize();
  }

  /** Logical width (CSS pixels) */
  get width(): number { return this._width; }

  /** Logical height (CSS pixels) */
  get height(): number { return this._height; }

  /** Center X coordinate */
  get cx(): number { return this._width / 2; }

  /** Center Y coordinate */
  get cy(): number { return this._height / 2; }

  /** Smaller of width/height (for circular layouts) */
  get size(): number { return Math.min(this._width, this._height); }

  /** Radius for circular layouts */
  get radius(): number { return this.size / 2; }

  /**
   * Resize canvas to fit container with HiDPI support.
   *
   * Why devicePixelRatio matters:
   * - Retina displays have 2x or 3x physical pixels per CSS pixel
   * - Without DPR scaling, canvas looks blurry
   * - We draw at physical resolution, then scale down via CSS
   */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this._width = rect.width;
    this._height = rect.height;
    this._dpr = dpr;

    // Physical pixels (what we actually draw)
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);

    // CSS pixels (what user sees)
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // Scale context so we can think in CSS pixels
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Clear the entire canvas */
  clear(): void {
    this.ctx.clearRect(0, 0, this._width, this._height);
  }

  /** Clear a specific region (make transparent) */
  clearRect(x: number, y: number, w: number, h: number): void {
    this.ctx.clearRect(x, y, w, h);
  }

  /** Fill the entire canvas with a color */
  fill(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this._width, this._height);
  }

  /**
   * Save current transform state.
   * Always pair with restore()!
   */
  save(): void {
    this.ctx.save();
  }

  /** Restore previously saved state */
  restore(): void {
    this.ctx.restore();
  }

  /** Move origin to (x, y) */
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  /** Rotate by angle (radians) */
  rotate(radians: number): void {
    this.ctx.rotate(radians);
  }

  /** Scale uniformly */
  scale(factor: number): void {
    this.ctx.scale(factor, factor);
  }

  // ─────────────────────────────────────────────────────────────
  // Shape Primitives
  // ─────────────────────────────────────────────────────────────

  /**
   * Draw a circle.
   *
   * @param x Center X
   * @param y Center Y
   * @param r Radius
   * @param opts Fill and/or stroke options
   */
  circle(x: number, y: number, r: number, opts: ShapeOpts = {}): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.applyOpts(opts);
  }

  /**
   * Draw a line.
   *
   * @param x1 Start X
   * @param y1 Start Y
   * @param x2 End X
   * @param y2 End Y
   * @param opts Stroke options
   */
  line(x1: number, y1: number, x2: number, y2: number, opts: StrokeOpts = {}): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.applyStroke(opts);
  }

  /**
   * Draw a rectangle.
   */
  rect(x: number, y: number, w: number, h: number, opts: ShapeOpts = {}): void {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.applyOpts(opts);
  }

  /**
   * Draw a rounded rectangle (HTML5 Canvas 2D API).
   */
  roundRect(x: number, y: number, w: number, h: number, r: number, opts: ShapeOpts = {}): void {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.applyOpts(opts);
  }

  /**
   * Draw text.
   *
   * @param text The string to draw
   * @param x X position
   * @param y Y position
   * @param opts Text styling options
   */
  text(text: string, x: number, y: number, opts: TextOpts = {}): void {
    const {
      font = '16px sans-serif',
      fill = '#000',
      align = 'center',
      baseline = 'middle',
    } = opts;

    this.ctx.font = font;
    this.ctx.fillStyle = fill;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }

  /**
   * Draw a clock hand (line from center with optional tail).
   *
   * @param angle Angle in radians (0 = 3 o'clock, increases clockwise)
   * @param length Length of hand
   * @param opts Styling options
   */
  hand(angle: number, length: number, opts: HandOpts = {}): void {
    const {
      width = 2,
      color = '#000',
      tail = 0,
      cap = 'round',
    } = opts;

    this.ctx.save();
    this.ctx.rotate(angle);
    this.ctx.beginPath();
    this.ctx.moveTo(-tail, 0);
    this.ctx.lineTo(length, 0);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = cap;
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Draw an arc (partial circle).
   *
   * @param x Center X
   * @param y Center Y
   * @param r Radius
   * @param startAngle Start angle in radians
   * @param endAngle End angle in radians
   * @param opts Stroke options
   */
  arc(
    x: number,
    y: number,
    r: number,
    startAngle: number,
    endAngle: number,
    opts: StrokeOpts = {}
  ): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, startAngle, endAngle);
    this.applyStroke(opts);
  }

  // ─────────────────────────────────────────────────────────────
  // Gradients
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a radial gradient.
   *
   * @param x Center X
   * @param y Center Y
   * @param r1 Inner radius
   * @param r2 Outer radius
   * @param stops Color stops: [[offset, color], ...]
   */
  radialGradient(
    x: number,
    y: number,
    r1: number,
    r2: number,
    stops: [number, string][]
  ): CanvasGradient {
    const gradient = this.ctx.createRadialGradient(x, y, r1, x, y, r2);
    for (const [offset, color] of stops) {
      gradient.addColorStop(offset, color);
    }
    return gradient;
  }

  /**
   * Create a linear gradient.
   */
  linearGradient(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stops: [number, string][]
  ): CanvasGradient {
    const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [offset, color] of stops) {
      gradient.addColorStop(offset, color);
    }
    return gradient;
  }

  // ─────────────────────────────────────────────────────────────
  // Advanced
  // ─────────────────────────────────────────────────────────────

  /** Set global alpha (transparency) */
  set alpha(value: number) {
    this.ctx.globalAlpha = value;
  }

  /** Set composite operation (blend modes) */
  set blendMode(mode: GlobalCompositeOperation) {
    this.ctx.globalCompositeOperation = mode;
  }

  /** Set shadow */
  shadow(color: string, blur: number, offsetX = 0, offsetY = 0): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = blur;
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
  }

  /** Clear shadow */
  clearShadow(): void {
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
  }

  /** Get raw context for advanced operations */
  get raw(): CanvasRenderingContext2D {
    return this.ctx;
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private applyOpts(opts: ShapeOpts): void {
    if (opts.fill) {
      this.ctx.fillStyle = opts.fill;
      this.ctx.fill();
    }
    if (opts.stroke) {
      this.applyStroke(opts);
    }
  }

  private applyStroke(opts: StrokeOpts): void {
    this.ctx.strokeStyle = opts.stroke || '#000';
    this.ctx.lineWidth = opts.width || 1;
    this.ctx.lineCap = opts.cap || 'butt';
    this.ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface StrokeOpts {
  stroke?: string;
  width?: number;
  cap?: CanvasLineCap;
}

export interface ShapeOpts extends StrokeOpts {
  fill?: string | CanvasGradient;
}

export interface TextOpts {
  font?: string;
  fill?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

export interface HandOpts {
  width?: number;
  color?: string;
  tail?: number;
  cap?: CanvasLineCap;
}
