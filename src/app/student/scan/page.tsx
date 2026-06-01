// Wrapper page for the scanner client component. Splitting them out lets
// the page itself stay server-rendered (and benefit from layout caching),
// while the camera/scanner runs purely on the client.

import { Scanner } from "./Scanner";

export default function ScanPage() {
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="page-title">Scan attendance QR</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Point your phone camera at the QR code your lecturer is showing.
        </p>
      </div>
      <div className="card p-5">
        <Scanner />
      </div>
    </div>
  );
}
