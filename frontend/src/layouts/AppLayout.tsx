import {
  BarChart3,
  Bell,
  LayoutDashboard,
  LogOut,
  Package,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  User,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import logoImg from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";

const menuItems: Array<{ to: string; icon: LucideIcon; label: string; roles?: Array<"ADMIN" | "CASHIER"> }> = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ventas", icon: ShoppingCart, label: "Ventas", roles: ["ADMIN", "CASHIER"] },
  { to: "/productos", icon: Tag, label: "Productos", roles: ["ADMIN", "CASHIER"] },
  { to: "/inventario", icon: Package, label: "Inventario", roles: ["ADMIN", "CASHIER"] },
  { to: "/compras", icon: ShoppingBag, label: "Compras", roles: ["ADMIN"] },
  { to: "/clientes", icon: Users, label: "Clientes", roles: ["ADMIN"] },
  { to: "/usuarios", icon: UserCog, label: "Usuarios", roles: ["ADMIN"] },
  { to: "/reportes", icon: BarChart3, label: "Reportes", roles: ["ADMIN"] },
  { to: "/configuracion", icon: Settings, label: "Configuración", roles: ["ADMIN"] },
];

function getCurrentDate(): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function getRoleLabel(role: string | null): string {
  if (role === "ADMIN") {
    return "Administrador";
  }
  if (role === "CASHIER") {
    return "Cajero";
  }
  return "Usuario";
}

function getBreadcrumb(pathname: string): string {
  const current = menuItems.find((item) => item.to === pathname);
  return current?.label ?? "Dashboard";
}

export function MainLayout() {
  const { fullName, role, logout } = useAuth();
  const location = useLocation();
  const visibleMenuItems = menuItems.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-gradient-to-b from-[#047857] to-[#065f46] text-white">
        <div className="border-b border-white/10 p-6">
          <div className="flex flex-col items-center">
            <div className="mb-4 inline-block rounded-2xl bg-white/70 p-3 backdrop-blur-sm">
              <img src={logoImg} alt="Logo MeynaPOS" className="h-20 w-20 object-contain" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">MeynaPOS</h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                        isActive ? "bg-white/20 text-white shadow-lg" : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
            <p className="mb-1 text-xs text-white/60">Version</p>
            <p className="text-sm font-semibold">2.0.1</p>
          </div>
        </div>
      </aside>

      <header className="fixed left-64 right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex max-w-2xl flex-1 items-center">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos, clientes, ventas..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="ml-6 flex items-center gap-4">
          <p className="hidden text-sm capitalize text-gray-500 xl:block">{getCurrentDate()}</p>
          <button className="relative rounded-lg p-2 transition-colors hover:bg-gray-100" aria-label="Notificaciones">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{fullName ?? "Usuario"}</p>
              <p className="text-xs text-gray-500">{getRoleLabel(role)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400">
              <User className="h-5 w-5 text-white" />
            </div>
          </div>

          <button onClick={logout} className="rounded-lg p-2 transition-colors hover:bg-red-50 group" aria-label="Cerrar sesión">
            <LogOut className="h-5 w-5 text-gray-600 group-hover:text-red-600" />
          </button>
        </div>
      </header>

      <main className="ml-64 pt-16">
        <div className="border-b border-gray-200 bg-white px-8 py-3 text-sm text-gray-500">
          MeynaPOS / <span className="font-medium text-gray-800">{getBreadcrumb(location.pathname)}</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export function AppLayout() {
  return <MainLayout />;
}
