// Admin /courses — list courses, add new ones, and jump to per-course
// enrollment management.

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { SlideOver } from "@/components/SlideOver";
import { StatusBanner } from "@/components/StatusBanner";
import { CoursesTable, type CourseRowVM } from "./CoursesTable";
import { AddCourseForm } from "./AddCourseForm";
import { CourseBulkImportCard } from "./CourseBulkImportCard";
import type { CourseImportState } from "./import-shared";
import { importCoursesFromCsv } from "./import-server";

const createCourseSchema = z.object({
  code: z.string().min(3).max(20),
  title: z.string().min(3),
  lecturerId: z.string().min(1),
});

async function createCourse(formData: FormData) {
  "use server";
  const parsed = createCourseSchema.safeParse({
    code: formData.get("code"),
    title: formData.get("title"),
    lecturerId: formData.get("lecturerId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  // Course.code is unique. Catch the clash (Prisma P2002) and surface a
  // readable message instead of leaking the raw constraint error.
  let duplicate = false;
  try {
    await db.course.create({ data: parsed.data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      duplicate = true;
    } else {
      throw err;
    }
  }

  if (duplicate) {
    redirect(
      "/admin/courses?error=" +
        encodeURIComponent(`A course with code "${parsed.data.code}" already exists.`),
    );
  }

  revalidatePath("/admin/courses");
  redirect("/admin/courses?created=" + encodeURIComponent(parsed.data.code));
}

async function bulkImportCourses(
  _prev: CourseImportState,
  formData: FormData,
): Promise<CourseImportState> {
  "use server";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Please choose a CSV file.", created: [], skipped: [] };
  }

  // All validation + DB work lives in importCoursesFromCsv (import-server.ts) so
  // it stays unit-testable; this action just feeds it the file and refreshes the
  // list when something was created.
  const result = await importCoursesFromCsv(await file.text());
  if (result.created.length > 0) revalidatePath("/admin/courses");
  return result;
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string; panel?: string }>;
}) {
  const { created, error, panel } = await searchParams;

  const [rawCourses, lecturers] = await Promise.all([
    db.course.findMany({
      include: {
        lecturer: { select: { name: true } },
        _count: { select: { enrollments: true, sessions: true } },
      },
      orderBy: { code: "asc" },
    }),
    db.user.findMany({
      where: { role: "LECTURER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const courses: CourseRowVM[] = rawCourses.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    lecturerName: c.lecturer.name,
    students: c._count.enrollments,
    sessions: c._count.sessions,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create courses, assign lecturers, and manage enrollments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/courses?panel=import" className="btn-ghost text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Import CSV
          </Link>
          <Link href="/admin/courses?panel=new" className="btn-primary text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add course
          </Link>
        </div>
      </div>

      {/* Status banners — dismiss by navigating back to the clean URL. */}
      {created && (
        <StatusBanner tone="success" closeHref="/admin/courses">
          Created course <strong>{created}</strong>. Enroll students from its management page.
        </StatusBanner>
      )}
      {error && (
        <StatusBanner tone="error" closeHref="/admin/courses">
          {error}
        </StatusBanner>
      )}

      <CoursesTable courses={courses} />

      {/* URL-driven slide-over */}
      {panel === "new" && (
        <SlideOver
          title="Add course"
          description="Create a course and assign its lecturer."
          closeHref="/admin/courses"
        >
          <AddCourseForm createCourse={createCourse} lecturers={lecturers} />
        </SlideOver>
      )}
      {panel === "import" && (
        <SlideOver
          title="Import courses from CSV"
          description="Create many courses at once."
          closeHref="/admin/courses"
        >
          <CourseBulkImportCard action={bulkImportCourses} />
        </SlideOver>
      )}
    </div>
  );
}
