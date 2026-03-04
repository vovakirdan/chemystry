import type { ReactNode } from "react";
import type { LeftPanelPlaceholderState, LeftPanelTabId } from "./model";

type LeftPanelTabDefinition = {
  id: LeftPanelTabId;
  label: string;
  title: string;
  description: string;
};

type LeftPanelSkeletonProps = {
  activeTab: LeftPanelTabId;
  onTabChange: (tab: LeftPanelTabId) => void;
  placeholderStateByTab: Readonly<Record<LeftPanelTabId, LeftPanelPlaceholderState>>;
};

const LEFT_PANEL_TAB_DEFINITIONS: ReadonlyArray<LeftPanelTabDefinition> = [
  {
    id: "library",
    label: "Library",
    title: "Substance Library",
    description: "Container boundary for searchable compounds and category metadata.",
  },
  {
    id: "builder",
    label: "Builder",
    title: "Reaction Builder",
    description: "Container boundary for step inputs, constraints, and validation state.",
  },
  {
    id: "presets",
    label: "Presets",
    title: "Saved Presets",
    description: "Container boundary for reusable scenario templates and quick apply actions.",
  },
];

const LEFT_PANEL_TAB_BY_ID: Record<LeftPanelTabId, LeftPanelTabDefinition> = {
  library: LEFT_PANEL_TAB_DEFINITIONS[0],
  builder: LEFT_PANEL_TAB_DEFINITIONS[1],
  presets: LEFT_PANEL_TAB_DEFINITIONS[2],
};

function renderPlaceholder(
  tab: LeftPanelTabDefinition,
  state: LeftPanelPlaceholderState,
): ReactNode {
  switch (state) {
    case "loading":
      return (
        <div
          className="left-panel-placeholder left-panel-placeholder--loading"
          data-testid={`left-panel-placeholder-${tab.id}-loading`}
        >
          <h4 className="left-panel-placeholder-title">Loading {tab.label.toLowerCase()} data</h4>
          <p className="left-panel-placeholder-text">
            Placeholder shown while this section is waiting for its first payload.
          </p>
        </div>
      );
    case "empty":
      return (
        <div
          className="left-panel-placeholder left-panel-placeholder--empty"
          data-testid={`left-panel-placeholder-${tab.id}-empty`}
        >
          <h4 className="left-panel-placeholder-title">{tab.label} is empty</h4>
          <p className="left-panel-placeholder-text">
            Placeholder shown when requests succeed but there is no data to display.
          </p>
        </div>
      );
    case "error":
      return (
        <div
          className="left-panel-placeholder left-panel-placeholder--error"
          role="alert"
          data-testid={`left-panel-placeholder-${tab.id}-error`}
        >
          <h4 className="left-panel-placeholder-title">Unable to load {tab.label.toLowerCase()}</h4>
          <p className="left-panel-placeholder-text">
            Placeholder shown when data fetches fail and retry actions will be added later.
          </p>
        </div>
      );
    default:
      return null;
  }
}

function LeftPanelSkeleton({
  activeTab,
  onTabChange,
  placeholderStateByTab,
}: LeftPanelSkeletonProps) {
  const activeDefinition = LEFT_PANEL_TAB_BY_ID[activeTab];
  const activePlaceholderState = placeholderStateByTab[activeTab];
  const tabPanelId = `left-panel-tabpanel-${activeTab}`;
  const tabButtonId = `left-panel-tab-${activeTab}`;

  return (
    <div className="left-panel-skeleton" data-testid="left-panel-skeleton">
      <header className="left-panel-header">
        <h2 className="panel-title">Workspace</h2>
        <p className="panel-description">
          Use Tab to move through controls. Use Alt+1, Alt+2, and Alt+3 to jump between the main
          panels.
        </p>
      </header>

      <div
        className="left-panel-tabs"
        role="tablist"
        aria-label="Left panel sections"
        data-testid="left-panel-tab-list"
      >
        {LEFT_PANEL_TAB_DEFINITIONS.map((tab) => {
          const isActive = tab.id === activeTab;
          const tabId = `left-panel-tab-${tab.id}`;
          const panelId = `left-panel-tabpanel-${tab.id}`;

          return (
            <button
              key={tab.id}
              id={tabId}
              className="left-panel-tab"
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              aria-label={`${tab.label} tab`}
              data-testid={`left-panel-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section
        id={tabPanelId}
        className="left-panel-content"
        role="tabpanel"
        aria-labelledby={tabButtonId}
        aria-label={`${activeDefinition.label} panel content`}
        data-testid={`left-panel-content-${activeTab}`}
      >
        <header className="left-panel-content-header">
          <h3 className="panel-subtitle">{activeDefinition.title}</h3>
          <p className="panel-description">{activeDefinition.description}</p>
        </header>

        <div
          className="left-panel-data-boundary"
          aria-live="polite"
          data-testid={`left-panel-data-boundary-${activeTab}`}
        >
          {renderPlaceholder(activeDefinition, activePlaceholderState)}
        </div>
      </section>
    </div>
  );
}

export default LeftPanelSkeleton;
