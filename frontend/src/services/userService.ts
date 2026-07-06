import { api } from "./api";
import type { Role } from "../types/auth";
import type { UserPayload, UserRecord } from "../types/user";

export interface UserFilters {
  search?: string;
  role?: Role | "";
  status?: "active" | "inactive" | "locked" | "";
}

export async function listUsers(filters: UserFilters): Promise<UserRecord[]> {
  const response = await api.get<UserRecord[]>("/users", {
    params: {
      search: filters.search || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
    },
  });
  return response.data;
}

export async function createUser(payload: UserPayload): Promise<UserRecord> {
  const response = await api.post<UserRecord>("/users", payload);
  return response.data;
}

export async function updateUser(id: number, payload: Omit<UserPayload, "password">): Promise<UserRecord> {
  const response = await api.put<UserRecord>(`/users/${id}`, payload);
  return response.data;
}

export async function activateUser(id: number): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/activate`);
  return response.data;
}

export async function deactivateUser(id: number): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/deactivate`);
  return response.data;
}

export async function unlockUser(id: number): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/unlock`);
  return response.data;
}

export async function resetFailedAttempts(id: number): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/reset-attempts`);
  return response.data;
}

export async function resetPassword(id: number, password: string): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/password`, { password });
  return response.data;
}
