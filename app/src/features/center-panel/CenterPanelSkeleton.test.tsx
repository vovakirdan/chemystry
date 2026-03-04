import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CenterPanelSkeleton, { CENTER_TIMELINE_INITIAL } from "./CenterPanelSkeleton";

describe("CenterPanelSkeleton lifecycle sync", () => {
  it("reflects externally controlled simulation state", () => {
    const html = renderToStaticMarkup(
      <CenterPanelSkeleton controlState={{ isPlaying: true, timelinePosition: 64 }} />,
    );

    expect(html).toContain('data-testid="center-control-play" disabled=""');
    expect(html).toContain('data-testid="center-control-pause"');
    expect(html).not.toContain('data-testid="center-control-pause" disabled=""');
    expect(html).toContain('data-testid="center-control-timeline-value"');
    expect(html).toContain("64%");
    expect(html).toContain("Playback: running");
  });

  it("renders blocked playback state and message when Play is unavailable", () => {
    const blockedHtml = renderToStaticMarkup(
      <CenterPanelSkeleton
        controlState={{ isPlaying: false, timelinePosition: CENTER_TIMELINE_INITIAL }}
        playBlocked
        playBlockedReason="Fix Builder validation errors."
      />,
    );

    expect(blockedHtml).toContain("Playback: blocked");
    expect(blockedHtml).toContain("Play disabled: Fix Builder validation errors.");
    expect(blockedHtml).toContain('data-testid="center-control-blocked-reason"');
  });
});
