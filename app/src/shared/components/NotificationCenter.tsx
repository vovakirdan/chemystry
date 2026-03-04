import type { AppNotification } from "../lib/notifications";

type NotificationCenterProps = {
  notifications: ReadonlyArray<AppNotification>;
  onDismiss: (id: number) => void;
};

function NotificationCenter({ notifications, onDismiss }: NotificationCenterProps) {
  return (
    <section
      className="notification-center"
      aria-label="System notifications"
      data-testid="notification-center"
    >
      {notifications.length === 0 ? (
        <p className="notification-center-empty" data-testid="notification-center-empty">
          No notifications
        </p>
      ) : (
        notifications.map((notification) => (
          <article
            key={notification.id}
            className={`notification-card notification-card--${notification.level}`}
            role={notification.level === "error" ? "alert" : "status"}
            data-testid="notification-card"
            data-notification-id={notification.id}
            data-notification-level={notification.level}
          >
            <p className="notification-card-level" data-testid="notification-level">
              {notification.level.toUpperCase()}
            </p>
            <p className="notification-card-message" data-testid="notification-message">
              {notification.message}
            </p>
            <button
              type="button"
              className="notification-card-dismiss"
              aria-label="Dismiss notification"
              data-testid="notification-dismiss"
              onClick={() => onDismiss(notification.id)}
            >
              Dismiss
            </button>
          </article>
        ))
      )}
    </section>
  );
}

export default NotificationCenter;
