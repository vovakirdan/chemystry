export const RIGHT_PANEL_SECTION_IDS = ["environment", "calculations", "summary"] as const;

export type RightPanelSectionId = (typeof RIGHT_PANEL_SECTION_IDS)[number];

export const DEFAULT_RIGHT_PANEL_SECTION: RightPanelSectionId = "environment";
