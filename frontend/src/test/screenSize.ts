// jsdom has no window.matchMedia; react-bootstrap's responsive Offcanvas (the sidebar) needs it.
// Tests pick a screen size: "large" (≥ lg: static sidebar, the default) or "small" (offcanvas sidebar).

export function setScreenSize(size: "large" | "small"): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: size === "large",
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
