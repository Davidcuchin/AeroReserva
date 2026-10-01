import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import {
  Plane,
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
  Compass,
} from "lucide-react";
export default function Login() {
  return (
    <main className="login-layout">
      <section className="login-story">
        <Link className="brand" href="/">
          {" "}
          <span className="brand-icon">
            <Plane />
          </span>
          Aero<span>Reserva</span>
        </Link>
        <div className="story-content">
          <div className="eyebrow">EL CIELO EMPIEZA AQUÍ</div>
          <h1>
            Menos coordinación.
            <br />
            Más tiempo
            <br />
            <em>para volar.</em>
          </h1>
          <p>
            Tu aeronave, tu instructor y tu próximo desafío.
            <br />
            Todo conectado en una sola agenda.
          </p>
          <div className="flight-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="flight-line" />
            <Plane size={108} strokeWidth={1} />
            <span className="art-point start">SCRM</span>
            <span className="art-point end">
              TU PRÓXIMO DESTINO <ArrowUpRight size={14} />
            </span>
          </div>
          <div className="story-features">
            <span>
              <CalendarDays size={18} /> Agenda compartida
            </span>
            <span>
              <ShieldCheck size={18} /> Reservas sin conflictos
            </span>
          </div>
        </div>
        <footer>
          CLUB AÉREO · PLATAFORMA DE INSTRUCCIÓN <Compass size={19} />
        </footer>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <span className="mini-label">BIENVENIDO A BORDO</span>
          <h2>Inicia tu próxima aventura.</h2>
          <p className="muted">
            Ingresa a tu cuenta para organizar tus vuelos.
          </p>
          <LoginForm />
          <div className="login-help">
            <ShieldCheck size={20} />
            <p>
              ¿Aún no tienes una cuenta?
              <br />
              <span>Solicita el acceso a la administración de tu club.</span>
            </p>
          </div>
        </div>
        <p className="login-bottom">
          AeroReserva · Planifica con confianza, vuela con propósito.
        </p>
      </section>
    </main>
  );
}
