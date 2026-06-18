"use server";

// Server actions for lecturer-managed enrolment. A lecturer may add or remove
// students, but only in a course they actually teach. The middleware already
// keeps non-lecturers off /lecturer/*; these actions add the second belt — they
// re-check ownership server-side so a lecturer can't manage someone else's
// course even by POSTing straight to the action with a guessed course id.
//
// Mirrors the admin enrolment flow (see src/app/admin/courses/[id]/page.tsx)
// rather than inventing a new shape: same Enrollment table, same validation
// idea. Unlike admins, lecturers cannot create accounts, edit students, or
// touch courses they don't own.

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Specific error keys so the client can show a precise message instead of a
// generic failure. Returned (never thrown) for the "expected" failures.
export type EnrolError =
  | "unauthorized" // not signed in, or not a lecturer
  | "forbidden" // a lecturer, but doesn't teach this course
  | "student_invalid" // id doesn't resolve to an enrollable STUDENT
  | "already_enrolled";

export type RemoveError =
  | "unauthorized"
  | "forbidden"
  | "not_enrolled"; // no enrolment link to remove

export type ActionResult<E> = { ok: true } | { ok: false; error: E };

// Shared gate run first by both actions: the caller must be a LECTURER who owns
// `courseId`. An unknown course and someone else's course both return
// "forbidden" — not distinguishing them stops a lecturer probing which course
// ids exist.
async function requireCourseOwner(
  courseId: string,
): Promise<ActionResult<"unauthorized" | "forbidden">> {
  const session = await auth();
  if (!session?.user || session.user.role !== "LECTURER") {
    return { ok: false, error: "unauthorized" };
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { lecturerId: true },
  });
  if (!course || course.lecturerId !== session.user.id) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: true };
}

// Refresh every surface that shows this course's student count / roster.
function revalidateCourse(courseId: string) {
  revalidatePath(`/lecturer/courses/${courseId}/students`);
  revalidatePath(`/lecturer/courses/${courseId}`);
  revalidatePath("/lecturer");
}

export async function enrolStudentInCourse(
  courseId: string,
  studentId: string,
): Promise<ActionResult<EnrolError>> {
  const gate = await requireCourseOwner(courseId);
  if (!gate.ok) return gate;

  // The target must be a real STUDENT account. (The schema has no soft-delete
  // column — deletion is a hard delete with cascades, see prisma/schema.prisma
  // User — so role is the only check that applies here.)
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { role: true },
  });
  if (!student || student.role !== "STUDENT") {
    return { ok: false, error: "student_invalid" };
  }

  try {
    await db.enrollment.create({ data: { studentId, courseId } });
  } catch (err) {
    // Composite PK (studentId, courseId) already exists — the student is
    // enrolled. Report it rather than crashing on the unique-constraint error.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { ok: false, error: "already_enrolled" };
    }
    throw err;
  }

  revalidateCourse(courseId);
  return { ok: true };
}

export async function removeStudentFromCourse(
  courseId: string,
  studentId: string,
): Promise<ActionResult<RemoveError>> {
  const gate = await requireCourseOwner(courseId);
  if (!gate.ok) return gate;

  try {
    await db.enrollment.delete({
      where: { studentId_courseId: { studentId, courseId } },
    });
  } catch (err) {
    // Nothing to delete — already removed, or never enrolled.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { ok: false, error: "not_enrolled" };
    }
    throw err;
  }

  // We delete ONLY the Enrollment link. The student's Attendance rows for this
  // course's past sessions are left untouched — un-enrolling someone shouldn't
  // rewrite attendance history.
  revalidateCourse(courseId);
  return { ok: true };
}
