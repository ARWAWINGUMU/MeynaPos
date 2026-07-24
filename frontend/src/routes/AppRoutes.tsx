import { Navigate, Route, Routes } from "react-router-dom";

import { MainLayout } from "../layouts/MainLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { InventoryPage } from "../pages/InventoryPage";
import { LoginPage } from "../pages/LoginPage";
import { POSPage } from "../pages/POSPage";
import { ProductsPage } from "../pages/ProductsPage";
import { PurchasesPage } from "../pages/PurchasesPage";
import { CustomersPage } from "../pages/CustomersPage";
import { ChangeRequiredPasswordPage } from "../pages/ChangeRequiredPasswordPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { UsersPage } from "../pages/UsersPage";
import { PrivateRoute } from "./PrivateRoute";
import { RoleGuard } from "./RoleGuard";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route path="/change-password" element={<ChangeRequiredPasswordPage />} />
        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="ventas" element={<POSPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="inventario" element={<InventoryPage />} />
          <Route path="clientes" element={<CustomersPage />} />
          <Route element={<RoleGuard roles={["ADMIN"]} />}>
            <Route path="compras" element={<PurchasesPage />} />
            <Route path="reportes" element={<ReportsPage />} />
            <Route path="usuarios" element={<UsersPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
