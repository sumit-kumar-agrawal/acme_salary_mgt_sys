import { apiRequest, setCsrfToken, type DataEnvelope } from "@/services/api";
import type { Session, SignInCredentials } from "@/services/auth.types";

// Session endpoints (API spec §4). Every session response carries the next CSRF token; sign-out ends it.

export const authService = {
  /** Current sign-in state and a fresh CSRF token (public endpoint). */
  async getSession(): Promise<Session> {
    const { data } = await apiRequest<DataEnvelope<Session>>("/session");
    setCsrfToken(data.csrf_token);
    return data;
  },

  /** Signs in. The body is not wrapped in a resource key; the returned token replaces the old one. */
  async signIn(credentials: SignInCredentials): Promise<Session> {
    const { data } = await apiRequest<DataEnvelope<Session>>("/session", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setCsrfToken(data.csrf_token);
    return data;
  },

  /** Signs out (204). The server resets the session, so the token is cleared even if the request fails. */
  async signOut(): Promise<void> {
    try {
      await apiRequest<void>("/session", { method: "DELETE" });
    } finally {
      setCsrfToken(null);
    }
  },
};
