import type { Flight } from "./view-types";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
function fold(line: string) {
  let out = "",
    part = "";
  for (const char of line) {
    if (Buffer.byteLength(part + char, "utf8") > 73) {
      out += part + "\r\n ";
      part = "";
    }
    part += char;
  }
  return out + part;
}
export function calendarFile(
  flights: Pick<
    Flight,
    | "id"
    | "start"
    | "end"
    | "status"
    | "registration"
    | "private"
    | "student"
    | "instructor"
    | "note"
  >[],
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AeroReserva//Club Aereo//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AeroReserva",
    "X-WR-TIMEZONE:America/Santiago",
  ];
  for (const b of flights)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@aeroreserva.local`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(b.start)}`,
      `DTEND:${stamp(b.end)}`,
      `SUMMARY:${escape(b.registration + " · " + (b.private ? "Ocupado" : "Vuelo de instrucción"))}`,
      `DESCRIPTION:${escape(b.private ? "Ocupado" : `Alumno: ${b.student}\nInstructor: ${b.instructor}\n${b.note}`)}`,
      `STATUS:${b.status === "CANCELADA" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
