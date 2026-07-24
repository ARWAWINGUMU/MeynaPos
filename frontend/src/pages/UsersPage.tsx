import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, LockOpen, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { AxiosError } from "axios";

import { ReusableForm } from "../components/ReusableForm";
import { ReusableModal } from "../components/ReusableModal";
import { ReusableTable, type TableColumn } from "../components/ReusableTable";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import {
  activateUser,
  createUser,
  deactivateUser,
  deleteUser,
  listUsers,
  resetFailedAttempts,
  resetPassword,
  unlockUser,
  updateUser,
  type UserFilters,
} from "../services/userService";
import type { Role } from "../types/auth";
import type { TemporaryPasswordResponse, UserPayload, UserRecord } from "../types/user";

const emptyForm: UserPayload = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  password: "",
  role: "CASHIER",
};

interface TemporaryPasswordDialog {
  title: string;
  message: string;
  password: string;
  expiresAt: string | null;
}

interface ResetDialogState {
  user: UserRecord;
  adminPassword: string;
  temporaryPassword: string;
  generateAutomatically: boolean;
}

interface SensitiveActionDialog {
  user: UserRecord;
  action: "deactivate" | "reactivate" | "delete";
  adminPassword: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { detail?: string | { message?: string } } | undefined;
    const detail = data?.detail;
    if (typeof detail === "object" && detail?.message) {
      return String(detail.message);
    }
    if (typeof detail === "string") {
      return detail;
    }
  }
  return "No fue posible completar la acción.";
}

function isTemporaryExpired(user: UserRecord): boolean {
  return Boolean(user.must_change_password && user.temporary_password_expires_at && new Date(user.temporary_password_expires_at).getTime() <= Date.now());
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function UsersPage() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filters, setFilters] = useState<UserFilters>({ search: "", role: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserPayload>(emptyForm);
  const [temporaryDialog, setTemporaryDialog] = useState<TemporaryPasswordDialog | null>(null);
  const [resetDialog, setResetDialog] = useState<ResetDialogState | null>(null);
  const [actionDialog, setActionDialog] = useState<SensitiveActionDialog | null>(null);
  const [showResetAdminPassword, setShowResetAdminPassword] = useState(false);
  const [showActionAdminPassword, setShowActionAdminPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentUserId = session?.user.id ?? 0;

  async function loadUsers() {
    try {
      setUsers(await listUsers(filters));
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  }

  useEffect(() => {
    loadUsers();
  }, [filters.role, filters.status]);

  function openCreateModal() {
    setEditingUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEditModal(user: UserRecord) {
    setEditingUser(user);
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      email: user.email,
      username: user.username ?? "",
      role: user.role,
    });
    setModalOpen(true);
  }

  function openResetDialog(user: UserRecord) {
    setShowResetAdminPassword(false);
    setResetDialog({ user, adminPassword: "", temporaryPassword: "", generateAutomatically: true });
  }

  function openActionDialog(user: UserRecord, action: SensitiveActionDialog["action"]) {
    setShowActionAdminPassword(false);
    setActionDialog({ user, action, adminPassword: "" });
  }

  function showTemporaryPassword(result: TemporaryPasswordResponse, title: string, message: string) {
    setTemporaryDialog({
      title,
      message,
      password: result.temporary_password,
      expiresAt: result.temporary_password_expires_at,
    });
  }

  async function saveUser() {
    if (!form.first_name || !form.last_name || !form.email || !form.username) {
      showToast("Completa los campos obligatorios.", "error");
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          username: form.username,
          role: form.role,
        });
        showToast("Usuario actualizado correctamente.", "success");
      } else {
        const payload = { ...form, password: form.password?.trim() || undefined };
        const createdUser = await createUser(payload);
        showToast("Usuario creado correctamente.", "success");
        showTemporaryPassword(
          createdUser,
          "Contraseña temporal generada",
          "Usuario creado correctamente. Copie esta contraseña temporal y entréguela al usuario. Solo se mostrará una vez.",
        );
      }
      setModalOpen(false);
      await loadUsers();
    } catch (error) {
      setResetDialog((current) => (current ? { ...current, adminPassword: "" } : current));
      showToast(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSensitiveAction() {
    if (!actionDialog) {
      return;
    }
    if (!actionDialog.adminPassword) {
      showToast("Ingrese su contraseña de administrador.", "error");
      return;
    }

    setLoading(true);
    try {
      if (actionDialog.action === "deactivate") {
        await deactivateUser(actionDialog.user.id, { admin_password: actionDialog.adminPassword });
        showToast("Usuario desactivado. Sus sesiones quedaron invalidadas y el historial se conservó.", "success");
      } else if (actionDialog.action === "reactivate") {
        await activateUser(actionDialog.user.id, { admin_password: actionDialog.adminPassword });
        showToast("Usuario reactivado correctamente.", "success");
      } else {
        const message = await deleteUser(actionDialog.user.id, { admin_password: actionDialog.adminPassword });
        showToast(message, "success");
      }
      setActionDialog(null);
      setShowActionAdminPassword(false);
      await loadUsers();
    } catch (error) {
      setActionDialog((current) => (current ? { ...current, adminPassword: "" } : current));
      showToast(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetDialog) {
      return;
    }
    if (!resetDialog.adminPassword) {
      showToast("Ingrese su contraseña de administrador.", "error");
      return;
    }
    if (!resetDialog.generateAutomatically && !resetDialog.temporaryPassword) {
      showToast("Ingrese una contraseña temporal o active la generación automática.", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(resetDialog.user.id, {
        admin_password: resetDialog.adminPassword,
        temporary_password: resetDialog.generateAutomatically ? undefined : resetDialog.temporaryPassword,
      });
      showToast("Contraseña restablecida correctamente.", "success");
      showTemporaryPassword(
        result,
        "Contraseña temporal restablecida",
        "Copie esta contraseña temporal y entréguela al usuario. Solo se mostrará una vez.",
      );
      setResetDialog(null);
      setShowResetAdminPassword(false);
      await loadUsers();
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetAttempts(user: UserRecord) {
    try {
      await resetFailedAttempts(user.id);
      showToast("Intentos fallidos reiniciados.", "success");
      await loadUsers();
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  }

  async function handleUnlock(user: UserRecord) {
    try {
      await unlockUser(user.id);
      showToast("Usuario desbloqueado.", "success");
      await loadUsers();
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryDialog) {
      return;
    }
    await navigator.clipboard.writeText(temporaryDialog.password);
    showToast("Contraseña temporal copiada.", "success");
  }

  const columns = useMemo<Array<TableColumn<UserRecord>>>(
    () => [
      { key: "name", header: "Nombre", render: (user) => <div className="space-y-1"><span className="font-medium text-gray-900">{user.full_name}</span>{user.is_superuser && <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Superadministrador</span>}</div> },
      { key: "username", header: "Username", render: (user) => user.username ?? "-" },
      { key: "email", header: "Correo", render: (user) => user.email },
      { key: "role", header: "Rol", render: (user) => (user.role === "ADMIN" ? "Administrador" : "Cajero") },
      {
        key: "status",
        header: "Estado",
        render: (user) => (
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {user.is_active ? "Activo" : "Inactivo"}
            </span>
            {user.locked && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Bloqueado</span>}
            {user.must_change_password && !isTemporaryExpired(user) && (
              <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">Cambio pendiente</span>
            )}
            {isTemporaryExpired(user) && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Temporal expirada</span>}
          </div>
        ),
      },
      { key: "attempts", header: "Fallos", render: (user) => user.failed_login_attempts },
      {
        key: "actions",
        header: "Acciones",
        render: (user) => (
          <div className="flex flex-wrap gap-2">
            {(!user.is_superuser || user.id === currentUserId) && <button className="text-emerald-700 hover:underline" onClick={() => openEditModal(user)}>Editar</button>}
            {user.id !== currentUserId && user.is_active && (
              !user.is_superuser && <button className="text-gray-700 hover:underline" onClick={() => openActionDialog(user, "deactivate")}>
                Desactivar
              </button>
            )}
            {!user.is_active && !user.is_superuser && (
              <button className="text-emerald-700 hover:underline" onClick={() => openActionDialog(user, "reactivate")}>
                Reactivar
              </button>
            )}
            {user.locked && <button className="text-blue-700 hover:underline" onClick={() => handleUnlock(user)}>Desbloquear</button>}
            {user.failed_login_attempts > 0 && <button className="text-teal-700 hover:underline" onClick={() => handleResetAttempts(user)}>Reiniciar intentos</button>}
            {user.id !== currentUserId && !user.is_superuser && (
              <button className="inline-flex items-center gap-1 text-amber-700 hover:underline" onClick={() => openResetDialog(user)}>
                <KeyRound className="h-3.5 w-3.5" /> Restablecer contraseña
              </button>
            )}
            {!user.is_active && user.can_be_deleted && user.role !== "ADMIN" && user.id !== currentUserId && (
              <button className="inline-flex items-center gap-1 text-red-700 hover:underline" onClick={() => openActionDialog(user, "delete")}>
                <Trash2 className="h-3.5 w-3.5" /> Eliminar definitivamente
              </button>
            )}
          </div>
        ),
      },
    ],
    [currentUserId],
  );

  return (
    <section className="space-y-5 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Usuarios</h2>
          <p className="text-sm text-gray-500">Gestiona usuarios, roles, estados, bloqueo de cuentas y contraseñas temporales.</p>
        </div>
        <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-2 text-white hover:bg-[#156b46]">
          <Plus className="h-4 w-4" /> Crear Usuario
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[1fr_180px_210px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Buscar usuarios"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3"
          />
        </div>
        <select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value as Role | "" }))} className="rounded-lg border border-gray-300 px-3 py-2">
          <option value="">Todos los roles</option>
          <option value="ADMIN">Administrador</option>
          <option value="CASHIER">Cajero</option>
        </select>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as UserFilters["status"] }))} className="rounded-lg border border-gray-300 px-3 py-2">
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="locked">Bloqueado</option>
          <option value="password_pending">Cambio pendiente</option>
          <option value="temporary_expired">Temporal expirada</option>
        </select>
        <button onClick={loadUsers} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <RefreshCcw className="h-4 w-4" /> Buscar
        </button>
      </div>

      <ReusableTable columns={columns} data={users} emptyMessage="No hay usuarios registrados." />

      <ReusableModal open={modalOpen} title={editingUser ? "Editar Usuario" : "Crear Usuario"} onClose={() => setModalOpen(false)}>
        <ReusableForm onSubmit={saveUser}>
          <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Apellido" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="rounded-lg border border-gray-300 px-3 py-2" />
          {!editingUser && (
            <input
              value={form.password ?? ""}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Contraseña temporal opcional"
              type="password"
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
          )}
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            disabled={editingUser?.id === currentUserId}
            className="rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="ADMIN">Administrador</option>
            <option value="CASHIER">Cajero</option>
          </select>
          {!editingUser && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 md:col-span-2">
              Si deja la contraseña vacía, el sistema generará una temporal segura y la mostrará una sola vez.
            </p>
          )}
          <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-2 text-white disabled:opacity-70 md:col-span-2">
            <LockOpen className="h-4 w-4" /> {loading ? "Guardando..." : "Guardar"}
          </button>
        </ReusableForm>
      </ReusableModal>

      <ReusableModal
        open={Boolean(resetDialog)}
        title="Restablecer contraseña"
        onClose={() => { setResetDialog(null); setShowResetAdminPassword(false); }}
      >
        {resetDialog && (
          <form autoComplete="off" onSubmit={(event) => { event.preventDefault(); handleResetPassword(); }} className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Se cerrarán las sesiones activas de {resetDialog.user.full_name} y deberá cambiar la contraseña en su próximo inicio de sesión.
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{resetDialog.user.full_name}</p>
              <p className="text-sm text-gray-500">{resetDialog.user.email}</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">Su contraseña de administrador</span>
              <div className="relative">
                <input
                  value={resetDialog.adminPassword}
                  onChange={(event) => setResetDialog({ ...resetDialog, adminPassword: event.target.value })}
                  type={showResetAdminPassword ? "text" : "password"}
                  name="user_reset_admin_reauthentication_value"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
                />
                <button type="button" onClick={() => setShowResetAdminPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showResetAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={resetDialog.generateAutomatically}
                onChange={(event) => setResetDialog({ ...resetDialog, generateAutomatically: event.target.checked, temporaryPassword: "" })}
                className="h-4 w-4 rounded border-gray-300 text-[#1B8A5A]"
              />
              Generar automáticamente una contraseña temporal segura
            </label>
            {!resetDialog.generateAutomatically && (
              <input
                value={resetDialog.temporaryPassword}
                onChange={(event) => setResetDialog({ ...resetDialog, temporaryPassword: event.target.value })}
                type="password"
                name="temporary_password_manual_value"
                autoComplete="new-password"
                placeholder="Contraseña temporal manual"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setResetDialog(null); setShowResetAdminPassword(false); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="rounded-lg bg-[#1B8A5A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#156b46] disabled:opacity-70">
                {loading ? "Restableciendo..." : "Confirmar restablecimiento"}
              </button>
            </div>
          </form>
        )}
      </ReusableModal>

      <ReusableModal
        open={Boolean(actionDialog)}
        title={
          actionDialog?.action === "delete"
            ? "Eliminar usuario definitivamente"
            : actionDialog?.action === "reactivate"
              ? "Reactivar usuario"
              : "Desactivar usuario"
        }
        onClose={() => { setActionDialog(null); setShowActionAdminPassword(false); }}
      >
        {actionDialog && (
          <form autoComplete="off" onSubmit={(event) => { event.preventDefault(); handleSensitiveAction(); }} className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {actionDialog.action === "deactivate" &&
                "Al desactivar este usuario se cerrarán sus sesiones y no podrá volver a iniciar sesión. Su historial se conservará."}
              {actionDialog.action === "reactivate" && "El usuario podrá volver a iniciar sesión después de la reactivación."}
              {actionDialog.action === "delete" && "Esta acción solo está permitida para cajeros sin historial. No se eliminarán ventas ni registros históricos."}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{actionDialog.user.full_name}</p>
              <p className="text-sm text-gray-500">{actionDialog.user.email}</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm text-gray-700">Su contraseña de administrador</span>
              <div className="relative">
                <input
                  value={actionDialog.adminPassword}
                  onChange={(event) => setActionDialog({ ...actionDialog, adminPassword: event.target.value })}
                  type={showActionAdminPassword ? "text" : "password"}
                  name="user_action_admin_reauthentication_value"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
                />
                <button type="button" onClick={() => setShowActionAdminPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showActionAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setActionDialog(null); setShowActionAdminPassword(false); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-70 ${actionDialog.action === "delete" ? "bg-red-700 hover:bg-red-800" : "bg-[#1B8A5A] hover:bg-[#156b46]"}`}
              >
                {loading ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </form>
        )}
      </ReusableModal>

      <ReusableModal
        open={Boolean(temporaryDialog)}
        title={temporaryDialog?.title ?? ""}
        onClose={() => setTemporaryDialog(null)}
      >
        {temporaryDialog && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">{temporaryDialog.message}</p>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-emerald-700">Contraseña temporal</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-900">{temporaryDialog.password}</code>
                <button onClick={copyTemporaryPassword} className="inline-flex items-center gap-2 rounded-lg bg-[#1B8A5A] px-3 py-2 text-sm text-white hover:bg-[#156b46]">
                  <Copy className="h-4 w-4" /> Copiar
                </button>
              </div>
              <p className="mt-3 text-xs text-emerald-800">Expira: {formatDate(temporaryDialog.expiresAt)}</p>
            </div>
            <button onClick={() => setTemporaryDialog(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cerrar
            </button>
          </div>
        )}
      </ReusableModal>
    </section>
  );
}
