// Centered modal dialog, used for the admin create flows (Add user / Add
// course). Like SlideOver it's deliberately stateless and URL-driven: a page
// renders it when ?panel=... is present, and every close affordance is a <Link>
// back to the bare route. Driving it from the URL means it closes correctly
// after a server action redirects, with no client state to sync.

import Link from "next/link";

export function Dialog({
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      {/* Backdrop — clicking it closes the dialog. */}
      <Link
        href={closeHref}
        aria-label="Close dialog"
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in"
      />

      <div className="relative z-10 my-auto w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl animate-fade-in-up">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-medium text-slate-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>
            )}
          </div>
          <Link
            href={closeHref}
            aria-label="Close"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Link>
        </div>

        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
