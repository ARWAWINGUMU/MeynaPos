import { AxiosError } from "axios";

import { api } from "./api";
import type { AuthErrorResponse, AuthSession, LoginApiResponse, LoginCredentials, LoginErrorDetail } from "../types/auth";

export class AuthLoginError extends Error {
  attemptsRemaining?: number;
  locked?: boolean;

  constructor(message: string, detail?: LoginErrorDetail) {
    super(message);
    this.name = "AuthLoginError";
    this.attemptsRemaining = detail?.attempts_remaining;
    this.locked = detail?.locked;
  }
}

function isLoginErrorDetail(value: unknown): value is LoginErrorDetail {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseError(error: unknown): AuthLoginError {
  if (error instanceof AxiosError) {
    const data = error.response?.data as AuthErrorResponse | undefined;
    if (isLoginErrorDetail(data?.detail)) {
      return new AuthLoginError(data.detail.message ?? "No fue posible iniciar sesión.", data.detail);
    }
    if (typeof data?.detail === "string") {
      return new AuthLoginError(data.detail);
    }
    if (Array.isArray(data?.detail)) {
      return new AuthLoginError(data.detail.map((item) => item.msg).filter(Boolean).join(" "));
    }
    if (data?.message) {
      return new AuthLoginError(data.message);
    }
  }
  return new AuthLoginError("No fue posible iniciar sesión. Intenta nuevamente.");
}

export async function loginRequest(credentials: LoginCredentials): Promise<AuthSession> {
  try {
    const response = await api.post<LoginApiResponse>("/auth/login", credentials);
    return {
      token: response.data.access_token,
      user: {
        name: response.data.full_name ?? response.data.name ?? credentials.username,
        role: response.data.role ?? "CASHIER",
      },
    };
  } catch (error) {
    throw parseError(error);
  }
}
