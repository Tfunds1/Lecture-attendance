"use client";

// The "Add course" form body, rendered inside the slide-over. A course needs a
// lecturer, so if none exist yet we don't show an unusable form — we point the
// admin to create a lecturer first. The create itself is the `createCourse`
// server action passed in as a prop; on success it redirects, closing the panel.

import Link from "next/link";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Creating…" : "Create course"}
    </button>
  );
}

export function AddCourseForm({
  createCourse,
  lecturers,
}: {
  createCourse: (formData: FormData) => Promise<void>;
  lecturers: { id: string; name: string }[];
}) {
  if (lecturers.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">No lecturers yet</p>
        <p className="mt-1 text-amber-700">
          A course must be assigned to a lecturer. Add a lecturer account first,
          then come back to create the course.
        </p>
        <Link
          href="/admin/users?panel=new"
          className="mt-3 inline-flex items-center gap-1 font-medium text-amber-900 hover:underline"
        >
          Add a lecturer
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </Link>
      </div>
    );
  }

  return (
    <form action={createCourse} className="space-y-4">
      <div>
        <label className="label" htmlFor="course-code">Course code</label>
        <input id="course-code" name="code" className="input font-mono" placeholder="CSC401" required autoFocus />
      </div>

      <div>
        <label className="label" htmlFor="course-title">Title</label>
        <input id="course-title" name="title" className="input" placeholder="Software Engineering" required />
      </div>

      <div>
        <label className="label" htmlFor="course-lecturer">Lecturer</label>
        <select id="course-lecturer" name="lecturerId" className="input" defaultValue="" required>
          <option value="" disabled>Select a lecturer…</option>
          {lecturers.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <SubmitButton />

      <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        Students are enrolled afterwards from the course&apos;s management page.
      </p>
    </form>
  );
}
