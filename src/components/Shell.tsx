"use client";

// The single application shell for every authenticated role (admin, lecturer,
// student). A fixed left sidebar on desktop that collapses to a hamburger
// drawer below the md breakpoint. Each layout passes its own nav items and a
// sign-out server action, so all three roles share one cohesive chrome.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  LECTURER: "Lecturer",
  STUDENT: "Student",
};

export type IconName = "dashboard" | "users" | "courses" | "scan" | "code";
export type NavItem = { href: string; label: string; icon: IconName };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Shell({
  name,
  role,
  nav,
  signOut,
  children,
}: {
  name: string;
  role: Role;
  nav: NavItem[];
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-slate-200 bg-[#00044B] md:flex">
        <SidebarContent name={name} role={role} nav={nav} signOut={signOut} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-[#00044B] px-4 md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="-mr-2.5 grid h-11 w-11 place-items-center rounded-lg text-white hover:bg-slate-900"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-white/10 bg-[#00044B] animate-slide-in-right">
            <SidebarContent
              name={name}
              role={role}
              nav={nav}
              signOut={signOut}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="md:ml-[220px]">
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
  nav,
  signOut,
  onNavigate,
}: {
  name: string;
  role: Role;
  nav: NavItem[];
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
        {nav.map((item) => {
          // A one-segment href (/admin, /lecturer, /student) is a role home and
          // matches exactly; deeper items also light up on their detail pages.
          const isHome = item.href.split("/").filter(Boolean).length <= 1;
          const active = isHome
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
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
              <NavIcon
                name={item.icon}
                className="h-[18px] w-[18px] shrink-0"
              />
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
            <span className="block truncate text-[13px] font-medium text-white">
              {name}
            </span>
            <span className="block text-xs text-slate-500">
              {ROLE_LABEL[role]}
            </span>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-slate-700 "
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-900 text-white">
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3M20 20v.01M17 20v.01M20 17v.01" />
        </svg>
      </span>
      <span className="font-medium tracking-tight text-white">Attendance</span>
    </Link>
  );
}

// --- Inline nav icons (lucide-style strokes, no dependency) ---------------

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "courses":
      return (
        <svg {...common}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case "scan":
      return (
        <svg {...common}>
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
          <rect x="7" y="7" width="10" height="10" rx="1" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
        </svg>
      );
  }
}
