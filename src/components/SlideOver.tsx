// Right-hand slide-over drawer, shared by the admin create/import flows
// (/admin/users, /admin/courses).
//
// Deliberately stateless: it's opened and closed purely by the URL (a page
// renders it when ?panel=... is present; the close affordances are <Link>s
// back to the bare route). Driving it from the route — rather than client
// useState — means it closes correctly after a server action redirects, with
// no effect-syncing gymnastics. The backdrop and the ✕ both navigate to
// `closeHref`.

import Link from "next/link";

export function SlideOver({
  title,
  description,
  closeHref,
  children,
}: {
  title: string;
  description?: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop — clicking it closes the panel. */}
      <Link
        href={closeHref}
        aria-label="Close panel"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl animate-slide-in-right">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <Link
            href={closeHref}
            aria-label="Close"
            className="-mr-2.5 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
