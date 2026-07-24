import type { AuthSession, Role } from "../types/auth";
import { isTokenExpired } from "./jwt";

const TOKEN_KEY = "meynapos.token";
const USER_ID_KEY = "meynapos.userId";
const NAME_KEY = "meynapos.fullName";
const ROLE_KEY = "meynapos.role";
const MUST_CHANGE_PASSWORD_KEY = "meynapos.mustChangePassword";

export function saveSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_ID_KEY, String(session.user.id));
  localStorage.setItem(NAME_KEY, session.user.name);
  localStorage.setItem(ROLE_KEY, session.user.role);
  localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, String(session.mustChangePassword));
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredSession(): AuthSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const userId = Number(localStorage.getItem(USER_ID_KEY) ?? "0");
  const name = localStorage.getItem(NAME_KEY);
  const role = localStorage.getItem(ROLE_KEY) as Role | null;
  const mustChangePassword = localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === "true";

  if (!token || !name || !role || isTokenExpired(token)) {
    clearSession();
    return null;
  }

  return {
    token,
    user: { id: userId, name, role },
    mustChangePassword,
  };
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
}
