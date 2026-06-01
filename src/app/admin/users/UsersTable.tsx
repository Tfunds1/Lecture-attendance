"use client";

// The users table for /admin/users. Dense, with instant client-side search and
// a role filter over the already-loaded list (one institution's roster is
// small, so filtering in the browser beats a round-trip per keystroke). The
// list arrives pre-shaped and secret-free (no passwordHash) — `active` is
// derived server-side.
//
// Per-row actions live in a kebab menu. Delete uses the `deleteUser` server
// action passed in as a prop; admins and the signed-in user can't be deleted,
// so those rows show no menu.

import { useMemo, useRef, useState } from "react";
import type { Role } from "@/lib/roles";

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type RoleFilter = "ALL" | Role;

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
  const [menuId, setMenuId] = useState<string | null>(null);

  const hasAdmins = useMemo(() => users.some((u) => u.role === "ADMIN"), [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (q) {
        const hay = `${u.name} ${u.email} ${u.identifier ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, query, roleFilter]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Toolbar: search + role filter */}
      <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
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
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          aria-label="Filter by role"
          className="input sm:w-44"
        >
          <option value="ALL">All roles</option>
          <option value="LECTURER">Lecturers</option>
          <option value="STUDENT">Students</option>
          {hasAdmins && <option value="ADMIN">Admins</option>}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">ID</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="w-px px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-500">No users match your filters.</p>
                  {(query || roleFilter !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setRoleFilter("ALL");
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
                  <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-medium text-brand-700">
                          {initials(u.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-slate-900">{u.name}</span>
                            {isSelf && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">You</span>
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.identifier ? (
                        <span className="font-mono text-xs text-slate-600">{u.identifier}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {deletable && (
                        <RowMenu
                          open={menuId === u.id}
                          onToggle={() => setMenuId((cur) => (cur === u.id ? null : u.id))}
                          onClose={() => setMenuId(null)}
                        >
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <button
                              type="submit"
                              onClick={(e) => {
                                if (!confirm(`Delete ${u.name}? This can't be undone.`)) {
                                  e.preventDefault();
                                } else {
                                  setMenuId(null);
                                }
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              </svg>
                              Delete
                            </button>
                          </form>
                        </RowMenu>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        Showing <span className="tabular-nums text-slate-700">{filtered.length}</span> of{" "}
        <span className="tabular-nums text-slate-700">{users.length}</span> users
      </div>
    </div>
  );
}

// Kebab dropdown. The menu is rendered fixed-position (anchored to the trigger
// on open) so it isn't clipped by the table's horizontal-scroll container.
function RowMenu({
  open,
  onToggle,
  onClose,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  function toggle() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    onToggle();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      {open && (
        <>
          <button type="button" aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
          <div
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg animate-fade-in"
          >
            {children}
          </div>
        </>
      )}
    </>
  );
}
