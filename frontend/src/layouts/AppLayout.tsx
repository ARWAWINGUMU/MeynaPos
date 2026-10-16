import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  User,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import logoImg from "../assets/logo.png";
import { InventoryNotificationBell } from "../components/InventoryNotificationBell";
import { useAuth } from "../context/AuthContext";
import { useBusinessSettings } from "../hooks/useBusinessSettings";
import { useResponsiveSidebar } from "../hooks/useResponsiveSidebar";
import { ResponsiveSidebar } from "../components/ResponsiveSidebar";

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
  const { settings } = useBusinessSettings();
  const location = useLocation();
  const sidebar = useResponsiveSidebar();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { sidebar.closeMobile(); }, [location.key, sidebar.closeMobile]);
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.inert = sidebar.mobileOpen;
    return () => { if (contentRef.current) contentRef.current.inert = false; };
  }, [sidebar.mobileOpen]);
  const visibleMenuItems = menuItems.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-gray-50">
      <ResponsiveSidebar open={sidebar.open} isDesktop={sidebar.isDesktop} onClose={sidebar.closeMobile} triggerRef={triggerRef}>
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
                    end={item.to === "/"}
                    onClick={sidebar.closeMobile}
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
      </ResponsiveSidebar>

      <div ref={contentRef}>
      <header className={`fixed right-0 top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 transition-[left] duration-200 motion-reduce:transition-none sm:px-4 ${sidebar.isDesktop && sidebar.open ? "left-64" : "left-0"}`}>
        <button ref={triggerRef} type="button" onClick={sidebar.toggle} aria-label={sidebar.open ? "Ocultar menu" : "Mostrar menu"}
          aria-controls="main-navigation" aria-expanded={sidebar.open} title={sidebar.open ? "Ocultar menu" : "Mostrar menu"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><Menu className="h-5 w-5" /></button>
        <div className="flex min-w-0 flex-1 items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{settings?.business_name ?? "MeynaPOS"}</p>
            <p className="truncate text-xs text-gray-500">NIT: {settings?.tax_id ?? "000000000-0"}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {role === "ADMIN" && <InventoryNotificationBell />}

          <p className="hidden text-sm capitalize text-gray-500 xl:block">{getCurrentDate()}</p>

          <div className="flex items-center gap-2 border-l border-gray-200 pl-2" title={`${fullName ?? "Usuario"} - ${getRoleLabel(role)}`}>
            <div className="hidden max-w-36 text-right sm:block">
              <p className="truncate text-sm font-medium text-gray-900">{fullName ?? "Usuario"}</p>
              <p className="text-xs text-gray-500">{getRoleLabel(role)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400">
              <User className="h-5 w-5 text-white" />
            </div>
          </div>

          <button onClick={logout} className="group flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-red-50" aria-label="Cerrar sesión">
            <LogOut className="h-5 w-5 text-gray-600 group-hover:text-red-600" />
          </button>
        </div>
      </header>

      <main className={`min-w-0 pt-16 transition-[margin] duration-200 motion-reduce:transition-none ${sidebar.isDesktop && sidebar.open ? "ml-64" : "ml-0"}`}>
        <div className="border-b border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 sm:px-8">
          MeynaPOS / <span className="font-medium text-gray-800">{getBreadcrumb(location.pathname)}</span>
        </div>
        <Outlet />
      </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return <MainLayout />;
}
