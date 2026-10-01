"use client";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {
    ok: false,
    message: "",
  });
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="login-form">
      <label>
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="nombre@club.cl"
          required
          maxLength={254}
        />
      </label>
      <label>
        Contraseña
        <div className="password-field">
          <input
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Ingresa tu contraseña"
            required
            maxLength={128}
          />
          <button
            type="button"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </label>
      {state.message && (
        <p role="alert" className="notice error">
          {state.message}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="spin" size={18} />
            Ingresando…
          </>
        ) : (
          <>
            Ingresar a AeroReserva
            <ArrowRight size={18} />
          </>
        )}
      </button>
      <p className="form-note">
        Acceso exclusivo para alumnos, instructores y administración.
      </p>
    </form>
  );
}
