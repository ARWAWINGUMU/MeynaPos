import { clearSession, getStoredSession, saveSession } from "../utils/authStorage";
import { loginRequest } from "./loginService";
import { api } from "./api";
import type { AuthSession, ChangeRequiredPasswordPayload, LoginCredentials } from "../types/auth";

export class AuthService {
  static getSession(): AuthSession | null {
    return getStoredSession();
  }

  static async login(credentials: LoginCredentials): Promise<AuthSession> {
    const session = await loginRequest(credentials);
    saveSession(session);
    return session;
  }

  static async changeRequiredPassword(payload: ChangeRequiredPasswordPayload): Promise<string> {
    const response = await api.post<{ message: string }>("/auth/change-required-password", payload);
    return response.data.message;
  }

  static logout(): void {
    clearSession();
  }
}
