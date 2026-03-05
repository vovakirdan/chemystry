import * as THREE from "three";
import type { SceneRuntime } from "./sceneLifecycle";

const CAMERA_FOV = 60;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 500;
const CAMERA_ZOOM_MIN_HEIGHT_PX = 240;

const GRID_SIZE = 20;
const GRID_DIVISIONS = 20;
const AXES_SIZE = 2.5;

function isBufferGeometry(value: unknown): value is THREE.BufferGeometry {
  return value instanceof THREE.BufferGeometry;
}

function isMaterial(value: unknown): value is THREE.Material {
  return value instanceof THREE.Material;
}

function disposeObjectResources(object: THREE.Object3D): void {
  const objectWithGeometry = object as { geometry?: unknown };
  if (isBufferGeometry(objectWithGeometry.geometry)) {
    objectWithGeometry.geometry.dispose();
  }

  const objectWithMaterial = object as { material?: unknown };
  const { material } = objectWithMaterial;
  if (Array.isArray(material)) {
    material.forEach((materialEntry) => {
      if (isMaterial(materialEntry)) {
        materialEntry.dispose();
      }
    });
    return;
  }

  if (isMaterial(material)) {
    material.dispose();
  }
}

function resolveViewportSize(container: HTMLElement): { width: number; height: number } {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(CAMERA_ZOOM_MIN_HEIGHT_PX, container.clientHeight);

  return { width, height };
}

export function createThreeSceneRuntime(container: HTMLElement): SceneRuntime {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f2f6fb");

  const { width, height } = resolveViewportSize(container);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(6, 5, 8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.domElement.className = "center-render-canvas-element";
  renderer.domElement.setAttribute("aria-label", "3D scene canvas");
  renderer.domElement.setAttribute("data-testid", "center-render-canvas-element");

  container.replaceChildren(renderer.domElement);

  const ambientLight = new THREE.AmbientLight("#edf4ff", 0.65);
  const keyLight = new THREE.DirectionalLight("#ffffff", 1.1);
  keyLight.position.set(6, 10, 8);
  const fillLight = new THREE.DirectionalLight("#c4d8ff", 0.45);
  fillLight.position.set(-4, 3, -5);

  const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, "#8fb3d9", "#d3e2f1");
  grid.position.y = -1.1;
  const axes = new THREE.AxesHelper(AXES_SIZE);

  const atomGeometry = new THREE.SphereGeometry(0.7, 24, 24);
  const atomMaterial = new THREE.MeshStandardMaterial({ color: "#3f74c4", metalness: 0.22 });
  const atomMesh = new THREE.Mesh(atomGeometry, atomMaterial);
  atomMesh.position.set(0, 0.2, 0);

  const bondGeometry = new THREE.CylinderGeometry(0.14, 0.14, 2.2, 18);
  const bondMaterial = new THREE.MeshStandardMaterial({ color: "#8fa7c5", metalness: 0.12 });
  const bondMesh = new THREE.Mesh(bondGeometry, bondMaterial);
  bondMesh.rotation.z = Math.PI / 2;

  scene.add(ambientLight, keyLight, fillLight, grid, axes, atomMesh, bondMesh);

  let disposed = false;
  let started = false;
  let animationFrameHandle: number | null = null;

  const updateViewport = (): void => {
    if (disposed) {
      return;
    }

    const viewportSize = resolveViewportSize(container);
    camera.aspect = viewportSize.width / viewportSize.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewportSize.width, viewportSize.height, false);
  };

  const onWindowResize = (): void => {
    updateViewport();
  };

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          updateViewport();
        });

  const renderFrame = (): void => {
    if (disposed) {
      return;
    }

    atomMesh.rotation.y += 0.008;
    atomMesh.rotation.x += 0.0025;
    bondMesh.rotation.y -= 0.0045;

    renderer.render(scene, camera);
    animationFrameHandle = window.requestAnimationFrame(renderFrame);
  };

  return {
    start: () => {
      if (disposed || started) {
        return;
      }

      started = true;
      updateViewport();
      if (resizeObserver !== null) {
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", onWindowResize);
      }

      renderFrame();
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      started = false;
      if (animationFrameHandle !== null) {
        window.cancelAnimationFrame(animationFrameHandle);
        animationFrameHandle = null;
      }

      if (resizeObserver !== null) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", onWindowResize);
      }

      scene.traverse((object) => {
        disposeObjectResources(object);
      });
      renderer.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
    },
  };
}
