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
        <Link href="/admin/courses?panel=new" className="btn-primary text-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add course
        </Link>
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
    </div>
  );
}
