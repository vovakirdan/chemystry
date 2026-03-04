import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NotificationCenter from "./NotificationCenter";

describe("NotificationCenter", () => {
  it("renders empty state when queue is empty", () => {
    const html = renderToStaticMarkup(
      <NotificationCenter notifications={[]} onDismiss={vi.fn()} />,
    );

    expect(html).toContain("No notifications");
  });

  it("renders cards for info/warn/error levels", () => {
    const html = renderToStaticMarkup(
      <NotificationCenter
        notifications={[
          { id: 1, level: "info", message: "Info message" },
          { id: 2, level: "warn", message: "Warn message" },
          { id: 3, level: "error", message: "Error message" },
        ]}
        onDismiss={vi.fn()}
      />,
    );

    expect(html).toContain("notification-card--info");
    expect(html).toContain("notification-card--warn");
    expect(html).toContain("notification-card--error");
    expect(html).toContain("INFO");
    expect(html).toContain("WARN");
    expect(html).toContain("ERROR");
  });
});
