// Admin per-course page: manage enrollments (add / remove students).

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

async function enrollStudent(courseId: string, formData: FormData) {
  "use server";
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) return;
  await db.enrollment.upsert({
    where: { studentId_courseId: { studentId, courseId } },
    create: { studentId, courseId },
    update: {},
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

  const enrollBound = enrollStudent.bind(null, id);

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
          <h2 className="font-semibold mb-3">Enroll a student</h2>
          {availableStudents.length === 0 ? (
            <p className="text-sm text-slate-500">
              All students are already enrolled.
            </p>
          ) : (
            <form action={enrollBound} className="space-y-3">
              <select name="studentId" className="input" required>
                <option value="">Select a student…</option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.matricNumber})
                  </option>
                ))}
              </select>
              <button className="btn-primary w-full" type="submit">
                Enroll
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
