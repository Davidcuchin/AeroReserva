import { auth } from "@/auth";
import { dueReminders } from "@/lib/reminders";
const headers = { "Cache-Control": "private, no-store" };
// Lazy Auth.js configuration resolves the route wrapper asynchronously.
export const GET = await auth(async (request) => {
  if (!request.auth?.user?.id)
    return Response.json(
      { error: "Inicia sesión nuevamente." },
      { status: 401, headers },
    );
  try {
    return Response.json(
      { reminders: await dueReminders(request.auth.user.id) },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "No se pudieron actualizar los recordatorios." },
      { status: 503, headers },
    );
  }
});
