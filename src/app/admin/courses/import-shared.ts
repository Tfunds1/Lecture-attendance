// Shared CSV import logic for courses — the single source of truth for "what
// counts as a valid course row". Imported by BOTH the client
// (CourseBulkImportCard, for the live preview) and the server
// (bulkImportCourses, the authority that actually writes to the DB). Keeping it
// in one place means the preview a user sees can't drift from the rules the
// server enforces. Mirrors src/app/admin/users/import-shared.ts.
//
// This module must stay client-safe: pure functions + zod only, no Prisma,
// no Node APIs, no "use server".

import { z } from "zod";

import { parseCsv } from "@/lib/csv";

// Cap per import so a giant paste can't tie up the server.
export const MAX_IMPORT_ROWS = 500;

export const REQUIRED_HEADERS = ["code", "title", "lecturer", "semester"] as const;

// Same field rules as the single-course create form (createCourseSchema in
// page.tsx), so a row imported in bulk is held to exactly the same standard as
// one typed in by hand. `lecturer` is the lecturer's email OR staff ID — the
// CSV can't carry the lecturer's internal database id, so we reference them by
// something an admin can actually type. Resolving it to a real lecturer is a
// DB lookup, so it can only happen on import (see bulkImportCourses), not here.
// `semester` is the Course.semester enum, required, UPPERCASE and case-sensitive.
export const courseRowSchema = z.object({
  code: z.string().min(3).max(20),
  title: z.string().min(3),
  lecturer: z.string().min(1),
  semester: z.enum(["HARMATTAN", "RAIN"], {
    errorMap: () => ({ message: "must be HARMATTAN or RAIN" }),
  }),
});
export type CourseRow = z.infer<typeof courseRowSchema>;

// The raw (pre-validation) cell values for a row, kept around so the preview
// table and the downloadable error report can show what the user actually typed.
export type RawCourseRow = {
  code: string;
  title: string;
  lecturer: string;
  semester: string;
};

export type CourseImportRowResult =
  | { rowNum: number; raw: RawCourseRow; valid: true; data: CourseRow }
  | { rowNum: number; raw: RawCourseRow; valid: false; error: string };

// A whole-file failure (bad header, empty, too many rows) OR a per-row breakdown.
export type CoursePreviewResult =
  | { ok: false; message: string }
  | {
      ok: true;
      rows: CourseImportRowResult[];
      validCount: number;
      errorCount: number;
    };

// The result of actually running an import: which courses were created and
// which rows were skipped (with a human-readable reason). `message` is set only
// for top-level failures (no file, bad header) where no rows were processed.
// Shared so the client card, the server action, and the import core all agree.
export type CourseImportState = {
  ok: boolean;
  message?: string;
  created: { code: string; title: string; lecturerName: string }[];
  skipped: { row: number; code: string; reason: string }[];
};

// Parse + validate a CSV string into a row-by-row preview. Detects:
//   - whole-file problems (empty, missing columns, too many rows)
//   - per-row schema failures (blank code, short title, missing lecturer)
//   - duplicate course codes *within the file* (the same code twice)
//
// What it CANNOT know: whether a course code already exists in the database, or
// whether the named lecturer actually exists. Those checks only happen on import
// (course-code clash → Prisma P2002; unknown lecturer → no match), so the caller
// should make clear those surface at the final step, not here.
export function buildCoursePreview(text: string): CoursePreviewResult {
  const rows = parseCsv(text).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) {
    return { ok: false, message: "The file is empty." };
  }

  // Map columns by header name so column order doesn't matter.
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {
    code: header.indexOf("code"),
    title: header.indexOf("title"),
    lecturer: header.indexOf("lecturer"),
    semester: header.indexOf("semester"),
  };
  const missing = REQUIRED_HEADERS.filter((h) => col[h] === -1);
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing column(s): ${missing.join(", ")}. Expected header: ${REQUIRED_HEADERS.join(",")}`,
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      message: `Too many rows (${dataRows.length}). Limit is ${MAX_IMPORT_ROWS} per import.`,
    };
  }

  const seenCodes = new Set<string>();
  const results: CourseImportRowResult[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2; // +1 for header, +1 for 1-based line numbers
    const cells = dataRows[i];
    const raw: RawCourseRow = {
      code: (cells[col.code] ?? "").trim(),
      title: (cells[col.title] ?? "").trim(),
      lecturer: (cells[col.lecturer] ?? "").trim(),
      // Not upper-cased on purpose: semester is case-sensitive, so "harmattan"
      // is rejected rather than silently accepted.
      semester: (cells[col.semester] ?? "").trim(),
    };

    const parsed = courseRowSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      results.push({
        rowNum,
        raw,
        valid: false,
        error: `invalid ${issue.path.join(".") || "row"}: ${issue.message}`,
      });
      errorCount++;
      continue;
    }

    const key = parsed.data.code.toLowerCase();
    if (seenCodes.has(key)) {
      results.push({ rowNum, raw, valid: false, error: "duplicate code in file" });
      errorCount++;
      continue;
    }
    seenCodes.add(key);

    results.push({ rowNum, raw, valid: true, data: parsed.data });
    validCount++;
  }

  return { ok: true, rows: results, validCount, errorCount };
}
