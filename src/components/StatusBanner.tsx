// Inline, dismissible status banner used after admin server actions
// (created / deleted / error). The ✕ is a <Link> back to the bare route,
// which drops the success/error query params on a fresh server render — so
// "dismiss" needs no client state.

import Link from "next/link";

export function StatusBanner({
  tone,
  closeHref,
  children,
}: {
  tone: "success" | "error";
  closeHref: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${styles}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tone === "success" ? (
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" />
        ) : (
          <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        )}
      </svg>
      <div className="flex-1">{children}</div>
      <Link href={closeHref} aria-label="Dismiss" className="-mr-1 -mt-1 shrink-0 rounded-md p-1 hover:bg-black/5">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </Link>
    </div>
  );
}
