// A small, restrained health indicator shown in the top-right of every admin
// page header. Decorative for now — always green — but isolated as its own
// component so a real health check can drive it later without touching pages.

export function StatusPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      System operational
    </span>
  );
}
