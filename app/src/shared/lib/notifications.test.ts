import { describe, expect, it } from "vitest";
import { appendNotification, MAX_NOTIFICATIONS, type AppNotification } from "./notifications";

function notification(id: number): AppNotification {
  return {
    id,
    level: "info",
    message: `message-${id}`,
  };
}

describe("appendNotification", () => {
  it("prepends new notifications to the queue", () => {
    const queue = [notification(1), notification(2)];
    const next = appendNotification(queue, notification(3));

    expect(next.map((entry) => entry.id)).toEqual([3, 1, 2]);
  });

  it("enforces queue size limit", () => {
    const queue = Array.from({ length: MAX_NOTIFICATIONS }, (_, index) => notification(index + 1));
    const next = appendNotification(queue, notification(999), 3);

    expect(next).toHaveLength(3);
    expect(next.map((entry) => entry.id)).toEqual([999, 1, 2]);
  });
});
