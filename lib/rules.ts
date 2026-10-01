import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
export const ZONE = "America/Santiago";
export class BusinessError extends Error {}
export const roleSchema = z.enum(["ALUMNO", "INSTRUCTOR", "ADMINISTRADOR"]);
export type Actor = { id: string; role: z.infer<typeof roleSchema> };
export const isAdmin = (actor: Actor) => actor.role !== "ALUMNO";
export const bookingSchema = z.object({
  studentId: z.string().min(1),
  instructorId: z.string().min(1),
  aircraftId: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  note: z
    .string()
    .max(500, "La observación admite hasta 500 caracteres.")
    .default(""),
  reminder: z.boolean().default(false),
  requestKey: z.string().min(8).max(100),
  reason: z.string().max(500).default(""),
});
export type BookingInput = z.infer<typeof bookingSchema>;
export function instant(value: string): Date {
  try {
    if (/Z$/.test(value))
      return new Date(Temporal.Instant.from(value).epochMilliseconds);
    if (/[+-]\d\d:\d\d$/.test(value))
      return new Date(
        Temporal.ZonedDateTime.from(`${value}[${ZONE}]`, { offset: "reject" })
          .epochMilliseconds,
      );
    return new Date(
      Temporal.PlainDateTime.from(value).toZonedDateTime(ZONE, {
        disambiguation: "reject",
      }).epochMilliseconds,
    );
  } catch {
    throw new BusinessError(
      "Horario inexistente o ambiguo en Santiago. Usa otro horario o indica su desplazamiento UTC.",
    );
  }
}
export function interval(
  start: string,
  end: string,
  now = new Date(),
  flight = true,
) {
  const s = instant(start),
    e = instant(end);
  const minutes = (e.getTime() - s.getTime()) / 60000;
  if (s <= now || e <= s)
    throw new BusinessError("El inicio debe ser futuro y anterior al término.");
  if (flight) {
    const local = Temporal.Instant.from(s.toISOString()).toZonedDateTimeISO(
      ZONE,
    );
    if (
      minutes < 30 ||
      minutes > 180 ||
      minutes % 30 ||
      local.minute % 30 ||
      local.second ||
      local.millisecond
    )
      throw new BusinessError(
        "Usa bloques de 30 minutos, con una duración de 30 a 180 minutos.",
      );
    const limit = Temporal.Instant.from(now.toISOString())
      .toZonedDateTimeISO(ZONE)
      .add({ days: 30 });
    if (s.getTime() > limit.epochMilliseconds)
      throw new BusinessError(
        "Solo puedes reservar con hasta 30 días de anticipación.",
      );
  }
  return { start: s, end: e };
}
export interface BookingPolicy {
  validate(actor: Actor, studentId: string): void;
}
export class StudentPolicy implements BookingPolicy {
  validate(actor: Actor, studentId: string) {
    if (actor.role !== "ALUMNO" || actor.id !== studentId)
      throw new BusinessError("Solo puedes reservar para ti.");
  }
}
export class AdministrativePolicy implements BookingPolicy {
  validate(actor: Actor) {
    if (!isAdmin(actor))
      throw new BusinessError("Esta acción requiere permisos administrativos.");
  }
}
export const policyFor = (actor: Actor): BookingPolicy =>
  isAdmin(actor) ? new AdministrativePolicy() : new StudentPolicy();
export function canEdit(
  actor: Actor,
  booking: { studentId: string; start: Date; status: string },
  reason: string,
) {
  if (!isAdmin(actor) && actor.id !== booking.studentId)
    throw new BusinessError("No tienes permiso para modificar esta reserva.");
  if (booking.start <= new Date() || booking.status !== "CONFIRMADA")
    throw new BusinessError(
      "Solo puedes modificar reservas confirmadas que no han comenzado.",
    );
  if (isAdmin(actor) && reason.trim().length < 5)
    throw new BusinessError("Registra un motivo de al menos 5 caracteres.");
}
export const dateLabel = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {},
) =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONE,
    hourCycle: "h23",
    ...options,
  }).format(new Date(date));
