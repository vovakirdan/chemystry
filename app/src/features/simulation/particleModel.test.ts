import { describe, expect, it } from "vitest";
import {
  stepParticleModel,
  type Particle,
  type ParticleModelState,
  type ParticleReactionRule,
} from "./particleModel";

function createParticle(
  overrides: Partial<Particle> & Pick<Particle, "id" | "speciesId">,
): Particle {
  return {
    id: overrides.id,
    speciesId: overrides.speciesId,
    role: overrides.role ?? "reactant",
    radius: overrides.radius ?? 0.45,
    mass: overrides.mass ?? 1,
    position: overrides.position ?? { x: 0, y: 0, z: 0 },
    velocity: overrides.velocity ?? { x: 0, y: 0, z: 0 },
  };
}

function createState(particles: ReadonlyArray<Particle>): ParticleModelState {
  return {
    particles,
    elapsedMs: 0,
    totalReactions: 0,
  };
}

function createDeterministicRandom(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current = (1664525 * current + 1013904223) >>> 0;
    return current / 0x100000000;
  };
}

describe("stepParticleModel", () => {
  it("resolves particle overlap with collision response and keeps particles finite", () => {
    const initialState = createState([
      createParticle({
        id: "p-left",
        speciesId: "A",
        position: { x: -0.2, y: 0, z: 0 },
        velocity: { x: 1.5, y: 0, z: 0 },
      }),
      createParticle({
        id: "p-right",
        speciesId: "B",
        role: "product",
        position: { x: 0.2, y: 0, z: 0 },
        velocity: { x: -1.5, y: 0, z: 0 },
      }),
    ]);

    const result = stepParticleModel({
      state: initialState,
      deltaMs: 16,
      config: {
        boundsHalfExtent: 8,
      },
      random: () => 1,
    });

    expect(result.metrics.collisionCount).toBeGreaterThan(0);

    const [left, right] = result.state.particles;
    const deltaX = right.position.x - left.position.x;
    const deltaY = right.position.y - left.position.y;
    const deltaZ = right.position.z - left.position.z;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    expect(distance).toBeGreaterThanOrEqual(left.radius + right.radius - 1e-4);
    expect(Number.isFinite(left.position.x)).toBe(true);
    expect(Number.isFinite(right.position.x)).toBe(true);
  });

  it("applies collision impulse only for approaching particles", () => {
    const approachingState = createState([
      createParticle({
        id: "approach-left",
        speciesId: "A",
        position: { x: -0.2, y: 0, z: 0 },
        velocity: { x: 2, y: 0, z: 0 },
      }),
      createParticle({
        id: "approach-right",
        speciesId: "B",
        position: { x: 0.2, y: 0, z: 0 },
        velocity: { x: -1, y: 0, z: 0 },
      }),
    ]);

    const approachingResult = stepParticleModel({
      state: approachingState,
      deltaMs: 0,
      random: () => 1,
    });
    const [approachLeft, approachRight] = approachingResult.state.particles;
    expect(approachLeft.velocity.x).toBeLessThan(2);
    expect(approachRight.velocity.x).toBeGreaterThan(-1);

    const separatingState = createState([
      createParticle({
        id: "separate-left",
        speciesId: "A",
        position: { x: -0.2, y: 0, z: 0 },
        velocity: { x: -2, y: 0, z: 0 },
      }),
      createParticle({
        id: "separate-right",
        speciesId: "B",
        position: { x: 0.2, y: 0, z: 0 },
        velocity: { x: 1, y: 0, z: 0 },
      }),
    ]);

    const separatingResult = stepParticleModel({
      state: separatingState,
      deltaMs: 0,
      random: () => 1,
    });
    const [separateLeft, separateRight] = separatingResult.state.particles;
    expect(separateLeft.velocity.x).toBeCloseTo(-2, 6);
    expect(separateRight.velocity.x).toBeCloseTo(1, 6);
  });

  it("applies minimal reaction kinetics when reactants satisfy distance and speed conditions", () => {
    const initialState = createState([
      createParticle({
        id: "r1",
        speciesId: "H2",
        position: { x: -0.25, y: 0, z: 0 },
        velocity: { x: 4, y: 0, z: 0 },
      }),
      createParticle({
        id: "r2",
        speciesId: "O2",
        position: { x: 0.25, y: 0, z: 0 },
        velocity: { x: -4, y: 0, z: 0 },
      }),
    ]);

    const rules: ReadonlyArray<ParticleReactionRule> = [
      {
        id: "rule-water",
        reactants: ["H2", "O2"],
        productSpeciesId: "H2O",
        activationDistance: 2,
        activationSpeed: 0.2,
        probabilityPerSecond: 20,
      },
    ];

    const result = stepParticleModel({
      state: initialState,
      deltaMs: 80,
      rules,
      random: () => 0,
    });

    expect(result.metrics.reactionCount).toBe(1);
    expect(result.metrics.reactionEvents[0].ruleId).toBe("rule-water");
    expect(result.state.totalReactions).toBe(1);
    expect(result.state.particles.every((particle) => particle.speciesId === "H2O")).toBe(true);
    expect(result.state.particles.every((particle) => particle.role === "product")).toBe(true);
  });

  it("stays numerically stable over long integration runs with many particles", () => {
    const random = createDeterministicRandom(42);
    const particles: Particle[] = [];
    for (let index = 0; index < 30; index += 1) {
      particles.push(
        createParticle({
          id: `p-${index.toString()}`,
          speciesId: index % 2 === 0 ? "A" : "B",
          role: index % 2 === 0 ? "reactant" : "product",
          radius: 0.25 + (index % 3) * 0.05,
          mass: 0.9 + (index % 4) * 0.2,
          position: {
            x: (random() - 0.5) * 8,
            y: (random() - 0.5) * 8,
            z: (random() - 0.5) * 8,
          },
          velocity: {
            x: (random() - 0.5) * 6,
            y: (random() - 0.5) * 6,
            z: (random() - 0.5) * 6,
          },
        }),
      );
    }

    let state = createState(particles);
    const reactionRule: ParticleReactionRule = {
      id: "rule-a-b",
      reactants: ["A", "B"],
      productSpeciesId: "AB",
      activationDistance: 1.2,
      activationSpeed: 0.15,
      probabilityPerSecond: 2.5,
    };
    let totalCollisions = 0;
    let totalInteractions = 0;

    for (let stepIndex = 0; stepIndex < 800; stepIndex += 1) {
      const result = stepParticleModel({
        state,
        deltaMs: 16,
        rules: [reactionRule],
        config: {
          boundsHalfExtent: 6,
          interactionRange: 2.6,
          interactionStrength: 1.1,
        },
        random,
      });

      state = result.state;
      totalCollisions += result.metrics.collisionCount;
      totalInteractions += result.metrics.interactionPairCount;

      for (const particle of state.particles) {
        expect(Number.isFinite(particle.position.x)).toBe(true);
        expect(Number.isFinite(particle.position.y)).toBe(true);
        expect(Number.isFinite(particle.position.z)).toBe(true);
        expect(Math.abs(particle.position.x)).toBeLessThanOrEqual(6.001);
        expect(Math.abs(particle.position.y)).toBeLessThanOrEqual(6.001);
        expect(Math.abs(particle.position.z)).toBeLessThanOrEqual(6.001);
      }
    }

    expect(totalCollisions).toBeGreaterThan(0);
    expect(totalInteractions).toBeGreaterThan(0);
    expect(state.totalReactions).toBeGreaterThanOrEqual(0);
    expect(state.elapsedMs).toBe(12_800);
  });
});
