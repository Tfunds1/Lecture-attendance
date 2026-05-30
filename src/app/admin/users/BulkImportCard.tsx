"use client";

// Bulk-import card for /admin/users — a three-step "validate, preview, confirm"
// flow that mirrors how production tools (Stripe, Mailchimp, Google Workspace)
// handle CSV import:
//
//   1. Upload   — drag/drop or pick a .csv (type + size checked client-side).
//   2. Preview  — we parse and validate the file IN THE BROWSER and show a
//                 per-row breakdown (ready vs error) before anything is written.
//                 Nothing hits the DB at this stage.
//   3. Done     — on confirm, the file is sent to the bulkImportUsers server
//                 action, which RE-validates with the same shared code and
//                 creates the valid rows, then we show the result summary.
//
// The parse/validate rules live in ./import-shared so the preview here can't
// drift from what the server enforces. We use useActionState (React 19) because
// the server result is richer than a redirect query string can carry.

import { useActionState, useEffect, useRef, useState } from "react";

import { buildPreview, type PreviewResult } from "./import-shared";

export type ImportState = {
  ok: boolean;
  // Set only for top-level failures (no file, bad header, file too big).
  message?: string;
  created: { name: string; email: string; setupUrl: string; emailSent: boolean }[];
  skipped: { row: number; email: string; reason: string }[];
};

export const emptyImportState: ImportState = { ok: false, created: [], skipped: [] };

// A ready-to-fill template, generated in the browser so we don't need a static
// asset or an extra route. The header row names must match what the server
// action looks for.
const TEMPLATE_CSV =
  "name,email,role,identifier\n" +
  "Jane Student,jane@example.com,STUDENT,CSC-2021-001\n" +
  "John Lecturer,john@example.com,LECTURER,STAFF-1023\n";

// Reject oversized files before we even read them — a multi-MB paste is almost
// always a wrong file, and parsing it would freeze the tab.
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

// Cap how many rows we render in the preview table (we still validate them all);
// keeps the DOM small for a 500-row import.
const PREVIEW_DISPLAY_LIMIT = 50;

export function BulkImportCard({
  action,
}: {
  action: (prev: ImportState, formData: FormData) => Promise<ImportState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyImportState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // "Import another file" dismisses a finished result; reset each time a fresh
  // server result arrives so the next import's summary still shows.
  const [dismissed, setDismissed] = useState(false);

  const done = state.created.length > 0 || state.skipped.length > 0;
  const showResult = done && !dismissed;

  // useActionState has no reset, so we key off `state` changing identity: a new
  // server result has arrived. Surface it (un-dismiss) and clear the working
  // file/preview so the card moves from step 2 (preview) to step 3 (summary).
  useEffect(() => {
    setDismissed(false);
    setPreview(null);
    setFileName(null);
    setFileSize(0);
    if (inputRef.current) inputRef.current.value = "";
  }, [state]);

  function downloadTemplate() {
    download(TEMPLATE_CSV, "users-template.csv");
  }

  // Put the chosen file into the hidden <input> so the form submits it exactly
  // as if it had been picked through the dialog. The input is the single source
  // of truth for the form; the state below is only for display/preview.
  function setFile(file: File | null) {
    if (inputRef.current) {
      const dt = new DataTransfer();
      if (file) dt.items.add(file);
      inputRef.current.files = dt.files;
    }
    setFileName(file?.name ?? null);
    setFileSize(file?.size ?? 0);
  }

  async function handleFile(file: File | null) {
    setFileError(null);
    setPreview(null);
    if (!file) {
      setFile(null);
      return;
    }
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setFile(null);
      setFileError("That doesn't look like a .csv file. Please choose a CSV.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError(`File is too large (${formatBytes(file.size)}). Max is 2 MB.`);
      return;
    }
    setFile(file);
    setPreview(buildPreview(await file.text()));
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setFileError(null);
  }

  function downloadErrors() {
    if (!preview?.ok) return;
    const rows = preview.rows.filter((r) => !r.valid);
    const csv =
      "row,name,email,role,identifier,error\n" +
      rows
        .map((r) =>
          [r.rowNum, r.raw.name, r.raw.email, r.raw.role, r.raw.identifier, r.valid ? "" : r.error]
            .map(csvCell)
            .join(","),
        )
        .join("\n");
    download(csv, "import-errors.csv");
  }

  const failedEmails = state.created.filter((c) => !c.emailSent);
  const currentStep = showResult ? 3 : preview ? 2 : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">Validate, preview, then import.</p>
        <button
          type="button"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
          onClick={downloadTemplate}
        >
          Download template
        </button>
      </div>

      <Steps current={currentStep} />

      <form action={formAction} className="mt-4">
        {/* Hidden input is the actual form field; the drop zone / preview drive it. */}
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        {/* STEP 3 — result summary (after an import has run). */}
        {showResult ? (
          <div className="space-y-3 text-sm">
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">
              Created <strong>{state.created.length}</strong> user(s).{" "}
              {state.skipped.length > 0 && (
                <>
                  Skipped <strong>{state.skipped.length}</strong> row(s) — see below.
                </>
              )}
            </div>

            {state.skipped.length > 0 && (
              <div>
                <h3 className="font-medium text-slate-700 mb-1">Skipped rows</h3>
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-1">Row</th>
                      <th>Email</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.skipped.map((s, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1 text-slate-500">{s.row}</td>
                        <td className="text-slate-600">{s.email}</td>
                        <td className="text-amber-700">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {failedEmails.length > 0 && (
              <div>
                <h3 className="font-medium text-slate-700 mb-1">
                  Email not sent — share these links manually
                </h3>
                <ul className="space-y-2">
                  {failedEmails.map((c, i) => (
                    <li key={i}>
                      <span className="text-slate-600">{c.email}</span>
                      <input
                        className="input mt-1 w-full font-mono text-xs"
                        value={c.setupUrl}
                        readOnly
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDismissed(true);
                clearFile();
              }}
            >
              Import another file
            </button>
          </div>
        ) : preview ? (
          /* STEP 2 — preview + confirm. */
          <div className="space-y-3">
            <FileChip name={fileName} size={fileSize} onRemove={clearFile} />

            {preview.ok === false ? (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {preview.message}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="badge bg-emerald-100 text-emerald-700">
                    ✓ {preview.validCount} ready
                  </span>
                  {preview.errorCount > 0 && (
                    <span className="badge bg-amber-100 text-amber-700">
                      ⚠ {preview.errorCount} error(s)
                    </span>
                  )}
                </div>

                <PreviewTable preview={preview} />

                <p className="text-xs text-slate-500">
                  Emails or IDs that already exist in the system can only be
                  detected during import — they&apos;ll appear as skipped rows
                  on the next step.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={pending || preview.validCount === 0}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-primary"
                  >
                    <DownloadIcon />
                    {pending
                      ? "Importing…"
                      : `Import ${preview.validCount} valid`}
                  </button>
                  {preview.errorCount > 0 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={downloadErrors}
                    >
                      Download errors
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* STEP 1 — drop zone. */
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition cursor-pointer ${
                dragActive
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <UploadIcon />
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">
                  Drag &amp; drop your CSV here
                </span>
                <br />
                or click to browse
              </p>
              <p className="text-xs text-slate-400">CSV · up to 2 MB</p>
            </div>
            {fileError && (
              <p className="mt-2 text-sm text-red-600">{fileError}</p>
            )}
          </>
        )}
      </form>

      <p className="text-xs text-slate-500 mt-3">
        Columns: <code>name</code>, <code>email</code>, <code>role</code>{" "}
        (STUDENT or LECTURER), <code>identifier</code> (matric / staff ID). Each
        created user is emailed their setup link.
      </p>

      {/* Top-level server error with no rows processed (e.g. file changed between
          preview and submit). Row-level outcomes render in the step-3 summary. */}
      {state.message && !showResult && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: number }) {
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

function FileChip({
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

function PreviewTable({
  preview,
}: {
  preview: Extract<PreviewResult, { ok: true }>;
}) {
  const shown = preview.rows.slice(0, PREVIEW_DISPLAY_LIMIT);
  const hidden = preview.rows.length - shown.length;
  return (
    <div className="overflow-hidden rounded border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="w-8 py-1.5 pl-2"></th>
            <th className="py-1.5">Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr
              key={r.rowNum}
              className={`border-t border-slate-100 ${r.valid ? "" : "bg-red-50"}`}
            >
              <td className="py-1.5 pl-2">
                {r.valid ? (
                  <span className="text-emerald-600" aria-label="ready">
                    ✓
                  </span>
                ) : (
                  <span className="text-red-500" aria-label="error">
                    ✗
                  </span>
                )}
              </td>
              <td className="py-1.5 text-slate-700">{r.raw.name || "—"}</td>
              <td className="text-slate-600">{r.raw.email || "—"}</td>
              <td className="text-slate-600">{r.raw.role || "—"}</td>
              <td className={r.valid ? "text-slate-400" : "text-red-600"}>
                {r.valid ? "Ready" : r.error}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <div className="bg-slate-50 px-2 py-1.5 text-[11px] text-slate-400">
          + {hidden} more row(s) not shown (all {preview.rows.length} were validated)
        </div>
      )}
    </div>
  );
}

// ---- small helpers -------------------------------------------------------

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Quote a cell for the error-report CSV if it contains a comma, quote, or newline.
function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Download/import glyph in the confirm button. Inline so we don't pull in an
// icon dependency (matches the approach used on the login page).
function DownloadIcon() {
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

function UploadIcon() {
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
