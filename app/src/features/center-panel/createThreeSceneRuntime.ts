import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import type { SceneRuntime } from "./sceneLifecycle";

const CAMERA_FOV = 60;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 500;
const CAMERA_ZOOM_MIN_HEIGHT_PX = 240;

const GRID_SIZE = 20;
const GRID_DIVISIONS = 20;
const AXES_SIZE = 2.5;

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(6, 5, 8);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

const KEYBOARD_ZOOM_FACTOR = 1.1;

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

function toVectorDatasetValue(vector: THREE.Vector3): string {
  return `${vector.x.toFixed(4)},${vector.y.toFixed(4)},${vector.z.toFixed(4)}`;
}

export function createThreeSceneRuntime(container: HTMLElement): SceneRuntime {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f2f6fb");

  const { width, height } = resolveViewportSize(container);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR);
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  camera.lookAt(DEFAULT_CAMERA_TARGET);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.domElement.className = "center-render-canvas-element";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "3D scene canvas. Mouse: orbit, pan, zoom. Keyboard: arrows pan, plus/minus zoom, R reset.",
  );
  renderer.domElement.setAttribute("data-testid", "center-render-canvas-element");

  container.replaceChildren(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.enableDamping = false;
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.keys = {
    LEFT: "ArrowLeft",
    UP: "ArrowUp",
    RIGHT: "ArrowRight",
    BOTTOM: "ArrowDown",
  };
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.update();
  controls.saveState();

  const syncCameraDiagnostics = (): void => {
    renderer.domElement.dataset.cameraPosition = toVectorDatasetValue(camera.position);
    renderer.domElement.dataset.cameraTarget = toVectorDatasetValue(controls.target);
  };

  const resetCamera = (): void => {
    controls.reset();
    controls.update();
    syncCameraDiagnostics();
  };

  const onCanvasPointerDown = (): void => {
    renderer.domElement.focus({ preventScroll: true });
  };

  const onCanvasKeyDown = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "KeyR": {
        event.preventDefault();
        resetCamera();
        break;
      }
      case "Equal":
      case "NumpadAdd": {
        event.preventDefault();
        controls.dollyIn(KEYBOARD_ZOOM_FACTOR);
        controls.update();
        syncCameraDiagnostics();
        break;
      }
      case "Minus":
      case "NumpadSubtract": {
        event.preventDefault();
        controls.dollyOut(KEYBOARD_ZOOM_FACTOR);
        controls.update();
        syncCameraDiagnostics();
        break;
      }
      default:
        break;
    }
  };

  renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
  renderer.domElement.addEventListener("keydown", onCanvasKeyDown);

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

    controls.update();
    syncCameraDiagnostics();

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

      controls.listenToKeyEvents(renderer.domElement);
      renderer.domElement.focus({ preventScroll: true });
      syncCameraDiagnostics();
      renderFrame();
    },
    resetCamera,
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

      controls.stopListenToKeyEvents();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown);
      renderer.domElement.removeEventListener("keydown", onCanvasKeyDown);

      scene.traverse((object) => {
        disposeObjectResources(object);
      });

      renderer.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
    },
  };
}
