// In-memory CSRF token (FRONTEND_PLAN.md FD6a, Q10). Never written to localStorage, sessionStorage, or cookies.
// The session module sets it from GET /session and replaces it with the token returned at sign-in.

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}
