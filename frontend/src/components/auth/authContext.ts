import { createContext } from "react";
import type { User } from "@/services/auth.types";

/** TanStack Query key of the session query (everything else is cleared on sign-out, R6). */
export const SESSION_QUERY_KEY = ["session"] as const;

/** `error`: the first session check failed (API unreachable), which is not the same as signed out (R3). */
export type AuthStatus = "loading" | "error" | "signedIn" | "signedOut";

/** Why the user is on the sign-in page, shown once (R6). */
export type AuthNotice = "expired" | "signedOut" | null;

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** The startup error when `status` is `error`. */
  error: unknown;
  notice: AuthNotice;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Retries the startup session check. */
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
