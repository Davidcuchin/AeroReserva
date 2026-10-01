import { currentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rules";
import { Dashboard } from "@/components/dashboard";
import type { AppData, Person } from "@/lib/view-types";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await currentUser(),
    admin = isAdmin(user);
  const [people, planes, flights, resources, blocks, availability, audits] =
    await Promise.all([
      db.user.findMany({
        where: admin
          ? {}
          : { OR: [{ id: user.id }, { role: "INSTRUCTOR", active: true }] },
        include: { qualifications: true },
        orderBy: { name: "asc" },
      }),
      db.aircraft.findMany({ orderBy: { registration: "asc" } }),
      db.booking.findMany({
        include: { student: true, instructor: true, aircraft: true },
        orderBy: { start: "desc" },
      }),
      db.resource.findMany({ include: { user: true, aircraft: true } }),
      db.block.findMany({ where: { active: true } }),
      db.availability.findMany({
        where: { end: { gt: new Date() } },
        orderBy: { start: "asc" },
      }),
      db.audit.findMany({
        where: admin
          ? {}
          : {
              entity: "Reserva",
              entityId: {
                in: (
                  await db.booking.findMany({
                    where: {
                      OR: [{ studentId: user.id }, { instructorId: user.id }],
                    },
                    select: { id: true },
                  })
                ).map((b) => b.id),
              },
            },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
    ]);
  const person = (p: (typeof people)[number]): Person => ({
    id: p.id,
    name: p.name,
    email: admin || p.id === user.id ? p.email : "",
    role: p.role,
    active: p.active,
    qualifications:
      admin || p.id === user.id
        ? p.qualifications.map((q) => ({
            id: q.id,
            model: q.model,
            validUntil: q.validUntil.toISOString(),
          }))
        : [],
  });
  const data: AppData = {
    user: person(people.find((p) => p.id === user.id)!),
    users: people.map(person),
    planes,
    flights: flights.map((b) => {
      const visible =
        admin || b.studentId === user.id || b.instructorId === user.id;
      return {
        id: b.id,
        studentId: visible ? b.studentId : "",
        instructorId: b.instructorId,
        aircraftId: b.aircraftId,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
        status: b.status,
        note: visible ? b.note : "",
        reminder: visible ? b.reminder : false,
        reminderRead: visible ? b.reminderRead : true,
        student: visible ? b.student.name : "Ocupado",
        instructor: visible ? b.instructor.name : "",
        registration: b.aircraft.registration,
        model: b.aircraft.model,
        private: !visible,
        cancelReason: visible ? b.cancelReason : null,
      };
    }),
    resources: resources
      .filter((r) => admin || r.aircraftId || r.userId === user.id)
      .map((r) => ({
        id: r.id,
        label: r.aircraft
          ? `${r.aircraft.registration} · ${r.aircraft.model}`
          : r.user!.name,
      })),
    blocks: blocks.map((b) => ({
      ...b,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      reason: admin ? b.reason : "No disponible",
    })),
    availability: availability.map((a) => ({
      ...a,
      start: a.start.toISOString(),
      end: a.end.toISOString(),
    })),
    audits: audits.map((a) => ({
      id: a.id,
      actor: a.actor.name,
      entity: a.entity,
      entityId: a.entityId,
      action: a.action,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
      before: a.before,
      after: a.after,
    })),
  };
  return <Dashboard data={data} />;
}
