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
  user_id?: number;
  must_change_password?: boolean;
}

export interface AuthUser {
  id: number;
  name: string;
  role: Role;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  mustChangePassword: boolean;
}

export interface AuthErrorResponse {
  detail?: string | Array<{ msg?: string }> | LoginErrorDetail;
  message?: string;
}

export interface LoginErrorDetail {
  message?: string;
  attempts_remaining?: number;
  locked?: boolean;
  temporary_password_expired?: boolean;
}

export interface ChangeRequiredPasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
