// Two-line header used at the top of every admin page: a 20px/medium title, a
// 13px muted subtitle, and a right-hand cluster holding any page actions
// (Add user / Add course buttons) followed by the operational status pill.

import { StatusPill } from "@/components/StatusPill";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-medium tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <StatusPill />
      </div>
    </div>
  );
}
