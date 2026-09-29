import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  setCsrfRefresher,
  setCsrfToken,
  setUnauthorizedHandler,
} from "@/services/api";
import type { Session } from "@/services/auth.types";
import { authService } from "@/services/authService";
import {
  AuthContext,
  SESSION_QUERY_KEY,
  type AuthContextValue,
  type AuthNotice,
  type AuthStatus,
} from "@/components/auth/authContext";

// Session state for the whole app (FRONTEND_PLAN.md FD13, R2–R6): React Context over one TanStack Query.
// The user and CSRF token live in memory only; passwords are never stored.

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<AuthNotice>(null);

  const session = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => authService.getSession(),
    staleTime: Infinity,
  });

  /**
   * Ends the local session (R6): cancels requests, removes every cached query and mutation except the
   * session (no employee or salary data stays in memory), shows the notice, then fetches a fresh
   * anonymous session so a new CSRF token is ready for the next sign-in (R4).
   */
  const endSession = useCallback(
    async (reason: Exclude<AuthNotice, null>) => {
      setCsrfToken(null);
      await queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
      });
      queryClient.getMutationCache().clear();
      queryClient.setQueryData<Session>(SESSION_QUERY_KEY, (current) =>
        current ? { ...current, authenticated: false, user: null } : current,
      );
      setNotice(reason);
      await queryClient.refetchQueries({ queryKey: SESSION_QUERY_KEY });
    },
    [queryClient],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void endSession("expired");
    });
    setCsrfRefresher(async () => {
      const fresh = await authService.getSession();
      queryClient.setQueryData(SESSION_QUERY_KEY, fresh);
    });
    return () => {
      setUnauthorizedHandler(null);
      setCsrfRefresher(null);
    };
  }, [endSession, queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const signedIn = await authService.signIn({ email, password });
      queryClient.setQueryData(SESSION_QUERY_KEY, signedIn);
      setNotice(null);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
    } finally {
      // Even if the request fails, nothing stays on screen or in memory (the server session expires anyway).
      await endSession("signedOut");
    }
  }, [endSession]);

  const { refetch } = session;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus;
    if (session.data)
      status = session.data.authenticated ? "signedIn" : "signedOut";
    else if (session.isError) status = "error";
    else status = "loading";

    return {
      status,
      user: status === "signedIn" ? (session.data?.user ?? null) : null,
      error: session.error,
      notice,
      signIn,
      signOut,
      retry,
    };
  }, [
    session.data,
    session.isError,
    session.error,
    notice,
    signIn,
    signOut,
    retry,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
