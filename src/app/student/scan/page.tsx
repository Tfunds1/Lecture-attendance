// Wrapper page for the scanner client component. Splitting them out lets
// the page itself stay server-rendered (and benefit from layout caching),
// while the camera/scanner runs purely on the client.

import { Scanner } from "./Scanner";

export default function ScanPage() {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="page-title">Scan attendance QR</h1>
        <p className="text-sm text-slate-500 mt-1">
          Point your phone camera at the QR code your lecturer is showing.
        </p>
      </div>
      <Scanner />
    </div>
  );
}
