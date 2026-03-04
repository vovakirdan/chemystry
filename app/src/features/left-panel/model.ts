export const LEFT_PANEL_TAB_IDS = ["library", "builder", "presets"] as const;

export type LeftPanelTabId = (typeof LEFT_PANEL_TAB_IDS)[number];
export type LeftPanelPlaceholderState = "loading" | "empty" | "error";

export const DEFAULT_LEFT_PANEL_TAB: LeftPanelTabId = "library";

export const isLeftPanelTabId = (value: string): value is LeftPanelTabId =>
  LEFT_PANEL_TAB_IDS.includes(value as LeftPanelTabId);
