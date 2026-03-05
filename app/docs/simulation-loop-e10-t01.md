# E10-T01: Simulation Loop and Time-Step Manager

## Scope
- Added `simulationLoop` engine in `src/features/simulation/simulationLoop.ts`.
- Implemented deterministic state machine with explicit runtime states:
  - `running`
  - `paused`
  - `stopped`
- Added configurable time-step strategies:
  - `fixed`: strict fixed-step processing
  - `hybrid`: fixed-step with fractional fallback step for smooth UI sync
- Added frame debt protection:
  - capped catch-up steps per frame
  - dropped-step accounting to prevent runaway lag accumulation
- Kept simulation stepping decoupled from renderer concerns by exposing loop controller + callbacks only.

## API Summary
- `createSimulationLoop(options)` returns `SimulationLoopController`:
  - `start()`, `pause()`, `stop()`, `dispose()`
  - `updateConfig(config)`
  - `getSnapshot()`
- Step callback contract:
  - `onStep({ stepMs, frameDeltaMs, tick, mode })`

## Files
- `src/features/simulation/simulationLoop.ts`
- `src/features/simulation/simulationLoop.test.ts`

## Verification
Run from `app/`:

```bash
npm run lint
npx vitest run src/features/simulation/simulationLoop.test.ts
npm run test
npm run build
```

Expected:
- tests verify state transitions and tick lifecycle
- fixed/hybrid behavior is covered
- catch-up cap and lag dropping are covered
- invalid runtime config updates are sanitized safely
