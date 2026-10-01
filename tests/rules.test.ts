import test from "node:test";
import assert from "node:assert/strict";
import {
  AdministrativePolicy,
  StudentPolicy,
  bookingSchema,
  canEdit,
  instant,
  interval,
} from "../lib/rules";
import { calendarFile } from "../lib/ical";
const now = new Date("2026-10-01T12:00:00Z");
test("RN01/RN02: future, ordered, half-hour blocks and horizon", () => {
  assert.equal(
    interval("2026-10-02T10:00", "2026-10-02T11:00", now).start.toISOString(),
    "2026-10-02T13:00:00.000Z",
  );
  for (const [s, e] of [
    ["2026-09-30T10:00", "2026-09-30T11:00"],
    ["2026-10-02T10:15", "2026-10-02T11:15"],
    ["2026-10-02T10:00", "2026-10-02T14:00"],
    ["2026-10-02T11:00", "2026-10-02T10:00"],
    ["2026-11-02T10:00", "2026-11-02T11:00"],
  ])
    assert.throws(() => interval(s, e, now));
});
test("RN10: reject missing and ambiguous Chilean local hours", () => {
  assert.throws(() => instant("2026-09-06T00:30"));
  assert.throws(() => instant("2026-04-04T23:30"));
  assert.notEqual(
    instant("2026-04-04T23:30:00-03:00").getTime(),
    instant("2026-04-04T23:30:00-04:00").getTime(),
  );
});
test("RN05: Strategy permits own student bookings and administrative roles", () => {
  const p = new StudentPolicy();
  p.validate({ id: "a", role: "ALUMNO" }, "a");
  assert.throws(() => p.validate({ id: "a", role: "ALUMNO" }, "b"));
  const a = new AdministrativePolicy();
  a.validate({ id: "a", role: "INSTRUCTOR" });
  a.validate({ id: "a", role: "ADMINISTRADOR" });
  assert.throws(() => a.validate({ id: "a", role: "ALUMNO" }));
});
test("RN07: cannot modify foreign, started or cancelled booking; admin reason required", () => {
  const booking = {
    studentId: "s",
    start: new Date(Date.now() + 86400000),
    status: "CONFIRMADA",
  };
  assert.throws(() => canEdit({ id: "other", role: "ALUMNO" }, booking, ""));
  assert.throws(() =>
    canEdit(
      { id: "s", role: "ALUMNO" },
      { ...booking, start: new Date(0) },
      "",
    ),
  );
  assert.throws(() =>
    canEdit(
      { id: "s", role: "ALUMNO" },
      { ...booking, status: "CANCELADA" },
      "",
    ),
  );
  assert.throws(() =>
    canEdit({ id: "admin", role: "ADMINISTRADOR" }, booking, ""),
  );
  canEdit({ id: "admin", role: "INSTRUCTOR" }, booking, "Cambio de horario");
});
test("RF11: note limit and required fields", () => {
  const input = {
    studentId: "s",
    instructorId: "i",
    aircraftId: "p",
    start: "2026-10-02T10:00",
    end: "2026-10-02T11:00",
    requestKey: "test-1234",
  };
  assert.equal(bookingSchema.parse(input).reminder, false);
  assert.equal(
    bookingSchema.safeParse({ ...input, note: "x".repeat(501) }).success,
    false,
  );
  assert.equal(
    bookingSchema.safeParse({ ...input, instructorId: "" }).success,
    false,
  );
});
test("RF12: calendar escapes notes, hides private details, folds UTF-8, uses UTC instants", () => {
  const base = {
    id: "a",
    start: "2026-10-02T13:00:00Z",
    end: "2026-10-02T14:00:00Z",
    status: "CONFIRMADA",
    registration: "CC-AAA",
    private: false,
    student: "Alumno",
    instructor: "Instructor",
    note: "Hola;\nBEGIN:VEVENT," + "á".repeat(100),
  };
  const ics = calendarFile([base]);
  assert.match(ics, /DTSTART:20261002T130000Z/);
  assert.match(ics.replace(/\r\n /g, ""), /Hola\\;\\nBEGIN:VEVENT\\,/);
  assert.equal(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT").length, 1);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  const hidden = calendarFile([{ ...base, private: true }]);
  assert.ok(!hidden.includes("Alumno"));
  assert.ok(!hidden.includes("Instructor"));
  assert.ok(!hidden.includes("Hola"));
});
