import { useEffect, useMemo, useState } from "react";
import { DEFAULT_RIGHT_PANEL_SECTION, type RightPanelSectionId } from "./model";
import {
  formatStoichiometryValue,
  type StoichiometryCalculationResult,
} from "../../shared/lib/stoichiometry";
import type {
  CalculationResultTypeV1,
  CalculationSummaryV1,
  GasMediumV1,
} from "../../shared/contracts/ipc/v1";

export type RightPanelFeatureStatus = {
  id: string;
  label: string;
  availability: string;
};

export type ScenarioHistoryEntry = {
  id: string;
  timestampLabel: string;
  category: "environment";
  message: string;
};

type RightPanelSkeletonProps = {
  healthMessage: string;
  featureStatuses: ReadonlyArray<RightPanelFeatureStatus>;
  runtimeSettings?: RightPanelRuntimeSettings;
  onRuntimeSettingsChange?: (state: RightPanelRuntimeSettings) => void;
  stoichiometryResult?: StoichiometryCalculationResult;
  calculationSummary?: CalculationSummaryV1 | null;
  calculationSummaryIsStale?: boolean;
  onExportCalculationSummary?: () => void;
  scenarioHistory?: ReadonlyArray<ScenarioHistoryEntry>;
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
const DEFAULT_GAS_MEDIUM: GasMediumV1 = "gas";
const DEFAULT_CALCULATION_PASSES = 250;
const DEFAULT_FPS_LIMIT = 60;
const MIN_TEMPERATURE_C = -273.14;
const MAX_TEMPERATURE_C = 1000;
const MIN_PRESSURE_ATM = 0.1;
const MAX_PRESSURE_ATM = 50;
const GAS_MEDIUM_OPTIONS: ReadonlyArray<{ value: GasMediumV1; label: string }> = [
  { value: "gas", label: "Gas" },
  { value: "liquid", label: "Liquid aerosol" },
  { value: "vacuum", label: "Vacuum" },
];

export type RightPanelRuntimeSettings = {
  temperatureC: number | null;
  pressureAtm: number | null;
  gasMedium: GasMediumV1;
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

function getCalculationSummaryEntry(
  summary: CalculationSummaryV1 | null | undefined,
  resultType: CalculationResultTypeV1,
): CalculationSummaryV1["entries"][number] | null {
  if (summary === null || summary === undefined) {
    return null;
  }

  return summary.entries.find((entry) => entry.resultType === resultType) ?? null;
}

function RightPanelSkeleton({
  healthMessage,
  featureStatuses,
  runtimeSettings,
  onRuntimeSettingsChange,
  stoichiometryResult,
  calculationSummary,
  calculationSummaryIsStale = false,
  onExportCalculationSummary,
  scenarioHistory = [],
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
  const [gasMedium, setGasMedium] = useState<GasMediumV1>(
    runtimeSettings?.gasMedium ?? DEFAULT_GAS_MEDIUM,
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
  const temperatureValidationMessage = useMemo(() => {
    if (parsedTemperatureC === null) {
      return "Temperature is required.";
    }

    if (parsedTemperatureC < MIN_TEMPERATURE_C || parsedTemperatureC > MAX_TEMPERATURE_C) {
      return `Temperature must stay between ${MIN_TEMPERATURE_C}°C and ${MAX_TEMPERATURE_C}°C.`;
    }

    return null;
  }, [parsedTemperatureC]);
  const pressureValidationMessage = useMemo(() => {
    if (parsedPressureAtm === null) {
      return "Pressure is required.";
    }

    if (parsedPressureAtm < MIN_PRESSURE_ATM || parsedPressureAtm > MAX_PRESSURE_ATM) {
      return `Pressure must stay between ${MIN_PRESSURE_ATM} atm and ${MAX_PRESSURE_ATM} atm.`;
    }

    return null;
  }, [parsedPressureAtm]);
  const stoichiometrySummaryEntry = useMemo(
    () => getCalculationSummaryEntry(calculationSummary, "stoichiometry"),
    [calculationSummary],
  );
  const limitingSummaryEntry = useMemo(
    () => getCalculationSummaryEntry(calculationSummary, "limiting_reagent"),
    [calculationSummary],
  );
  const yieldSummaryEntry = useMemo(
    () => getCalculationSummaryEntry(calculationSummary, "yield"),
    [calculationSummary],
  );
  const concentrationSummaryEntry = useMemo(
    () => getCalculationSummaryEntry(calculationSummary, "concentration"),
    [calculationSummary],
  );
  const conversionSummaryEntry = useMemo(
    () => getCalculationSummaryEntry(calculationSummary, "conversion"),
    [calculationSummary],
  );

  useEffect(() => {
    onRuntimeSettingsChange?.({
      temperatureC: parsedTemperatureC,
      pressureAtm: parsedPressureAtm,
      gasMedium,
      calculationPasses: parsedCalculationPasses,
      precisionProfile,
      fpsLimit: parsedFpsLimit,
    });
  }, [
    gasMedium,
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
                  min={MIN_TEMPERATURE_C}
                  max={MAX_TEMPERATURE_C}
                  aria-label="Environment temperature in Celsius"
                  data-testid="right-panel-environment-temperature"
                  value={temperatureCInput}
                  onChange={(event) => setTemperatureCInput(event.currentTarget.value)}
                />
                <p className="status-line" data-testid="right-panel-environment-temperature-value">
                  Temperature: {parsedTemperatureC === null ? "not set" : parsedTemperatureC}
                  &deg;C
                </p>
                {temperatureValidationMessage !== null ? (
                  <p
                    className="status-line"
                    data-testid="right-panel-environment-temperature-validation"
                  >
                    {temperatureValidationMessage}
                  </p>
                ) : null}

                <label htmlFor="right-panel-environment-pressure-input">Pressure (atm)</label>
                <input
                  id="right-panel-environment-pressure-input"
                  type="number"
                  step={0.01}
                  min={MIN_PRESSURE_ATM}
                  max={MAX_PRESSURE_ATM}
                  aria-label="Environment pressure in atmospheres"
                  data-testid="right-panel-environment-pressure"
                  value={pressureAtmInput}
                  onChange={(event) => setPressureAtmInput(event.currentTarget.value)}
                />
                <p className="status-line" data-testid="right-panel-environment-pressure-value">
                  Pressure: {parsedPressureAtm === null ? "not set" : parsedPressureAtm} atm
                </p>
                {pressureValidationMessage !== null ? (
                  <p
                    className="status-line"
                    data-testid="right-panel-environment-pressure-validation"
                  >
                    {pressureValidationMessage}
                  </p>
                ) : null}

                <label htmlFor="right-panel-environment-gas-medium-select">Gas medium model</label>
                <select
                  id="right-panel-environment-gas-medium-select"
                  aria-label="Environment gas medium"
                  data-testid="right-panel-environment-gas-medium"
                  value={gasMedium}
                  onChange={(event) => {
                    const nextMedium = event.currentTarget.value as GasMediumV1;
                    if (GAS_MEDIUM_OPTIONS.some((option) => option.value === nextMedium)) {
                      setGasMedium(nextMedium);
                    }
                  }}
                >
                  {GAS_MEDIUM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="status-line" data-testid="right-panel-environment-gas-medium-value">
                  Gas medium: {gasMedium}
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
                <section
                  className="right-panel-summary-block"
                  aria-label="Scenario history"
                  data-testid="right-panel-summary-history"
                >
                  <h4 className="panel-subtitle">Scenario history</h4>
                  {scenarioHistory.length === 0 ? (
                    <p className="status-line" data-testid="right-panel-summary-history-empty">
                      No environment changes logged yet.
                    </p>
                  ) : (
                    <ul className="status-list" data-testid="right-panel-summary-history-list">
                      {scenarioHistory.map((entry) => (
                        <li key={entry.id}>
                          [{entry.timestampLabel}] {entry.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

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
                    <h4 className="panel-subtitle">Calculation summary (MVP)</h4>
                    <div className="action-row">
                      <button
                        type="button"
                        data-testid="right-panel-summary-export-calculation"
                        onClick={() => onExportCalculationSummary?.()}
                        disabled={
                          onExportCalculationSummary === undefined ||
                          calculationSummary === null ||
                          calculationSummary === undefined
                        }
                      >
                        Export summary (JSON)
                      </button>
                    </div>
                    <p className="status-line" data-testid="right-panel-summary-export-status">
                      {calculationSummaryIsStale
                        ? "Saved/exported calculation snapshot is stale because inputs changed."
                        : calculationSummary === null || calculationSummary === undefined
                          ? "Calculation summary is unavailable until required Builder inputs are valid."
                          : "Calculation summary is current and ready for save/export."}
                    </p>
                    {stoichiometryResult.ok ? (
                      <>
                        <section data-testid="right-panel-summary-calc-stoichiometry">
                          <h5 className="panel-subtitle">Stoichiometry</h5>
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
                          {stoichiometrySummaryEntry?.warnings.length ? (
                            <ul className="status-list">
                              {stoichiometrySummaryEntry.warnings.map((warning, index) => (
                                <li key={`stoichiometry-warning-${index.toString()}`}>{warning}</li>
                              ))}
                            </ul>
                          ) : null}
                        </section>

                        <section data-testid="right-panel-summary-calc-limiting">
                          <h5 className="panel-subtitle">Limiting reagent</h5>
                          <p
                            className="status-line"
                            data-testid="right-panel-summary-stoichiometry-limiting"
                          >
                            Limiting reactant:{" "}
                            {stoichiometryResult.limitingReactants
                              .map((reactant) => reactant.label)
                              .join(", ")}
                          </p>
                          {limitingSummaryEntry?.warnings.length ? (
                            <ul className="status-list">
                              {limitingSummaryEntry.warnings.map((warning, index) => (
                                <li key={`limiting-warning-${index.toString()}`}>{warning}</li>
                              ))}
                            </ul>
                          ) : null}
                        </section>

                        <section data-testid="right-panel-summary-calc-yield">
                          <h5 className="panel-subtitle">Yield</h5>
                          <p className="status-line">Actual product yields and percent yield:</p>
                          <ul
                            className="status-list"
                            data-testid="right-panel-summary-stoichiometry-yields"
                          >
                            {stoichiometryResult.participants
                              .filter((participant) => participant.role === "product")
                              .map((participant) => (
                                <li key={`${participant.id}-yield`}>
                                  {participant.label}: actual{" "}
                                  {formatStoichiometryValue(participant.actualYieldAmountMol ?? 0)}{" "}
                                  {stoichiometryResult.units.amount}; % yield{" "}
                                  {participant.percentYield === null
                                    ? "n/a"
                                    : formatStoichiometryValue(participant.percentYield)}{" "}
                                  {stoichiometryResult.units.percentYield}
                                </li>
                              ))}
                          </ul>
                          {yieldSummaryEntry?.warnings.length ? (
                            <ul className="status-list">
                              {yieldSummaryEntry.warnings.map((warning, index) => (
                                <li key={`yield-warning-${index.toString()}`}>{warning}</li>
                              ))}
                            </ul>
                          ) : null}
                        </section>

                        <section data-testid="right-panel-summary-calc-concentration">
                          <h5 className="panel-subtitle">Concentration</h5>
                          {stoichiometryResult.derivedCalculations.concentrations.length === 0 ? (
                            <p className="status-line">
                              No concentration values for current inputs.
                            </p>
                          ) : (
                            <>
                              <p className="status-line">
                                Concentrations from entered amount/volume:
                              </p>
                              <ul
                                className="status-list"
                                data-testid="right-panel-summary-stoichiometry-concentrations"
                              >
                                {stoichiometryResult.derivedCalculations.concentrations.map(
                                  (concentration) => (
                                    <li key={`${concentration.participantId}-concentration`}>
                                      {concentration.participantLabel}:{" "}
                                      {formatStoichiometryValue(concentration.concentrationMolL)}{" "}
                                      {stoichiometryResult.units.concentration}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </>
                          )}
                          {concentrationSummaryEntry?.warnings.length ? (
                            <ul className="status-list">
                              {concentrationSummaryEntry.warnings.map((warning, index) => (
                                <li key={`concentration-warning-${index.toString()}`}>{warning}</li>
                              ))}
                            </ul>
                          ) : null}
                        </section>

                        <section data-testid="right-panel-summary-calc-conversion">
                          <h5 className="panel-subtitle">Gas conversion</h5>
                          {stoichiometryResult.derivedCalculations.gasRuntime === null ||
                          stoichiometryResult.derivedCalculations.gasCalculations.length === 0 ? (
                            <p className="status-line">
                              No gas conversion values for current inputs.
                            </p>
                          ) : (
                            <>
                              <p
                                className="status-line"
                                data-testid="right-panel-summary-stoichiometry-gas-runtime"
                              >
                                Gas calculations at{" "}
                                {formatStoichiometryValue(
                                  stoichiometryResult.derivedCalculations.gasRuntime.temperatureC,
                                )}{" "}
                                &deg;C and{" "}
                                {formatStoichiometryValue(
                                  stoichiometryResult.derivedCalculations.gasRuntime.pressureAtm,
                                )}{" "}
                                atm (ideal gas).
                              </p>
                              <ul
                                className="status-list"
                                data-testid="right-panel-summary-stoichiometry-gas"
                              >
                                {stoichiometryResult.derivedCalculations.gasCalculations.map(
                                  (gasCalculation) => (
                                    <li key={`${gasCalculation.participantId}-gas`}>
                                      {gasCalculation.participantLabel}: ideal V{" "}
                                      {formatStoichiometryValue(gasCalculation.idealVolumeL)}{" "}
                                      {stoichiometryResult.units.volume}, implied n{" "}
                                      {formatStoichiometryValue(
                                        gasCalculation.impliedAmountMolFromVolume,
                                      )}{" "}
                                      {stoichiometryResult.units.amount}, consistency{" "}
                                      {gasCalculation.isVolumeConsistent &&
                                      gasCalculation.isAmountConsistent
                                        ? "ok"
                                        : "check inputs"}
                                      .
                                    </li>
                                  ),
                                )}
                              </ul>
                            </>
                          )}
                          {conversionSummaryEntry?.warnings.length ? (
                            <ul className="status-list">
                              {conversionSummaryEntry.warnings.map((warning, index) => (
                                <li key={`conversion-warning-${index.toString()}`}>{warning}</li>
                              ))}
                            </ul>
                          ) : null}
                        </section>
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
                      concentrations in {stoichiometryResult.units.concentration}; gas volumes in{" "}
                      {stoichiometryResult.units.volume}; coefficients as{" "}
                      {stoichiometryResult.units.coefficient}; percent yield in{" "}
                      {stoichiometryResult.units.percentYield}; pressure in{" "}
                      {stoichiometryResult.units.pressure}; temperature in{" "}
                      {stoichiometryResult.units.temperature}; gas constant in{" "}
                      {stoichiometryResult.units.gasConstant}.
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
