import test from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import { createHash } from "node:crypto";
import { db } from "../lib/db";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
class Client {
  jar = new Map<string, string>();
  cookie() {
    return Array.from(this.jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
  async request(path: string, body?: Record<string, string>) {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      redirect: "manual",
      headers: {
        cookie: this.cookie(),
        ...(body
          ? {
              "Content-Type": "application/x-www-form-urlencoded",
              Origin: base,
              "X-Auth-Return-Redirect": "1",
            }
          : {}),
      },
      body: body ? new URLSearchParams(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const cut = pair.indexOf("=");
      this.jar.set(pair.slice(0, cut), pair.slice(cut + 1));
    }
    return response;
  }
  async csrf() {
    return (await (await this.request("/api/auth/csrf")).json())
      .csrfToken as string;
  }
  async login(email: string, password: string) {
    const csrfToken = await this.csrf();
    return this.request("/api/auth/callback/credentials", {
      email,
      password,
      csrfToken,
      callbackUrl: base,
    });
  }
  async session() {
    return (await (await this.request("/api/auth/session")).json())?.user;
  }
}
test("PA01/RNF02: Auth.js HTTP security workflow", async (t) => {
  const id = "http-test-" + Date.now(),
    email = id + "@example.invalid",
    password = "TestingPassword2026!";
  const key = createHash("sha256").update(email).digest("hex");
  await db.user.create({
    data: {
      id,
      name: "HTTP test",
      email,
      passwordHash: await argon2.hash(password),
      role: "ALUMNO",
      resource: { create: {} },
    },
  });
  try {
    await t.test("unauthenticated export denied", async () => {
      assert.equal((await fetch(base + "/api/calendar")).status, 401);
    });
    await t.test("wrong password and inactive account rejected", async () => {
      const c = new Client();
      await c.login(email, "WrongPassword");
      assert.equal(await c.session(), undefined);
      await db.user.update({ where: { id }, data: { active: false } });
      await c.login(email, password);
      assert.equal(await c.session(), undefined);
      await db.user.update({ where: { id }, data: { active: true } });
    });
    await db.loginAttempt.deleteMany({ where: { key } });
    await t.test("login throttles after five attempts", async () => {
      const c = new Client();
      for (let n = 0; n < 5; n++) await c.login(email, "WrongPassword");
      await c.login(email, password);
      assert.equal(await c.session(), undefined);
    });
    await db.loginAttempt.deleteMany({ where: { key } });
    await t.test("missing CSRF rejected", async () => {
      const c = new Client();
      await c.request("/api/auth/callback/credentials", {
        email,
        password,
        callbackUrl: base,
      });
      assert.equal(await c.session(), undefined);
    });
    await t.test(
      "valid login, private export, signout revokes even a copied old cookie",
      async () => {
        const c = new Client();
        await c.login(email, password);
        assert.equal((await c.session()).id, id);
        const ics = await (await c.request("/api/calendar")).text();
        assert.match(ics, /BEGIN:VCALENDAR/);
        assert.ok(!ics.includes("Javier Gracia"));
        assert.ok(!ics.includes("Cristian Lizama"));
        const cookie = c.cookie();
        await c.request("/api/auth/signout", {
          csrfToken: await c.csrf(),
          callbackUrl: base + "/login",
        });
        assert.equal(await c.session(), undefined);
        assert.equal(
          (await fetch(base + "/api/calendar", { headers: { cookie } })).status,
          401,
        );
      },
    );
    await t.test("30-minute idle timeout enforced server-side", async () => {
      const c = new Client();
      await c.login(email, password);
      await db.loginSession.updateMany({
        where: { userId: id },
        data: { lastSeen: new Date(Date.now() - 31 * 60000) },
      });
      assert.equal(await c.session(), undefined);
    });
  } finally {
    await db.loginSession.deleteMany({ where: { userId: id } });
    await db.loginAttempt.deleteMany({ where: { key } });
    await db.resource.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });
    await db.$disconnect();
  }
});
