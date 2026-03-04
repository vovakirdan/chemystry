import { useRef, type ReactNode } from "react";
import { usePanelHotkeys } from "./usePanelHotkeys";

type AppShellProps = {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
};

function AppShell({ leftPanel, centerPanel, rightPanel }: AppShellProps) {
  const leftPanelRef = useRef<HTMLElement | null>(null);
  const centerPanelRef = useRef<HTMLElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);

  usePanelHotkeys({
    leftPanelRef,
    centerPanelRef,
    rightPanelRef,
  });

  return (
    <div className="app-shell" data-testid="app-shell">
      <section
        ref={leftPanelRef}
        className="app-panel app-panel--left"
        role="region"
        aria-label="Left panel"
        data-testid="panel-left"
        tabIndex={0}
      >
        {leftPanel}
      </section>

      <section
        ref={centerPanelRef}
        className="app-panel app-panel--center"
        role="region"
        aria-label="Center panel"
        data-testid="panel-center"
        tabIndex={0}
      >
        {centerPanel}
      </section>

      <section
        ref={rightPanelRef}
        className="app-panel app-panel--right"
        role="region"
        aria-label="Right panel"
        data-testid="panel-right"
        tabIndex={0}
      >
        {rightPanel}
      </section>
    </div>
  );
}

export default AppShell;
