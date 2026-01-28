/**
 * ThreeRenderer: 3D rendering with Three.js
 *
 * Provides a simple 3D API matching the Bee Framework pattern.
 * Same tick-driven, immediate-mode approach as CanvasRenderer.
 */

import * as THREE from 'three';

export interface ThreeRendererConfig {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  alpha?: boolean;
}

export class ThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.PerspectiveCamera;
  private _width = 0;
  private _height = 0;

  // Reusable objects (avoid GC)
  private tempColor = new THREE.Color();
  private tempVec3 = new THREE.Vector3();

  // Object pools for common shapes
  private spherePool: THREE.Mesh[] = [];
  private boxPool: THREE.Mesh[] = [];
  private cylinderPool: THREE.Mesh[] = [];
  private activeObjects: THREE.Object3D[] = [];

  // Materials (reuse)
  private materials: Map<string, THREE.MeshStandardMaterial> = new Map();

  constructor(config: ThreeRendererConfig) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: config.antialias ?? true,
      alpha: config.alpha ?? true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this._camera.position.set(0, 0, 10);

    this.setupLights();
    this.resize();
  }

  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get scene(): THREE.Scene { return this._scene; }
  get camera(): THREE.PerspectiveCamera { return this._camera; }

  private setupLights(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404040, 0.5);
    this._scene.add(ambient);

    // Main directional light
    const main = new THREE.DirectionalLight(0xffffff, 1);
    main.position.set(5, 10, 7);
    main.castShadow = true;
    main.shadow.mapSize.width = 1024;
    main.shadow.mapSize.height = 1024;
    this._scene.add(main);

    // Fill light
    const fill = new THREE.DirectionalLight(0x4488ff, 0.3);
    fill.position.set(-5, 0, -5);
    this._scene.add(fill);
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this._width = rect.width;
    this._height = rect.height;

    this._camera.aspect = this._width / this._height;
    this._camera.updateProjectionMatrix();
    this.renderer.setSize(this._width, this._height, false);
  }

  /**
   * Set viewport for rendering to a portion of the canvas.
   * Useful for split-view rendering.
   */
  setViewport(x: number, y: number, width: number, height: number): void {
    const pixelRatio = window.devicePixelRatio;
    const canvas = this.renderer.domElement;
    const canvasHeight = canvas.height / pixelRatio;

    // Convert from top-left origin to bottom-left origin (WebGL convention)
    const glY = canvasHeight - y - height;

    this.renderer.setViewport(x * pixelRatio, glY * pixelRatio, width * pixelRatio, height * pixelRatio);
    this.renderer.setScissor(x * pixelRatio, glY * pixelRatio, width * pixelRatio, height * pixelRatio);
    this.renderer.setScissorTest(true);

    // Update camera aspect ratio for the viewport
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
  }

  /**
   * Reset viewport to full canvas.
   */
  resetViewport(): void {
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this._width * window.devicePixelRatio, this._height * window.devicePixelRatio);
  }

  /**
   * Clear all dynamic objects from the scene.
   * Called at the start of each frame.
   */
  clear(color?: string): void {
    // Return objects to pools
    for (const obj of this.activeObjects) {
      obj.visible = false;
    }
    this.activeObjects = [];

    // Set background color
    if (color) {
      this.tempColor.set(color);
      this._scene.background = this.tempColor.clone();
    }
  }

  /**
   * Render the scene to the canvas.
   * Called at the end of each frame.
   */
  render(): void {
    this.renderer.render(this._scene, this._camera);
  }

  // ─────────────────────────────────────────────────────────────
  // 3D Primitives
  // ─────────────────────────────────────────────────────────────

  sphere(x: number, y: number, z: number, radius: number, opts: ShapeOpts3D = {}): void {
    const mesh = this.getSphere();
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(radius);
    this.applyMaterial(mesh, opts);
    mesh.visible = true;
    this.activeObjects.push(mesh);
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, opts: ShapeOpts3D = {}): void {
    const mesh = this.getBox();
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    this.applyMaterial(mesh, opts);
    mesh.visible = true;
    this.activeObjects.push(mesh);
  }

  cylinder(
    x: number, y: number, z: number,
    radius: number, height: number,
    opts: CylinderOpts3D = {}
  ): void {
    const mesh = this.getCylinder();
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, height, radius);

    // Rotation for clock hands (around Z axis)
    if (opts.rotateZ !== undefined) {
      mesh.rotation.set(Math.PI / 2, 0, opts.rotateZ);
    }

    this.applyMaterial(mesh, opts);
    mesh.visible = true;
    this.activeObjects.push(mesh);
  }

  /**
   * Draw a clock hand (cylinder rotated around origin).
   */
  hand(angle: number, length: number, radius: number, opts: ShapeOpts3D = {}): void {
    const mesh = this.getCylinder();

    // Position at half length along the angle direction
    const halfLen = length / 2;
    mesh.position.set(
      Math.cos(angle) * halfLen,
      Math.sin(angle) * halfLen,
      0
    );

    // Scale: radius for thickness, length for height
    mesh.scale.set(radius, length, radius);

    // Rotate to point in the right direction
    mesh.rotation.set(0, 0, angle - Math.PI / 2);

    this.applyMaterial(mesh, opts);
    mesh.visible = true;
    this.activeObjects.push(mesh);
  }

  // ─────────────────────────────────────────────────────────────
  // Camera Control
  // ─────────────────────────────────────────────────────────────

  setCameraPosition(x: number, y: number, z: number): void {
    this._camera.position.set(x, y, z);
  }

  lookAt(x: number, y: number, z: number): void {
    this._camera.lookAt(x, y, z);
  }

  /**
   * Orbit camera around origin based on normalized mouse position.
   */
  orbit(mouseX: number, mouseY: number, distance = 10): void {
    // mouseX/Y should be -1 to 1
    const theta = mouseX * Math.PI; // Horizontal rotation
    const phi = (mouseY * 0.5 + 0.5) * Math.PI; // Vertical rotation

    this._camera.position.set(
      distance * Math.sin(phi) * Math.cos(theta),
      distance * Math.cos(phi),
      distance * Math.sin(phi) * Math.sin(theta)
    );
    this._camera.lookAt(0, 0, 0);
  }

  /**
   * Set camera position and look-at target directly.
   * Useful for fixed camera angles like fighting games.
   */
  setCamera(x: number, y: number, z: number, lookX = 0, lookY = 0, lookZ = 0): void {
    this._camera.position.set(x, y, z);
    this._camera.lookAt(lookX, lookY, lookZ);
  }

  // ─────────────────────────────────────────────────────────────
  // Object Pooling
  // ─────────────────────────────────────────────────────────────

  private getSphere(): THREE.Mesh {
    let mesh = this.spherePool.find(m => !m.visible);
    if (!mesh) {
      const geometry = new THREE.SphereGeometry(1, 32, 32);
      const material = new THREE.MeshStandardMaterial();
      mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.spherePool.push(mesh);
      this._scene.add(mesh);
    }
    return mesh;
  }

  private getBox(): THREE.Mesh {
    let mesh = this.boxPool.find(m => !m.visible);
    if (!mesh) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial();
      mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.boxPool.push(mesh);
      this._scene.add(mesh);
    }
    return mesh;
  }

  private getCylinder(): THREE.Mesh {
    let mesh = this.cylinderPool.find(m => !m.visible);
    if (!mesh) {
      const geometry = new THREE.CylinderGeometry(1, 1, 1, 16);
      const material = new THREE.MeshStandardMaterial();
      mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.cylinderPool.push(mesh);
      this._scene.add(mesh);
    }
    return mesh;
  }

  private getMaterial(color: string): THREE.MeshStandardMaterial {
    let mat = this.materials.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness: 0.3,
        roughness: 0.7,
      });
      this.materials.set(color, mat);
    }
    return mat;
  }

  private applyMaterial(mesh: THREE.Mesh, opts: ShapeOpts3D): void {
    const color = opts.color ?? '#ffffff';
    const mat = this.getMaterial(color);

    // Clone material if we need different properties
    if (opts.emissive || opts.metalness !== undefined || opts.roughness !== undefined) {
      const cloned = mat.clone();
      if (opts.emissive) cloned.emissive.set(opts.emissive);
      if (opts.metalness !== undefined) cloned.metalness = opts.metalness;
      if (opts.roughness !== undefined) cloned.roughness = opts.roughness;
      mesh.material = cloned;
    } else {
      mesh.material = mat;
    }
  }

  dispose(): void {
    this.renderer.dispose();
    this.materials.forEach(m => m.dispose());
    this.spherePool.forEach(m => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.boxPool.forEach(m => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.cylinderPool.forEach(m => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ShapeOpts3D {
  color?: string;
  emissive?: string;
  metalness?: number;
  roughness?: number;
}

export interface CylinderOpts3D extends ShapeOpts3D {
  rotateZ?: number;
}
