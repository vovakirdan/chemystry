# E09-T01: 3D Scene Bootstrap in Center Panel

## Scope
- Replaced viewport placeholder with real Three.js runtime mount.
- Added baseline scene primitives for MVP visualization boundary:
  - ambient + directional lighting
  - grid helper + axes helper
  - animated atom/bond meshes to keep render loop active
- Added deferred runtime mount on `requestAnimationFrame` to avoid blocking initial UI paint.
- Added explicit dispose path for animation loop, resize listeners/observer, geometry/material resources, and WebGL context.

## Files
- `src/features/center-panel/CenterPanelSkeleton.tsx`
- `src/features/center-panel/SceneViewport.tsx`
- `src/features/center-panel/createThreeSceneRuntime.ts`
- `src/features/center-panel/sceneLifecycle.ts`
- `src/features/center-panel/CenterPanelSkeleton.test.tsx`
- `src/features/center-panel/sceneLifecycle.test.ts`
- `src/App.css`

## Verification
Run from `app/`:

```bash
npm run lint
npx vitest run src/features/center-panel/CenterPanelSkeleton.test.tsx src/features/center-panel/sceneLifecycle.test.ts src/App.test.tsx
```

Expected outcomes:
- lint passes with zero warnings
- center panel test confirms viewport shell markers render and legacy placeholder text is removed
- scene lifecycle tests confirm deferred mount and cleanup behavior
- app test confirms greeting demo artifacts are not present
