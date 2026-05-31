// Helpers for the Course.semester enum (defined in prisma/schema.prisma). The
// `Semester` type itself comes from the generated Prisma client; this module
// adds the display labels and badge styling so the admin table, the dashboards,
// and the CSV import all render a semester the same way.

import type { Semester } from "@prisma/client";

export const SEMESTERS = ["HARMATTAN", "RAIN"] as const;

export const SEMESTER_LABELS: Record<Semester, string> = {
  HARMATTAN: "Harmattan",
  RAIN: "Rain",
};

// Badge tone per semester, using the existing `.badge` colour conventions
// (see globals.css): Harmattan in a neutral slate, Rain in sky blue.
export const SEMESTER_BADGE: Record<Semester, string> = {
  HARMATTAN: "bg-slate-100 text-slate-600",
  RAIN: "bg-sky-100 text-sky-700",
};
