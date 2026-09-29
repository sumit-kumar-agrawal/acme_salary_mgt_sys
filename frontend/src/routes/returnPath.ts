// Where to go after sign-in (FRONTEND_PLAN.md R7). Only internal paths are accepted, so a crafted link
// cannot send the user to another site after signing in (open redirect).

export const SIGN_IN_PATH = "/sign-in";

export interface ReturnState {
  from?: string;
}

export function safeReturnPath(state: unknown): string {
  const from =
    typeof state === "object" &&
    state !== null &&
    "from" in state &&
    typeof state.from === "string"
      ? state.from
      : "/";
  const internal =
    from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/\\");
  if (!internal || from === SIGN_IN_PATH || from.startsWith(`${SIGN_IN_PATH}?`))
    return "/";
  return from;
}
