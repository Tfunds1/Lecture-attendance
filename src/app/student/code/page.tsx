// Wrapper page for the short-code entry client component. Same shape as
// /student/scan/page.tsx so the routing and layout caching stay symmetric.

import { CodeEntry } from "./CodeEntry";

export default function CodeEntryPage() {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Enter attendance code</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your lecturer will announce or display a six-character code.
        </p>
      </div>
      <CodeEntry />
    </div>
  );
}
