import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";
import { Temporal } from "@js-temporal/polyfill";
import { saveBooking } from "../lib/service";
import { db } from "../lib/db";
const prisma = new PrismaClient();
async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Configura DEMO_PASSWORD de al menos 12 caracteres.");
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const users = [
    {
      id: "demo-admin",
      name: "David González",
      email: "admin@aeroreserva.cl",
      role: Role.ADMINISTRADOR,
    },
    {
      id: "demo-alumno",
      name: "Javier Gracia",
      email: "alumno@aeroreserva.cl",
      role: Role.ALUMNO,
    },
    {
      id: "demo-alumno-2",
      name: "Camila Torres",
      email: "camila@aeroreserva.cl",
      role: Role.ALUMNO,
    },
    {
      id: "demo-alumno-3",
      name: "Nicolás Fuentes",
      email: "nicolas@aeroreserva.cl",
      role: Role.ALUMNO,
    },
    {
      id: "demo-instructor",
      name: "Cristian Lizama",
      email: "instructor@aeroreserva.cl",
      role: Role.INSTRUCTOR,
    },
    {
      id: "demo-instructor-2",
      name: "Valentina Rojas",
      email: "valentina@aeroreserva.cl",
      role: Role.INSTRUCTOR,
    },
  ];
  const planes = [
    {
      id: "demo-plane-1",
      registration: "CC-KDA",
      model: "Cessna 172S",
      seats: 4,
    },
    {
      id: "demo-plane-2",
      registration: "CC-PIP",
      model: "Piper PA-28",
      seats: 4,
    },
    {
      id: "demo-plane-3",
      registration: "CC-DAH",
      model: "Cessna 152",
      seats: 2,
    },
  ];
  for (const user of users)
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { ...user, passwordHash, resource: { create: {} } },
    });
  for (const plane of planes)
    await prisma.aircraft.upsert({
      where: { id: plane.id },
      update: {},
      create: { ...plane, resource: { create: {} } },
    });
  const now = Temporal.Now.zonedDateTimeISO("America/Santiago");
  for (const user of users.filter((u) => u.role !== Role.ADMINISTRADOR))
    for (const plane of planes) {
      await prisma.qualification.upsert({
        where: { userId_model: { userId: user.id, model: plane.model } },
        update: {},
        create: {
          userId: user.id,
          model: plane.model,
          validUntil: new Date(now.add({ years: 1 }).epochMilliseconds),
        },
      });
    }
  for (const user of users.filter((u) => u.role === Role.INSTRUCTOR))
    for (let i = 1; i <= 31; i++) {
      const start = now
        .add({ days: i })
        .with({ hour: 8, minute: 0, second: 0, millisecond: 0 });
      const id = `seed-${user.id}-${start.toPlainDate()}`;
      await prisma.availability.upsert({
        where: { id },
        update: {},
        create: {
          id,
          userId: user.id,
          start: new Date(start.epochMilliseconds),
          end: new Date(start.with({ hour: 20 }).epochMilliseconds),
        },
      });
    }
  for (let i = 1; i <= 7; i++) {
    const start = now
      .add({ days: i })
      .with({ hour: i % 2 ? 10 : 14, minute: 0, second: 0, millisecond: 0 });
    const student = users[1 + ((i - 1) % 3)],
      plane = planes[(i - 1) % 3],
      instructor = users[4 + ((i - 1) % 2)];
    const requestKey = `demo-${start.toPlainDate()}`;
    if (
      await prisma.booking.findUnique({
        where: {
          creatorId_requestKey: { creatorId: "demo-admin", requestKey },
        },
      })
    )
      continue;
    await saveBooking(
      { id: "demo-admin", role: "ADMINISTRADOR" },
      {
        studentId: student.id,
        instructorId: instructor.id,
        aircraftId: plane.id,
        start: start.toInstant().toString(),
        end: start.add({ hours: 1 }).toInstant().toString(),
        requestKey,
        note:
          i % 2
            ? "Práctica de circuitos y aproximaciones."
            : "Navegación y procedimientos básicos.",
        reminder: true,
      },
    );
  }
  console.log(
    "Datos de demostración disponibles: admin@aeroreserva.cl, alumno@aeroreserva.cl, instructor@aeroreserva.cl.",
  );
}
main().finally(async () => {
  await prisma.$disconnect();
  await db.$disconnect();
});
