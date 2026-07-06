import { useEffect, useMemo, useState } from "react";
import { LockOpen, Plus, RefreshCcw, Search } from "lucide-react";

import { ReusableForm } from "../components/ReusableForm";
import { ReusableModal } from "../components/ReusableModal";
import { ReusableTable, type TableColumn } from "../components/ReusableTable";
import {
  activateUser,
  createUser,
  deactivateUser,
  listUsers,
  resetFailedAttempts,
  resetPassword,
  unlockUser,
  updateUser,
  type UserFilters,
} from "../services/userService";
import type { Role } from "../types/auth";
import type { UserPayload, UserRecord } from "../types/user";

const emptyForm: UserPayload = {
  first_name: "",
  last_name: "",
  email: "",
  username: "",
  password: "",
  role: "CASHIER",
};

export function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filters, setFilters] = useState<UserFilters>({ search: "", role: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserPayload>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);

  async function loadUsers() {
    setUsers(await listUsers(filters));
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

  async function saveUser() {
    if (!form.first_name || !form.last_name || !form.email || !form.username) {
      setMessage("Completa los campos obligatorios.");
      return;
    }
    if (editingUser) {
      await updateUser(editingUser.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        username: form.username,
        role: form.role,
      });
      setMessage("Usuario actualizado.");
    } else {
      if (!form.password) {
        setMessage("La contraseña es obligatoria.");
        return;
      }
      await createUser(form);
      setMessage("Usuario creado.");
    }
    setModalOpen(false);
    await loadUsers();
  }

  async function handleResetPassword(user: UserRecord) {
    const temporaryPassword = "MeynaPOS123!";
    await resetPassword(user.id, temporaryPassword);
    setMessage(`Contraseña temporal: ${temporaryPassword}`);
    await loadUsers();
  }

  async function handleResetAttempts(user: UserRecord) {
    await resetFailedAttempts(user.id);
    setMessage("Intentos fallidos reiniciados.");
    await loadUsers();
  }

  const columns = useMemo<Array<TableColumn<UserRecord>>>(
    () => [
      { key: "name", header: "Nombre", render: (user) => <span className="font-medium text-gray-900">{user.full_name}</span> },
      { key: "username", header: "Username", render: (user) => user.username ?? "-" },
      { key: "email", header: "Correo", render: (user) => user.email },
      { key: "role", header: "Rol", render: (user) => (user.role === "ADMIN" ? "Administrador" : "Cajero") },
      {
        key: "status",
        header: "Estado",
        render: (user) => (
          <span className={user.locked ? "text-red-700" : user.is_active ? "text-emerald-700" : "text-gray-500"}>
            {user.locked ? "Bloqueado" : user.is_active ? "Activo" : "Inactivo"}
          </span>
        ),
      },
      { key: "attempts", header: "Fallos", render: (user) => user.failed_login_attempts },
      {
        key: "actions",
        header: "Acciones",
        render: (user) => (
          <div className="flex flex-wrap gap-2">
            <button className="text-emerald-700 hover:underline" onClick={() => openEditModal(user)}>Editar</button>
            <button className="text-gray-700 hover:underline" onClick={() => (user.is_active ? deactivateUser(user.id) : activateUser(user.id)).then(loadUsers)}>
              {user.is_active ? "Desactivar" : "Activar"}
            </button>
            {user.locked && <button className="text-blue-700 hover:underline" onClick={() => unlockUser(user.id).then(loadUsers)}>Desbloquear</button>}
            {user.failed_login_attempts > 0 && <button className="text-teal-700 hover:underline" onClick={() => handleResetAttempts(user)}>Reiniciar intentos</button>}
            <button className="text-amber-700 hover:underline" onClick={() => handleResetPassword(user)}>Reset</button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-5 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Usuarios</h2>
          <p className="text-sm text-gray-500">Gestiona usuarios, roles, estados y bloqueo de cuentas.</p>
        </div>
        <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-2 text-white hover:bg-[#156b46]">
          <Plus className="h-4 w-4" /> Crear Usuario
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[1fr_180px_180px_auto]">
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
        </select>
        <button onClick={loadUsers} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <RefreshCcw className="h-4 w-4" /> Buscar
        </button>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      <ReusableTable columns={columns} data={users} emptyMessage="No hay usuarios registrados." />

      <ReusableModal open={modalOpen} title={editingUser ? "Editar Usuario" : "Crear Usuario"} onClose={() => setModalOpen(false)}>
        <ReusableForm onSubmit={saveUser}>
          <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Nombre" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Apellido" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo" className="rounded-lg border border-gray-300 px-3 py-2" />
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="rounded-lg border border-gray-300 px-3 py-2" />
          {!editingUser && <input value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Contraseña" type="password" className="rounded-lg border border-gray-300 px-3 py-2" />}
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="rounded-lg border border-gray-300 px-3 py-2">
            <option value="ADMIN">Administrador</option>
            <option value="CASHIER">Cajero</option>
          </select>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-2 text-white md:col-span-2">
            <LockOpen className="h-4 w-4" /> Guardar
          </button>
        </ReusableForm>
      </ReusableModal>
    </section>
  );
}
