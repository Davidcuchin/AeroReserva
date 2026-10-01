import { auth } from "@/auth";
import { db } from "./db";
import { redirect } from "next/navigation";
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.active) redirect("/login");
  return user;
}
