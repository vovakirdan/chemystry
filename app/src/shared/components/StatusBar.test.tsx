import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StatusBar from "./StatusBar";

describe("StatusBar", () => {
  it("renders simulation state, precision profile, and fps limit values", () => {
    const html = renderToStaticMarkup(
      <StatusBar simulationState="Running" precisionProfile="High Precision" fpsLimit={144} />,
    );

    expect(html).toContain("Simulation");
    expect(html).toContain("Running");
    expect(html).toContain("Precision");
    expect(html).toContain("High Precision");
    expect(html).toContain("FPS limit");
    expect(html).toContain(">144<");
  });
});
