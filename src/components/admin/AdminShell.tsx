"use client";

// Admin-only chrome: a fixed left sidebar on desktop that collapses to a
// hamburger-triggered drawer below the md breakpoint. Used solely by the admin
// layout — the lecturer/student shells still use AppShell, so this is additive
// and leaves them untouched.
//
// The sign-out server action is passed in from the (server) layout and rendered
// inside a plain <form>, so no auth logic lives here.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  LECTURER: "Lecturer",
  STUDENT: "Student",
};

const NAV = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/courses", label: "Courses", icon: CoursesIcon },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AdminShell({
  name,
  role,
  signOut,
  children,
}: {
  name: string;
  role: Role;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[200px] flex-col border-r border-slate-200 bg-slate-50 md:flex">
        <SidebarContent name={name} role={role} signOut={signOut} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="-mr-2.5 grid h-11 w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[240px] flex-col border-r border-slate-200 bg-slate-50 animate-slide-in-right">
            <SidebarContent
              name={name}
              role={role}
              signOut={signOut}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Content. No entrance animation here: an opacity animation forms a
          stacking context that would trap the URL-driven Sheet/Dialog overlays
          (rendered inside children) beneath the mobile nav bar. */}
      <main className="md:ml-[200px]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarContent({
  name,
  role,
  signOut,
  onNavigate,
}: {
  name: string;
  role: Role;
  signOut: () => Promise<void>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-16 items-center px-4">
        <Brand />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "border border-slate-200 bg-white font-medium text-slate-900 shadow-sm"
                  : "border border-transparent font-normal text-slate-500 hover:bg-white/70 hover:text-slate-800",
              ].join(" ")}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Profile row */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-medium text-brand-700">
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium text-slate-900">{name}</span>
            <span className="block text-xs text-slate-500">{ROLE_LABEL[role]}</span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-900 text-white">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3M20 20v.01M17 20v.01M20 17v.01" />
        </svg>
      </span>
      <span className="font-medium tracking-tight text-slate-900">Attendance</span>
    </Link>
  );
}

// --- Inline nav icons (lucide-style strokes, no dependency) ---------------

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CoursesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
