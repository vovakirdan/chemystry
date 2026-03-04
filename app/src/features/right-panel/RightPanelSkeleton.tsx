import { useEffect, useMemo, useState } from "react";
import { DEFAULT_RIGHT_PANEL_SECTION, type RightPanelSectionId } from "./model";
import {
  formatStoichiometryValue,
  type StoichiometryCalculationResult,
} from "../../shared/lib/stoichiometry";

export type RightPanelFeatureStatus = {
  id: string;
  label: string;
  availability: string;
};

type RightPanelSkeletonProps = {
  healthMessage: string;
  featureStatuses: ReadonlyArray<RightPanelFeatureStatus>;
  runtimeSettings?: RightPanelRuntimeSettings;
  onRuntimeSettingsChange?: (state: RightPanelRuntimeSettings) => void;
  stoichiometryResult?: StoichiometryCalculationResult;
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

const PRECISION_PROFILE_OPTIONS = ["Balanced", "High Precision", "Custom"] as const;
type PrecisionProfile = (typeof PRECISION_PROFILE_OPTIONS)[number];

const DEFAULT_PRECISION_PROFILE: PrecisionProfile = "Balanced";
const DEFAULT_TEMPERATURE_C = 25;
const DEFAULT_PRESSURE_ATM = 1;
const DEFAULT_CALCULATION_PASSES = 250;
const DEFAULT_FPS_LIMIT = 60;

export type RightPanelRuntimeSettings = {
  temperatureC: number | null;
  pressureAtm: number | null;
  calculationPasses: number | null;
  precisionProfile: PrecisionProfile;
  fpsLimit: number | null;
};

function isPrecisionProfile(value: string): value is PrecisionProfile {
  return PRECISION_PROFILE_OPTIONS.includes(value as PrecisionProfile);
}

function parseNumberInput(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsedValue = Number(normalized);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatRuntimeNumberInput(value: number | null | undefined, fallbackValue: number): string {
  if (value === undefined) {
    return String(fallbackValue);
  }

  if (value === null) {
    return "";
  }

  return String(value);
}

function RightPanelSkeleton({
  healthMessage,
  featureStatuses,
  runtimeSettings,
  onRuntimeSettingsChange,
  stoichiometryResult,
}: RightPanelSkeletonProps) {
  const [activeSection, setActiveSection] = useState<RightPanelSectionId>(
    DEFAULT_RIGHT_PANEL_SECTION,
  );
  const [ambientFogEnabled, setAmbientFogEnabled] = useState(false);
  const [temperatureCInput, setTemperatureCInput] = useState(
    formatRuntimeNumberInput(
      runtimeSettings === undefined ? DEFAULT_TEMPERATURE_C : runtimeSettings.temperatureC,
      DEFAULT_TEMPERATURE_C,
    ),
  );
  const [pressureAtmInput, setPressureAtmInput] = useState(
    formatRuntimeNumberInput(
      runtimeSettings === undefined ? DEFAULT_PRESSURE_ATM : runtimeSettings.pressureAtm,
      DEFAULT_PRESSURE_ATM,
    ),
  );
  const [calculationPassesInput, setCalculationPassesInput] = useState(
    formatRuntimeNumberInput(
      runtimeSettings === undefined
        ? DEFAULT_CALCULATION_PASSES
        : runtimeSettings.calculationPasses,
      DEFAULT_CALCULATION_PASSES,
    ),
  );
  const [precisionProfile, setPrecisionProfile] = useState<PrecisionProfile>(
    runtimeSettings?.precisionProfile ?? DEFAULT_PRECISION_PROFILE,
  );
  const [fpsLimitInput, setFpsLimitInput] = useState(
    formatRuntimeNumberInput(
      runtimeSettings === undefined ? DEFAULT_FPS_LIMIT : runtimeSettings.fpsLimit,
      DEFAULT_FPS_LIMIT,
    ),
  );
  const [summaryNote, setSummaryNote] = useState("Initial scenario review pending.");

  const parsedTemperatureC = useMemo(
    () => parseNumberInput(temperatureCInput),
    [temperatureCInput],
  );
  const parsedPressureAtm = useMemo(() => parseNumberInput(pressureAtmInput), [pressureAtmInput]);
  const parsedCalculationPasses = useMemo(
    () => parseNumberInput(calculationPassesInput),
    [calculationPassesInput],
  );
  const parsedFpsLimit = useMemo(() => parseNumberInput(fpsLimitInput), [fpsLimitInput]);

  useEffect(() => {
    onRuntimeSettingsChange?.({
      temperatureC: parsedTemperatureC,
      pressureAtm: parsedPressureAtm,
      calculationPasses: parsedCalculationPasses,
      precisionProfile,
      fpsLimit: parsedFpsLimit,
    });
  }, [
    onRuntimeSettingsChange,
    parsedCalculationPasses,
    parsedFpsLimit,
    parsedPressureAtm,
    parsedTemperatureC,
    precisionProfile,
  ]);

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
                <label htmlFor="right-panel-environment-temperature-input">Temperature (°C)</label>
                <input
                  id="right-panel-environment-temperature-input"
                  type="number"
                  step={0.1}
                  aria-label="Environment temperature in Celsius"
                  data-testid="right-panel-environment-temperature"
                  value={temperatureCInput}
                  onChange={(event) => setTemperatureCInput(event.currentTarget.value)}
                />
                <p className="status-line" data-testid="right-panel-environment-temperature-value">
                  Temperature: {parsedTemperatureC === null ? "not set" : parsedTemperatureC}
                  &deg;C
                </p>

                <label htmlFor="right-panel-environment-pressure-input">Pressure (atm)</label>
                <input
                  id="right-panel-environment-pressure-input"
                  type="number"
                  step={0.01}
                  aria-label="Environment pressure in atmospheres"
                  data-testid="right-panel-environment-pressure"
                  value={pressureAtmInput}
                  onChange={(event) => setPressureAtmInput(event.currentTarget.value)}
                />
                <p className="status-line" data-testid="right-panel-environment-pressure-value">
                  Pressure: {parsedPressureAtm === null ? "not set" : parsedPressureAtm} atm
                </p>

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
                  value={calculationPassesInput}
                  onChange={(event) => setCalculationPassesInput(event.currentTarget.value)}
                />
                <p className="status-line" data-testid="right-panel-calculations-value">
                  Planned passes:{" "}
                  {parsedCalculationPasses === null ? "not set" : parsedCalculationPasses}
                </p>

                <label htmlFor="right-panel-precision-profile-select">Precision profile</label>
                <select
                  id="right-panel-precision-profile-select"
                  aria-label="Simulation precision profile"
                  data-testid="right-panel-calculations-precision"
                  value={precisionProfile}
                  onChange={(event) => {
                    const nextProfile = event.currentTarget.value;

                    if (isPrecisionProfile(nextProfile)) {
                      setPrecisionProfile(nextProfile);
                    }
                  }}
                >
                  {PRECISION_PROFILE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="status-line" data-testid="right-panel-calculations-precision-value">
                  Precision profile: {precisionProfile}
                </p>

                <label htmlFor="right-panel-fps-limit-input">FPS limit</label>
                <input
                  id="right-panel-fps-limit-input"
                  type="number"
                  min={1}
                  step={1}
                  aria-label="Simulation FPS limit"
                  data-testid="right-panel-calculations-fps"
                  value={fpsLimitInput}
                  onChange={(event) => setFpsLimitInput(event.currentTarget.value)}
                />
                <p className="status-line" data-testid="right-panel-calculations-fps-value">
                  FPS limit: {parsedFpsLimit === null ? "not set" : parsedFpsLimit}
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

                {stoichiometryResult === undefined ? null : (
                  <section
                    className={`right-panel-summary-block ${
                      stoichiometryResult.ok
                        ? "right-panel-summary-block--ready"
                        : "right-panel-summary-block--error"
                    }`}
                    aria-label="Stoichiometry summary"
                    data-testid="right-panel-summary-stoichiometry"
                  >
                    <h4 className="panel-subtitle">Stoichiometry (MVP)</h4>
                    {stoichiometryResult.ok ? (
                      <>
                        <p
                          className="status-line"
                          data-testid="right-panel-summary-stoichiometry-limiting"
                        >
                          Limiting reactant:{" "}
                          {stoichiometryResult.limitingReactants
                            .map((reactant) => reactant.label)
                            .join(", ")}
                        </p>
                        <p
                          className="status-line"
                          data-testid="right-panel-summary-stoichiometry-extent"
                        >
                          Reaction extent:{" "}
                          {formatStoichiometryValue(stoichiometryResult.reactionExtentMol)}{" "}
                          {stoichiometryResult.units.reactionExtent}
                        </p>

                        <p className="status-line">Theoretical product amounts:</p>
                        <ul
                          className="status-list"
                          data-testid="right-panel-summary-stoichiometry-products"
                        >
                          {stoichiometryResult.participants
                            .filter((participant) => participant.role === "product")
                            .map((participant) => (
                              <li key={participant.id}>
                                {participant.label}:{" "}
                                {formatStoichiometryValue(participant.theoreticalAmountMol)}{" "}
                                {stoichiometryResult.units.amount}
                              </li>
                            ))}
                        </ul>

                        <p className="status-line">Reactant amounts after full conversion:</p>
                        <ul
                          className="status-list"
                          data-testid="right-panel-summary-stoichiometry-reactants"
                        >
                          {stoichiometryResult.participants
                            .filter((participant) => participant.role === "reactant")
                            .map((participant) => (
                              <li key={participant.id}>
                                {participant.label}: remaining{" "}
                                {formatStoichiometryValue(participant.remainingAmountMol ?? 0)}{" "}
                                {stoichiometryResult.units.amount}
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <p
                          className="status-line"
                          data-testid="right-panel-summary-stoichiometry-error"
                        >
                          Stoichiometry is blocked until required Builder inputs are complete.
                        </p>
                        <ul
                          className="status-list"
                          data-testid="right-panel-summary-stoichiometry-errors"
                        >
                          {stoichiometryResult.errors.map((error, index) => (
                            <li key={`${error.code}-${index.toString()}`}>{error.message}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    <p
                      className="status-line"
                      data-testid="right-panel-summary-stoichiometry-units"
                    >
                      Units: amounts and reaction extent in {stoichiometryResult.units.amount};
                      coefficients as {stoichiometryResult.units.coefficient}.
                    </p>
                    <ul
                      className="status-list"
                      data-testid="right-panel-summary-stoichiometry-assumptions"
                    >
                      {stoichiometryResult.assumptions.map((assumption, index) => (
                        <li key={`stoichiometry-assumption-${index.toString()}`}>{assumption}</li>
                      ))}
                    </ul>
                  </section>
                )}

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
