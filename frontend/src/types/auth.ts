export type Role = "ADMIN" | "CASHIER";

export interface LoginCredentials {
  username: string;
  password: string;
  captchaToken?: string;
}

export interface LoginApiResponse {
  access_token: string;
  token_type: string;
  role?: Role;
  full_name?: string;
  name?: string;
}

export interface AuthUser {
  name: string;
  role: Role;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface AuthErrorResponse {
  detail?: string | Array<{ msg?: string }> | LoginErrorDetail;
  message?: string;
}

export interface LoginErrorDetail {
  message?: string;
  attempts_remaining?: number;
  locked?: boolean;
}
