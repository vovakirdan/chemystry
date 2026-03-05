export type ParticleRole = "reactant" | "product" | "inert";

export type ParticleMedium = "gas" | "liquid" | "vacuum";

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type Particle = {
  id: string;
  speciesId: string;
  role: ParticleRole;
  radius: number;
  mass: number;
  position: Vector3;
  velocity: Vector3;
};

export type ParticleReactionRule = {
  id: string;
  reactants: readonly [string, string];
  productSpeciesId: string;
  activationDistance: number;
  activationSpeed: number;
  probabilityPerSecond: number;
};

export type ParticleModelEnvironment = {
  temperatureK: number;
  pressureAtm: number;
  medium: ParticleMedium;
};

export type ParticleModelConfig = {
  boundsHalfExtent: number;
  collisionRestitution: number;
  interactionRange: number;
  interactionStrength: number;
  maxSpeed: number;
  reactionGlobalScale: number;
};

export type ParticleModelState = {
  particles: ReadonlyArray<Particle>;
  elapsedMs: number;
  totalReactions: number;
};

export type ParticleReactionEvent = {
  ruleId: string;
  particleIds: readonly [string, string];
  productSpeciesId: string;
};

export type ParticleModelStepMetrics = {
  collisionCount: number;
  interactionPairCount: number;
  reactionCount: number;
  reactionEvents: ReadonlyArray<ParticleReactionEvent>;
};

export type ParticleModelStepResult = {
  state: ParticleModelState;
  metrics: ParticleModelStepMetrics;
};

export type ParticleModelStepInput = {
  state: ParticleModelState;
  deltaMs: number;
  rules?: ReadonlyArray<ParticleReactionRule>;
  environment?: Partial<ParticleModelEnvironment>;
  config?: Partial<ParticleModelConfig>;
  random?: () => number;
};

const DEFAULT_ENVIRONMENT: Readonly<ParticleModelEnvironment> = Object.freeze({
  temperatureK: 298.15,
  pressureAtm: 1,
  medium: "gas",
});

const DEFAULT_CONFIG: Readonly<ParticleModelConfig> = Object.freeze({
  boundsHalfExtent: 12,
  collisionRestitution: 0.9,
  interactionRange: 3.4,
  interactionStrength: 0.8,
  maxSpeed: 9,
  reactionGlobalScale: 1,
});

const EPSILON = 1e-6;
const MAX_DELTA_MS = 250;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizePositive(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function sanitizeEnvironment(
  input: Partial<ParticleModelEnvironment> | undefined,
): ParticleModelEnvironment {
  return {
    temperatureK: sanitizePositive(input?.temperatureK, DEFAULT_ENVIRONMENT.temperatureK),
    pressureAtm: sanitizePositive(input?.pressureAtm, DEFAULT_ENVIRONMENT.pressureAtm),
    medium: input?.medium ?? DEFAULT_ENVIRONMENT.medium,
  };
}

function sanitizeConfig(input: Partial<ParticleModelConfig> | undefined): ParticleModelConfig {
  return {
    boundsHalfExtent: sanitizePositive(input?.boundsHalfExtent, DEFAULT_CONFIG.boundsHalfExtent),
    collisionRestitution: clamp(
      input?.collisionRestitution ?? DEFAULT_CONFIG.collisionRestitution,
      0,
      1,
    ),
    interactionRange: sanitizePositive(input?.interactionRange, DEFAULT_CONFIG.interactionRange),
    interactionStrength: sanitizePositive(
      input?.interactionStrength,
      DEFAULT_CONFIG.interactionStrength,
    ),
    maxSpeed: sanitizePositive(input?.maxSpeed, DEFAULT_CONFIG.maxSpeed),
    reactionGlobalScale: sanitizePositive(
      input?.reactionGlobalScale,
      DEFAULT_CONFIG.reactionGlobalScale,
    ),
  };
}

function cloneParticle(particle: Particle): Particle {
  return {
    ...particle,
    position: { ...particle.position },
    velocity: { ...particle.velocity },
  };
}

function vectorDelta(from: Vector3, to: Vector3): Vector3 {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  };
}

function vectorLength(vector: Vector3): number {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
}

function normalize(vector: Vector3): Vector3 {
  const length = vectorLength(vector);
  if (length <= EPSILON) {
    return { x: 1, y: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function dot(left: Vector3, right: Vector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function sanitizeParticle(particle: Particle, config: ParticleModelConfig): Particle {
  const sanitized = cloneParticle(particle);

  sanitized.radius = sanitizePositive(sanitized.radius, 0.2);
  sanitized.mass = sanitizePositive(sanitized.mass, 1);
  sanitized.position.x = Number.isFinite(sanitized.position.x) ? sanitized.position.x : 0;
  sanitized.position.y = Number.isFinite(sanitized.position.y) ? sanitized.position.y : 0;
  sanitized.position.z = Number.isFinite(sanitized.position.z) ? sanitized.position.z : 0;
  sanitized.velocity.x = Number.isFinite(sanitized.velocity.x) ? sanitized.velocity.x : 0;
  sanitized.velocity.y = Number.isFinite(sanitized.velocity.y) ? sanitized.velocity.y : 0;
  sanitized.velocity.z = Number.isFinite(sanitized.velocity.z) ? sanitized.velocity.z : 0;
  limitParticleSpeed(sanitized, config.maxSpeed);

  return sanitized;
}

function limitParticleSpeed(particle: Particle, maxSpeed: number): void {
  const speed = vectorLength(particle.velocity);
  if (speed <= maxSpeed || speed <= EPSILON) {
    return;
  }

  const scale = maxSpeed / speed;
  particle.velocity.x *= scale;
  particle.velocity.y *= scale;
  particle.velocity.z *= scale;
}

function applyBoundaryConstraints(particle: Particle, config: ParticleModelConfig): void {
  const halfExtent = config.boundsHalfExtent;
  const restitution = config.collisionRestitution;
  const axes: Array<keyof Vector3> = ["x", "y", "z"];

  for (const axis of axes) {
    const min = -halfExtent + particle.radius;
    const max = halfExtent - particle.radius;
    const value = particle.position[axis];

    if (value < min) {
      particle.position[axis] = min;
      particle.velocity[axis] = Math.abs(particle.velocity[axis]) * restitution;
    } else if (value > max) {
      particle.position[axis] = max;
      particle.velocity[axis] = -Math.abs(particle.velocity[axis]) * restitution;
    }
  }
}

function resolveInteractionSign(leftRole: ParticleRole, rightRole: ParticleRole): number {
  if (leftRole === "inert" || rightRole === "inert") {
    return 0;
  }

  if (leftRole === rightRole) {
    return 1;
  }

  return -1;
}

function pairMatchesRule(rule: ParticleReactionRule, left: Particle, right: Particle): boolean {
  const [firstReactant, secondReactant] = rule.reactants;
  return (
    (left.speciesId === firstReactant && right.speciesId === secondReactant) ||
    (left.speciesId === secondReactant && right.speciesId === firstReactant)
  );
}

function resolveReactionProbability(
  rule: ParticleReactionRule,
  deltaSeconds: number,
  environment: ParticleModelEnvironment,
  config: ParticleModelConfig,
): number {
  const temperatureFactor = clamp(
    environment.temperatureK / DEFAULT_ENVIRONMENT.temperatureK,
    0.25,
    4,
  );
  const pressureFactor = clamp(environment.pressureAtm / DEFAULT_ENVIRONMENT.pressureAtm, 0.2, 5);
  const mediumFactor =
    environment.medium === "liquid" ? 0.75 : environment.medium === "vacuum" ? 0.45 : 1;
  const baseProbability =
    rule.probabilityPerSecond *
    deltaSeconds *
    config.reactionGlobalScale *
    temperatureFactor *
    pressureFactor *
    mediumFactor;

  return clamp(baseProbability, 0, 1);
}

export function stepParticleModel(input: ParticleModelStepInput): ParticleModelStepResult {
  const deltaMs = clamp(sanitizePositive(input.deltaMs, 0), 0, MAX_DELTA_MS);
  const deltaSeconds = deltaMs / 1000;
  const environment = sanitizeEnvironment(input.environment);
  const config = sanitizeConfig(input.config);
  const random = input.random ?? Math.random;
  const rules = input.rules ?? [];

  const particles = input.state.particles.map((particle) => sanitizeParticle(particle, config));
  const reactedParticleIds = new Set<string>();
  const reactionEvents: ParticleReactionEvent[] = [];
  let collisionCount = 0;
  let interactionPairCount = 0;

  particles.forEach((particle) => {
    particle.position.x += particle.velocity.x * deltaSeconds;
    particle.position.y += particle.velocity.y * deltaSeconds;
    particle.position.z += particle.velocity.z * deltaSeconds;
  });

  for (let leftIndex = 0; leftIndex < particles.length; leftIndex += 1) {
    const left = particles[leftIndex];

    for (let rightIndex = leftIndex + 1; rightIndex < particles.length; rightIndex += 1) {
      const right = particles[rightIndex];
      const delta = vectorDelta(left.position, right.position);
      const distance = vectorLength(delta);
      const combinedRadius = left.radius + right.radius;
      const normal = normalize(delta);
      const inverseMassLeft = 1 / left.mass;
      const inverseMassRight = 1 / right.mass;

      if (distance < combinedRadius) {
        const overlap = combinedRadius - distance;
        const separationScale = overlap / (inverseMassLeft + inverseMassRight);
        left.position.x -= normal.x * separationScale * inverseMassLeft;
        left.position.y -= normal.y * separationScale * inverseMassLeft;
        left.position.z -= normal.z * separationScale * inverseMassLeft;
        right.position.x += normal.x * separationScale * inverseMassRight;
        right.position.y += normal.y * separationScale * inverseMassRight;
        right.position.z += normal.z * separationScale * inverseMassRight;

        const relativeVelocity = {
          x: left.velocity.x - right.velocity.x,
          y: left.velocity.y - right.velocity.y,
          z: left.velocity.z - right.velocity.z,
        };
        const velocityAlongNormal = dot(relativeVelocity, normal);

        // `relativeVelocity` is computed as `left - right` with normal `left -> right`.
        // Positive projection means particles are approaching and need collision impulse.
        if (velocityAlongNormal > 0) {
          const impulseMagnitude =
            (-(1 + config.collisionRestitution) * velocityAlongNormal) /
            (inverseMassLeft + inverseMassRight);

          left.velocity.x += (impulseMagnitude * normal.x) / left.mass;
          left.velocity.y += (impulseMagnitude * normal.y) / left.mass;
          left.velocity.z += (impulseMagnitude * normal.z) / left.mass;
          right.velocity.x -= (impulseMagnitude * normal.x) / right.mass;
          right.velocity.y -= (impulseMagnitude * normal.y) / right.mass;
          right.velocity.z -= (impulseMagnitude * normal.z) / right.mass;
        }

        collisionCount += 1;
      } else if (distance < config.interactionRange) {
        const interactionSign = resolveInteractionSign(left.role, right.role);
        if (interactionSign !== 0) {
          const normalizedDistance = clamp(distance / config.interactionRange, 0, 1);
          const interactionMagnitude =
            config.interactionStrength * (1 - normalizedDistance) * deltaSeconds * interactionSign;

          left.velocity.x += (interactionMagnitude * normal.x) / left.mass;
          left.velocity.y += (interactionMagnitude * normal.y) / left.mass;
          left.velocity.z += (interactionMagnitude * normal.z) / left.mass;
          right.velocity.x -= (interactionMagnitude * normal.x) / right.mass;
          right.velocity.y -= (interactionMagnitude * normal.y) / right.mass;
          right.velocity.z -= (interactionMagnitude * normal.z) / right.mass;
          interactionPairCount += 1;
        }
      }

      if (reactedParticleIds.has(left.id) || reactedParticleIds.has(right.id)) {
        continue;
      }

      const relativeSpeed = vectorLength({
        x: left.velocity.x - right.velocity.x,
        y: left.velocity.y - right.velocity.y,
        z: left.velocity.z - right.velocity.z,
      });

      for (const rule of rules) {
        if (!pairMatchesRule(rule, left, right)) {
          continue;
        }

        if (distance > rule.activationDistance || relativeSpeed < rule.activationSpeed) {
          continue;
        }

        const probability = resolveReactionProbability(rule, deltaSeconds, environment, config);
        if (random() > probability) {
          continue;
        }

        left.speciesId = rule.productSpeciesId;
        right.speciesId = rule.productSpeciesId;
        left.role = "product";
        right.role = "product";
        left.velocity.x *= 0.7;
        left.velocity.y *= 0.7;
        left.velocity.z *= 0.7;
        right.velocity.x *= 0.7;
        right.velocity.y *= 0.7;
        right.velocity.z *= 0.7;
        reactedParticleIds.add(left.id);
        reactedParticleIds.add(right.id);
        reactionEvents.push({
          ruleId: rule.id,
          particleIds: [left.id, right.id],
          productSpeciesId: rule.productSpeciesId,
        });
        break;
      }
    }
  }

  particles.forEach((particle) => {
    limitParticleSpeed(particle, config.maxSpeed);
    applyBoundaryConstraints(particle, config);
    particle.position.x = Number.isFinite(particle.position.x) ? particle.position.x : 0;
    particle.position.y = Number.isFinite(particle.position.y) ? particle.position.y : 0;
    particle.position.z = Number.isFinite(particle.position.z) ? particle.position.z : 0;
  });

  return {
    state: {
      particles,
      elapsedMs: input.state.elapsedMs + deltaMs,
      totalReactions: input.state.totalReactions + reactionEvents.length,
    },
    metrics: {
      collisionCount,
      interactionPairCount,
      reactionCount: reactionEvents.length,
      reactionEvents,
    },
  };
}
