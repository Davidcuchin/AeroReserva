"use server";
import { currentUser } from "@/lib/session";
import { atomic } from "@/lib/service";
import { BusinessError } from "@/lib/rules";
import { administer } from "@/lib/admin-service";
import { failure, type Result } from "./actions";
import { revalidatePath } from "next/cache";
export async function adminAction(
  kind: Parameters<typeof administer>[1],
  raw: unknown,
): Promise<Result> {
  const actor = await currentUser();
  try {
    await administer(actor, kind, raw);
    revalidatePath("/");
    return { ok: true, message: "Cambios guardados correctamente." };
  } catch (error) {
    return failure(error);
  }
}
export async function readReminder(id: string): Promise<Result> {
  const actor = await currentUser();
  try {
    await atomic(actor, async (tx, current) => {
      const b = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (b.studentId !== current.id)
        throw new BusinessError("Este recordatorio no te pertenece.");
      await tx.booking.update({ where: { id }, data: { reminderRead: true } });
    });
    revalidatePath("/");
    return { ok: true, message: "Recordatorio leído." };
  } catch (error) {
    return failure(error);
  }
}
