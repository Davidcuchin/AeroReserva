import argon2 from "argon2";
import { z } from "zod";
import { atomic, audit, assertFutureValid, requireAdmin } from "./service";
import {
  BusinessError,
  instant,
  interval,
  roleSchema,
  type Actor,
} from "./rules";
const text = z.string().trim().min(2).max(100);
const schemas = {
  user: z.object({
    id: z.string().optional(),
    name: text,
    email: z
      .string()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    role: roleSchema,
    active: z.boolean(),
    password: z.string().min(12).max(128).optional(),
  }),
  aircraft: z.object({
    id: z.string().optional(),
    registration: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{3,15}$/),
    model: text,
    seats: z.coerce.number().int().min(1).max(20),
    active: z.boolean(),
  }),
  qualification: z.object({
    id: z.string().optional(),
    userId: z.string().min(1),
    model: text,
    validUntil: z.string().min(1),
  }),
  availability: z.object({
    id: z.string().optional(),
    userId: z.string().min(1),
    start: z.string(),
    end: z.string(),
    remove: z.boolean().optional(),
  }),
  block: z.object({
    id: z.string().optional(),
    resourceId: z.string().min(1),
    start: z.string(),
    end: z.string(),
    reason: z.string().trim().min(5).max(500),
    remove: z.boolean().optional(),
  }),
};
export async function administer(
  actor: Actor,
  kind: keyof typeof schemas,
  raw: unknown,
) {
  if (!(kind in schemas)) throw new BusinessError("Operación desconocida.");
  await atomic(actor, async (tx, current) => {
    if (kind !== "availability") requireAdmin(current);
    if (kind === "user") {
      const { id, password, ...data } = schemas.user.parse(raw);
      if (!id && !password)
        throw new BusinessError(
          "La contraseña debe tener al menos 12 caracteres.",
        );
      if (id === current.id && (!data.active || data.role !== current.role))
        throw new BusinessError(
          "No puedes desactivar tu propia cuenta ni cambiar tu propio rol.",
        );
      const old = id
        ? await tx.user.findUniqueOrThrow({ where: { id } })
        : null;
      const passwordHash = password
        ? await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
          })
        : undefined;
      const user = id
        ? await tx.user.update({
            where: { id },
            data: { ...data, passwordHash },
          })
        : await tx.user.create({
            data: {
              ...data,
              passwordHash: passwordHash!,
              resource: { create: {} },
            },
          });
      await assertFutureValid(tx);
      if (id && (password || !data.active || old?.role !== data.role))
        await tx.loginSession.deleteMany({ where: { userId: id } });
      const safe = (u: typeof user | null) =>
        u
          ? {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              active: u.active,
            }
          : null;
      await audit(
        tx,
        current,
        "Usuario",
        user.id,
        old ? "ACTUALIZAR" : "CREAR",
        safe(old),
        safe(user),
      );
    }
    if (kind === "aircraft") {
      const { id, ...data } = schemas.aircraft.parse(raw);
      const old = id
        ? await tx.aircraft.findUniqueOrThrow({ where: { id } })
        : null;
      const plane = id
        ? await tx.aircraft.update({ where: { id }, data })
        : await tx.aircraft.create({
            data: { ...data, resource: { create: {} } },
          });
      await assertFutureValid(tx);
      await audit(
        tx,
        current,
        "Aeronave",
        plane.id,
        old ? "ACTUALIZAR" : "CREAR",
        old,
        plane,
      );
    }
    if (kind === "qualification") {
      const data = schemas.qualification.parse(raw);
      const validUntil = instant(data.validUntil);
      const old = await tx.qualification.findUnique({
        where: { userId_model: { userId: data.userId, model: data.model } },
      });
      const q = await tx.qualification.upsert({
        where: { userId_model: { userId: data.userId, model: data.model } },
        create: { userId: data.userId, model: data.model, validUntil },
        update: { validUntil },
      });
      await assertFutureValid(tx);
      await audit(
        tx,
        current,
        "Habilitación",
        q.id,
        old ? "ACTUALIZAR" : "CREAR",
        old,
        q,
      );
    }
    if (kind === "availability") {
      const data = schemas.availability.parse(raw);
      if (current.role !== "INSTRUCTOR" || current.id !== data.userId)
        throw new BusinessError(
          "Cada instructor debe declarar su propia disponibilidad.",
        );
      const old = data.id
        ? await tx.availability.findUniqueOrThrow({ where: { id: data.id } })
        : null;
      if (old && old.userId !== current.id)
        throw new BusinessError(
          "No puedes modificar la disponibilidad de otra persona.",
        );
      if (data.remove) {
        if (!old) throw new BusinessError("Disponibilidad no encontrada.");
        await tx.availability.delete({ where: { id: old.id } });
        await assertFutureValid(tx);
        await audit(
          tx,
          current,
          "Disponibilidad",
          old.id,
          "ELIMINAR",
          old,
          null,
        );
      } else {
        const times = interval(data.start, data.end, new Date(), false);
        const item = old
          ? await tx.availability.update({ where: { id: old.id }, data: times })
          : await tx.availability.create({
              data: { userId: current.id, ...times },
            });
        await assertFutureValid(tx);
        await audit(
          tx,
          current,
          "Disponibilidad",
          item.id,
          old ? "ACTUALIZAR" : "CREAR",
          old,
          item,
        );
      }
    }
    if (kind === "block") {
      const data = schemas.block.parse(raw);
      if (data.remove) {
        const old = await tx.block.findUniqueOrThrow({
          where: { id: data.id },
        });
        if (!old.active) throw new BusinessError("El bloqueo ya fue liberado.");
        await tx.block.update({
          where: { id: old.id },
          data: { active: false },
        });
        await tx.occupancy.updateMany({
          where: { blockId: old.id },
          data: { active: false },
        });
        await audit(
          tx,
          current,
          "Bloqueo",
          old.id,
          "LIBERAR",
          old,
          { ...old, active: false },
          data.reason,
        );
      } else {
        const times = interval(data.start, data.end, new Date(), false);
        const collisions = await tx.occupancy.findMany({
          where: {
            resourceId: data.resourceId,
            active: true,
            start: { lt: times.end },
            end: { gt: times.start },
          },
          include: { booking: true },
        });
        if (collisions.length)
          throw new BusinessError(
            "El bloqueo coincide con: " +
              collisions
                .map((c) =>
                  c.booking
                    ? `reserva ${c.booking.id.slice(-8)}`
                    : "otro bloqueo",
                )
                .join(", ") +
              ". Resuelve las reservas antes de bloquear.",
          );
        const block = await tx.block.create({
          data: { resourceId: data.resourceId, reason: data.reason, ...times },
        });
        await tx.occupancy.create({
          data: { resourceId: data.resourceId, blockId: block.id, ...times },
        });
        await audit(
          tx,
          current,
          "Bloqueo",
          block.id,
          "CREAR",
          null,
          block,
          data.reason,
        );
      }
    }
  });
}
