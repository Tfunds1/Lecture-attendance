"use client";

// Field-agnostic UI shared by the bulk-import cards (users, courses, …). These
// pieces — the step indicator, the file chip, the upload/download glyphs, and a
// few small helpers — don't know or care what's being imported, so they live
// here instead of being copied into each card. Anything that depends on the
// columns of a particular import (the preview table, the result summary, the
// template) stays in that import's own card.

// Reject oversized files before we even read them — a multi-MB paste is almost
// always a wrong file, and parsing it would freeze the tab.
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

// Cap how many rows we render in the preview table (we still validate them all);
// keeps the DOM small for a 500-row import.
export const PREVIEW_DISPLAY_LIMIT = 50;

export function Steps({ current }: { current: number }) {
  const labels = ["Upload", "Preview", "Done"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const complete = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                active
                  ? "bg-brand-600 text-white"
                  : complete
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {complete ? "✓" : step}
            </span>
            <span className={active ? "font-medium text-slate-700" : "text-slate-400"}>
              {label}
            </span>
            {step < labels.length && <span className="text-slate-300">—</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function FileChip({
  name,
  size,
  onRemove,
}: {
  name: string | null;
  size: number;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
      <span className="text-slate-700">{name}</span>
      <span className="text-slate-400">({formatBytes(size)})</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove file"
        className="text-slate-400 hover:text-slate-600"
      >
        ✕
      </button>
    </div>
  );
}

// Trigger a client-side download of generated CSV text (template / error report).
export function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Quote a cell for a generated CSV if it contains a comma, quote, or newline.
export function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Download/import glyph in the confirm button. Inline so we don't pull in an
// icon dependency (matches the approach used elsewhere in the app).
export function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mr-2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-slate-400"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
