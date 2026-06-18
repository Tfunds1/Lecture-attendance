// Root 403 boundary. Next renders this whenever a page calls forbidden()
// (enabled by experimental.authInterrupts in next.config.mjs). Today that's a
// lecturer opening a course they don't teach — see
// app/lecturer/courses/[id]/students/page.tsx. Kept on the same restrained
// card/slate design as the rest of the app.

import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <h1 className="mt-4 text-xl font-medium tracking-tight text-slate-900">
          403 — Access denied
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          You don't have permission to view this page. It may belong to another lecturer.
        </p>
        <Link href="/lecturer" className="btn-primary mt-5 text-sm">
          Back to my courses
        </Link>
      </div>
    </div>
  );
}
