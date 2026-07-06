import { FormEvent, useState } from "react";
import { Eye, EyeOff, Lock, Shield, User } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";

import logoImg from "../assets/logo.png";
import { AuthErrorMessage } from "../components/AuthErrorMessage";
import { ReusableModal } from "../components/ReusableModal";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { useAuth } from "../context/AuthContext";
import { AuthLoginError } from "../services/loginService";

interface LoginFormState {
  username: string;
  password: string;
}

interface AuthDialogState {
  title: string;
  message: string;
}

const initialFormState: LoginFormState = {
  username: "",
  password: "",
};

const turnstileEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

function validateForm(form: LoginFormState, turnstileToken: string): string | null {
  if (!form.username.trim()) {
    return "El usuario es obligatorio.";
  }
  if (!form.password.trim()) {
    return "La contraseña es obligatoria.";
  }
  if (!turnstileEnabled) {
    return "La verificación de seguridad no está configurada.";
  }
  if (!turnstileToken) {
    return "Complete la verificación de seguridad.";
  }
  return null;
}

function buildAuthDialog(error: unknown): AuthDialogState {
  if (error instanceof AuthLoginError) {
    if (error.locked) {
      return {
        title: "Cuenta bloqueada",
        message: "La cuenta ha sido bloqueada. Contacte a un administrador para desbloquearla.",
      };
    }
    if (typeof error.attemptsRemaining === "number") {
      return {
        title: "Contraseña incorrecta",
        message: `Contraseña incorrecta. Intentos restantes: ${error.attemptsRemaining}`,
      };
    }
    return { title: "No fue posible iniciar sesión", message: error.message };
  }
  return { title: "No fue posible iniciar sesión", message: "No fue posible iniciar sesión. Intenta nuevamente." };
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AuthDialogState | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(form, turnstileToken);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setDialog(null);
    try {
      await login({
        username: form.username.trim(),
        password: form.password,
        captchaToken: turnstileToken,
      });
      navigate("/", { replace: true });
    } catch (loginError) {
      const nextDialog = buildAuthDialog(loginError);
      setDialog(nextDialog);
      setError(nextDialog.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-white">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1B8A5A] via-[#1E4E5F] to-[#1B8A5A] p-12 lg:flex xl:w-3/5">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-6 inline-block rounded-2xl bg-white/70 p-3 backdrop-blur-sm">
            <img src={logoImg} alt="Logo MeynaPOS" className="h-20 w-20 object-contain" />
          </div>
          <h1 className="mb-3 text-4xl text-white">MeynaPOS</h1>
          <p className="mb-2 text-xl text-white/90">Sistema Inteligente de Punto de Venta</p>
          <p className="max-w-md text-sm text-white/70">Tecnología para crecer juntos</p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {["Control de Inventario", "Análisis de Ventas", "Código de Barras", "Múltiples Pagos"].map((label) => (
            <div key={label} className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-white">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex w-full flex-col bg-white lg:w-1/2 xl:w-2/5">
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto w-full max-w-md p-8">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 inline-block rounded-2xl bg-emerald-50 p-3">
                <img src={logoImg} alt="Logo MeynaPOS" className="h-16 w-16 object-contain" />
              </div>
              <h1 className="text-3xl text-gray-900">MeynaPOS</h1>
              <p className="text-sm text-gray-600">Tecnología para crecer juntos</p>
            </div>

            <div className="mb-8">
              <h2 className="mb-2 text-3xl text-gray-900">Iniciar sesión</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield className="h-4 w-4 text-[#1B8A5A]" />
                <span>Conexión segura</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm text-gray-700">
                  Usuario
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="username"
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    type="text"
                    placeholder="Ingresa tu usuario"
                    className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-4 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1B8A5A]"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-gray-700">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingresa tu contraseña"
                    className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-12 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1B8A5A]"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && <AuthErrorMessage message={error} />}
              <TurnstileWidget onVerify={setTurnstileToken} />
              {!turnstileEnabled && <AuthErrorMessage message="La verificación de seguridad no está configurada." />}
              {turnstileToken && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Verificación de seguridad completada.
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !turnstileEnabled}
                className="w-full rounded-lg bg-[#1B8A5A] py-3 text-white shadow-sm transition-colors hover:bg-[#156b46] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              </button>
            </form>
          </div>
        </div>

        <footer className="border-t border-gray-200 p-6">
          <p className="text-center text-xs text-gray-600">Yeiner Arwawingumu Zapata Vallejo</p>
        </footer>
      </section>

      <ReusableModal open={Boolean(dialog)} title={dialog?.title ?? ""} onClose={() => setDialog(null)}>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{dialog?.message}</p>
          <button onClick={() => setDialog(null)} className="rounded-lg bg-[#1B8A5A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#156b46]">
            Entendido
          </button>
        </div>
      </ReusableModal>
    </main>
  );
}
