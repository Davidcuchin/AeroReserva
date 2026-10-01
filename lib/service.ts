import { createHash } from "node:crypto";
import { Prisma, type User } from "@prisma/client";
import { db } from "./db";
import {
  bookingSchema,
  BusinessError,
  canEdit,
  interval,
  isAdmin,
  policyFor,
  instant,
  type Actor,
} from "./rules";
export type Tx = Prisma.TransactionClient;
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function audit(
  tx: Tx,
  actor: Actor,
  entity: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  reason = "",
) {
  await tx.audit.create({
    data: {
      actorId: actor.id,
      entity,
      entityId,
      action,
      before: before == null ? Prisma.JsonNull : json(before),
      after: after == null ? Prisma.JsonNull : json(after),
      reason,
    },
  });
}
// A transaction-scoped lock serializes all scheduling and administrative writes.
// A database exclusion constraint independently protects each resource interval.
export async function atomic<T>(
  actor: Actor,
  fn: (tx: Tx, current: User) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261001)`;
      const current = await tx.user.findUnique({ where: { id: actor.id } });
      if (!current?.active)
        throw new BusinessError("Tu cuenta no está activa.");
      return fn(tx, current);
    },
    { timeout: 15000, maxWait: 15000 },
  );
}
export async function validateFlight(
  tx: Tx,
  input: {
    studentId: string;
    instructorId: string;
    aircraftId: string;
    start: Date;
    end: Date;
  },
) {
  const [student, instructor, aircraft] = await Promise.all([
    tx.user.findUnique({
      where: { id: input.studentId },
      include: { qualifications: true },
    }),
    tx.user.findUnique({
      where: { id: input.instructorId },
      include: { qualifications: true, availability: true },
    }),
    tx.aircraft.findUnique({ where: { id: input.aircraftId } }),
  ]);
  if (!student?.active || student.role !== "ALUMNO")
    throw new BusinessError("Selecciona un alumno activo.");
  if (
    !instructor?.active ||
    instructor.role !== "INSTRUCTOR" ||
    student.id === instructor.id
  )
    throw new BusinessError(
      "Selecciona un instructor activo distinto del alumno.",
    );
  if (!aircraft?.active)
    throw new BusinessError("La aeronave no está disponible.");
  for (const person of [student, instructor]) {
    if (
      !person.qualifications.some(
        (q) => q.model === aircraft.model && q.validUntil >= input.end,
      )
    )
      throw new BusinessError(
        "Alumno e instructor deben tener habilitación vigente para el modelo hasta el término del vuelo.",
      );
  }
  if (
    !instructor.availability.some(
      (a) => a.start <= input.start && a.end >= input.end,
    )
  )
    throw new BusinessError(
      "El horario completo debe estar dentro de la disponibilidad del instructor.",
    );
  const resources = await tx.resource.findMany({
    where: {
      OR: [
        { userId: { in: [student.id, instructor.id] } },
        { aircraftId: aircraft.id },
      ],
    },
    orderBy: { id: "asc" },
  });
  if (resources.length !== 3)
    throw new BusinessError("Falta configurar un recurso de agenda.");
  return resources;
}
export async function saveBooking(actor: Actor, raw: unknown, id?: string) {
  const data = bookingSchema.parse(raw);
  const times = { start: instant(data.start), end: instant(data.end) };
  const hash = createHash("sha256")
    .update(JSON.stringify({ ...data, ...times }))
    .digest("hex");
  return atomic(actor, async (tx, current) => {
    if (!id) {
      const previous = await tx.booking.findUnique({
        where: {
          creatorId_requestKey: {
            creatorId: current.id,
            requestKey: data.requestKey,
          },
        },
      });
      if (previous) {
        if (previous.requestHash !== hash)
          throw new BusinessError(
            "La clave de solicitud ya fue usada con otros datos.",
          );
        return previous;
      }
    }
    interval(data.start, data.end);
    policyFor(current).validate(current, data.studentId);
    const old = id ? await tx.booking.findUnique({ where: { id } }) : null;
    if (id && !old) throw new BusinessError("Reserva no encontrada.");
    if (old) canEdit(current, old, data.reason);
    const resources = await validateFlight(tx, { ...data, ...times });
    const conflict = await tx.occupancy.findFirst({
      where: {
        active: true,
        resourceId: { in: resources.map((r) => r.id) },
        start: { lt: times.end },
        end: { gt: times.start },
        ...(id ? { NOT: { bookingId: id } } : {}),
      },
    });
    if (conflict)
      throw new BusinessError(
        "Ese horario coincide con otra reserva o bloqueo de la aeronave, alumno o instructor. Elige otro horario.",
      );
    const values = {
      studentId: data.studentId,
      instructorId: data.instructorId,
      aircraftId: data.aircraftId,
      ...times,
      note: data.note,
      reminder: data.reminder,
      reminderRead: false,
    };
    const booking = old
      ? await tx.booking.update({ where: { id }, data: values })
      : await tx.booking.create({
          data: {
            ...values,
            creatorId: current.id,
            requestKey: data.requestKey,
            requestHash: hash,
          },
        });
    if (old)
      await tx.occupancy.updateMany({
        where: { bookingId: id, active: true },
        data: { active: false },
      });
    await tx.occupancy.createMany({
      data: resources.map((r) => ({
        resourceId: r.id,
        bookingId: booking.id,
        ...times,
      })),
    });
    await audit(
      tx,
      current,
      "Reserva",
      booking.id,
      old ? "REPROGRAMAR" : "CREAR",
      old,
      booking,
      data.reason,
    );
    return booking;
  });
}
export async function cancelBooking(actor: Actor, id: string, reason: string) {
  if (reason.trim().length < 5 || reason.length > 500)
    throw new BusinessError(
      "Indica un motivo de cancelación de 5 a 500 caracteres.",
    );
  return atomic(actor, async (tx, current) => {
    const old = await tx.booking.findUnique({ where: { id } });
    if (!old) throw new BusinessError("Reserva no encontrada.");
    canEdit(current, old, reason);
    const updated = await tx.booking.update({
      where: { id },
      data: { status: "CANCELADA", cancelReason: reason, reminder: false },
    });
    await tx.occupancy.updateMany({
      where: { bookingId: id },
      data: { active: false },
    });
    await audit(tx, current, "Reserva", id, "CANCELAR", old, updated, reason);
    return updated;
  });
}
export async function assertFutureValid(tx: Tx) {
  const future = await tx.booking.findMany({
    where: { status: "CONFIRMADA", end: { gt: new Date() } },
  });
  for (const booking of future) {
    try {
      await validateFlight(tx, booking);
    } catch {
      throw new BusinessError(
        `El cambio invalidaría la reserva ${booking.id.slice(-8)}. Reprograma o cancela primero las reservas afectadas.`,
      );
    }
  }
}
export function requireAdmin(actor: Actor) {
  if (!isAdmin(actor))
    throw new BusinessError("Esta acción requiere permisos administrativos.");
}
