"use client";

// The "Add user" form body, rendered inside the slide-over. Client-side only so
// the identifier field can relabel itself (Matric number vs Staff ID) as the
// role changes — a small affordance that prevents the most common data-entry
// mistake. The actual create is the `createUser` server action passed in as a
// prop; on success it redirects, which closes the slide-over for us.

import { useState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Creating…" : "Create user"}
    </button>
  );
}

export function AddUserForm({
  createUser,
}: {
  createUser: (formData: FormData) => Promise<void>;
}) {
  const [role, setRole] = useState<"STUDENT" | "LECTURER">("STUDENT");
  const idLabel = role === "STUDENT" ? "Matric number" : "Staff ID";
  const idPlaceholder = role === "STUDENT" ? "e.g. CSC/2021/001" : "e.g. STAFF-1023";

  return (
    <form action={createUser} className="space-y-4">
      <div>
        <label className="label" htmlFor="add-name">Full name</label>
        <input id="add-name" name="name" className="input" required autoFocus />
      </div>

      <div>
        <label className="label" htmlFor="add-email">Email</label>
        <input id="add-email" name="email" type="email" className="input" required placeholder="name@university.edu" />
      </div>

      <div>
        <label className="label" htmlFor="add-role">Role</label>
        <select
          id="add-role"
          name="role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as "STUDENT" | "LECTURER")}
          required
        >
          <option value="STUDENT">Student</option>
          <option value="LECTURER">Lecturer</option>
        </select>
      </div>

      <div>
        <label className="label" htmlFor="add-identifier">{idLabel}</label>
        <input id="add-identifier" name="identifier" className="input" required placeholder={idPlaceholder} />
      </div>

      <SubmitButton />

      <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        No password is set here. We email the user a one-time setup link (valid 7
        days) and also show it to you as a fallback.
      </p>
    </form>
  );
}
