import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { SIGN_IN_PATH, type ReturnState } from "@/routes/returnPath";

/** Default deny for app pages: signed-out users go to sign-in and come back afterwards (R7). */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status !== "signedIn") {
    // The search string never holds `q` (FD6b), so returning to it exposes nothing new.
    const state: ReturnState = {
      from: `${location.pathname}${location.search}`,
    };
    return <Navigate to={SIGN_IN_PATH} replace state={state} />;
  }
  return children;
}
