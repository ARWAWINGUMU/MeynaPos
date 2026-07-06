import { clearSession, getStoredSession, saveSession } from "../utils/authStorage";
import { loginRequest } from "./loginService";
import type { AuthSession, LoginCredentials } from "../types/auth";

export class AuthService {
  static getSession(): AuthSession | null {
    return getStoredSession();
  }

  static async login(credentials: LoginCredentials): Promise<AuthSession> {
    const session = await loginRequest(credentials);
    saveSession(session);
    return session;
  }

  static logout(): void {
    clearSession();
  }
}

