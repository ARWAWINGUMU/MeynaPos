import { api } from "./api";
import type { Role } from "../types/auth";
import type { AdminPasswordPayload, PasswordResetPayload, TemporaryPasswordResponse, UserPayload, UserRecord } from "../types/user";

export interface UserFilters {
  search?: string;
  role?: Role | "";
  status?: "active" | "inactive" | "locked" | "password_pending" | "temporary_expired" | "";
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

export async function createUser(payload: UserPayload): Promise<TemporaryPasswordResponse> {
  const response = await api.post<TemporaryPasswordResponse>("/users", payload);
  return response.data;
}

export async function updateUser(id: number, payload: Omit<UserPayload, "password">): Promise<UserRecord> {
  const response = await api.put<UserRecord>(`/users/${id}`, payload);
  return response.data;
}

export async function activateUser(id: number, payload: AdminPasswordPayload): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/reactivate`, payload);
  return response.data;
}

export async function deactivateUser(id: number, payload: AdminPasswordPayload): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/deactivate`, payload);
  return response.data;
}

export async function deleteUser(id: number, payload: AdminPasswordPayload): Promise<string> {
  const response = await api.delete<{ message: string }>(`/users/${id}`, { data: payload });
  return response.data.message;
}

export async function unlockUser(id: number): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/unlock`);
  return response.data;
}

export async function resetFailedAttempts(id: number): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${id}/reset-attempts`);
  return response.data;
}

export async function resetPassword(id: number, payload: PasswordResetPayload): Promise<TemporaryPasswordResponse> {
  const response = await api.patch<TemporaryPasswordResponse>(`/users/${id}/password`, payload);
  return response.data;
}
