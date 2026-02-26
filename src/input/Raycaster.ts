import * as THREE from 'three';
import { SceneManager } from '../renderer/SceneManager';

export class Raycaster {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private sceneManager: SceneManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  /** Convert screen coordinates to tile coordinates */
  screenToTile(screenX: number, screenY: number, terrainMesh: THREE.Mesh): { x: number; z: number } | null {
    const canvas = this.sceneManager.getCanvas();
    this.mouse.x = (screenX / canvas.clientWidth) * 2 - 1;
    this.mouse.y = -(screenY / canvas.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

    const intersects = this.raycaster.intersectObject(terrainMesh);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      return {
        x: Math.floor(point.x),
        z: Math.floor(point.z),
      };
    }

    // Fallback: intersect with a horizontal plane at y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersection);
    if (intersection) {
      return {
        x: Math.floor(intersection.x),
        z: Math.floor(intersection.z),
      };
    }

    return null;
  }
}
