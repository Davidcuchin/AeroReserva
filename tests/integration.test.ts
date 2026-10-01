import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, Role } from "@prisma/client";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "../lib/db";
import { cancelBooking, saveBooking } from "../lib/service";
import { dueReminders } from "../lib/reminders";
import { administer } from "../lib/admin-service";
const prefix = "test-" + Date.now();
const admin = { id: prefix + "admin", role: Role.ADMINISTRADOR },
  s = { id: prefix + "s", role: Role.ALUMNO },
  s2 = { id: prefix + "s2", role: Role.ALUMNO },
  i = { id: prefix + "i", role: Role.INSTRUCTOR },
  i2 = { id: prefix + "i2", role: Role.INSTRUCTOR };
const plane = prefix + "p",
  plane2 = prefix + "p2",
  model = prefix + "model";
const start = Temporal.Now.zonedDateTimeISO("America/Santiago")
  .add({ days: 10 })
  .with({ hour: 10, minute: 0, second: 0, millisecond: 0 });
const at = (minutes: number) => start.add({ minutes }).toInstant().toString();
let count = 0;
const input = (overrides: Record<string, unknown> = {}) => ({
  studentId: s.id,
  instructorId: i.id,
  aircraftId: plane,
  start: at(0),
  end: at(60),
  requestKey: prefix + "key" + ++count,
  note: "Prueba de integración",
  reminder: true,
  ...overrides,
});
async function clear() {
  const bids = (
    await db.booking.findMany({
      where: { creatorId: { startsWith: prefix } },
      select: { id: true },
    })
  ).map((b) => b.id);
  const rs = (
    await db.resource.findMany({
      where: {
        OR: [
          { userId: { startsWith: prefix } },
          { aircraftId: { startsWith: prefix } },
        ],
      },
      select: { id: true },
    })
  ).map((r) => r.id);
  await db.occupancy.deleteMany({ where: { resourceId: { in: rs } } });
  await db.block.deleteMany({ where: { resourceId: { in: rs } } });
  await db.audit.deleteMany({ where: { actorId: { startsWith: prefix } } });
  await db.booking.deleteMany({ where: { id: { in: bids } } });
}
test("PostgreSQL acceptance scenarios (real transactions)", async (t) => {
  try {
    for (const u of [admin, s, s2, i, i2])
      await db.user.create({
        data: {
          ...u,
          name: u.id,
          email: u.id + "@test.invalid",
          passwordHash: "not-used",
          resource: { create: {} },
        },
      });
    for (const p of [plane, plane2])
      await db.aircraft.create({
        data: { id: p, registration: p, model, resource: { create: {} } },
      });
    for (const u of [s, s2, i, i2])
      await db.qualification.create({
        data: { userId: u.id, model, validUntil: new Date(at(1440)) },
      });
    for (const u of [i, i2])
      await db.availability.create({
        data: {
          userId: u.id,
          start: new Date(at(-120)),
          end: new Date(at(600)),
        },
      });
    await t.test("PA02: foreign student rejected server-side", async () => {
      await assert.rejects(
        saveBooking(s, input({ studentId: s2.id })),
        /Solo puedes/,
      );
    });
    await t.test(
      "PA04: concurrent requests, exactly one confirmation, three allocations",
      async () => {
        const result = await Promise.allSettled([
          saveBooking(s, input()),
          saveBooking(s2, input({ studentId: s2.id, instructorId: i2.id })),
        ]);
        assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          await db.occupancy.count({
            where: { resource: { aircraftId: plane }, active: true },
          }),
          1,
        );
        assert.equal(
          await db.occupancy.count({
            where: {
              booking: { creatorId: { startsWith: prefix } },
              active: true,
            },
          }),
          3,
        );
        await clear();
      },
    );
    await t.test("PA06: adjacent accepted, overlapping rejected", async () => {
      await saveBooking(s, input());
      await saveBooking(s, input({ start: at(60), end: at(120) }));
      await assert.rejects(
        saveBooking(s, input({ start: at(30), end: at(90) })),
        /coincide/,
      );
      await clear();
    });
    await t.test(
      "PA05: missing qualification, inactive aircraft, instructor availability",
      async () => {
        await db.qualification.update({
          where: { userId_model: { userId: s.id, model } },
          data: { validUntil: new Date(at(30)) },
        });
        await assert.rejects(saveBooking(s, input()), /habilitación/);
        await db.qualification.update({
          where: { userId_model: { userId: s.id, model } },
          data: { validUntil: new Date(at(1440)) },
        });
        await db.aircraft.update({
          where: { id: plane },
          data: { active: false },
        });
        await assert.rejects(saveBooking(s, input()), /aeronave/);
        await db.aircraft.update({
          where: { id: plane },
          data: { active: true },
        });
        await assert.rejects(
          saveBooking(s, input({ start: at(600), end: at(660) })),
          /disponibilidad/,
        );
      },
    );
    await t.test(
      "PA09: failed reschedule preserves original booking and allocations",
      async () => {
        const b = await saveBooking(s, input());
        await saveBooking(
          s2,
          input({
            studentId: s2.id,
            instructorId: i2.id,
            start: at(90),
            end: at(150),
          }),
        );
        await assert.rejects(
          saveBooking(s, input({ start: at(90), end: at(150) }), b.id),
          /coincide/,
        );
        assert.equal(
          (
            await db.booking.findUniqueOrThrow({ where: { id: b.id } })
          ).start.toISOString(),
          new Date(at(0)).toISOString(),
        );
        assert.equal(
          await db.occupancy.count({
            where: { bookingId: b.id, active: true },
          }),
          3,
        );
        await clear();
      },
    );
    await t.test(
      "PA10/PA12/PA13: cancel releases resources, reminder disabled, audit kept",
      async () => {
        const b = await saveBooking(s, input());
        await cancelBooking(s, b.id, "Cambio de planes");
        const cancelled = await db.booking.findUniqueOrThrow({
          where: { id: b.id },
        });
        assert.equal(cancelled.status, "CANCELADA");
        assert.equal(cancelled.reminder, false);
        assert.equal(
          await db.occupancy.count({
            where: { bookingId: b.id, active: true },
          }),
          0,
        );
        assert.equal(await db.audit.count({ where: { entityId: b.id } }), 2);
        await saveBooking(s, input());
        await clear();
      },
    );
    await t.test(
      "PA15: same request concurrent replay, payload mismatch rejected",
      async () => {
        const raw = input();
        const [a, b] = await Promise.all([
          saveBooking(s, raw),
          saveBooking(s, raw),
        ]);
        assert.equal(a.id, b.id);
        assert.equal(await db.booking.count({ where: { creatorId: s.id } }), 1);
        await assert.rejects(
          saveBooking(s, { ...raw, note: "different" }),
          /clave/,
        );
        await clear();
      },
    );
    await t.test(
      "PA11: block conflicts with flight and is auditable",
      async () => {
        const r = await db.resource.findUniqueOrThrow({
          where: { aircraftId: plane },
        });
        const b = await saveBooking(s, input());
        await assert.rejects(
          administer(admin, "block", {
            resourceId: r.id,
            start: at(0),
            end: at(60),
            reason: "Mantenimiento preventivo",
          }),
          /coincide/,
        );
        await cancelBooking(s, b.id, "Resolver mantenimiento");
        await administer(admin, "block", {
          resourceId: r.id,
          start: at(0),
          end: at(60),
          reason: "Mantenimiento preventivo",
        });
        await assert.rejects(saveBooking(s, input()), /coincide/);
        await clear();
      },
    );
    await t.test(
      "PA16: admin changes invalidating future flight are rolled back",
      async () => {
        await saveBooking(s, input());
        await assert.rejects(
          administer(admin, "qualification", {
            userId: s.id,
            model,
            validUntil: at(30),
          }),
          /invalidaría/,
        );
        await assert.rejects(
          administer(admin, "user", {
            id: s.id,
            name: s.id,
            email: s.id + "@test.invalid",
            role: "ALUMNO",
            active: false,
          }),
          /invalidaría/,
        );
        const a = await db.availability.findFirstOrThrow({
          where: { userId: i.id },
        });
        await assert.rejects(
          administer(i, "availability", {
            ...a,
            start: a.start.toISOString(),
            end: a.end.toISOString(),
            remove: true,
          }),
          /invalidaría/,
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: s.id } })).active,
          true,
        );
        assert.ok(await db.availability.findUnique({ where: { id: a.id } }));
        await clear();
      },
    );
    await t.test(
      "RF07/RF09: student denied admin, instructor cannot change another instructor",
      async () => {
        await assert.rejects(
          administer(s, "aircraft", {
            registration: "CC-TST",
            model,
            seats: 2,
            active: true,
          }),
          /permisos/,
        );
        await assert.rejects(
          administer(i, "availability", {
            userId: i2.id,
            start: at(0),
            end: at(60),
          }),
          /propia disponibilidad/,
        );
      },
    );
    await t.test(
      "PA10 regression: duplicate cancellation is idempotent and still checks ownership",
      async () => {
        try {
          const b = await saveBooking(s, input());
          const first = await cancelBooking(s, b.id, "Cambio de planes");
          const repeated = await cancelBooking(s, b.id, "Cambio de planes");
          assert.equal(repeated.id, first.id);
          assert.equal(repeated.status, "CANCELADA");
          assert.equal(
            await db.audit.count({
              where: { entityId: b.id, action: "CANCELAR" },
            }),
            1,
          );
          await assert.rejects(
            cancelBooking(s2, b.id, "Cambio de planes"),
            /permiso/,
          );
        } finally {
          await clear();
        }
      },
    );
    await t.test(
      "PA09 regression: reschedule over a block returns a domain conflict and keeps original allocations",
      async () => {
        try {
          const b = await saveBooking(s, input());
          const r = await db.resource.findUniqueOrThrow({
            where: { aircraftId: plane },
          });
          await administer(admin, "block", {
            resourceId: r.id,
            start: at(120),
            end: at(180),
            reason: "Mantenimiento preventivo",
          });
          await assert.rejects(
            saveBooking(s, input({ start: at(120), end: at(180) }), b.id),
            /coincide con otra reserva o bloqueo/,
          );
          const original = await db.booking.findUniqueOrThrow({
            where: { id: b.id },
          });
          assert.equal(
            original.start.toISOString(),
            new Date(at(0)).toISOString(),
          );
          assert.equal(
            await db.occupancy.count({
              where: { bookingId: b.id, active: true },
            }),
            3,
          );
        } finally {
          await clear();
        }
      },
    );

    await t.test(
      "PA07/PA08: instructor privileges, busy instructor, availability and audit",
      async () => {
        try {
          const b = await saveBooking(i, input());
          await assert.rejects(
            saveBooking(s2, input({ studentId: s2.id, aircraftId: plane2 })),
            /coincide/,
          );
          await assert.rejects(
            saveBooking(
              s2,
              input({
                studentId: s2.id,
                instructorId: i2.id,
                aircraftId: plane2,
                start: at(660),
                end: at(720),
              }),
            ),
            /disponibilidad/,
          );
          await saveBooking(
            i,
            input({
              start: at(60),
              end: at(120),
              reason: "Ajuste por instrucción",
            }),
            b.id,
          );
          assert.equal(
            await db.audit.count({
              where: { entityId: b.id, action: "REPROGRAMAR", actorId: i.id },
            }),
            1,
          );
        } finally {
          await clear();
        }
      },
    );
    await t.test(
      "PA11: concurrent block and booking permit exactly one winner",
      async () => {
        try {
          const r = await db.resource.findUniqueOrThrow({
            where: { aircraftId: plane },
          });
          const outcomes = await Promise.allSettled([
            saveBooking(s, input()),
            administer(admin, "block", {
              resourceId: r.id,
              start: at(0),
              end: at(60),
              reason: "Mantenimiento concurrente",
            }),
          ]);
          assert.equal(
            outcomes.filter((o) => o.status === "fulfilled").length,
            1,
          );
          assert.equal(
            await db.occupancy.count({
              where: { resourceId: r.id, active: true },
            }),
            1,
          );
        } finally {
          await clear();
        }
      },
    );
    await t.test(
      "PA13/CU10: due reminders revalidate ownership, time, state, reading and rescheduling",
      async () => {
        try {
          const b = await saveBooking(s, input());
          const before = new Date(new Date(at(0)).getTime() - 30 * 60000);
          assert.equal(
            (await dueReminders(s.id, new Date(before.getTime() - 1))).length,
            0,
          );
          assert.deepEqual(
            (await dueReminders(s.id, before)).map((r) => r.id),
            [b.id],
          );
          assert.equal((await dueReminders(s2.id, before)).length, 0);
          assert.equal((await dueReminders(s.id, new Date(at(0)))).length, 0);
          await db.booking.update({
            where: { id: b.id },
            data: { reminderRead: true },
          });
          assert.equal((await dueReminders(s.id, before)).length, 0);
          await saveBooking(s, input({ start: at(60), end: at(120) }), b.id);
          assert.equal((await dueReminders(s.id, before)).length, 0);
          const due = new Date(new Date(at(60)).getTime() - 30 * 60000);
          assert.equal((await dueReminders(s.id, due)).length, 1);
          await cancelBooking(s, b.id, "Cambio de planificación");
          assert.equal((await dueReminders(s.id, due)).length, 0);
          const without = await saveBooking(
            s,
            input({ reminder: false, note: "" }),
          );
          assert.equal(without.note, "");
          assert.equal((await dueReminders(s.id, before)).length, 0);
        } finally {
          await clear();
        }
      },
    );
    await t.test(
      "RNF01: PostgreSQL exclusion protects independent raw clients",
      async () => {
        const r = await db.resource.findUniqueOrThrow({
          where: { aircraftId: plane },
        });
        const block = await db.block.create({
          data: {
            resourceId: r.id,
            start: new Date(at(0)),
            end: new Date(at(60)),
            reason: "Raw constraint test",
          },
        });
        const second = new PrismaClient();
        try {
          const make = (client: PrismaClient) =>
            client.occupancy.create({
              data: {
                resourceId: r.id,
                blockId: block.id,
                start: new Date(at(0)),
                end: new Date(at(60)),
              },
            });
          const result = await Promise.allSettled([make(db), make(second)]);
          assert.equal(
            result.filter((x) => x.status === "fulfilled").length,
            1,
          );
        } finally {
          await second.$disconnect();
        }
        await clear();
      },
    );
  } finally {
    await clear();
    await db.qualification.deleteMany({
      where: { userId: { startsWith: prefix } },
    });
    await db.availability.deleteMany({
      where: { userId: { startsWith: prefix } },
    });
    await db.resource.deleteMany({
      where: {
        OR: [
          { userId: { startsWith: prefix } },
          { aircraftId: { startsWith: prefix } },
        ],
      },
    });
    await db.aircraft.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  }
});
