# E10-T02: Base Particle Model and Interactions

## Scope
- Added base particle simulation model in `src/features/simulation/particleModel.ts`.
- Implemented MVP mechanics for semi-realistic behavior:
  - pairwise collision handling with overlap resolution
  - pairwise interaction forces (attraction/repulsion by role)
  - boundary constraints with configurable restitution
- Implemented minimal reaction kinetics pipeline:
  - rule-based reactant matching (`reactants -> productSpeciesId`)
  - activation constraints (`distance`, `relative speed`)
  - probabilistic conversion based on `dt`, environment and rule rate
- Added extensible environment/config inputs (temperature, pressure, medium, bounds, interaction scale).

## Contracts
- `stepParticleModel(input)` returns:
  - next `state` (`particles`, `elapsedMs`, `totalReactions`)
  - step `metrics` (`collisionCount`, `interactionPairCount`, `reactionEvents`)
- Core domain types:
  - `Particle`, `ParticleReactionRule`
  - `ParticleModelState`, `ParticleModelEnvironment`, `ParticleModelConfig`

## Verification
Run from `app/`:

```bash
npm run lint
npx vitest run src/features/simulation/particleModel.test.ts src/features/simulation/simulationLoop.test.ts
npm run test
npm run build
```

Expected:
- collision overlap separation is validated
- collision impulse invariant is validated:
  - approaching particles receive bounce impulse
  - separating particles do not receive extra bounce impulse
- reaction conversion path is validated
- long-run integration stability remains finite and bounded
