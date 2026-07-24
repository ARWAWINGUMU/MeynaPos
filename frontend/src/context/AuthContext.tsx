import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { AuthService } from "../services/authService";
import type { AuthSession, LoginCredentials } from "../types/auth";
import { getTokenExpirationTime } from "../utils/jwt";

interface AuthContextValue {
  session: AuthSession | null;
  token: string | null;
  fullName: string | null;
  role: AuthSession["user"]["role"] | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.getSession());

  const logout = useCallback(() => {
    AuthService.logout();
    setSession(null);
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      logout();
    }

    window.addEventListener("meynapos:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("meynapos:unauthorized", handleUnauthorized);
  }, [logout]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    const expirationTime = getTokenExpirationTime(session.token);
    if (!expirationTime) {
      logout();
      return;
    }

    const millisecondsUntilExpiration = expirationTime - Date.now();
    if (millisecondsUntilExpiration <= 0) {
      logout();
      return;
    }

    const timeout = window.setTimeout(logout, millisecondsUntilExpiration);
    return () => window.clearTimeout(timeout);
  }, [logout, session?.token]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const authenticatedSession = await AuthService.login(credentials);
    setSession(authenticatedSession);
    return authenticatedSession;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      token: session?.token ?? null,
      fullName: session?.user.name ?? null,
      role: session?.user.role ?? null,
      isAuthenticated: Boolean(session),
      mustChangePassword: Boolean(session?.mustChangePassword),
      login,
      logout,
    }),
    [login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
