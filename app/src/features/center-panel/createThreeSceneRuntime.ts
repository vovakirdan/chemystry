import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import type { SceneParticipantVisual, SceneRuntime, SceneSelectionDetails } from "./sceneLifecycle";
import {
  resolveAtomColorByRole,
  resolveSceneColorScheme,
  type SceneColorScheme,
} from "./sceneVisualConfig";

const CAMERA_FOV = 60;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 500;
const CAMERA_ZOOM_MIN_HEIGHT_PX = 240;

const GRID_SIZE = 20;
const GRID_DIVISIONS = 20;
const AXES_SIZE = 2.5;
const ATOM_RADIUS = 0.48;
const BOND_RADIUS = 0.1;

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(6, 5, 8);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

const KEYBOARD_ZOOM_FACTOR = 1.1;

type SceneRuntimeOptions = {
  participants?: ReadonlyArray<SceneParticipantVisual>;
  onSelectionChange?: (nextSelection: SceneSelectionDetails | null) => void;
  colorScheme?: Partial<SceneColorScheme>;
};

type SelectableSceneObjectMetadata = SceneSelectionDetails;

type SelectableSceneObject = THREE.Object3D & {
  userData: {
    selectable?: SelectableSceneObjectMetadata;
  };
};

const FALLBACK_PARTICIPANTS: ReadonlyArray<SceneParticipantVisual> = [
  {
    id: "fallback-reactant",
    label: "Reactant A",
    formula: "A",
    role: "reactant",
    phase: "gas",
  },
  {
    id: "fallback-product",
    label: "Product B",
    formula: "B",
    role: "product",
    phase: "gas",
  },
];

function isBufferGeometry(value: unknown): value is THREE.BufferGeometry {
  return value instanceof THREE.BufferGeometry;
}

function isMaterial(value: unknown): value is THREE.Material {
  return value instanceof THREE.Material;
}

function asMeshStandardMaterial(
  value: unknown,
): THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | null {
  if (value instanceof THREE.MeshStandardMaterial) {
    return value;
  }

  if (Array.isArray(value) && value.every((entry) => entry instanceof THREE.MeshStandardMaterial)) {
    return value;
  }

  return null;
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

function createAtomSelectionMetadata(
  participant: SceneParticipantVisual,
  colorScheme: SceneColorScheme,
): SelectableSceneObjectMetadata {
  return {
    id: participant.id,
    kind: "atom",
    label: participant.label,
    formula: participant.formula,
    role: participant.role,
    phase: participant.phase,
    colorHex: resolveAtomColorByRole(participant.role, colorScheme),
    linkedParticipantLabel: null,
  };
}

function createBondSelectionMetadata(
  left: SceneParticipantVisual,
  right: SceneParticipantVisual,
  colorScheme: SceneColorScheme,
): SelectableSceneObjectMetadata {
  return {
    id: `bond:${left.id}:${right.id}`,
    kind: "bond",
    label: `${left.label} <-> ${right.label}`,
    formula: `${left.formula}-${right.formula}`,
    role: left.role,
    phase: `${left.phase}/${right.phase}`,
    colorHex: colorScheme.bondHex,
    linkedParticipantLabel: right.label,
  };
}

function setSelectableEmphasis(
  object: SelectableSceneObject | null,
  active: boolean,
  colorScheme: SceneColorScheme,
): void {
  if (object === null) {
    return;
  }

  const objectMaterial = asMeshStandardMaterial((object as { material?: unknown }).material);
  if (objectMaterial === null) {
    return;
  }

  const materials = Array.isArray(objectMaterial) ? objectMaterial : [objectMaterial];
  materials.forEach((material) => {
    material.emissive.set(active ? colorScheme.selectionEmissiveHex : "#000000");
    material.emissiveIntensity = active ? 0.45 : 0;
  });
}

function createParticipantPositions(
  participants: ReadonlyArray<SceneParticipantVisual>,
): THREE.Vector3[] {
  if (participants.length === 1) {
    return [new THREE.Vector3(0, 0.2, 0)];
  }

  const radius = Math.max(1.8, participants.length * 0.58);
  return participants.map((_, index) => {
    const angle = (index / participants.length) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      index % 2 === 0 ? 0.18 : 0.34,
      Math.sin(angle) * radius,
    );
  });
}

function resolveNearestSelectableObject(
  pointer: THREE.Vector2,
  camera: THREE.PerspectiveCamera,
  objects: ReadonlyArray<SelectableSceneObject>,
  maxDistance: number,
): SelectableSceneObject | null {
  const worldPosition = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let closestObject: SelectableSceneObject | null = null;
  let closestDistance = maxDistance;

  objects.forEach((object) => {
    object.getWorldPosition(worldPosition);
    projected.copy(worldPosition).project(camera);
    const deltaX = pointer.x - projected.x;
    const deltaY = pointer.y - projected.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestObject = object;
    }
  });

  return closestObject;
}

export function createThreeSceneRuntime(
  container: HTMLElement,
  options: SceneRuntimeOptions = {},
): SceneRuntime {
  const participants =
    options.participants !== undefined && options.participants.length > 0
      ? options.participants
      : FALLBACK_PARTICIPANTS;
  const colorScheme = resolveSceneColorScheme(options.colorScheme);

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

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const selectableObjects: SelectableSceneObject[] = [];
  let selectedObject: SelectableSceneObject | null = null;

  const syncCameraDiagnostics = (): void => {
    renderer.domElement.dataset.cameraPosition = toVectorDatasetValue(camera.position);
    renderer.domElement.dataset.cameraTarget = toVectorDatasetValue(controls.target);
  };

  const setSelection = (nextObject: SelectableSceneObject | null): void => {
    if (selectedObject === nextObject) {
      return;
    }

    setSelectableEmphasis(selectedObject, false, colorScheme);
    selectedObject = nextObject;
    setSelectableEmphasis(selectedObject, true, colorScheme);

    const nextSelection = selectedObject?.userData.selectable ?? null;
    renderer.domElement.dataset.selectedObjectId = nextSelection?.id ?? "";
    options.onSelectionChange?.(nextSelection);
  };

  const resetCamera = (): void => {
    controls.reset();
    controls.update();
    syncCameraDiagnostics();
  };

  const onCanvasPointerDown = (): void => {
    renderer.domElement.focus({ preventScroll: true });
  };

  const onCanvasClick = (event: MouseEvent): void => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const previousClickCount = Number(renderer.domElement.dataset.clickCount ?? "0");
    renderer.domElement.dataset.clickCount = (previousClickCount + 1).toString();

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectableObjects, false)[0] ?? null;
    const raycastObject = (hit?.object as SelectableSceneObject | undefined) ?? null;
    const nearestObject = resolveNearestSelectableObject(pointer, camera, selectableObjects, 0.25);
    setSelection(raycastObject ?? nearestObject);
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
  renderer.domElement.addEventListener("click", onCanvasClick);
  renderer.domElement.addEventListener("keydown", onCanvasKeyDown);

  const ambientLight = new THREE.AmbientLight("#edf4ff", 0.65);
  const keyLight = new THREE.DirectionalLight("#ffffff", 1.1);
  keyLight.position.set(6, 10, 8);
  const fillLight = new THREE.DirectionalLight("#c4d8ff", 0.45);
  fillLight.position.set(-4, 3, -5);

  const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, "#8fb3d9", "#d3e2f1");
  grid.position.y = -1.1;
  const axes = new THREE.AxesHelper(AXES_SIZE);
  scene.add(ambientLight, keyLight, fillLight, grid, axes);

  const atomPositions = createParticipantPositions(participants);
  const atomGeometry = new THREE.SphereGeometry(ATOM_RADIUS, 28, 28);

  participants.forEach((participant, index) => {
    const atomMaterial = new THREE.MeshStandardMaterial({
      color: resolveAtomColorByRole(participant.role, colorScheme),
      metalness: 0.22,
      roughness: 0.38,
    });
    const atomMesh = new THREE.Mesh(atomGeometry.clone(), atomMaterial) as SelectableSceneObject;
    atomMesh.position.copy(atomPositions[index]);
    atomMesh.userData.selectable = createAtomSelectionMetadata(participant, colorScheme);
    selectableObjects.push(atomMesh);
    scene.add(atomMesh);
  });
  atomGeometry.dispose();

  for (let index = 0; index < participants.length - 1; index += 1) {
    const start = atomPositions[index];
    const end = atomPositions[index + 1];
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    if (length <= 0.0001) {
      continue;
    }

    const bondGeometry = new THREE.CylinderGeometry(BOND_RADIUS, BOND_RADIUS, length, 16);
    const bondMaterial = new THREE.MeshStandardMaterial({
      color: colorScheme.bondHex,
      metalness: 0.12,
      roughness: 0.52,
    });
    const bondMesh = new THREE.Mesh(bondGeometry, bondMaterial) as SelectableSceneObject;
    bondMesh.position.copy(start).add(end).multiplyScalar(0.5);
    bondMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    bondMesh.userData.selectable = createBondSelectionMetadata(
      participants[index],
      participants[index + 1],
      colorScheme,
    );

    selectableObjects.push(bondMesh);
    scene.add(bondMesh);
  }

  renderer.domElement.dataset.sceneObjectCount = selectableObjects.length.toString();

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

      setSelection(null);
      controls.stopListenToKeyEvents();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown);
      renderer.domElement.removeEventListener("click", onCanvasClick);
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
