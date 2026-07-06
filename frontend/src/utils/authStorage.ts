import type { AuthSession, Role } from "../types/auth";
import { isTokenExpired } from "./jwt";

const TOKEN_KEY = "meynapos.token";
const NAME_KEY = "meynapos.fullName";
const ROLE_KEY = "meynapos.role";

export function saveSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(NAME_KEY, session.user.name);
  localStorage.setItem(ROLE_KEY, session.user.role);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredSession(): AuthSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const name = localStorage.getItem(NAME_KEY);
  const role = localStorage.getItem(ROLE_KEY) as Role | null;

  if (!token || !name || !role || isTokenExpired(token)) {
    clearSession();
    return null;
  }

  return {
    token,
    user: { name, role },
  };
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ROLE_KEY);
}

