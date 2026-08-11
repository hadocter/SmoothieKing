import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  email: string;
  nickname: string;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_TOKEN_KEY = "smoothy_king_token";
const AUTH_USER_KEY = "smoothy_king_user";

/**
 * The token, at module scope, registered with the API client at import time.
 *
 * It used to be a ref registered from a `useEffect` inside the provider, and
 * that is one tick too late: React runs child effects before parent effects,
 * so every page's `useQuery` fired before the provider had told the client
 * where to find a token. The first request of every page load went out
 * unauthenticated and came back 401, which the profile screens then rendered
 * as "you have not set a profile" — to people who had.
 *
 * Registering here happens before any component renders, so there is no
 * ordering to get wrong.
 */
const tokenRef: { current: string | null } = { current: null };
setAuthTokenGetter(() => tokenRef.current);

/**
 * This is only a client-side convenience check. The server remains the source
 * of truth for token validity; reading `exp` here merely avoids briefly
 * rendering an account that we already know has expired.
 */
function tokenIsExpired(token: string): boolean {
  try {
    const [, payload] = token.split(".");
    if (!payload) return false;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const parsed = JSON.parse(json) as { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp <= Date.now();
  } catch {
    // A malformed token still goes to the server, which will reject it and
    // route through the same logout handler below.
    return false;
  }
}

/** Read synchronously, for the same reason. */
function readStoredAuth(): { token: string | null; user: AuthUser | null } {
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
  const storedUser = localStorage.getItem(AUTH_USER_KEY);
  if (!storedToken || !storedUser || tokenIsExpired(storedToken)) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    return { token: null, user: null };
  }
  try {
    return { token: storedToken, user: JSON.parse(storedUser) as AuthUser };
  } catch {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // The initializer runs during the first render, before any child renders and
  // therefore before any child can fire a request. Restoring in an effect meant
  // the session was not there yet when it was first needed.
  const [restored] = useState(readStoredAuth);
  const [user, setUser] = useState<AuthUser | null>(restored.user);
  const [token, setToken] = useState<string | null>(restored.token);
  const queryClient = useQueryClient();

  // Kept in the context for callers that already read it. Nothing is loaded
  // asynchronously any more, so it is never true — retained rather than removed
  // because several pages gate on it and flipping them is a separate change.
  const isLoading = false;

  // Follows the current token, not the restored one — assigning `restored`
  // here would undo a fresh login on the next render. `login` and `logout`
  // still set the ref directly so a request fired in the same tick as either
  // one already carries the right value, before any re-render happens.
  tokenRef.current = token;

  const login = useCallback((newUser: AuthUser, newToken: string) => {
    // Set the ref before clearing so any refetch triggered below already
    // carries the new token.
    tokenRef.current = newToken;
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    // A signed-out visit caches an empty favorites list; drop it so the
    // account's real data is fetched.
    queryClient.clear();
  }, [queryClient]);

  const logout = useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    // Favorites and the health profile are per-user, so the previous account's
    // cached responses must not survive into the next session.
    queryClient.clear();
  }, [queryClient]);

  // Assign during render, as with tokenRef above: child query effects may run
  // before a provider effect, and their first 401 should still clear the
  // expired session rather than leave an authenticated-looking screen behind.
  setUnauthorizedHandler(logout);
  useEffect(() => () => setUnauthorizedHandler(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
