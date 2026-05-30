// Landing page. Middleware redirects logged-in users away from here, so this
// is only ever seen by anonymous visitors.

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Lecture Attendance
        </h1>
        <p className="mt-3 text-slate-600">
          A QR-based attendance system for lectures. Lecturers display a rotating QR code;
          students scan with their phone to mark themselves present.
        </p>
        <Link href="/login" className="btn-primary mt-8 inline-block">
          Sign in
        </Link>
      </div>
    </main>
  );
}
