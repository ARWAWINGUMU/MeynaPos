import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/auth";

export function RoleGuard({ roles }: { roles: Role[] }) {
  const { role } = useAuth();
  return role && roles.includes(role) ? <Outlet /> : <Navigate to="/" replace />;
}

