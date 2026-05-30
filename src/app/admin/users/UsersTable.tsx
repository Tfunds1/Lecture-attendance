"use client";

// The users table — the centerpiece of /admin/users.
//
// A dense, Linear/Stripe-style table with instant client-side search, role
// filter tabs (carrying live counts), and a status filter. All filtering runs
// in the browser over the already-loaded list: the dataset is small (one
// institution's staff + students) and instant filtering feels far better than
// a server round-trip per keystroke. The list arrives pre-shaped and free of
// any secret fields (no passwordHash) — `active` is derived server-side.
//
// Row deletion uses the `deleteUser` server action passed in as a prop; the
// trash control (DeleteUserButton) reveals on row hover. Admins and the
// signed-in user can't be deleted, so those rows show no action.

import { useMemo, useState } from "react";
import type { Role } from "@/lib/roles";
import { DeleteUserButton } from "./DeleteUserButton";

export type UserRowVM = {
  id: string;
  name: string;
  email: string;
  role: Role;
  identifier: string | null;
  active: boolean;
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  LECTURER: "Lecturer",
  STUDENT: "Student",
};

// Muted, ringed badges — colour-coded by role but low-saturation so the table
// reads as data, not decoration.
const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  LECTURER: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  STUDENT: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
};

const AVATAR_TINT: Record<Role, string> = {
  ADMIN: "bg-violet-100 text-violet-700 ring-violet-200",
  LECTURER: "bg-sky-100 text-sky-700 ring-sky-200",
  STUDENT: "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type RoleFilter = "ALL" | Role;
type StatusFilter = "ALL" | "ACTIVE" | "PENDING";

export function UsersTable({
  users,
  currentUserId,
  deleteUser,
}: {
  users: UserRowVM[];
  currentUserId?: string;
  deleteUser: (formData: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const counts = useMemo(() => {
    const c = { ALL: users.length, ADMIN: 0, LECTURER: 0, STUDENT: 0 };
    for (const u of users) c[u.role]++;
    return c;
  }, [users]);

  const tabs = useMemo(() => {
    const base: { key: RoleFilter; label: string; count: number }[] = [
      { key: "ALL", label: "All", count: counts.ALL },
      { key: "LECTURER", label: "Lecturers", count: counts.LECTURER },
      { key: "STUDENT", label: "Students", count: counts.STUDENT },
    ];
    if (counts.ADMIN > 0)
      base.push({ key: "ADMIN", label: "Admins", count: counts.ADMIN });
    return base;
  }, [counts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !u.active) return false;
      if (statusFilter === "PENDING" && u.active) return false;
      if (q) {
        const hay = `${u.name} ${u.email} ${u.identifier ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, query, roleFilter, statusFilter]);

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:max-w-xs lg:flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or ID…"
            className="input pl-9"
            aria-label="Search users"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role tabs */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
            {tabs.map((t) => {
              const active = roleFilter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setRoleFilter(t.key)}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-xs tabular-nums ${active ? "text-slate-400" : "text-slate-400"}`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-semibold">User</th>
              <th className="px-4 py-2.5 font-semibold">Role</th>
              <th className="px-4 py-2.5 font-semibold">ID</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="w-px px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-500">No users match your filters.</p>
                  {(query || roleFilter !== "ALL" || statusFilter !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setRoleFilter("ALL");
                        setStatusFilter("ALL");
                      }}
                      className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const isSelf = u.id === currentUserId;
                const deletable = u.role !== "ADMIN" && !isSelf;
                return (
                  <tr key={u.id} className="group transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 ${AVATAR_TINT[u.role]}`}>
                          {initials(u.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-slate-900">{u.name}</span>
                            {isSelf && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">You</span>
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {u.identifier ? (
                        <span className="font-mono text-xs text-slate-600">{u.identifier}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deletable ? (
                        <form action={deleteUser} className="inline">
                          <input type="hidden" name="id" value={u.id} />
                          <DeleteUserButton name={u.name} />
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700 tabular-nums">{filtered.length}</span> of{" "}
        <span className="font-medium text-slate-700 tabular-nums">{users.length}</span> users
      </div>
    </div>
  );
}
