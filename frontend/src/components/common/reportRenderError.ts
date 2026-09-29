// React 19 logs caught and uncaught render errors with `console.error(error)` by default, even in
// production, which would print error messages (possibly containing on-screen data) to the console.
// The root in main.tsx uses this instead: only the error's name is logged (.claude/rules/frontend/security.md).

export function reportRenderError(error: unknown): void {
  const name = error instanceof Error ? error.name : "error";
  console.error(`Unexpected ${name} while rendering`);
}
