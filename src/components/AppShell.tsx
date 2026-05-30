// Shared chrome for all authenticated pages: a sticky top bar with brand,
// active-aware navigation, the user's avatar + role badge, and sign-out, plus
// a slim footer. Server component — receives the already-fetched session from
// the parent layout to avoid double auth lookups.

import Link from "next/link";
import { signOut } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { NavLink } from "@/components/NavLink";

type Props = {
  name: string;
  role: Role;
  nav: Array<{ href: string; label: string }>;
  children: React.ReactNode;
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  LECTURER: "Lecturer",
  STUDENT: "Student",
};

// Each role gets a distinct badge tint so the header reads at a glance.
const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-violet-100 text-violet-700",
  LECTURER: "bg-sky-100 text-sky-700",
  STUDENT: "bg-emerald-100 text-emerald-700",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({ name, role, nav, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm transition-transform group-hover:scale-105">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3M20 20v.01M17 20v.01M20 17v.01" />
                </svg>
              </span>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                Attendance
              </span>
            </Link>

            {/* Primary nav — hidden on narrow screens, shown in a second row */}
            <nav className="hidden md:flex items-center gap-1">
              {nav.map((n) => (
                <NavLink key={n.href} href={n.href} label={n.label} />
              ))}
            </nav>

            {/* User cluster */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-brand-100 text-brand-700 text-xs font-bold ring-1 ring-brand-200">
                  {initials(name)}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-slate-900">{name}</span>
                  <span className={`badge ${ROLE_BADGE[role]} mt-0.5`}>{ROLE_LABEL[role]}</span>
                </span>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="btn-ghost text-sm" type="submit">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
            </div>
          </div>

          {/* Mobile nav row */}
          <nav className="md:hidden flex items-center gap-1 overflow-x-auto pb-2 -mt-1">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href} label={n.label} />
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in-up">{children}</div>
      </main>

      <footer className="border-t border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>QR Lecture Attendance System</span>
          <span>© {new Date().getFullYear()} · All rights reserved</span>
        </div>
      </footer>
    </div>
  );
}
