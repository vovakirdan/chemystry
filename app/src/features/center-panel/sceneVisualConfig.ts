import type { SceneParticipantRole } from "./sceneLifecycle";

export type SceneColorScheme = {
  reactantAtomHex: string;
  productAtomHex: string;
  bondHex: string;
  selectionEmissiveHex: string;
};

export const DEFAULT_SCENE_COLOR_SCHEME: Readonly<SceneColorScheme> = Object.freeze({
  reactantAtomHex: "#3f74c4",
  productAtomHex: "#50a06d",
  bondHex: "#8fa7c5",
  selectionEmissiveHex: "#ffd37a",
});

export function resolveSceneColorScheme(
  overrides: Partial<SceneColorScheme> | undefined,
): SceneColorScheme {
  return {
    ...DEFAULT_SCENE_COLOR_SCHEME,
    ...overrides,
  };
}

export function resolveAtomColorByRole(
  role: SceneParticipantRole,
  colorScheme: SceneColorScheme,
): string {
  return role === "reactant" ? colorScheme.reactantAtomHex : colorScheme.productAtomHex;
}
