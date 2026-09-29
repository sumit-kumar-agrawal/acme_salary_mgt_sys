// Session shapes (docs/api-specification.md §4).

export interface User {
  email: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

/** GET /session and POST /session return this; every response carries the CSRF token to use next. */
export interface Session {
  authenticated: boolean;
  user: User | null;
  csrf_token: string;
}
