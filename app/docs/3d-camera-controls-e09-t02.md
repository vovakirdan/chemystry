# E09-T02: Interactive Camera Controls

## Scope
- Added interactive camera controls on top of E09-T01 runtime using `OrbitControls`.
- Enabled camera interactions:
  - `orbit / pan / zoom` in viewport controls layer
  - reset to default camera position/target
- Added predictable camera reset entry points:
  - overlay button `Reset camera (R)`
  - keyboard hotkey `R`
- Added keyboard control mapping for consistency across scenes:
  - `Arrow` keys for camera pan
  - `=` / `Numpad +` and `-` / `Numpad -` for zoom
- Added camera diagnostics attributes on canvas (`data-camera-position`, `data-camera-target`) to support deterministic QA checks.

## Files
- `src/features/center-panel/createThreeSceneRuntime.ts`
- `src/features/center-panel/SceneViewport.tsx`
- `src/features/center-panel/sceneLifecycle.ts`
- `src/features/center-panel/CenterPanelSkeleton.test.tsx`
- `src/App.css`

## Verification
Run from `app/`:

```bash
npm run lint
npx vitest run src/features/center-panel/CenterPanelSkeleton.test.tsx src/features/center-panel/sceneLifecycle.test.ts src/App.test.tsx
npm run build
```

Manual Playwright checks performed:
- canvas is mounted and receives camera diagnostics
- keyboard pan (`ArrowRight`) changes camera target
- keyboard zoom (`=`) changes camera position
- reset button and `R` hotkey return camera to default diagnostics baseline
- mouse wheel changes camera distance (zoom path)
