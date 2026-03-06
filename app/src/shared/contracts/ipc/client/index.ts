import { invoke } from "@tauri-apps/api/core";
import {
  IPC_COMMANDS_V1,
  type CalculationSummaryV1,
  type CreateSubstanceV1Input,
  type CreateSubstanceV1Output,
  type DeleteSubstanceV1Input,
  type DeleteSubstanceV1Output,
  type GreetV1Input,
  type GreetV1Output,
  type HealthV1Output,
  type ImportSdfMolV1Input,
  type ImportSdfMolV1Output,
  type ImportSmilesV1Input,
  type ImportSmilesV1Output,
  type ImportXyzV1Input,
  type ImportXyzV1Output,
  type ListPresetsV1Output,
  type ListScenariosV1Output,
  type ListSubstancesV1Output,
  type LoadScenarioV1Input,
  type LoadScenarioV1Output,
  type SaveScenarioV1Input,
  type SaveScenarioV1Output,
  type ScenarioBuilderSnapshotV1,
  type ScenarioRuntimeSettingsV1,
  type UpdateSubstanceV1Input,
  type UpdateSubstanceV1Output,
} from "../v1";

import { normalizeCommandErrorV1 } from "./errors";
import {
  parseImportSdfMolV1Output,
  parseImportSmilesV1Output,
  parseImportXyzV1Output,
} from "./parsers/imports";
import { parseListPresetsV1Output } from "./parsers/presets";
import {
  parseListScenariosV1Output,
  parseLoadScenarioV1Output,
  parseSaveScenarioV1Output,
} from "./parsers/scenarios";
import {
  parseDeleteSubstanceV1Output,
  parseListSubstancesV1Output,
  parseSubstanceMutationV1Output,
} from "./parsers/substances";

export { isCommandErrorV1, normalizeCommandErrorV1, toUserFacingMessageV1 } from "./errors";
export {
  ensureFeatureEnabledV1,
  getFeatureFlagsV1,
  resolveFeatureFlagsV1,
  type ResolvedFeatureFlagsV1,
} from "./featureFlags";

export async function greetV1(input: GreetV1Input): Promise<GreetV1Output> {
  try {
    return await invoke<GreetV1Output>(IPC_COMMANDS_V1.greet, { input });
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function healthV1(): Promise<HealthV1Output> {
  try {
    return await invoke<HealthV1Output>(IPC_COMMANDS_V1.health);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function listSubstancesV1(): Promise<ListSubstancesV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.listSubstances, {
      input: {},
    });
    return parseListSubstancesV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function listPresetsV1(): Promise<ListPresetsV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.listPresets, {
      input: {},
    });
    return parseListPresetsV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function listScenariosV1(): Promise<ListScenariosV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.listScenarios, {
      input: {},
    });
    return parseListScenariosV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function createSubstanceV1(
  input: CreateSubstanceV1Input,
): Promise<CreateSubstanceV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.createSubstance, { input });
    return parseSubstanceMutationV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function updateSubstanceV1(
  input: UpdateSubstanceV1Input,
): Promise<UpdateSubstanceV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.updateSubstance, { input });
    return parseSubstanceMutationV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function deleteSubstanceV1(
  input: DeleteSubstanceV1Input,
): Promise<DeleteSubstanceV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.deleteSubstance, { input });
    return parseDeleteSubstanceV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function importSdfMolV1(input: ImportSdfMolV1Input): Promise<ImportSdfMolV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.importSdfMol, { input });
    return parseImportSdfMolV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function importSmilesV1(input: ImportSmilesV1Input): Promise<ImportSmilesV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.importSmiles, { input });
    return parseImportSmilesV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function importXyzV1(input: ImportXyzV1Input): Promise<ImportXyzV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.importXyz, { input });
    return parseImportXyzV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function saveScenarioV1(input: SaveScenarioV1Input): Promise<SaveScenarioV1Output> {
  try {
    const commandInput: {
      scenarioId?: string;
      scenarioName: string;
      builder: ScenarioBuilderSnapshotV1;
      runtime: ScenarioRuntimeSettingsV1;
      calculationSummary?: CalculationSummaryV1;
    } = {
      scenarioName: input.name,
      builder: input.payload.builderDraft,
      runtime: input.payload.runtimeSettings,
    };

    if (input.payload.calculationSummary !== undefined) {
      commandInput.calculationSummary = input.payload.calculationSummary;
    }

    if (input.scenarioId !== undefined) {
      commandInput.scenarioId = input.scenarioId;
    }

    const payload = await invoke<unknown>(IPC_COMMANDS_V1.saveScenario, {
      input: commandInput,
    });
    return parseSaveScenarioV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function loadScenarioV1(input: LoadScenarioV1Input): Promise<LoadScenarioV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.loadScenario, {
      input: {
        scenarioId: input.id,
      },
    });
    return parseLoadScenarioV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}
