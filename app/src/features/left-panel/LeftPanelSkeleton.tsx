import type { ReactNode } from "react";
import type { PresetCatalogEntryV1, SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";
import {
  BUILDER_PARTICIPANT_ROLES,
  LIBRARY_PHASE_FILTER_OPTIONS,
  LIBRARY_SOURCE_FILTER_OPTIONS,
  formatLibraryPhaseLabel,
  formatLibrarySourceLabel,
  formatPresetComplexityLabel,
  formatReactionClassLabel,
  isUserSubstanceEditable,
  type BuilderDraft,
  type BuilderDraftField,
  type BuilderDraftParticipantField,
  type LeftPanelPlaceholderState,
  type LeftPanelTabId,
  type UserSubstanceDraft,
  type UserSubstanceDraftField,
} from "./model";

type LeftPanelTabDefinition = {
  id: LeftPanelTabId;
  label: string;
  title: string;
  description: string;
};

type LeftPanelLibraryViewModel = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedPhases: ReadonlySet<(typeof LIBRARY_PHASE_FILTER_OPTIONS)[number]>;
  selectedSources: ReadonlySet<(typeof LIBRARY_SOURCE_FILTER_OPTIONS)[number]>;
  onTogglePhase: (phase: (typeof LIBRARY_PHASE_FILTER_OPTIONS)[number]) => void;
  onToggleSource: (source: (typeof LIBRARY_SOURCE_FILTER_OPTIONS)[number]) => void;
  onImportSdfMol: () => void;
  onImportSmiles: () => void;
  onImportXyz: () => void;
  substances: ReadonlyArray<SubstanceCatalogEntryV1>;
  selectedSubstance: SubstanceCatalogEntryV1 | null;
  onSelectSubstance: (substanceId: string) => void;
  createDraft: UserSubstanceDraft;
  createValidationErrors: ReadonlyArray<string>;
  onCreateDraftFieldChange: (field: UserSubstanceDraftField, value: string) => void;
  onCreateSubmit: () => void;
  editDraft: UserSubstanceDraft | null;
  editValidationErrors: ReadonlyArray<string>;
  onEditDraftFieldChange: (field: UserSubstanceDraftField, value: string) => void;
  onEditSubmit: () => void;
  onDeleteSelected: () => void;
  isMutating: boolean;
  mutationErrorMessage: string | null;
  emptyMessage: string;
  errorMessage: string | null;
};

type LeftPanelBuilderViewModel = {
  draft: BuilderDraft | null;
  onDraftFieldChange: (field: BuilderDraftField, value: string) => void;
  allSubstances: ReadonlyArray<SubstanceCatalogEntryV1>;
  onParticipantAdd: (substanceId: string) => void;
  onParticipantFieldChange: (
    participantId: string,
    field: BuilderDraftParticipantField,
    value: string,
  ) => void;
  onParticipantRemove: (participantId: string) => void;
  onSaveDraft: () => void;
  copyFeedbackMessage: string | null;
  launchBlocked: boolean;
  launchBlockReasons: ReadonlyArray<string>;
  scenarioNameInput: string;
  onScenarioNameInputChange: (value: string) => void;
  savedScenarios: ReadonlyArray<{
    id: string;
    name: string;
    updatedAt: string;
  }>;
  selectedScenarioId: string | null;
  onSelectScenario: (scenarioId: string | null) => void;
  onSaveScenario: () => void;
  onLoadScenario: () => void;
  onSetBaselineSnapshot: () => void;
  onRevertToBaseline: () => void;
  onRewindScenarioStep: () => void;
  canSaveScenario: boolean;
  canLoadScenario: boolean;
  canSetBaselineSnapshot: boolean;
  canRevertToBaseline: boolean;
  canRewindScenarioStep: boolean;
  isScenarioBusy: boolean;
  emptyMessage: string;
};

type LeftPanelPresetsViewModel = {
  presets: ReadonlyArray<PresetCatalogEntryV1>;
  selectedPreset: PresetCatalogEntryV1 | null;
  onSelectPreset: (presetId: string) => void;
  onUsePresetInBuilder: (presetId: string) => void;
  emptyMessage: string;
  errorMessage: string | null;
};

type LeftPanelSkeletonProps = {
  activeTab: LeftPanelTabId;
  onTabChange: (tab: LeftPanelTabId) => void;
  placeholderStateByTab: Readonly<Record<LeftPanelTabId, LeftPanelPlaceholderState>>;
  libraryViewModel: LeftPanelLibraryViewModel;
  builderViewModel: LeftPanelBuilderViewModel;
  presetsViewModel: LeftPanelPresetsViewModel;
};

const LEFT_PANEL_TAB_DEFINITIONS: ReadonlyArray<LeftPanelTabDefinition> = [
  {
    id: "library",
    label: "Library",
    title: "Substance Library",
    description: "Search local substances and inspect key properties for quick setup.",
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
    case "ready":
      return null;
    default:
      return null;
  }
}

function formatMolarMass(value: number | null): string {
  if (value === null) {
    return "Unknown";
  }

  return `${value.toFixed(5)} g/mol`;
}

function formatBuilderSubstanceOption(substance: SubstanceCatalogEntryV1): string {
  return `${substance.name} (${substance.formula})`;
}

function formatScenarioTimestampForLabel(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return value;
  }

  if (/^\d+$/.test(normalized)) {
    const unixMillis = Number(normalized);
    if (Number.isFinite(unixMillis)) {
      return new Date(unixMillis).toISOString();
    }
    return value;
  }

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}

function formatScenarioOptionLabel(name: string, updatedAt: string): string {
  return `${name} (${formatScenarioTimestampForLabel(updatedAt)})`;
}

type SubstanceEditorFormModel = {
  testIdPrefix: "library-create" | "library-edit";
  title: string;
  draft: UserSubstanceDraft;
  validationErrors: ReadonlyArray<string>;
  onFieldChange: (field: UserSubstanceDraftField, value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled: boolean;
};

function renderValidationErrors(
  errors: ReadonlyArray<string>,
  testId: "library-create-errors" | "library-edit-errors",
): ReactNode {
  if (errors.length === 0) {
    return null;
  }

  return (
    <ul className="left-panel-library-form-errors" role="alert" data-testid={testId}>
      {errors.map((error, index) => (
        <li key={`${testId}-${index.toString()}`}>{error}</li>
      ))}
    </ul>
  );
}

function renderSubstanceEditorForm({
  testIdPrefix,
  title,
  draft,
  validationErrors,
  onFieldChange,
  onSubmit,
  submitLabel,
  disabled,
}: SubstanceEditorFormModel): ReactNode {
  const errorsTestId = `${testIdPrefix}-errors` as "library-create-errors" | "library-edit-errors";

  return (
    <form
      className="left-panel-library-form"
      data-testid={`${testIdPrefix}-form`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h5 className="left-panel-library-form-title">{title}</h5>
      <label>
        Name
        <input
          type="text"
          value={draft.name}
          onChange={(event) => onFieldChange("name", event.currentTarget.value)}
          data-testid={`${testIdPrefix}-name-input`}
          disabled={disabled}
        />
      </label>
      <label>
        Formula
        <input
          type="text"
          value={draft.formula}
          onChange={(event) => onFieldChange("formula", event.currentTarget.value)}
          data-testid={`${testIdPrefix}-formula-input`}
          disabled={disabled}
        />
      </label>
      <label>
        Phase
        <select
          value={draft.phase}
          onChange={(event) => onFieldChange("phase", event.currentTarget.value)}
          data-testid={`${testIdPrefix}-phase-select`}
          disabled={disabled}
        >
          {LIBRARY_PHASE_FILTER_OPTIONS.map((phase) => (
            <option key={phase} value={phase}>
              {formatLibraryPhaseLabel(phase)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Molar mass (g/mol)
        <input
          type="text"
          inputMode="decimal"
          value={draft.molarMassInput}
          onChange={(event) => onFieldChange("molarMassInput", event.currentTarget.value)}
          placeholder="Required"
          data-testid={`${testIdPrefix}-molar-mass-input`}
          disabled={disabled}
        />
      </label>
      {renderValidationErrors(validationErrors, errorsTestId)}
      <button type="submit" data-testid={`${testIdPrefix}-submit`} disabled={disabled}>
        {submitLabel}
      </button>
    </form>
  );
}

function renderLibraryState(
  state: LeftPanelPlaceholderState,
  emptyMessage: string,
  errorMessage: string | null,
): ReactNode {
  if (state === "loading") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--loading"
        data-testid="library-state-loading"
      >
        <h4 className="left-panel-placeholder-title">Loading substances</h4>
        <p className="left-panel-placeholder-text">Querying local catalog command payload.</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--error"
        role="alert"
        data-testid="library-state-error"
      >
        <h4 className="left-panel-placeholder-title">Unable to load substance catalog</h4>
        <p className="left-panel-placeholder-text">
          {errorMessage ?? "Retry when backend is available."}
        </p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--empty"
        data-testid="library-state-empty"
      >
        <h4 className="left-panel-placeholder-title">No substances to display</h4>
        <p className="left-panel-placeholder-text">{emptyMessage}</p>
      </div>
    );
  }

  return null;
}

function renderLibraryResults(
  libraryViewModel: LeftPanelLibraryViewModel,
  controlsDisabled: boolean,
): ReactNode {
  const { selectedSubstance, substances } = libraryViewModel;
  const selectedSubstanceIsEditable = isUserSubstanceEditable(selectedSubstance);
  const mutationControlsDisabled = controlsDisabled || libraryViewModel.isMutating;

  return (
    <div className="left-panel-library-results" data-testid="library-results">
      <ul className="left-panel-library-list" data-testid="library-substance-list">
        {substances.map((substance) => {
          const isSelected = selectedSubstance?.id === substance.id;
          const label = `${substance.name} (${substance.formula})`;

          return (
            <li key={substance.id} className="left-panel-library-list-item">
              <button
                type="button"
                className="left-panel-library-item-button"
                aria-selected={isSelected}
                data-testid={`library-substance-select-${substance.id}`}
                onClick={() => libraryViewModel.onSelectSubstance(substance.id)}
                disabled={mutationControlsDisabled}
              >
                <span className="left-panel-library-item-name">{label}</span>
                <span className="left-panel-library-item-meta">
                  {formatLibraryPhaseLabel(substance.phase)} /{" "}
                  {formatLibrarySourceLabel(substance.source)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <article className="left-panel-library-card" data-testid="library-property-card">
        {selectedSubstance === null ? (
          <p className="left-panel-placeholder-text">Select a substance to view properties.</p>
        ) : (
          <>
            <h4 className="left-panel-library-card-title" data-testid="library-property-name">
              {selectedSubstance.name}
            </h4>
            <p className="left-panel-library-card-subtitle" data-testid="library-property-formula">
              {selectedSubstance.formula}
            </p>
            <dl className="left-panel-library-card-grid">
              <div>
                <dt>Phase</dt>
                <dd>{formatLibraryPhaseLabel(selectedSubstance.phase)}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{formatLibrarySourceLabel(selectedSubstance.source)}</dd>
              </div>
              <div>
                <dt>Molar mass</dt>
                <dd>{formatMolarMass(selectedSubstance.molarMassGMol)}</dd>
              </div>
            </dl>
          </>
        )}
      </article>

      <section className="left-panel-library-crud" data-testid="library-crud-section">
        {renderSubstanceEditorForm({
          testIdPrefix: "library-create",
          title: "Create user substance",
          draft: libraryViewModel.createDraft,
          validationErrors: libraryViewModel.createValidationErrors,
          onFieldChange: libraryViewModel.onCreateDraftFieldChange,
          onSubmit: libraryViewModel.onCreateSubmit,
          submitLabel: "Create",
          disabled: mutationControlsDisabled,
        })}

        {selectedSubstance === null ? (
          <p className="left-panel-placeholder-text" data-testid="library-edit-empty">
            Select a substance to edit or delete.
          </p>
        ) : !selectedSubstanceIsEditable ? (
          <p className="left-panel-library-readonly" data-testid="library-readonly-message">
            Builtin and imported substances are read-only.
          </p>
        ) : (
          <div className="left-panel-library-edit-actions" data-testid="library-edit-actions">
            {libraryViewModel.editDraft !== null &&
              renderSubstanceEditorForm({
                testIdPrefix: "library-edit",
                title: "Edit selected user substance",
                draft: libraryViewModel.editDraft,
                validationErrors: libraryViewModel.editValidationErrors,
                onFieldChange: libraryViewModel.onEditDraftFieldChange,
                onSubmit: libraryViewModel.onEditSubmit,
                submitLabel: "Save changes",
                disabled: mutationControlsDisabled,
              })}
            <button
              type="button"
              className="left-panel-library-delete-button"
              data-testid="library-delete-button"
              onClick={libraryViewModel.onDeleteSelected}
              disabled={mutationControlsDisabled}
            >
              Delete selected user substance
            </button>
          </div>
        )}

        {libraryViewModel.mutationErrorMessage !== null && (
          <p
            className="left-panel-library-mutation-error"
            role="alert"
            data-testid="library-mutation-error"
          >
            {libraryViewModel.mutationErrorMessage}
          </p>
        )}
      </section>
    </div>
  );
}

function renderLibraryView(
  state: LeftPanelPlaceholderState,
  libraryViewModel: LeftPanelLibraryViewModel,
): ReactNode {
  const controlsDisabled = state === "loading" || libraryViewModel.isMutating;
  const stateContent = renderLibraryState(
    state,
    libraryViewModel.emptyMessage,
    libraryViewModel.errorMessage,
  );

  return (
    <div className="left-panel-library-view" data-testid="left-panel-library-view">
      <div className="left-panel-library-search">
        <label htmlFor="library-search-input">Search by name or formula</label>
        <input
          id="library-search-input"
          type="search"
          value={libraryViewModel.searchQuery}
          onChange={(event) => libraryViewModel.onSearchQueryChange(event.currentTarget.value)}
          placeholder="e.g. water, H2O"
          data-testid="library-search-input"
          disabled={controlsDisabled}
        />
      </div>
      <div className="left-panel-library-import">
        <button
          type="button"
          data-testid="library-import-sdf-mol-button"
          onClick={libraryViewModel.onImportSdfMol}
          disabled={controlsDisabled}
        >
          Import SDF/MOL
        </button>
        <button
          type="button"
          data-testid="library-import-smiles-button"
          onClick={libraryViewModel.onImportSmiles}
          disabled={controlsDisabled}
        >
          Import SMILES
        </button>
        <button
          type="button"
          data-testid="library-import-xyz-button"
          onClick={libraryViewModel.onImportXyz}
          disabled={controlsDisabled}
        >
          Import XYZ
        </button>
      </div>
      <p className="left-panel-library-import-warning" data-testid="library-import-xyz-warning">
        XYZ bonds are inferred heuristically from distances/covalent radii; verify connectivity for
        edge cases.
      </p>

      <div className="left-panel-library-filter-row">
        <fieldset
          className="left-panel-library-filter-group"
          data-testid="library-filter-phase-group"
          disabled={controlsDisabled}
        >
          <legend>Phase</legend>
          {LIBRARY_PHASE_FILTER_OPTIONS.map((phase) => (
            <label key={phase} className="left-panel-library-filter-option">
              <input
                type="checkbox"
                checked={libraryViewModel.selectedPhases.has(phase)}
                onChange={() => libraryViewModel.onTogglePhase(phase)}
                data-testid={`library-filter-phase-${phase}`}
              />
              {formatLibraryPhaseLabel(phase)}
            </label>
          ))}
        </fieldset>

        <fieldset
          className="left-panel-library-filter-group"
          data-testid="library-filter-source-group"
          disabled={controlsDisabled}
        >
          <legend>Source</legend>
          {LIBRARY_SOURCE_FILTER_OPTIONS.map((source) => (
            <label key={source} className="left-panel-library-filter-option">
              <input
                type="checkbox"
                checked={libraryViewModel.selectedSources.has(source)}
                onChange={() => libraryViewModel.onToggleSource(source)}
                data-testid={`library-filter-source-${source}`}
              />
              {formatLibrarySourceLabel(source)}
            </label>
          ))}
        </fieldset>
      </div>

      <div
        className="left-panel-data-boundary"
        aria-live="polite"
        data-testid="left-panel-data-boundary-library"
      >
        {stateContent ?? renderLibraryResults(libraryViewModel, controlsDisabled)}
      </div>
    </div>
  );
}

function renderBuilderState(state: LeftPanelPlaceholderState, emptyMessage: string): ReactNode {
  if (state === "loading") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--loading"
        data-testid="builder-state-loading"
      >
        <h4 className="left-panel-placeholder-title">Preparing builder draft</h4>
        <p className="left-panel-placeholder-text">Loading preset data for manual editing.</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--error"
        role="alert"
        data-testid="builder-state-error"
      >
        <h4 className="left-panel-placeholder-title">Unable to open builder draft</h4>
        <p className="left-panel-placeholder-text">Select the preset again to retry.</p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--empty"
        data-testid="builder-state-empty"
      >
        <h4 className="left-panel-placeholder-title">Builder is empty</h4>
        <p className="left-panel-placeholder-text">{emptyMessage}</p>
      </div>
    );
  }

  return null;
}

function renderBuilderView(
  state: LeftPanelPlaceholderState,
  builderViewModel: LeftPanelBuilderViewModel,
): ReactNode {
  const stateContent = renderBuilderState(state, builderViewModel.emptyMessage);
  if (stateContent !== null) {
    return (
      <div
        className="left-panel-data-boundary"
        aria-live="polite"
        data-testid="left-panel-data-boundary-builder"
      >
        {stateContent}
      </div>
    );
  }

  if (builderViewModel.draft === null) {
    return null;
  }

  const scenariosAvailable = builderViewModel.savedScenarios.length > 0;

  return (
    <div className="left-panel-builder-view" data-testid="left-panel-builder-view">
      <div
        className="left-panel-data-boundary"
        aria-live="polite"
        data-testid="left-panel-data-boundary-builder"
      >
        {builderViewModel.copyFeedbackMessage !== null && (
          <p
            className="left-panel-builder-feedback"
            role="status"
            data-testid="builder-copy-feedback"
          >
            {builderViewModel.copyFeedbackMessage}
          </p>
        )}

        {builderViewModel.launchBlocked && (
          <div
            className="left-panel-builder-launch-blocked"
            role="alert"
            data-testid="builder-launch-blocked-banner"
          >
            Launch blocked: fix invalid participant values.
            {builderViewModel.launchBlockReasons.length > 0 && (
              <ul
                className="left-panel-builder-launch-blocked-list"
                data-testid="builder-launch-blocked-errors"
              >
                {builderViewModel.launchBlockReasons.map((reason, index) => (
                  <li key={`builder-launch-blocked-reason-${index.toString()}`}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="left-panel-builder-form" data-testid="builder-form">
          <label>
            Title
            <input
              type="text"
              value={builderViewModel.draft.title}
              onChange={(event) =>
                builderViewModel.onDraftFieldChange("title", event.currentTarget.value)
              }
              data-testid="builder-title-input"
            />
          </label>

          <label>
            Reaction class
            <select
              value={builderViewModel.draft.reactionClass}
              onChange={(event) =>
                builderViewModel.onDraftFieldChange("reactionClass", event.currentTarget.value)
              }
              data-testid="builder-class-select"
            >
              <option value="inorganic">{formatReactionClassLabel("inorganic")}</option>
              <option value="acid_base">{formatReactionClassLabel("acid_base")}</option>
              <option value="redox">{formatReactionClassLabel("redox")}</option>
              <option value="organic_basic">{formatReactionClassLabel("organic_basic")}</option>
              <option value="equilibrium">{formatReactionClassLabel("equilibrium")}</option>
            </select>
          </label>

          <label>
            Equation
            <input
              type="text"
              value={builderViewModel.draft.equation}
              onChange={(event) =>
                builderViewModel.onDraftFieldChange("equation", event.currentTarget.value)
              }
              data-testid="builder-equation-input"
            />
          </label>

          <label>
            Description
            <textarea
              value={builderViewModel.draft.description}
              onChange={(event) =>
                builderViewModel.onDraftFieldChange("description", event.currentTarget.value)
              }
              data-testid="builder-description-input"
              rows={4}
            />
          </label>

          <section
            className="left-panel-builder-participants"
            data-testid="builder-participants-section"
          >
            <h5 className="left-panel-library-form-title">Participants</h5>
            <p
              className="left-panel-builder-participant-hint"
              data-testid="builder-participant-conversion-hint"
            >
              Amount (mol) and Mass (g) auto-convert using selected substance molar mass. Volume (L)
              auto-converts only for gas phase.
            </p>
            {builderViewModel.draft.participants.length === 0 ? (
              <p className="left-panel-placeholder-text" data-testid="builder-participant-empty">
                Add reactants and products to build the reaction.
              </p>
            ) : (
              <ul
                className="left-panel-builder-participant-list"
                data-testid="builder-participant-list"
              >
                {builderViewModel.draft.participants.map((participant) => {
                  const hasKnownSubstance = builderViewModel.allSubstances.some(
                    (substance) => substance.id === participant.substanceId,
                  );

                  return (
                    <li
                      key={participant.id}
                      className="left-panel-builder-participant-item"
                      data-testid={`builder-participant-item-${participant.id}`}
                    >
                      <label>
                        Role
                        <select
                          value={participant.role}
                          onChange={(event) =>
                            builderViewModel.onParticipantFieldChange(
                              participant.id,
                              "role",
                              event.currentTarget.value,
                            )
                          }
                          data-testid={`builder-participant-role-${participant.id}`}
                        >
                          {BUILDER_PARTICIPANT_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role === "reactant" ? "Reactant" : "Product"}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Phase
                        <select
                          value={participant.phase}
                          onChange={(event) =>
                            builderViewModel.onParticipantFieldChange(
                              participant.id,
                              "phase",
                              event.currentTarget.value,
                            )
                          }
                          data-testid={`builder-participant-phase-${participant.id}`}
                        >
                          {LIBRARY_PHASE_FILTER_OPTIONS.map((phase) => (
                            <option key={phase} value={phase}>
                              {formatLibraryPhaseLabel(phase)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Coeff
                        <input
                          type="text"
                          inputMode="decimal"
                          value={participant.stoichCoeffInput}
                          onChange={(event) =>
                            builderViewModel.onParticipantFieldChange(
                              participant.id,
                              "stoichCoeffInput",
                              event.currentTarget.value,
                            )
                          }
                          data-testid={`builder-participant-coeff-${participant.id}`}
                        />
                      </label>

                      <label>
                        Amount (mol)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={participant.amountMolInput}
                          onChange={(event) =>
                            builderViewModel.onParticipantFieldChange(
                              participant.id,
                              "amountMolInput",
                              event.currentTarget.value,
                            )
                          }
                          data-testid={`builder-participant-mol-${participant.id}`}
                        />
                      </label>

                      <label>
                        Mass (g)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={participant.massGInput}
                          onChange={(event) =>
                            builderViewModel.onParticipantFieldChange(
                              participant.id,
                              "massGInput",
                              event.currentTarget.value,
                            )
                          }
                          data-testid={`builder-participant-mass-${participant.id}`}
                        />
                      </label>

                      <label>
                        Volume (L)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={participant.volumeLInput}
                          onChange={(event) =>
                            builderViewModel.onParticipantFieldChange(
                              participant.id,
                              "volumeLInput",
                              event.currentTarget.value,
                            )
                          }
                          data-testid={`builder-participant-volume-${participant.id}`}
                        />
                      </label>
                      {participant.phase !== "gas" && (
                        <p
                          className="left-panel-builder-participant-warning"
                          data-testid={`builder-participant-volume-warning-${participant.id}`}
                        >
                          Volume auto-conversion requires gas phase. Enter amount and mass manually
                          for this participant.
                        </p>
                      )}

                      <label>
                        Substance
                        <select
                          value={participant.substanceId}
                          onChange={(event) =>
                            builderViewModel.onParticipantFieldChange(
                              participant.id,
                              "substanceId",
                              event.currentTarget.value,
                            )
                          }
                          data-testid={`builder-participant-substance-${participant.id}`}
                        >
                          {!hasKnownSubstance && (
                            <option value={participant.substanceId}>
                              {`Unknown substance (${participant.substanceId})`}
                            </option>
                          )}
                          {builderViewModel.allSubstances.map((substance) => (
                            <option key={substance.id} value={substance.id}>
                              {formatBuilderSubstanceOption(substance)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => builderViewModel.onParticipantRemove(participant.id)}
                        data-testid={`builder-participant-remove-${participant.id}`}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              className="left-panel-builder-participant-add-form"
              data-testid="builder-participant-add-form"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const selectedSubstanceId = formData.get("builder-participant-add-substance-id");

                if (
                  typeof selectedSubstanceId === "string" &&
                  selectedSubstanceId.trim().length > 0
                ) {
                  builderViewModel.onParticipantAdd(selectedSubstanceId);
                }
              }}
            >
              <label>
                Substance
                <select
                  name="builder-participant-add-substance-id"
                  data-testid="builder-participant-add-substance-select"
                  defaultValue={builderViewModel.allSubstances[0]?.id ?? ""}
                >
                  {builderViewModel.allSubstances.length === 0 ? (
                    <option value="">No substances available</option>
                  ) : (
                    builderViewModel.allSubstances.map((substance) => (
                      <option key={substance.id} value={substance.id}>
                        {formatBuilderSubstanceOption(substance)}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <button
                type="submit"
                data-testid="builder-participant-add-submit"
                disabled={builderViewModel.allSubstances.length === 0}
              >
                Add participant
              </button>
            </form>
          </section>

          <section className="left-panel-builder-scenarios" data-testid="builder-scenario-controls">
            <h5 className="left-panel-library-form-title">Scenario snapshots</h5>

            <label>
              Scenario name
              <input
                type="text"
                value={builderViewModel.scenarioNameInput}
                onChange={(event) =>
                  builderViewModel.onScenarioNameInputChange(event.currentTarget.value)
                }
                data-testid="builder-scenario-name-input"
                disabled={builderViewModel.isScenarioBusy}
              />
            </label>

            <button
              type="button"
              onClick={builderViewModel.onSaveScenario}
              data-testid="builder-scenario-save-button"
              disabled={!builderViewModel.canSaveScenario || builderViewModel.isScenarioBusy}
            >
              Save scenario
            </button>

            <label>
              Saved scenarios
              <select
                value={builderViewModel.selectedScenarioId ?? ""}
                onChange={(event) => {
                  const selectedScenarioId = event.currentTarget.value;
                  builderViewModel.onSelectScenario(
                    selectedScenarioId.length === 0 ? null : selectedScenarioId,
                  );
                }}
                data-testid="builder-scenario-list-select"
                disabled={!scenariosAvailable || builderViewModel.isScenarioBusy}
              >
                {scenariosAvailable ? (
                  builderViewModel.savedScenarios.map((scenario) => (
                    <option
                      key={scenario.id}
                      value={scenario.id}
                      data-testid={`builder-scenario-option-${scenario.id}`}
                    >
                      {formatScenarioOptionLabel(scenario.name, scenario.updatedAt)}
                    </option>
                  ))
                ) : (
                  <option value="">No saved scenarios</option>
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={builderViewModel.onLoadScenario}
              data-testid="builder-scenario-load-button"
              disabled={!builderViewModel.canLoadScenario || builderViewModel.isScenarioBusy}
            >
              Load
            </button>

            <div
              className="left-panel-builder-scenario-baseline-actions"
              data-testid="builder-scenario-baseline-actions"
            >
              <button
                type="button"
                onClick={builderViewModel.onSetBaselineSnapshot}
                data-testid="builder-scenario-set-baseline-button"
                disabled={
                  !builderViewModel.canSetBaselineSnapshot || builderViewModel.isScenarioBusy
                }
              >
                Set baseline snapshot
              </button>
              <button
                type="button"
                onClick={builderViewModel.onRevertToBaseline}
                data-testid="builder-scenario-revert-baseline-button"
                disabled={!builderViewModel.canRevertToBaseline || builderViewModel.isScenarioBusy}
              >
                Revert to baseline
              </button>
              <button
                type="button"
                onClick={builderViewModel.onRewindScenarioStep}
                data-testid="builder-scenario-rewind-button"
                disabled={
                  !builderViewModel.canRewindScenarioStep || builderViewModel.isScenarioBusy
                }
              >
                Rewind last step
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={builderViewModel.onSaveDraft}
            data-testid="builder-save-draft-button"
          >
            Save draft
          </button>
        </div>
      </div>
    </div>
  );
}

function renderPresetsState(
  state: LeftPanelPlaceholderState,
  presetsViewModel: LeftPanelPresetsViewModel,
): ReactNode {
  if (state === "loading") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--loading"
        data-testid="presets-state-loading"
      >
        <h4 className="left-panel-placeholder-title">Loading presets</h4>
        <p className="left-panel-placeholder-text">Fetching preset templates from local storage.</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--error"
        role="alert"
        data-testid="presets-state-error"
      >
        <h4 className="left-panel-placeholder-title">Unable to load preset library</h4>
        <p className="left-panel-placeholder-text">
          {presetsViewModel.errorMessage ?? "Retry when backend is available."}
        </p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div
        className="left-panel-placeholder left-panel-placeholder--empty"
        data-testid="presets-state-empty"
      >
        <h4 className="left-panel-placeholder-title">No presets to display</h4>
        <p className="left-panel-placeholder-text">{presetsViewModel.emptyMessage}</p>
      </div>
    );
  }

  return null;
}

function renderPresetsView(
  state: LeftPanelPlaceholderState,
  presetsViewModel: LeftPanelPresetsViewModel,
): ReactNode {
  const stateContent = renderPresetsState(state, presetsViewModel);
  if (stateContent !== null) {
    return (
      <div
        className="left-panel-data-boundary"
        aria-live="polite"
        data-testid="left-panel-data-boundary-presets"
      >
        {stateContent}
      </div>
    );
  }

  return (
    <div className="left-panel-presets-view" data-testid="left-panel-presets-view">
      <div
        className="left-panel-data-boundary"
        aria-live="polite"
        data-testid="left-panel-data-boundary-presets"
      >
        <ul className="left-panel-presets-list" data-testid="presets-list">
          {presetsViewModel.presets.map((preset) => {
            const isSelected = presetsViewModel.selectedPreset?.id === preset.id;
            return (
              <li key={preset.id} className="left-panel-presets-item">
                <article
                  className="left-panel-presets-card"
                  data-testid={`preset-card-${preset.id}`}
                  aria-selected={isSelected}
                >
                  <button
                    type="button"
                    className="left-panel-presets-select-button"
                    onClick={() => presetsViewModel.onSelectPreset(preset.id)}
                    data-testid={`preset-select-${preset.id}`}
                  >
                    {preset.title}
                  </button>
                  <dl className="left-panel-presets-meta" data-testid={`preset-meta-${preset.id}`}>
                    <div>
                      <dt>Class</dt>
                      <dd>{formatReactionClassLabel(preset.reactionClass)}</dd>
                    </div>
                    <div>
                      <dt>Complexity</dt>
                      <dd>{formatPresetComplexityLabel(preset.complexity)}</dd>
                    </div>
                  </dl>
                  <p
                    className="left-panel-presets-description"
                    data-testid={`preset-description-${preset.id}`}
                  >
                    {preset.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => presetsViewModel.onUsePresetInBuilder(preset.id)}
                    data-testid={`preset-use-${preset.id}`}
                  >
                    Use in Builder
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function LeftPanelSkeleton({
  activeTab,
  onTabChange,
  placeholderStateByTab,
  libraryViewModel,
  builderViewModel,
  presetsViewModel,
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

        {activeTab === "library" && renderLibraryView(activePlaceholderState, libraryViewModel)}
        {activeTab === "builder" && renderBuilderView(activePlaceholderState, builderViewModel)}
        {activeTab === "presets" && renderPresetsView(activePlaceholderState, presetsViewModel)}
        {activeTab !== "library" && activeTab !== "builder" && activeTab !== "presets" && (
          <div
            className="left-panel-data-boundary"
            aria-live="polite"
            data-testid={`left-panel-data-boundary-${activeTab}`}
          >
            {renderPlaceholder(activeDefinition, activePlaceholderState)}
          </div>
        )}
      </section>
    </div>
  );
}

export default LeftPanelSkeleton;
