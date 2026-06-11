import { useState } from "react";
import { ArrowMark, EyeIcon } from "../../components/common/Icons";
import { useAuth } from "../../context/AuthContext";
import "../../styles/login.css";

type LoginValues = {
  email: string;
  password: string;
};

type LoginFieldErrors = Partial<Record<keyof LoginValues, string>>;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function validateLogin(values: LoginValues): LoginFieldErrors {
  const nextErrors: LoginFieldErrors = {};
  if (!normalizeEmail(values.email)) {
    nextErrors.email = "Ingresá tu email";
  } else if (!isValidEmail(values.email)) {
    nextErrors.email = "Email inválido";
  }

  if (!values.password) {
    nextErrors.password = "Ingresá tu contraseña";
  }

  return nextErrors;
}

function getLoginErrorMessage(err: unknown) {
  const anyErr = err as Error & { status?: number; data?: { lockUntilMs?: number } };
  if (anyErr?.status === 423) {
    const lockUntilMs = anyErr.data?.lockUntilMs;
    if (typeof lockUntilMs === "number" && Number.isFinite(lockUntilMs)) {
      const mins = Math.max(1, Math.ceil((lockUntilMs - Date.now()) / 60_000));
      return `Cuenta bloqueada temporalmente. Intentá de nuevo en ${mins} minuto${mins === 1 ? "" : "s"}`;
    }
    return "Cuenta bloqueada temporalmente por intentos fallidos";
  }
  if (anyErr?.status === 401) {
    return "Credenciales inválidas";
  }
  return anyErr instanceof Error ? anyErr.message : "login_error";
}

function LoginShell(props: { children: React.ReactNode }) {
  return (
    <div className="loginPage">
      <div className="loginCard">
        <section className="loginLeft">
          <div className="loginLeftMark">
            <ArrowMark size={220} color="rgba(255,255,255,0.25)" />
          </div>
        </section>

        <section className="loginRight">
          <div className="loginTopMark">
            <ArrowMark size={46} color="#2a2c2e" />
          </div>
          <div className="loginHeader">
            <h1 className="loginTitle">Iniciar Sesión</h1>
            <p className="loginSubtitle">Ingresa tus datos para iniciar sesión</p>
          </div>
          {props.children}
        </section>
      </div>
    </div>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  error?: string;
}) {
  return (
    <label className="loginField">
      <span className="loginLabel">{props.label}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        className="loginInput"
      />
      {props.error ? <span className="fieldError">{props.error}</span> : null}
    </label>
  );
}

function PasswordField(props: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  error?: string;
}) {
  return (
    <label className="loginField">
      <span className="loginLabel">{props.label}</span>
      <div className="passwordWrap">
        <input
          type={props.showPassword ? "text" : "password"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          autoComplete="current-password"
          className="loginInput passwordInput"
        />
        <button
          type="button"
          onClick={props.onToggleShowPassword}
          aria-label={props.showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="togglePassword"
        >
          <EyeIcon open={props.showPassword} />
        </button>
      </div>
      {props.error ? <span className="fieldError">{props.error}</span> : null}
    </label>
  );
}

function useLoginController() {
  const { login } = useAuth();
  const [values, setValues] = useState<LoginValues>({
    email: "admin@cotizapp.local",
    password: "admin123"
  });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const nextErrors = validateLogin(values);
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      return;
    }

    setLoading(true);
    try {
      await login({ email: normalizeEmail(values.email), password: values.password });
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return {
    values,
    setValues,
    fieldErrors,
    error,
    loading,
    showPassword,
    setShowPassword,
    onSubmit
  };
}

export default function LoginPage() {
  const controller = useLoginController();

  return (
    <LoginShell>
      <form onSubmit={controller.onSubmit} className="loginForm">
        <TextField
          label="Email"
          value={controller.values.email}
          onChange={(next) => controller.setValues((v) => ({ ...v, email: next }))}
          autoComplete="email"
          inputMode="email"
          error={controller.fieldErrors.email}
        />

        <PasswordField
          label="Contraseña"
          value={controller.values.password}
          onChange={(next) => controller.setValues((v) => ({ ...v, password: next }))}
          showPassword={controller.showPassword}
          onToggleShowPassword={() => controller.setShowPassword((v) => !v)}
          error={controller.fieldErrors.password}
        />

        <a href="#" className="loginLink" onClick={(e) => e.preventDefault()}>
          Recuperar contraseña
        </a>

        {controller.error ? <div className="loginError">{controller.error}</div> : null}

        <div className="loginButtonRow">
          <button type="submit" disabled={controller.loading} className="loginButton">
            {controller.loading ? "Iniciando..." : "Iniciar sesión"}
          </button>
        </div>
      </form>
    </LoginShell>
  );
}
