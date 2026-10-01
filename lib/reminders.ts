import { db } from "./db";
import { REMINDER_LEAD_MS } from "./rules";
export async function dueReminders(studentId: string, now = new Date()) {
  const bookings = await db.booking.findMany({
    where: {
      studentId,
      status: "CONFIRMADA",
      reminder: true,
      reminderRead: false,
      start: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
    },
    select: {
      id: true,
      start: true,
      instructor: { select: { name: true } },
      aircraft: { select: { registration: true } },
    },
    orderBy: { start: "asc" },
  });
  return bookings.map((b) => ({
    id: b.id,
    start: b.start.toISOString(),
    instructor: b.instructor.name,
    registration: b.aircraft.registration,
  }));
}
