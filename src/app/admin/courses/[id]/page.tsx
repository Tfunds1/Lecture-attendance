// Admin per-course page: manage enrollments (add / remove students).

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { EnrollStudentsForm } from "./EnrollStudentsForm";

async function enrollStudents(courseId: string, formData: FormData) {
  "use server";
  const ids = formData.getAll("studentId").map(String).filter(Boolean);
  if (ids.length === 0) return;

  // Trust nothing from the form: keep only ids that really are students. This
  // drops any tampered or stale id rather than creating a bogus enrollment.
  const valid = await db.user.findMany({
    where: { id: { in: ids }, role: "STUDENT" },
    select: { id: true },
  });
  if (valid.length === 0) return;

  // One insert; skipDuplicates makes a re-submit of an already-enrolled student
  // a no-op instead of a unique-constraint error.
  await db.enrollment.createMany({
    data: valid.map((s) => ({ studentId: s.id, courseId })),
    skipDuplicates: true,
  });
  revalidatePath(`/admin/courses/${courseId}`);
}

async function unenrollStudent(courseId: string, studentId: string) {
  "use server";
  await db.enrollment.delete({
    where: { studentId_courseId: { studentId, courseId } },
  });
  revalidatePath(`/admin/courses/${courseId}`);
}

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      lecturer: true,
      enrollments: { include: { student: true } },
    },
  });
  if (!course) return notFound();

  const enrolledIds = new Set(course.enrollments.map((e) => e.studentId));
  const availableStudents = await db.user.findMany({
    where: { role: "STUDENT", id: { notIn: Array.from(enrolledIds) } },
    orderBy: { name: "asc" },
  });

  const enrollBound = enrollStudents.bind(null, id);

  // Plain, secret-free shape for the client multi-select.
  const studentOptions = availableStudents.map((s) => ({
    id: s.id,
    name: s.name,
    matricNumber: s.matricNumber,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {course.code} — {course.title}
        </h1>
        <p className="text-slate-500 text-sm">
          Lecturer: {course.lecturer.name}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">
            Enrolled students ({course.enrollments.length})
          </h2>
          {course.enrollments.length === 0 ? (
            <p className="text-sm text-slate-500">No students enrolled yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {course.enrollments.map((e) => (
                <li
                  key={e.studentId}
                  className="py-2 flex justify-between items-center"
                >
                  <span className="text-sm">
                    {e.student.name}{" "}
                    <span className="text-slate-500">
                      ({e.student.matricNumber})
                    </span>
                  </span>
                  <form action={unenrollStudent.bind(null, id, e.studentId)}>
                    <button className="text-red-600 text-xs hover:underline">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-3">Enroll students</h2>
          {availableStudents.length === 0 ? (
            <p className="text-sm text-slate-500">
              All students are already enrolled.
            </p>
          ) : (
            <EnrollStudentsForm enrollStudents={enrollBound} students={studentOptions} />
          )}
        </div>
      </div>
    </div>
  );
}
