export const MAX_NOTIFICATIONS = 6;

export type NotificationLevel = "info" | "warn" | "error";

export type AppNotification = {
  id: number;
  level: NotificationLevel;
  message: string;
};

export function appendNotification(
  queue: ReadonlyArray<AppNotification>,
  notification: AppNotification,
  maxSize = MAX_NOTIFICATIONS,
): ReadonlyArray<AppNotification> {
  const nextQueue = [notification, ...queue];

  if (nextQueue.length <= maxSize) {
    return nextQueue;
  }

  return nextQueue.slice(0, maxSize);
}
