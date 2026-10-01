import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import argon2 from "argon2";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
const loginSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});
const dummyHash = argon2.hash("constant-dummy-password-not-a-user", {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});
export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const key = createHash("sha256").update(email).digest("hex");
        const attempts = await db.$queryRaw<
          { count: number }[]
        >`INSERT INTO "LoginAttempt" (key, count, "windowStart") VALUES (${key},1,NOW()) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "LoginAttempt"."windowStart" < NOW() - interval '15 minutes' THEN 1 ELSE "LoginAttempt".count + 1 END, "windowStart" = CASE WHEN "LoginAttempt"."windowStart" < NOW() - interval '15 minutes' THEN NOW() ELSE "LoginAttempt"."windowStart" END RETURNING count`;
        if (attempts[0].count > 5) return null;
        const user = await db.user.findUnique({ where: { email } });
        const valid = await argon2.verify(
          user?.passwordHash ?? (await dummyHash),
          password,
        );
        if (!user?.active || !valid) return null;
        await db.loginAttempt.deleteMany({ where: { key } });
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const session = await db.loginSession.create({
          data: {
            userId: user.id!,
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
          },
        });
        token.sid = session.id;
      }
      if (typeof token.sid !== "string") return null;
      const session = await db.loginSession.findUnique({
        where: { id: token.sid },
        include: { user: true },
      });
      if (
        !session ||
        !session.user.active ||
        session.expiresAt < new Date() ||
        session.lastSeen.getTime() < Date.now() - 30 * 60 * 1000
      )
        return null;
      // Automatic reminder polling must not extend the inactivity timeout.
      if (request?.nextUrl.pathname !== "/api/reminders")
        await db.loginSession.update({
          where: { id: session.id },
          data: { lastSeen: new Date() },
        });
      token.sub = session.user.id;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.sid === "string")
        await db.loginSession.deleteMany({ where: { id: message.token.sid } });
    },
  },
}));
