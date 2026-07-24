import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, Lock, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";

import logoImg from "../assets/logo.png";
import { AuthErrorMessage } from "../components/AuthErrorMessage";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { AuthService } from "../services/authService";

interface FormState {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

const initialForm: FormState = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

function getApiMessage(error: unknown): string {
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
  return "No fue posible actualizar la contraseña.";
}

export function ChangeRequiredPasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requirements = useMemo(
    () => [
      { label: "Al menos 8 caracteres", valid: form.new_password.length >= 8 },
      { label: "Una mayúscula", valid: /[A-Z]/.test(form.new_password) },
      { label: "Una minúscula", valid: /[a-z]/.test(form.new_password) },
      { label: "Un número", valid: /\d/.test(form.new_password) },
      { label: "Un símbolo", valid: /[!@#$%^&*()\-=+[\]{};:,.?_]/.test(form.new_password) },
      { label: "Confirmación igual", valid: Boolean(form.confirm_password) && form.new_password === form.confirm_password },
    ],
    [form.confirm_password, form.new_password],
  );

  function validate(): string | null {
    if (!form.current_password || !form.new_password || !form.confirm_password) {
      return "Completa todos los campos.";
    }
    if (requirements.some((requirement) => !requirement.valid)) {
      return "La nueva contraseña todavía no cumple todos los requisitos.";
    }
    if (form.current_password === form.new_password) {
      return "La nueva contraseña no puede ser igual a la temporal.";
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const message = await AuthService.changeRequiredPassword(form);
      logout();
      showToast(message, "success");
      navigate("/login", { replace: true });
    } catch (changeError) {
      const message = getApiMessage(changeError);
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6">
      <section className="w-full max-w-2xl rounded-2xl border border-emerald-100 bg-white p-8 shadow-xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3">
              <img src={logoImg} alt="Logo MeynaPOS" className="h-14 w-14 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Cambio obligatorio de contraseña</h1>
              <p className="text-sm text-gray-500">Define una contraseña personal para continuar usando MeynaPOS.</p>
            </div>
          </div>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            {[
              ["current_password", "Contraseña temporal o actual"],
              ["new_password", "Nueva contraseña"],
              ["confirm_password", "Confirmar nueva contraseña"],
            ].map(([name, label]) => (
              <label key={name} className="block">
                <span className="mb-2 block text-sm text-gray-700">{label}</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={form[name as keyof FormState]}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                    type={showPasswords ? "text" : "password"}
                    className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-11 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1B8A5A]"
                    autoComplete={name === "current_password" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            ))}

            {error && <AuthErrorMessage message={error} />}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1B8A5A] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#156b46] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ShieldCheck className="h-5 w-5" />
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>

          <aside className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
            <h2 className="mb-3 text-sm font-semibold text-sky-950">Requisitos de seguridad</h2>
            <ul className="space-y-2">
              {requirements.map((requirement) => (
                <li key={requirement.label} className={`flex items-center gap-2 text-sm ${requirement.valid ? "text-emerald-700" : "text-gray-500"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${requirement.valid ? "bg-emerald-500" : "bg-gray-300"}`} />
                  {requirement.label}
                </li>
              ))}
            </ul>
          </aside>
        </form>
      </section>
    </main>
  );
}
