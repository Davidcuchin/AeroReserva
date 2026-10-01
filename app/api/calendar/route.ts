import { auth } from "@/auth";
import { db } from "@/lib/db";
import { calendarFile } from "@/lib/ical";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("No autorizado", { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.active) return new Response("No autorizado", { status: 401 });
  const own = new URL(request.url).searchParams.get("own") === "1";
  const bookings = await db.booking.findMany({
    where: own
      ? { OR: [{ studentId: user.id }, { instructorId: user.id }] }
      : {},
    include: { student: true, instructor: true, aircraft: true },
  });
  const items = bookings.map((b) => {
    const visible =
      user.role !== "ALUMNO" ||
      b.studentId === user.id ||
      b.instructorId === user.id;
    return {
      ...b,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      registration: b.aircraft.registration,
      private: !visible,
      student: visible ? b.student.name : "",
      instructor: visible ? b.instructor.name : "",
      note: visible ? b.note : "",
    };
  });
  return new Response(calendarFile(items), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aeroreserva.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
