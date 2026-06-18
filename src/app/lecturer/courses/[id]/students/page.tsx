// Lecturer course-students page: view the enrolled roster with each student's
// attendance for THIS course, and add / remove students.
//
// Authorization is belt-and-braces: middleware already keeps non-lecturers off
// /lecturer/*, but we ALSO confirm Course.lecturerId === session.user.id here
// before rendering anything. A lecturer who guesses another lecturer's course
// id gets a real 403 (forbidden()), never the data.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { forbidden, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBanner } from "@/components/StatusBanner";
import { Dialog } from "@/components/Dialog";
import { StudentsTable, type StudentRowVM } from "./StudentsTable";
import { AddStudentList, type AvailableStudent } from "./AddStudentList";
import { enrolStudentInCourse, removeStudentFromCourse } from "./actions";

export default async function LecturerCourseStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    panel?: string;
    enrolled?: string;
    removed?: string;
    error?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) return null; // middleware should prevent this
  const { id } = await params;
  const { panel, enrolled, removed, error } = await searchParams;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: {
          student: { select: { id: true, name: true, matricNumber: true } },
        },
        orderBy: { student: { name: "asc" } },
      },
      // Ids only — used to count total sessions and scope the attendance query.
      sessions: { select: { id: true } },
    },
  });
  if (!course) notFound();
  if (course.lecturerId !== session.user.id) forbidden();

  const sessionIds = course.sessions.map((s) => s.id);
  const totalSessions = sessionIds.length;

  // One grouped query for attended-counts, keyed by student — avoids an N+1
  // over the roster. A student with no attendance simply isn't in the result.
  const attendedByStudent = new Map<string, number>();
  if (sessionIds.length > 0) {
    const groups = await db.attendance.groupBy({
      by: ["studentId"],
      where: { sessionId: { in: sessionIds } },
      _count: { _all: true },
    });
    for (const g of groups) attendedByStudent.set(g.studentId, g._count._all);
  }

  const students: StudentRowVM[] = course.enrollments.map((e) => {
    const attended = attendedByStudent.get(e.studentId) ?? 0;
    return {
      id: e.student.id,
      name: e.student.name,
      matricNumber: e.student.matricNumber,
      attended,
      total: totalSessions,
      pct: totalSessions === 0 ? 0 : Math.round((attended / totalSessions) * 100),
    };
  });

  // Available to add = every STUDENT not already enrolled (mirrors the admin
  // panel). Already-enrolled students are excluded so they can't appear twice.
  const enrolledIds = course.enrollments.map((e) => e.studentId);
  const availableStudents: AvailableStudent[] = await db.user.findMany({
    where: { role: "STUDENT", id: { notIn: enrolledIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, matricNumber: true },
  });

  const base = `/lecturer/courses/${id}/students`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/lecturer/courses/${id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to {course.code}
        </Link>
        <PageHeader
          title={`Students in ${course.code}`}
          subtitle={`${students.length} enrolled · view attendance and manage enrolment`}
          actions={
            <Link href={`${base}?panel=add`} className="btn-primary text-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Add student
            </Link>
          }
        />
      </div>

      {/* Toast banners — dismiss by navigating back to the clean URL. */}
      {enrolled && (
        <StatusBanner tone="success" closeHref={base}>
          Enrolled <strong>{enrolled}</strong> in {course.code}.
        </StatusBanner>
      )}
      {removed && (
        <StatusBanner tone="success" closeHref={base}>
          Removed <strong>{removed}</strong> from {course.code}. Their attendance history was kept.
        </StatusBanner>
      )}
      {error && (
        <StatusBanner tone="error" closeHref={base}>
          {error}
        </StatusBanner>
      )}

      <StudentsTable
        courseId={id}
        courseCode={course.code}
        students={students}
        removeStudent={removeStudentFromCourse}
      />

      {/* URL-driven dialog, same pattern as the admin create flows. */}
      {panel === "add" && (
        <Dialog
          title="Add student"
          description={`Enrol a student in ${course.code}.`}
          closeHref={base}
        >
          <AddStudentList
            courseId={id}
            students={availableStudents}
            enrolStudent={enrolStudentInCourse}
          />
        </Dialog>
      )}
    </div>
  );
}
