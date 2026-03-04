import { useEffect, type RefObject } from "react";

type UsePanelHotkeysOptions = {
  leftPanelRef: RefObject<HTMLElement | null>;
  centerPanelRef: RefObject<HTMLElement | null>;
  rightPanelRef: RefObject<HTMLElement | null>;
};

function focusPanel(panelRef: RefObject<HTMLElement | null>): void {
  panelRef.current?.focus();
}

export function usePanelHotkeys({
  leftPanelRef,
  centerPanelRef,
  rightPanelRef,
}: UsePanelHotkeysOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      switch (event.code) {
        case "Digit1":
        case "Numpad1":
          event.preventDefault();
          focusPanel(leftPanelRef);
          return;
        case "Digit2":
        case "Numpad2":
          event.preventDefault();
          focusPanel(centerPanelRef);
          return;
        case "Digit3":
        case "Numpad3":
          event.preventDefault();
          focusPanel(rightPanelRef);
          return;
        default:
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [leftPanelRef, centerPanelRef, rightPanelRef]);
}
