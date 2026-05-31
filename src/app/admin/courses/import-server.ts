// Server-side core of the course CSV import. Touches the database, so it lives
// here (not in import-shared.ts, which must stay client-safe). The page's
// `bulkImportCourses` server action is a thin wrapper around this: it pulls the
// file off the FormData, calls importCoursesFromCsv, and handles revalidation.
//
// Kept as a plain exported function (no "use server", no revalidatePath) so it
// can be exercised directly by an integration test against a real database.

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { buildCoursePreview, type CourseImportState } from "./import-shared";

export async function importCoursesFromCsv(
  text: string,
): Promise<CourseImportState> {
  // Re-run the SAME parse + validation the client used for its preview. The
  // client preview is only a courtesy — this pass is the authority, so a
  // hand-crafted request can't slip past validation.
  const preview = buildCoursePreview(text);
  if (!preview.ok) {
    return { ok: false, message: preview.message, created: [], skipped: [] };
  }

  // Resolve lecturers in one query, then match each row in memory. A CSV can't
  // carry the lecturer's internal id, so we accept their email or staff ID and
  // look them up here — the check the client preview can't do.
  const lecturers = await db.user.findMany({
    where: { role: "LECTURER" },
    select: { id: true, name: true, email: true, staffId: true },
  });
  const byEmail = new Map(lecturers.map((l) => [l.email.toLowerCase(), l]));
  const byStaffId = new Map(
    lecturers.filter((l) => l.staffId).map((l) => [l.staffId!.toLowerCase(), l]),
  );

  const created: CourseImportState["created"] = [];
  const skipped: CourseImportState["skipped"] = [];

  for (const row of preview.rows) {
    // Rows the shared validator already rejected (short title, dup-in-file, …)
    // are skipped with the reason it gave — no DB attempt.
    if (!row.valid) {
      skipped.push({
        row: row.rowNum,
        code: row.raw.code || "(blank)",
        reason: row.error,
      });
      continue;
    }

    const { code, title, lecturer, semester } = row.data;
    const match =
      byEmail.get(lecturer.toLowerCase()) ?? byStaffId.get(lecturer.toLowerCase());
    if (!match) {
      skipped.push({ row: row.rowNum, code, reason: `lecturer not found: ${lecturer}` });
      continue;
    }

    try {
      await db.course.create({ data: { code, title, semester, lecturerId: match.id } });
      created.push({ code, title, lecturerName: match.name });
    } catch (err) {
      // Course.code is unique. A clash trips the unique constraint (Prisma
      // P2002) — the case the client preview can't see, since it doesn't know
      // what's already in the DB. Skip that row instead of aborting the import.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        skipped.push({ row: row.rowNum, code, reason: "code already exists" });
      } else {
        skipped.push({ row: row.rowNum, code, reason: "could not be created" });
      }
    }
  }

  return { ok: true, created, skipped };
}
