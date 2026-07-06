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
  created_at: string;
  last_login_at: string | null;
  failed_login_attempts: number;
  locked: boolean;
  locked_at: string | null;
}

export interface UserPayload {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  password?: string;
  role: Role;
}

