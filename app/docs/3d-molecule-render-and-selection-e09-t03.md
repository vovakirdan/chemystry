# E09-T03: Molecule Rendering, Object Selection, and Scene HUD

## Scope
- Extended center viewport runtime to render participant-based scene primitives:
  - atom meshes per participant (role-based color)
  - bond meshes between participant nodes
- Added object interaction and metadata inspection:
  - raycast selection + nearest-object fallback
  - highlighted selected object
  - selection metadata card in HUD (`kind`, `label`, `formula`, `role`, `phase`, linked participant)
- Added HUD indicators tied to runtime/session:
  - simulation state
  - timeline position
  - participant count
- Integrated App Builder data into scene visual model (`sceneParticipants`).
- Added explicit color-scheme configuration contract for atom/bond/selection colors.

## Technical Notes
- `SceneViewport` now accepts participant visuals and renders HUD overlay while delegating 3D runtime lifecycle to `mountSceneRuntimeDeferred`.
- Runtime emits diagnostics on canvas dataset (`cameraPosition`, `cameraTarget`, `sceneObjectCount`, `selectedObjectId`) used by manual QA.
- Overlay/HUD pointer handling adjusted so camera interactions are not blocked (`pointer-events: none` on overlays; reset button remains clickable).
- Color defaults are centralized in `sceneVisualConfig.ts` and can be partially overridden without changing runtime internals.

## Files
- `src/App.tsx`
- `src/App.css`
- `src/features/center-panel/CenterPanelSkeleton.tsx`
- `src/features/center-panel/CenterPanelSkeleton.test.tsx`
- `src/features/center-panel/SceneViewport.tsx`
- `src/features/center-panel/createThreeSceneRuntime.ts`
- `src/features/center-panel/sceneLifecycle.ts`
- `src/features/center-panel/sceneVisualConfig.ts`
- `src/features/center-panel/sceneVisualConfig.test.ts`

## Verification
Run from `app/`:

```bash
npm run lint
npx vitest run src/features/center-panel/CenterPanelSkeleton.test.tsx src/features/center-panel/sceneLifecycle.test.ts src/features/center-panel/sceneVisualConfig.test.ts src/App.test.tsx
npm run build
```

Manual Playwright verification:
- HUD shows state/timeline/participant counters in center viewport.
- Mouse drag and wheel change camera diagnostics (`cameraPosition` / `cameraTarget`).
- Clicking scene objects updates `selectedObjectId` and renders selection metadata card.
- Reset camera action preserves interaction consistency after scene movement.
