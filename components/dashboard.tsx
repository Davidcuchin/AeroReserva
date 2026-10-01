"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Temporal } from "@js-temporal/polyfill";
import {
  Plane,
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Users,
  ClipboardList,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Bell,
  LogOut,
  Check,
  X,
  Download,
  ShieldCheck,
  Compass,
  Search,
  Menu,
  LoaderCircle,
  Wrench,
  Pencil,
  Ban,
} from "lucide-react";
import type {
  AppData,
  Flight,
  Person,
  Plane as Aircraft,
} from "@/lib/view-types";
import { dateLabel, ZONE } from "@/lib/rules";
import {
  bookingAction,
  cancelAction,
  logoutAction,
  type Result,
} from "@/app/actions";
import { adminAction, readReminder } from "@/app/admin-actions";
type Tab =
  | "overview"
  | "calendar"
  | "bookings"
  | "fleet"
  | "users"
  | "availability"
  | "audit";
type Modal =
  | { kind: "booking"; flight?: Flight }
  | { kind: "cancel"; flight: Flight }
  | { kind: "aircraft"; plane?: Aircraft }
  | { kind: "user"; person?: Person }
  | { kind: "qualification"; person?: Person }
  | { kind: "availability"; item?: AppData["availability"][number] }
  | { kind: "block" }
  | null;
const names: Record<Tab, string> = {
  overview: "Vista general",
  calendar: "Calendario",
  bookings: "Mis reservas",
  fleet: "Aeronaves y bloqueos",
  users: "Personas y habilitaciones",
  availability: "Mi disponibilidad",
  audit: "Historial de actividad",
};
const roleLabel = {
  ALUMNO: "Alumno",
  INSTRUCTOR: "Instructor",
  ADMINISTRADOR: "Administrador",
};
const today = () =>
  Temporal.Now.zonedDateTimeISO(ZONE).toPlainDate().toString();
const local = (iso: string) =>
  Temporal.Instant.from(iso)
    .toZonedDateTimeISO(ZONE)
    .toPlainDateTime()
    .toString()
    .slice(0, 16);
const dayOf = (iso: string) => local(iso).slice(0, 10);
const time = (iso: string) =>
  dateLabel(iso, { hour: "2-digit", minute: "2-digit" });
const niceDay = (iso: string) =>
  dateLabel(iso, { weekday: "short", day: "numeric", month: "short" });
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge ${status === "CONFIRMADA" ? "green" : status === "CANCELADA" ? "gray" : "blue"}`}
    >
      <span className="badge-dot" />
      {status === "CONFIRMADA"
        ? "Confirmada"
        : status === "CANCELADA"
          ? "Cancelada"
          : status}
    </span>
  );
}
function Empty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <Compass size={30} />
      <h3>{title}</h3>
      <p>{description ?? "Los nuevos registros aparecerán aquí."}</p>
    </div>
  );
}
function Dialog({
  children,
  title,
  close,
}: {
  children: ReactNode;
  title: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="mini-label">AERORESERVA</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={close}
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Dashboard({ data }: { data: AppData }) {
  const [now] = useState(() => Date.now());
  const { user } = data,
    admin = user.role !== "ALUMNO";
  const [tab, setTab] = useState<Tab>("overview"),
    [modal, setModal] = useState<Modal>(null),
    [notice, setNotice] = useState<Result | null>(null),
    [pending, startTransition] = useTransition(),
    [menu, setMenu] = useState(false),
    [showNotices, setShowNotices] = useState(false);
  const [date, setDate] = useState(today),
    [view, setView] = useState<"week" | "day">("week"),
    [aircraft, setAircraft] = useState(""),
    [instructor, setInstructor] = useState(""),
    [own, setOwn] = useState(false),
    [query, setQuery] = useState("");
  const router = useRouter();
  const myFlights = data.flights.filter(
    (b) => b.studentId === user.id || b.instructorId === user.id,
  );
  const next = myFlights
    .filter((b) => b.status === "CONFIRMADA" && new Date(b.start) > new Date())
    .sort((a, b) => a.start.localeCompare(b.start));
  const reminders = myFlights.filter(
    (b) =>
      b.studentId === user.id &&
      b.reminder &&
      !b.reminderRead &&
      b.status === "CONFIRMADA" &&
      new Date(b.start) > new Date() &&
      new Date(b.start).getTime() < now + 24 * 3600000,
  );
  const chosen = Temporal.PlainDate.from(date),
    start =
      view === "week"
        ? chosen.subtract({ days: chosen.dayOfWeek - 1 })
        : chosen;
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) =>
    start.add({ days: i }).toString(),
  );
  const filtered = data.flights.filter(
    (b) =>
      b.status === "CONFIRMADA" &&
      (!aircraft || b.aircraftId === aircraft) &&
      (!instructor || b.instructorId === instructor) &&
      (!own || b.studentId === user.id || b.instructorId === user.id),
  );
  const navigate = (t: Tab) => {
    setTab(t);
    setMenu(false);
    setQuery("");
  };
  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      try {
        const result = await fn();
        setNotice(result);
        if (result.ok) {
          setModal(null);
          router.refresh();
        }
      } catch {
        setNotice({
          ok: false,
          message:
            "No se pudo conectar. Actualiza la página e inténtalo otra vez.",
        });
      }
    });
  const navItems = [
    { id: "overview" as Tab, icon: LayoutDashboard },
    { id: "calendar" as Tab, icon: CalendarDays },
    { id: "bookings" as Tab, icon: Ticket },
    { id: "fleet" as Tab, icon: Plane },
    ...(admin ? [{ id: "users" as Tab, icon: Users }] : []),
    ...(user.role === "INSTRUCTOR"
      ? [{ id: "availability" as Tab, icon: Clock3 }]
      : []),
    { id: "audit" as Tab, icon: ClipboardList },
  ];
  const reserveButton = (
    <button
      className="button primary"
      onClick={() => {
        setNotice(null);
        setModal({ kind: "booking" });
      }}
    >
      <Plus size={17} /> Nueva reserva
    </button>
  );
  const flightCard = (b: Flight, compact = false) => (
    <button
      key={b.id}
      className={`flight-event ${b.private ? "private" : ""} ${compact ? "compact" : ""}`}
      onClick={() => {
        if (!b.private) {
          setNotice(null);
          setModal({ kind: "booking", flight: b });
        }
      }}
      disabled={b.private}
    >
      <span className="event-time">
        {time(b.start)} — {time(b.end)}
      </span>
      <strong>
        {b.registration} <ArrowUpRight size={13} />
      </strong>
      <span>{b.private ? "Vuelo reservado" : b.student}</span>
      {!compact && (
        <small>{b.private ? "Información privada" : b.instructor}</small>
      )}
    </button>
  );
  const calendar = (
    <section className="panel calendar-panel">
      <div className="panel-header">
        <div>
          <h2>Agenda de vuelos</h2>
          <p className="muted">Toda la operación, en un mismo lugar.</p>
        </div>
        <div className="segmented">
          <button
            onClick={() => setView("day")}
            className={view === "day" ? "selected" : ""}
          >
            Día
          </button>
          <button
            onClick={() => setView("week")}
            className={view === "week" ? "selected" : ""}
          >
            Semana
          </button>
        </div>
      </div>
      <div className="calendar-toolbar">
        <div className="calendar-date">
          <button
            aria-label="Periodo anterior"
            className="icon-button"
            onClick={() =>
              setDate(
                chosen.subtract({ days: view === "week" ? 7 : 1 }).toString(),
              )
            }
          >
            <ChevronLeft size={17} />
          </button>
          <button
            aria-label="Periodo siguiente"
            className="icon-button"
            onClick={() =>
              setDate(chosen.add({ days: view === "week" ? 7 : 1 }).toString())
            }
          >
            <ChevronRight size={17} />
          </button>
          <h3>
            {chosen.toLocaleString("es-CL", { month: "long", year: "numeric" })}
          </h3>
          <button className="button small" onClick={() => setDate(today())}>
            Hoy
          </button>
        </div>
        <label className="sr-only" htmlFor="agenda-date">
          Fecha de agenda
        </label>
        <input
          id="agenda-date"
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </div>
      <div className="calendar-filters">
        <label>
          <span className="sr-only">Filtrar aeronave</span>
          <select
            value={aircraft}
            onChange={(e) => setAircraft(e.target.value)}
          >
            <option value="">Todas las aeronaves</option>
            {data.planes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.registration}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar instructor</span>
          <select
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          >
            <option value="">Todos los instructores</option>
            {data.users
              .filter((u) => u.role === "INSTRUCTOR")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={own}
            onChange={(e) => setOwn(e.target.checked)}
          />{" "}
          Solo mis vuelos
        </label>
      </div>
      <div className="calendar-scroll">
        <div className={`calendar-grid ${view === "day" ? "daily" : ""}`}>
          {days.map((day) => {
            const d = Temporal.PlainDate.from(day),
              list = filtered
                .filter((b) => dayOf(b.start) <= day && dayOf(b.end) >= day)
                .sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div className="calendar-column" key={day}>
                <div className={`day-head ${day === today() ? "current" : ""}`}>
                  <span>{d.toLocaleString("es-CL", { weekday: "short" })}</span>
                  <strong>{d.day}</strong>
                </div>
                <div className="day-events">
                  {list.map((b) => flightCard(b, true))}
                  {data.blocks
                    .filter(
                      (b) =>
                        dayOf(b.start) <= day &&
                        dayOf(b.end) >= day &&
                        (!aircraft ||
                          data.resources
                            .find((r) => r.id === b.resourceId)
                            ?.label.startsWith(
                              data.planes.find((p) => p.id === aircraft)
                                ?.registration ?? "---",
                            )),
                    )
                    .map((b) => (
                      <div className="block-event" key={b.id}>
                        <Wrench size={13} />
                        <strong>Bloqueo</strong>
                        <small>
                          {data.resources.find((r) => r.id === b.resourceId)
                            ?.label ?? "Recurso ocupado"}
                        </small>
                        <small>
                          {time(b.start)} — {time(b.end)}
                        </small>
                      </div>
                    ))}
                  {!list.length && (
                    <span className="day-empty">Sin vuelos</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="calendar-footer">
        <span>
          <i className="legend-dot" /> Vuelo confirmado
        </span>
        <span>
          <i className="legend-dot amber" /> Bloqueo de recurso
        </span>
        <span>
          Hora de Santiago · GMT{Temporal.Now.zonedDateTimeISO(ZONE).offset}
        </span>
      </div>
    </section>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Plane size={22} />
          </span>
          Aero<span>Reserva</span>
        </Link>
        <div className="club-label">
          <span className="club-symbol">AC</span>
          <div>
            <strong>Club Aéreo</strong>
            <span>Centro de instrucción</span>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="nav-label">ESPACIO DE VUELO</span>
        <nav>
          {navItems.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {names[id]}
              {id === "bookings" && next.length > 0 && (
                <span className="nav-count">{next.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <Compass size={22} />
            <strong>Tu próximo desafío está arriba.</strong>
            <p>Planifica tu práctica y sigue avanzando.</p>
            <button onClick={() => setModal({ kind: "booking" })}>
              Organizar mi vuelo <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="user-card">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{roleLabel[user.role]}</span>
            </div>
            <form action={logoutAction}>
              <button
                className="icon-button"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir menú"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <span>Mi espacio</span>
            <ChevronRight size={14} />
            <strong>{names[tab]}</strong>
          </div>
          <div className="topbar-right">
            <span className="club-status">
              <i /> Club conectado
            </span>
            <button
              className="notification-button icon-button"
              aria-label="Ver recordatorios"
              onClick={() => setShowNotices(!showNotices)}
            >
              <Bell size={20} />
              {reminders.length > 0 && <b>{reminders.length}</b>}
            </button>
            <span className="avatar small-avatar">{initials(user.name)}</span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-title">
            <div>
              <div className="eyebrow">
                {dateLabel(new Date(), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <h1>
                {tab === "overview"
                  ? `Buen vuelo, ${user.name.split(" ")[0]}.`
                  : names[tab]}
                {tab === "overview" && <span className="wave"> ✦</span>}
              </h1>
              <p className="muted">
                {tab === "overview"
                  ? "Un nuevo día para seguir ganando altura. Aquí comienza tu próximo vuelo."
                  : tab === "calendar"
                    ? "Consulta la disponibilidad y encuentra tu próximo horario."
                    : tab === "bookings"
                      ? "Tus vuelos de instrucción, organizados de principio a fin."
                      : tab === "fleet"
                        ? "Conoce los recursos que hacen posible cada práctica."
                        : tab === "audit"
                          ? "Cada cambio tiene una historia. Consulta quién, qué y cuándo."
                          : "Mantén la información del club al día."}
              </p>
            </div>
            {["overview", "calendar", "bookings"].includes(tab) ? (
              reserveButton
            ) : tab === "fleet" && admin ? (
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => setModal({ kind: "block" })}
                >
                  <Ban size={16} /> Crear bloqueo
                </button>
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "aircraft" })}
                >
                  <Plus size={16} /> Aeronave
                </button>
              </div>
            ) : tab === "users" ? (
              <button
                className="button primary"
                onClick={() => setModal({ kind: "user" })}
              >
                <Plus size={16} /> Nueva persona
              </button>
            ) : tab === "availability" ? (
              <button
                className="button primary"
                onClick={() => setModal({ kind: "availability" })}
              >
                <Plus size={16} /> Añadir horario
              </button>
            ) : null}
          </div>
          {notice && !modal && (
            <div
              className={`notice ${notice.ok ? "success" : "error"}`}
              role="status"
            >
              {notice.ok ? <Check size={17} /> : <X size={17} />}{" "}
              {notice.message}
              <button
                className="icon-button"
                aria-label="Cerrar mensaje"
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {showNotices && (
            <section className="panel reminders">
              <div className="panel-header">
                <h2>
                  <Bell size={19} /> Recordatorios · Próximas 24 horas
                </h2>
                <button
                  className="icon-button"
                  onClick={() => setShowNotices(false)}
                  aria-label="Cerrar recordatorios"
                >
                  <X size={18} />
                </button>
              </div>
              {reminders.length ? (
                reminders.map((b) => (
                  <div className="list-row" key={b.id}>
                    <div>
                      <strong>
                        {b.registration} · {niceDay(b.start)} a las{" "}
                        {time(b.start)}
                      </strong>
                      <p>{b.instructor}</p>
                    </div>
                    <button
                      className="button small"
                      disabled={pending}
                      onClick={() => run(() => readReminder(b.id))}
                    >
                      Marcar leído
                    </button>
                  </div>
                ))
              ) : (
                <Empty
                  title="Estás al día"
                  description="Tus recordatorios aparecerán 24 horas antes de cada vuelo."
                />
              )}
            </section>
          )}
          {tab === "overview" && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={<Ticket />}
                  label="Mis próximos vuelos"
                  value={String(next.length)}
                  sub="Reservas confirmadas"
                />
                <Stat
                  icon={<Clock3 />}
                  label="Horas por despegar"
                  value={`${next.reduce((n, b) => n + (+new Date(b.end) - +new Date(b.start)) / 3600000, 0).toLocaleString("es-CL")} h`}
                  sub="Tiempo reservado de instrucción"
                />
                <Stat
                  icon={<Plane />}
                  label="Aeronaves activas"
                  value={String(
                    data.planes.filter((p) => p.active).length,
                  ).padStart(2, "0")}
                  sub="Flota del club"
                />
                <Stat
                  icon={<ShieldCheck />}
                  label="Mis habilitaciones"
                  value={String(
                    user.qualifications.filter(
                      (q) => new Date(q.validUntil) > new Date(),
                    ).length,
                  ).padStart(2, "0")}
                  sub="Vigentes para planificar"
                />
              </div>
              <section className="hero-banner">
                <div className="hero-copy">
                  <span className="hero-label">
                    <span /> TU SIGUIENTE CAPÍTULO
                  </span>
                  <h2>
                    El mejor plan empieza
                    <br />
                    con un próximo vuelo.
                  </h2>
                  <p>
                    Encuentra tu horario, elige tu aeronave
                    <br />y deja lista tu próxima práctica.
                  </p>
                  <button
                    className="button light"
                    onClick={() => {
                      setTab("calendar");
                    }}
                  >
                    Explorar disponibilidad <ArrowRight size={16} />
                  </button>
                </div>
                <div className="hero-graphic" aria-hidden="true">
                  <div className="radar-ring ring1" />
                  <div className="radar-ring ring2" />
                  <div className="radar-ring ring3" />
                  <div className="radar-cross" />
                  <Plane size={160} strokeWidth={0.9} />
                  <span className="coordinate">34°10′ S &nbsp; 70°46′ O</span>
                  <span className="hero-chip">
                    <span /> LISTO PARA EL PRÓXIMO DESPEGUE
                  </span>
                </div>
                <span className="hero-watermark">AERO</span>
              </section>
              <div className="overview-grid">
                <div>{calendar}</div>
                <aside className="right-rail">
                  <section className="panel next-flight">
                    <div className="panel-header">
                      <h2>Tu próximo vuelo</h2>
                      <Plane size={18} />
                    </div>
                    {next[0] ? (
                      <>
                        <div className="next-plane">
                          <Plane size={42} strokeWidth={1} />
                          <span>VUELO DE INSTRUCCIÓN</span>
                          <h3>{next[0].model}</h3>
                          <p>{next[0].registration}</p>
                        </div>
                        <div className="next-details">
                          <div>
                            <CalendarDays size={17} />
                            <span>{niceDay(next[0].start)}</span>
                          </div>
                          <div>
                            <Clock3 size={17} />
                            <span>
                              {time(next[0].start)} — {time(next[0].end)}
                            </span>
                          </div>
                          <div>
                            <Users size={17} />
                            <span>{next[0].instructor}</span>
                          </div>
                          <Badge status="CONFIRMADA" />
                        </div>
                        <button
                          className="button full"
                          onClick={() =>
                            setModal({ kind: "booking", flight: next[0] })
                          }
                        >
                          Ver reserva <ArrowUpRight size={15} />
                        </button>
                      </>
                    ) : (
                      <Empty
                        title="Tu próximo vuelo te espera"
                        description="Reserva una práctica para comenzar a planificar."
                      />
                    )}
                  </section>
                  <div className="info-card">
                    <ShieldCheck size={23} />
                    <h3>Una agenda, cero cruces.</h3>
                    <p>
                      La disponibilidad de aeronave, alumno e instructor se
                      comprueba al confirmar.
                    </p>
                    <span>
                      PLANIFICA CON CONFIANZA <ArrowUpRight size={13} />
                    </span>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === "calendar" && calendar}
          {tab === "bookings" && (
            <section className="panel">
              <div className="panel-header">
                <h2>
                  Mis vuelos{" "}
                  <span className="count-label">{myFlights.length}</span>
                </h2>
                <a className="button" href="/api/calendar?own=1">
                  <Download size={16} /> Exportar .ics
                </a>
              </div>
              {myFlights.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Aeronave</th>
                        <th>Fecha y horario</th>
                        <th>Instructor / alumno</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myFlights.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <strong>{b.registration}</strong>
                            <small>{b.model}</small>
                          </td>
                          <td>
                            <strong>{niceDay(b.start)}</strong>
                            <small>
                              {time(b.start)} — {time(b.end)}
                            </small>
                          </td>
                          <td>
                            <strong>{b.instructor}</strong>
                            <small>{b.student}</small>
                          </td>
                          <td>
                            <Badge status={b.status} />
                          </td>
                          <td>
                            <div className="button-row">
                              <button
                                className="icon-button"
                                aria-label={`Ver reserva ${b.registration}`}
                                onClick={() =>
                                  setModal({ kind: "booking", flight: b })
                                }
                              >
                                <ArrowUpRight size={17} />
                              </button>
                              {b.status === "CONFIRMADA" &&
                                new Date(b.start) > new Date() && (
                                  <button
                                    className="icon-button danger"
                                    aria-label={`Cancelar reserva ${b.registration}`}
                                    onClick={() =>
                                      setModal({ kind: "cancel", flight: b })
                                    }
                                  >
                                    <Ban size={17} />
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Aún no tienes reservas"
                  description="Crea tu primera reserva para verla aquí."
                />
              )}
            </section>
          )}
          {tab === "fleet" && (
            <>
              <div className="fleet-grid">
                {data.planes.map((p) => (
                  <section className="panel plane-card" key={p.id}>
                    <div className="plane-illustration">
                      <Plane size={98} strokeWidth={1} />
                      <span>{p.registration}</span>
                    </div>
                    <div className="plane-info">
                      <div>
                        <span className="mini-label">
                          AERONAVE DE INSTRUCCIÓN
                        </span>
                        <h2>{p.model}</h2>
                      </div>
                      <Badge status={p.active ? "Activa" : "Inactiva"} />
                      <p>
                        {p.registration} <span>·</span> {p.seats} plazas
                      </p>
                      {admin && (
                        <button
                          className="button full"
                          onClick={() =>
                            setModal({ kind: "aircraft", plane: p })
                          }
                        >
                          <Pencil size={15} /> Editar aeronave
                        </button>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="panel-header">
                  <h2>Bloqueos activos</h2>
                  <Wrench size={18} />
                </div>
                {data.blocks.length ? (
                  data.blocks.map((b) => (
                    <div className="list-row" key={b.id}>
                      <div>
                        <strong>
                          {data.resources.find((r) => r.id === b.resourceId)
                            ?.label ?? "Recurso reservado"}
                        </strong>
                        <p>
                          {niceDay(b.start)} {time(b.start)} → {niceDay(b.end)}{" "}
                          {time(b.end)} · {b.reason}
                        </p>
                      </div>
                      {admin && (
                        <button
                          className="button small"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              adminAction("block", {
                                ...b,
                                remove: true,
                                reason: "Liberación manual del bloqueo",
                              }),
                            )
                          }
                        >
                          Liberar bloqueo
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    title="Sin bloqueos activos"
                    description="Los bloqueos de mantenimiento o indisponibilidad aparecerán aquí."
                  />
                )}
              </section>
            </>
          )}
          {tab === "users" && (
            <section className="panel">
              <div className="panel-header">
                <h2>Personas del club</h2>
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar personas"
                    placeholder="Buscar por nombre o correo"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Rol</th>
                      <th>Habilitaciones</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users
                      .filter((p) =>
                        (p.name + p.email)
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="person-cell">
                              <span className="avatar">{initials(p.name)}</span>
                              <div>
                                <strong>{p.name}</strong>
                                <small>{p.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>{roleLabel[p.role]}</td>
                          <td>
                            {p.qualifications.length ? (
                              p.qualifications.map((q) => (
                                <small key={q.id}>
                                  {q.model} · hasta{" "}
                                  {dateLabel(q.validUntil, {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })}
                                </small>
                              ))
                            ) : (
                              <small>Sin habilitaciones</small>
                            )}
                          </td>
                          <td>
                            <Badge status={p.active ? "Activa" : "Inactiva"} />
                          </td>
                          <td>
                            <div className="button-row">
                              <button
                                title="Editar persona"
                                aria-label={`Editar ${p.name}`}
                                className="icon-button"
                                onClick={() =>
                                  setModal({ kind: "user", person: p })
                                }
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                title="Gestionar habilitación"
                                aria-label={`Habilitación de ${p.name}`}
                                className="icon-button"
                                onClick={() =>
                                  setModal({ kind: "qualification", person: p })
                                }
                              >
                                <ShieldCheck size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {tab === "availability" && (
            <section className="panel">
              <div className="panel-header">
                <h2>Mis tramos disponibles</h2>
                <span className="muted">America/Santiago</span>
              </div>
              <p className="section-note">
                Cada vuelo debe caber completamente en un tramo. No se permiten
                cambios que invaliden reservas existentes.
              </p>
              {data.availability.filter((a) => a.userId === user.id).length ? (
                data.availability
                  .filter((a) => a.userId === user.id)
                  .map((a) => (
                    <div className="list-row" key={a.id}>
                      <div>
                        <strong>
                          {niceDay(a.start)} · {time(a.start)} →{" "}
                          {niceDay(a.end)} · {time(a.end)}
                        </strong>
                        <p>Disponible para vuelos de instrucción</p>
                      </div>
                      <div className="button-row">
                        <button
                          className="button small"
                          onClick={() =>
                            setModal({ kind: "availability", item: a })
                          }
                        >
                          Editar
                        </button>
                        <button
                          className="button small danger"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              adminAction("availability", {
                                ...a,
                                remove: true,
                              }),
                            )
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <Empty
                  title="Declara tus horarios"
                  description="Los alumnos podrán reservar dentro de los tramos que declares."
                />
              )}
            </section>
          )}
          {tab === "audit" && (
            <section className="panel">
              <div className="panel-header">
                <h2>Registro de cambios</h2>
                <a href="/api/calendar" className="button">
                  <Download size={16} /> Calendario visible
                </a>
              </div>
              <p className="section-note">
                Últimos 150 cambios autorizados para tu cuenta. Los registros
                conservan sus valores anteriores y nuevos.
              </p>
              {data.audits.length ? (
                data.audits.map((a) => (
                  <details className="audit-item" key={a.id}>
                    <summary>
                      <span className="audit-icon">
                        <ClipboardList size={18} />
                      </span>
                      <div>
                        <strong>
                          {a.action} · {a.entity}
                        </strong>
                        <p>
                          {a.actor} · {niceDay(a.createdAt)},{" "}
                          {time(a.createdAt)} · #{a.entityId.slice(-8)}
                        </p>
                      </div>
                      <ChevronRight size={16} />
                    </summary>
                    {a.reason && (
                      <p className="audit-reason">Motivo: {a.reason}</p>
                    )}
                    <div className="audit-values">
                      <div>
                        <h4>Antes</h4>
                        <pre>{JSON.stringify(a.before, null, 2)}</pre>
                      </div>
                      <div>
                        <h4>Después</h4>
                        <pre>{JSON.stringify(a.after, null, 2)}</pre>
                      </div>
                    </div>
                  </details>
                ))
              ) : (
                <Empty title="Aún no hay actividad" />
              )}
            </section>
          )}
          <footer className="main-footer">
            <span>
              AeroReserva <b>·</b> Un solo club. Todos conectados.
            </span>
            <span>
              La reserva no constituye una autorización operacional de vuelo.
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <Editor
          modal={modal}
          data={data}
          close={() => {
            setModal(null);
            setNotice(null);
          }}
          notice={notice}
          pending={pending}
          run={run}
          setModal={setModal}
        />
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <section className="stat-card">
      <div>
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <p>{sub}</p>
    </section>
  );
}
function Editor({
  modal,
  data,
  close,
  notice,
  pending,
  run,
  setModal,
}: {
  modal: NonNullable<Modal>;
  data: AppData;
  close: () => void;
  notice: Result | null;
  pending: boolean;
  run: (fn: () => Promise<Result>) => void;
  setModal: (m: Modal) => void;
}) {
  const key = useRef(globalThis.crypto.randomUUID());
  const b = modal.kind === "booking" ? modal.flight : undefined;
  const readOnly =
    !!b && (new Date(b.start) <= new Date() || b.status !== "CONFIRMADA");
  const titles = {
    booking: b ? "Detalle de la reserva" : "Planifica tu próximo vuelo",
    cancel: "Cancelar reserva",
    aircraft:
      modal.kind === "aircraft" && modal.plane
        ? "Editar aeronave"
        : "Nueva aeronave",
    user:
      modal.kind === "user" && modal.person
        ? "Editar persona"
        : "Nueva persona",
    qualification: "Habilitación interna",
    availability: "Disponibilidad de instrucción",
    block: "Bloquear un recurso",
  };
  const submit = (form: FormData) => {
    const values = Object.fromEntries(form);
    for (const field of ["start", "end"]) {
      const offset = values[field + "Offset"];
      if (offset && values[field])
        values[field] = String(values[field]) + ":00" + String(offset);
    }
    const str = (name: string) => String(values[name] ?? "");
    if (modal.kind === "booking")
      run(() =>
        bookingAction(
          {
            studentId: str("studentId"),
            instructorId: str("instructorId"),
            aircraftId: str("aircraftId"),
            start: str("start"),
            end: str("end"),
            note: str("note"),
            reminder: values.reminder === "on",
            reason: str("reason"),
            requestKey: key.current,
          },
          b?.id,
        ),
      );
    else if (modal.kind === "cancel")
      run(() => cancelAction(modal.flight.id, str("reason")));
    else if (modal.kind === "user")
      run(() =>
        adminAction("user", {
          ...values,
          id: modal.person?.id,
          active: values.active === "on",
          password: str("password") || undefined,
        }),
      );
    else if (modal.kind === "aircraft")
      run(() =>
        adminAction("aircraft", {
          ...values,
          id: modal.plane?.id,
          active: values.active === "on",
        }),
      );
    else if (modal.kind === "availability")
      run(() =>
        adminAction("availability", {
          ...values,
          id: modal.item?.id,
          userId: data.user.id,
        }),
      );
    else run(() => adminAction(modal.kind, values));
  };
  const defaultStart = Temporal.Now.zonedDateTimeISO(ZONE)
    .add({ days: 1 })
    .with({ hour: 10, minute: 0, second: 0, millisecond: 0 })
    .toPlainDateTime()
    .toString()
    .slice(0, 16);
  const dates = (s?: string, e?: string) => (
    <>
      <div className="form-grid">
        <Field label="Inicio · hora de Santiago">
          <input
            type="datetime-local"
            name="start"
            required
            step={1800}
            defaultValue={s ? local(s) : defaultStart}
          />
        </Field>
        <Field label="Término · hora de Santiago">
          <input
            type="datetime-local"
            name="end"
            required
            step={1800}
            defaultValue={e ? local(e) : defaultStart.replace("T10:", "T11:")}
          />
        </Field>
      </div>
      <details className="availability-help">
        <summary>Si una hora se repite por cambio de horario</summary>
        <p>
          Selecciona cuál de las dos horas deseas usar. En fechas normales, deja
          la zona automática.
        </p>
        <div className="form-grid">
          {["start", "end"].map((field) => (
            <Field
              key={field}
              label={field === "start" ? "Zona del inicio" : "Zona del término"}
            >
              <select name={field + "Offset"} defaultValue="">
                <option value="">Automática · Santiago</option>
                <option value="-03:00">Primera ocurrencia · UTC−3</option>
                <option value="-04:00">Segunda ocurrencia · UTC−4</option>
              </select>
            </Field>
          ))}
        </div>
      </details>
    </>
  );
  return (
    <Dialog title={titles[modal.kind]} close={close}>
      <form action={submit} className="editor-form">
        <fieldset disabled={pending || readOnly}>
          {modal.kind === "booking" && (
            <>
              <div className="reservation-hint">
                <ShieldCheck size={20} />
                <p>
                  Una aeronave. Un alumno. Un instructor.
                  <br />
                  <span>Verificaremos la disponibilidad al confirmar.</span>
                </p>
              </div>
              <Field label="Alumno">
                <select
                  name="studentId"
                  required
                  defaultValue={
                    b?.studentId ??
                    (data.user.role === "ALUMNO" ? data.user.id : "")
                  }
                >
                  <option value="">Selecciona al alumno</option>
                  {data.users
                    .filter((u) => u.role === "ALUMNO")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {!u.active ? " (inactivo)" : ""}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Aeronave">
                  <select
                    name="aircraftId"
                    required
                    defaultValue={b?.aircraftId ?? ""}
                  >
                    <option value="">Selecciona una aeronave</option>
                    {data.planes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.registration} · {p.model}
                        {!p.active ? " (inactiva)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Instructor">
                  <select
                    name="instructorId"
                    required
                    defaultValue={b?.instructorId ?? ""}
                  >
                    <option value="">Selecciona un instructor</option>
                    {data.users
                      .filter((u) => u.role === "INSTRUCTOR")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              {dates(b?.start, b?.end)}
              <p className="form-note">
                Bloques de 30 minutos · De 30 a 180 minutos · Hasta 30 días de
                anticipación.
              </p>
              <details className="availability-help">
                <summary>Consultar horarios de los instructores</summary>
                {data.users
                  .filter((p) => p.role === "INSTRUCTOR")
                  .map((p) => (
                    <div key={p.id}>
                      <strong>{p.name}</strong>
                      {data.availability
                        .filter((a) => a.userId === p.id)
                        .slice(0, 35)
                        .map((a) => (
                          <small key={a.id}>
                            {niceDay(a.start)} {time(a.start)} →{" "}
                            {niceDay(a.end)} {time(a.end)}
                          </small>
                        ))}
                    </div>
                  ))}
              </details>
              <Field label="Observación (opcional)">
                <textarea
                  name="note"
                  maxLength={500}
                  rows={3}
                  placeholder="¿Algo que debamos tener en cuenta?"
                  defaultValue={b?.note}
                />
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  name="reminder"
                  defaultChecked={b?.reminder}
                />{" "}
                Recordarme dentro de la aplicación 24 horas antes
              </label>
              {b && data.user.role !== "ALUMNO" && (
                <Field label="Motivo del cambio">
                  <textarea
                    name="reason"
                    minLength={5}
                    maxLength={500}
                    required
                    rows={2}
                  />
                </Field>
              )}
            </>
          )}
          {modal.kind === "cancel" && (
            <>
              <p>
                Cancelarás el vuelo de{" "}
                <strong>{modal.flight.registration}</strong> del{" "}
                {niceDay(modal.flight.start)} a las {time(modal.flight.start)}.
                Se liberarán sus recursos y se conservará el historial.
              </p>
              <Field label="Motivo de cancelación">
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                />
              </Field>
            </>
          )}
          {modal.kind === "aircraft" && (
            <>
              <Field label="Matrícula">
                <input
                  name="registration"
                  required
                  pattern="[A-Z0-9-]{3,15}"
                  placeholder="CC-KDA"
                  defaultValue={modal.plane?.registration}
                />
              </Field>
              <Field label="Modelo">
                <input
                  name="model"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Cessna 172S"
                  defaultValue={modal.plane?.model}
                />
              </Field>
              <Field label="Número de plazas">
                <input
                  type="number"
                  name="seats"
                  min={1}
                  max={20}
                  required
                  defaultValue={modal.plane?.seats ?? 2}
                />
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={modal.plane?.active ?? true}
                />{" "}
                Aeronave activa
              </label>
            </>
          )}
          {modal.kind === "user" && (
            <>
              <Field label="Nombre completo">
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={modal.person?.name}
                />
              </Field>
              <Field label="Correo electrónico">
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  defaultValue={modal.person?.email}
                />
              </Field>
              <Field label="Rol">
                <select
                  name="role"
                  defaultValue={modal.person?.role ?? "ALUMNO"}
                >
                  {Object.entries(roleLabel).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={
                  modal.person
                    ? "Nueva contraseña (dejar vacío para conservar)"
                    : "Contraseña inicial"
                }
              >
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required={!modal.person}
                />
              </Field>
              <p className="form-note">
                Mínimo 12 caracteres. Los instructores incluyen permisos
                administrativos.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={modal.person?.active ?? true}
                />{" "}
                Cuenta activa
              </label>
            </>
          )}
          {modal.kind === "qualification" && (
            <>
              <input type="hidden" name="userId" value={modal.person?.id} />
              <p>
                Habilitación de <strong>{modal.person?.name}</strong>.
                Selecciona un modelo existente para actualizar su vigencia.
              </p>
              <Field label="Modelo de aeronave">
                <select name="model" required>
                  {Array.from(new Set(data.planes.map((p) => p.model))).map(
                    (m) => (
                      <option key={m}>{m}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Vigente hasta · hora de Santiago">
                <input type="datetime-local" name="validUntil" required />
              </Field>
              <p className="form-note">
                Registro interno del club. No reemplaza licencias ni
                verificaciones aeronáuticas.
              </p>
            </>
          )}
          {modal.kind === "availability" && (
            <>
              <p>
                Declara un intervalo en que estarás disponible para instruir.
                Las reservas deben caber completamente dentro del tramo.
              </p>
              {dates(modal.item?.start, modal.item?.end)}
            </>
          )}
          {modal.kind === "block" && (
            <>
              <Field label="Recurso a bloquear">
                <select name="resourceId" required>
                  <option value="">Selecciona una aeronave o persona</option>
                  {data.resources.map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              {dates()}
              <Field label="Motivo del bloqueo">
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                />
              </Field>
              <p className="form-note">
                Las reservas incompatibles deberán resolverse antes. No se
                cancelan automáticamente.
              </p>
            </>
          )}
        </fieldset>
        {b && (
          <div className="detail-meta">
            <Badge status={b.status} />
            <small>Reserva #{b.id.slice(-8)}</small>
            {b.cancelReason && <p>Motivo de cancelación: {b.cancelReason}</p>}
          </div>
        )}
        {notice && (
          <p
            className={`notice ${notice.ok ? "success" : "error"}`}
            role="alert"
          >
            {notice.message}
          </p>
        )}
        <div className="modal-actions">
          {b && !readOnly && (
            <button
              type="button"
              className="button danger"
              disabled={pending}
              onClick={() => setModal({ kind: "cancel", flight: b })}
            >
              Cancelar reserva
            </button>
          )}
          <button
            type="button"
            className="button"
            onClick={close}
            disabled={pending}
          >
            {readOnly ? "Cerrar" : "Volver"}
          </button>
          {!readOnly && (
            <button
              type="submit"
              className={`button ${modal.kind === "cancel" ? "danger-solid" : "primary"}`}
              disabled={pending}
            >
              {pending ? (
                <>
                  <LoaderCircle size={17} className="spin" /> Guardando…
                </>
              ) : modal.kind === "booking" ? (
                b ? (
                  "Guardar cambios"
                ) : (
                  "Confirmar reserva"
                )
              ) : modal.kind === "cancel" ? (
                "Confirmar cancelación"
              ) : (
                "Guardar cambios"
              )}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
