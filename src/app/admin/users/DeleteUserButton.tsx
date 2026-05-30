"use client";

// Delete button for a single user row. Lives inside a <form action={deleteUser}>
// in the parent server component, so it just needs to (a) confirm the intent
// before the form submits and (b) show a pending state while the server action
// runs. useFormStatus reads the status of the enclosing form.

import { useFormStatus } from "react-dom";

export function DeleteUserButton({ name }: { name: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Delete ${name}`}
      title={`Delete ${name}`}
      className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-100 group-hover:opacity-100"
      onClick={(e) => {
        if (
          !confirm(
            `Delete ${name}? This also removes their setup link, enrollments, ` +
              `and attendance records. This can't be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
        </svg>
      )}
    </button>
  );
}
