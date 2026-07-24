import type { Role } from "./auth";

export interface UserRecord {
  id: number;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string;
  username: string | null;
  role: Role;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  last_login_at: string | null;
  failed_login_attempts: number;
  locked: boolean;
  locked_at: string | null;
  must_change_password: boolean;
  temporary_password_expires_at: string | null;
  password_changed_at: string | null;
  password_reset_by_id: number | null;
  token_version: number;
  can_be_deleted: boolean;
}

export interface UserPayload {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  password?: string;
  role: Role;
}

export interface TemporaryPasswordResponse extends UserRecord {
  temporary_password: string;
}

export interface PasswordResetPayload {
  admin_password: string;
  temporary_password?: string;
}

export interface AdminPasswordPayload {
  admin_password: string;
}
