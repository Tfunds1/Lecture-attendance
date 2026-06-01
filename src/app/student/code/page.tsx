// Wrapper page for the short-code entry client component. Same shape as
// /student/scan/page.tsx so the routing and layout caching stay symmetric.

import { CodeEntry } from "./CodeEntry";

export default function CodeEntryPage() {
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="page-title">Enter attendance code</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Your lecturer will announce or display a six-character code.
        </p>
      </div>
      <div className="card p-5">
        <CodeEntry />
      </div>
    </div>
  );
}
