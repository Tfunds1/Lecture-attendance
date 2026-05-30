// Shared CSV import logic — the single source of truth for "what counts as a
// valid import row". Imported by BOTH the client (BulkImportCard, for the live
// preview) and the server (bulkImportUsers, the authority that actually writes
// to the DB). Keeping it in one place means the preview a user sees can't drift
// from the rules the server enforces.
//
// This module must stay client-safe: pure functions + zod only, no Prisma,
// no Node APIs, no "use server".

import { z } from "zod";

// Cap per import so a giant paste can't tie up the server creating thousands of
// rows (each row does a DB write + an email send).
export const MAX_IMPORT_ROWS = 500;

export const REQUIRED_HEADERS = ["name", "email", "role", "identifier"] as const;

// Same field rules as the single-user create form, so a row imported in bulk is
// held to exactly the same standard as one typed in by hand.
export const userRowSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["LECTURER", "STUDENT"]),
  identifier: z.string().min(1), // matric number or staff ID
});
export type UserRow = z.infer<typeof userRowSchema>;

// The raw (pre-validation) cell values for a row, kept around so the preview
// table and the downloadable error report can show what the user actually typed.
export type RawRow = {
  name: string;
  email: string;
  role: string;
  identifier: string;
};

export type ImportRowResult =
  | { rowNum: number; raw: RawRow; valid: true; data: UserRow }
  | { rowNum: number; raw: RawRow; valid: false; error: string };

// A whole-file failure (bad header, empty, too many rows) OR a per-row breakdown.
export type PreviewResult =
  | { ok: false; message: string }
  | {
      ok: true;
      rows: ImportRowResult[];
      validCount: number;
      errorCount: number;
    };

// Minimal RFC-4180-ish CSV parser: handles quoted fields, commas and newlines
// inside quotes, and escaped double-quotes (""). Returns rows of string cells.
// Kept small and dependency-free so it's easy to explain — a real CSV (names
// like "Doe, Jane") parses correctly without pulling in a library.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  // Flush the final field/row when the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Parse + validate a CSV string into a row-by-row preview. Detects:
//   - whole-file problems (empty, missing columns, too many rows)
//   - per-row schema failures (blank name, bad email, unknown role, …)
//   - duplicate emails *within the file* (the same address twice)
//
// What it CANNOT know: whether an email/matric/staff ID already exists in the
// database. That uniqueness check only happens on import (Prisma P2002), so the
// caller should make clear those clashes surface at the final step, not here.
export function buildPreview(text: string): PreviewResult {
  const rows = parseCsv(text).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) {
    return { ok: false, message: "The file is empty." };
  }

  // Map columns by header name so column order doesn't matter.
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {
    name: header.indexOf("name"),
    email: header.indexOf("email"),
    role: header.indexOf("role"),
    identifier: header.indexOf("identifier"),
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

  const seenEmails = new Set<string>();
  const results: ImportRowResult[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2; // +1 for header, +1 for 1-based line numbers
    const cells = dataRows[i];
    const raw: RawRow = {
      name: (cells[col.name] ?? "").trim(),
      email: (cells[col.email] ?? "").trim(),
      role: (cells[col.role] ?? "").trim().toUpperCase(),
      identifier: (cells[col.identifier] ?? "").trim(),
    };

    const parsed = userRowSchema.safeParse(raw);
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

    const key = parsed.data.email.toLowerCase();
    if (seenEmails.has(key)) {
      results.push({ rowNum, raw, valid: false, error: "duplicate email in file" });
      errorCount++;
      continue;
    }
    seenEmails.add(key);

    results.push({ rowNum, raw, valid: true, data: parsed.data });
    validCount++;
  }

  return { ok: true, rows: results, validCount, errorCount };
}
