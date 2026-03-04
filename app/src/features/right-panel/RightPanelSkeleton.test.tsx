import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RightPanelSkeleton from "./RightPanelSkeleton";

describe("RightPanelSkeleton runtime settings hydration", () => {
  it("keeps null runtime fields empty instead of replacing them with defaults", () => {
    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        runtimeSettings={{
          temperatureC: null,
          pressureAtm: 1,
          calculationPasses: null,
          precisionProfile: "Custom",
          fpsLimit: null,
        }}
      />,
    );

    expect(html).toContain('data-testid="right-panel-environment-temperature" value=""');
    expect(html).toContain('data-testid="right-panel-environment-pressure" value="1"');
    expect(html).toContain('data-testid="right-panel-calculations-input" value=""');
    expect(html).toContain('data-testid="right-panel-calculations-fps" value=""');
    expect(html).toContain('data-testid="right-panel-calculations-precision-value"');
    expect(html).toContain("Precision profile: Custom");
  });
});
