"use server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { currentUser } from "@/lib/session";
import { BusinessError, bookingSchema } from "@/lib/rules";
import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { cancelBooking, saveBooking } from "@/lib/service";
export type Result = { ok: boolean; message: string; id?: string };
export async function loginAction(_: Result, form: FormData): Promise<Result> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError)
      return {
        ok: false,
        message:
          "No fue posible ingresar. Revisa tus datos o espera 15 minutos si agotaste los intentos.",
      };
    throw error;
  }
  return { ok: true, message: "" };
}
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
export async function bookingAction(
  raw: unknown,
  id?: string,
): Promise<Result> {
  const actor = await currentUser();
  try {
    const b = await saveBooking(actor, raw, id);
    revalidatePath("/");
    return {
      ok: true,
      message:
        (id ? "Reserva reprogramada." : "Tu reserva está confirmada.") +
        (bookingSchema.parse(raw).reminder && !b.reminder
          ? " No se programó el recordatorio porque faltan menos de 30 minutos."
          : ""),
      id: b.id,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function cancelAction(
  id: string,
  reason: string,
): Promise<Result> {
  const actor = await currentUser();
  try {
    await cancelBooking(actor, id, reason);
    revalidatePath("/");
    return {
      ok: true,
      message: "Reserva cancelada. Los recursos ya están disponibles.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function failure(error: unknown): Promise<Result> {
  if (error instanceof BusinessError)
    return { ok: false, message: error.message };
  if (error instanceof ZodError)
    return {
      ok: false,
      message:
        "Revisa los campos obligatorios y sus formatos. " +
        error.issues[0].message,
    };
  console.error(
    "Operación rechazada:",
    error instanceof Error ? error.name : "Error",
  );
  return {
    ok: false,
    message:
      "No se pudo completar la operación. Actualiza e inténtalo nuevamente.",
  };
}
