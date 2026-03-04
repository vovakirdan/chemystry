import { useState } from "react";
import { DEFAULT_RIGHT_PANEL_SECTION, type RightPanelSectionId } from "./model";

export type RightPanelFeatureStatus = {
  id: string;
  label: string;
  availability: string;
};

type RightPanelSkeletonProps = {
  healthMessage: string;
  featureStatuses: ReadonlyArray<RightPanelFeatureStatus>;
};

type RightPanelSectionDefinition = {
  id: RightPanelSectionId;
  label: string;
  title: string;
  description: string;
};

const RIGHT_PANEL_SECTION_DEFINITIONS: ReadonlyArray<RightPanelSectionDefinition> = [
  {
    id: "environment",
    label: "Environment",
    title: "Environment",
    description: "Skeleton controls for viewport surroundings and ambient conditions.",
  },
  {
    id: "calculations",
    label: "Calculations",
    title: "Calculations",
    description: "Skeleton controls for iteration, precision, and runtime strategies.",
  },
  {
    id: "summary",
    label: "Summary",
    title: "Summary",
    description: "Snapshot placeholder for shell status and simulation notes.",
  },
];

function RightPanelSkeleton({ healthMessage, featureStatuses }: RightPanelSkeletonProps) {
  const [activeSection, setActiveSection] = useState<RightPanelSectionId>(
    DEFAULT_RIGHT_PANEL_SECTION,
  );
  const [ambientFogEnabled, setAmbientFogEnabled] = useState(false);
  const [calculationPasses, setCalculationPasses] = useState("250");
  const [summaryNote, setSummaryNote] = useState("Initial scenario review pending.");

  return (
    <div className="right-panel-skeleton" data-testid="right-panel-skeleton">
      <header className="right-panel-header">
        <h2 className="panel-title">Inspector</h2>
        <p className="panel-description">
          Section state remains mounted while switching tabs so placeholder values persist.
        </p>
      </header>

      <div
        className="right-panel-tabs"
        role="tablist"
        aria-label="Right panel sections"
        data-testid="right-panel-tab-list"
      >
        {RIGHT_PANEL_SECTION_DEFINITIONS.map((section) => {
          const isActive = section.id === activeSection;
          const tabId = `right-panel-tab-${section.id}`;
          const panelId = `right-panel-tabpanel-${section.id}`;

          return (
            <button
              key={section.id}
              id={tabId}
              className="right-panel-tab"
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              aria-label={`${section.label} section tab`}
              data-testid={`right-panel-tab-${section.id}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {RIGHT_PANEL_SECTION_DEFINITIONS.map((section) => {
        const isActive = section.id === activeSection;
        const tabId = `right-panel-tab-${section.id}`;
        const panelId = `right-panel-tabpanel-${section.id}`;

        return (
          <section
            key={section.id}
            id={panelId}
            className="right-panel-section"
            role="tabpanel"
            aria-labelledby={tabId}
            aria-label={`${section.label} section`}
            data-testid={`right-panel-section-${section.id}`}
            hidden={!isActive}
          >
            <header className="right-panel-section-header">
              <h3 className="panel-subtitle">{section.title}</h3>
              <p className="panel-description">{section.description}</p>
            </header>

            {section.id === "environment" ? (
              <div className="right-panel-field">
                <label className="right-panel-toggle" htmlFor="right-panel-environment-fog-toggle">
                  <input
                    id="right-panel-environment-fog-toggle"
                    type="checkbox"
                    aria-label="Enable ambient fog placeholder"
                    data-testid="right-panel-environment-toggle"
                    checked={ambientFogEnabled}
                    onChange={(event) => setAmbientFogEnabled(event.currentTarget.checked)}
                  />
                  <span>Ambient fog placeholder</span>
                </label>
                <p className="status-line" data-testid="right-panel-environment-value">
                  Fog: {ambientFogEnabled ? "enabled" : "disabled"}
                </p>
              </div>
            ) : null}

            {section.id === "calculations" ? (
              <div className="right-panel-field">
                <label htmlFor="right-panel-calculation-passes-input">Iteration passes</label>
                <input
                  id="right-panel-calculation-passes-input"
                  type="number"
                  min={1}
                  step={1}
                  aria-label="Calculation iteration passes"
                  data-testid="right-panel-calculations-input"
                  value={calculationPasses}
                  onChange={(event) => setCalculationPasses(event.currentTarget.value)}
                />
                <p className="status-line" data-testid="right-panel-calculations-value">
                  Planned passes: {calculationPasses}
                </p>
              </div>
            ) : null}

            {section.id === "summary" ? (
              <div className="right-panel-summary" data-testid="right-panel-summary-content">
                <div className="right-panel-field">
                  <label htmlFor="right-panel-summary-note-input">Summary note</label>
                  <input
                    id="right-panel-summary-note-input"
                    type="text"
                    aria-label="Summary note"
                    data-testid="right-panel-summary-input"
                    value={summaryNote}
                    onChange={(event) => setSummaryNote(event.currentTarget.value)}
                  />
                </div>

                <p className="status-line" data-testid="right-panel-summary-health">
                  {healthMessage}
                </p>
                <ul className="status-list" aria-label="Feature status summary">
                  {featureStatuses.map((featureStatus) => (
                    <li
                      key={featureStatus.id}
                      data-testid={`right-panel-summary-feature-${featureStatus.id}`}
                    >
                      {featureStatus.label}: {featureStatus.availability}
                    </li>
                  ))}
                </ul>

                <h4 className="panel-subtitle">Panel shortcuts</h4>
                <ul className="kbd-list" aria-label="Panel keyboard shortcuts">
                  <li>
                    <span>Left panel</span>
                    <kbd>Alt+1</kbd>
                  </li>
                  <li>
                    <span>Center panel</span>
                    <kbd>Alt+2</kbd>
                  </li>
                  <li>
                    <span>Right panel</span>
                    <kbd>Alt+3</kbd>
                  </li>
                </ul>

                <p className="status-line" data-testid="right-panel-summary-note-preview">
                  Note preview: {summaryNote}
                </p>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export default RightPanelSkeleton;
