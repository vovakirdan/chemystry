import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { RightPanelFeatureStatus } from "../../features/right-panel/RightPanelSkeleton";
import type { FeatureFlagKey, FeatureFlags } from "../../shared/config/featureFlags";
import { ensureFeatureEnabledV1, isCommandErrorV1 } from "../../shared/contracts/ipc/client";
import type { NotificationLevel } from "../../shared/lib/notifications";
import { formatCommandError } from "../simulation/lifecycle";
import { FEATURE_KEYS, FEATURE_LABEL_BY_KEY } from "./constants";

type UseFeatureActionsParams = {
  featureFlags: Readonly<FeatureFlags>;
  setFeaturePathMsg: Dispatch<SetStateAction<string>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

function availabilityLabel(enabled: boolean): string {
  return enabled ? "available" : "unavailable";
}

export function useFeatureActions({
  featureFlags,
  setFeaturePathMsg,
  enqueueNotification,
}: UseFeatureActionsParams): {
  triggerFeaturePath: (feature: FeatureFlagKey) => void;
  rightPanelFeatureStatuses: ReadonlyArray<RightPanelFeatureStatus>;
} {
  const triggerFeaturePath = useCallback(
    (feature: FeatureFlagKey): void => {
      try {
        ensureFeatureEnabledV1(featureFlags, feature);
        const message = `${FEATURE_LABEL_BY_KEY[feature]} path is available.`;
        setFeaturePathMsg(message);
        enqueueNotification("info", message);
      } catch (error: unknown) {
        if (isCommandErrorV1(error)) {
          const message = formatCommandError(error);
          setFeaturePathMsg(message);
          enqueueNotification("warn", message);
          return;
        }

        const message = `Unexpected error: ${String(error)}`;
        setFeaturePathMsg(message);
        enqueueNotification("error", message);
      }
    },
    [enqueueNotification, featureFlags, setFeaturePathMsg],
  );

  const rightPanelFeatureStatuses: ReadonlyArray<RightPanelFeatureStatus> = useMemo(
    () =>
      FEATURE_KEYS.map((feature) => ({
        id: feature,
        label: FEATURE_LABEL_BY_KEY[feature],
        availability: availabilityLabel(featureFlags[feature]),
      })),
    [featureFlags],
  );

  return {
    triggerFeaturePath,
    rightPanelFeatureStatuses,
  };
}
