import * as THREE from 'three';
import { GRID_SIZE, CAMERA_ZOOM, CAMERA_PAN_SPEED, TILE_SIZE } from '../utils/Constants';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private cameraTarget: THREE.Vector3;

  // Camera panning state
  private keysDown = new Set<string>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    // Deep blue background — matching Populous ocean/sky
    this.scene.background = new THREE.Color(0x0c2870);

    // Orthographic camera for isometric view
    const aspect = window.innerWidth / window.innerHeight;
    const zoom = CAMERA_ZOOM;
    this.camera = new THREE.OrthographicCamera(
      -zoom * aspect, zoom * aspect,
      zoom, -zoom,
      0.1, 1000
    );

    // Classic isometric angle: rotate 45° around Y, tilt ~35.264° (arctan(1/sqrt(2)))
    const centerX = GRID_SIZE / 2;
    const centerZ = GRID_SIZE / 2;
    this.cameraTarget = new THREE.Vector3(centerX, 0, centerZ);

    // Position camera at isometric angle
    const dist = 80;
    const angle = Math.PI / 4; // 45 degrees
    const tilt = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees — true isometric

    this.camera.position.set(
      centerX + dist * Math.cos(tilt) * Math.sin(angle),
      dist * Math.sin(tilt),
      centerZ + dist * Math.cos(tilt) * Math.cos(angle)
    );
    this.camera.lookAt(this.cameraTarget);

    // Renderer — no antialiasing for that crisp retro pixel look
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1); // Force 1:1 pixel ratio for retro feel

    // No dynamic lighting — using MeshBasicMaterial for flat-shaded retro look
    // (all color comes from vertex colors / material color)

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));

    // Keyboard for camera panning
    window.addEventListener('keydown', (e) => this.keysDown.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.key.toLowerCase()));
  }

  private onResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const currentZoom = this.camera.top;
    this.camera.left = -currentZoom * aspect;
    this.camera.right = currentZoom * aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateCamera(dt: number): void {
    let dx = 0, dz = 0;
    if (this.keysDown.has('arrowleft') || this.keysDown.has('a')) dx -= 1;
    if (this.keysDown.has('arrowright') || this.keysDown.has('d')) dx += 1;
    if (this.keysDown.has('arrowup') || this.keysDown.has('w')) dz -= 1;
    if (this.keysDown.has('arrowdown') || this.keysDown.has('s')) dz += 1;

    if (dx !== 0 || dz !== 0) {
      const speed = CAMERA_PAN_SPEED * dt;
      // Pan along isometric axes
      const moveX = (dx + dz) * speed * 0.707;
      const moveZ = (-dx + dz) * speed * 0.707;

      this.cameraTarget.x += moveX;
      this.cameraTarget.z += moveZ;
      this.camera.position.x += moveX;
      this.camera.position.z += moveZ;
    }
  }

  zoom(delta: number): void {
    const aspect = window.innerWidth / window.innerHeight;
    const currentZoom = this.camera.top;
    const newZoom = Math.max(5, Math.min(60, currentZoom + delta));
    this.camera.left = -newZoom * aspect;
    this.camera.right = newZoom * aspect;
    this.camera.top = newZoom;
    this.camera.bottom = -newZoom;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
