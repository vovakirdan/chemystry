# UI Shell (E03)

## E03-T04: Status Bar, Notifications, Theme Tokens

### Delivered

- Global design tokens moved to `:root` CSS variables for spacing, typography, colors, radii, and shadows.
- `StatusBar` component added with live values:
  - simulation state
  - precision profile
  - FPS limit
- `NotificationCenter` component added with queue support and dismiss action.
- Notification levels implemented: `info`, `warn`, `error`.
- `appendNotification` utility enforces queue size limit.

### Colorblind-Friendly Baseline

- State severity is encoded by both color and text (`INFO/WARN/ERROR` labels), not color alone.
- Notification cards include high-contrast left borders and uppercase level labels.
- Status bar values remain readable with neutral text contrast independent of accent colors.

### Stable Selectors

- Status bar selectors:
  - `status-bar`
  - `status-bar-simulation-state`
  - `status-bar-precision-profile`
  - `status-bar-fps-limit`
- Notification selectors:
  - `notification-center`
  - `notification-card`
  - `notification-level`
  - `notification-message`
  - `notification-dismiss`
