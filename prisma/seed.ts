/**
 * Seed the database with a realistic demo dataset:
 *   - 1 admin
 *   - 2 lecturers
 *   - 6 students
 *   - 3 courses (each lecturer teaches some)
 *   - enrollments wiring students into courses
 *
 * Run with:  npm run db:seed
 *
 * Every seeded user has password "password123" so the demo is frictionless.
 * Reset + reseed with: npm run db:reset
 */

import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Idempotent reset of the demo data (in case seed is run repeatedly)
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@uni.edu",
      passwordHash,
      name: "System Administrator",
      role: "ADMIN",
    },
  });

  // Lecturers
  const drAdebayo = await prisma.user.create({
    data: {
      email: "adebayo@uni.edu",
      passwordHash,
      name: "Dr. Adebayo Okafor",
      role: "LECTURER",
      staffId: "STF-1001",
    },
  });

  const profIbrahim = await prisma.user.create({
    data: {
      email: "ibrahim@uni.edu",
      passwordHash,
      name: "Prof. Aminat Ibrahim",
      role: "LECTURER",
      staffId: "STF-1002",
    },
  });

  // Students
  const studentSeeds = [
    { name: "Chinonso Eze",     matric: "CSC/2021/001" },
    { name: "Fatima Bello",     matric: "CSC/2021/002" },
    { name: "Tunde Adeyemi",    matric: "CSC/2021/003" },
    { name: "Ngozi Onuoha",     matric: "CSC/2021/004" },
    { name: "Yusuf Salihu",     matric: "CSC/2021/005" },
    { name: "Blessing Okoro",   matric: "CSC/2021/006" },
  ];

  const students = await Promise.all(
    studentSeeds.map((s) =>
      prisma.user.create({
        data: {
          email: `${s.matric.replace(/\//g, ".").toLowerCase()}@uni.edu`,
          passwordHash,
          name: s.name,
          role: "STUDENT",
          matricNumber: s.matric,
        },
      })
    )
  );

  // Courses
  const csc401 = await prisma.course.create({
    data: { code: "CSC401", title: "Software Engineering",     semester: "HARMATTAN", lecturerId: drAdebayo.id },
  });
  const csc403 = await prisma.course.create({
    data: { code: "CSC403", title: "Database Systems",         semester: "RAIN",      lecturerId: drAdebayo.id },
  });
  const csc411 = await prisma.course.create({
    data: { code: "CSC411", title: "Artificial Intelligence",  semester: "RAIN",      lecturerId: profIbrahim.id },
  });

  // Enrollments: all 6 students take CSC401; first 4 take CSC403; last 3 take CSC411.
  const allEnroll = students.map((s) => ({ studentId: s.id, courseId: csc401.id }));
  const dbEnroll  = students.slice(0, 4).map((s) => ({ studentId: s.id, courseId: csc403.id }));
  const aiEnroll  = students.slice(3).map((s) => ({ studentId: s.id, courseId: csc411.id }));

  await prisma.enrollment.createMany({
    data: [...allEnroll, ...dbEnroll, ...aiEnroll],
  });

  // Live sessions covering every attendance-window state in the demo:
  //   - one minutes-mode window still accepting
  //   - one minutes-mode window already closed (but still active, so the
  //     lecturer keeps the live roster)
  //   - one seconds-mode (60s) window so the seconds display is visible
  // windowSeconds = 900 (15 min) for the two minutes-mode sessions.
  const now = Date.now();

  // CSC401 — started 5 min ago, window open until ~10 min from now.
  const openSession = await prisma.session.create({
    data: {
      courseId: csc401.id,
      secret: randomBytes(32).toString("hex"),
      shortCode: "7K2P9M",
      startedAt: new Date(now - 5 * 60_000),
      windowSeconds: 900,
      acceptingUntil: new Date(now - 5 * 60_000 + 15 * 60_000),
      active: true,
    },
  });

  // CSC403 — started 30 min ago, 15-min window closed ~15 min ago.
  const closedSession = await prisma.session.create({
    data: {
      courseId: csc403.id,
      secret: randomBytes(32).toString("hex"),
      shortCode: "4R8T6W",
      startedAt: new Date(now - 30 * 60_000),
      windowSeconds: 900,
      acceptingUntil: new Date(now - 30 * 60_000 + 15 * 60_000),
      active: true,
    },
  });

  // CSC411 — seconds-mode demo: a 60-second snapshot window, just started, so
  // the lecturer's live view shows the HH:MM:SS "Accepting until" badge.
  await prisma.session.create({
    data: {
      courseId: csc411.id,
      secret: randomBytes(32).toString("hex"),
      shortCode: "9S3D1F",
      startedAt: new Date(now),
      windowSeconds: 60,
      acceptingUntil: new Date(now + 60_000),
      active: true,
    },
  });

  // A few students who checked in under each session.
  await prisma.attendance.createMany({
    data: [
      ...students.slice(0, 3).map((s) => ({ sessionId: openSession.id, studentId: s.id })),
      ...students.slice(0, 2).map((s) => ({ sessionId: closedSession.id, studentId: s.id })),
    ],
  });

  console.log("Seed complete.");
  console.log("---");
  console.log("Login credentials (password for all accounts: password123):");
  console.log(`  Admin     : ${admin.email}`);
  console.log(`  Lecturer 1: ${drAdebayo.email}`);
  console.log(`  Lecturer 2: ${profIbrahim.email}`);
  students.forEach((s) =>
    console.log(`  Student   : ${s.email}    (${s.name})`)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
