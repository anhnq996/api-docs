import type { HttpMethod } from "@/lib/data/apiSpec";

const colors: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  POST: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  PATCH:
    "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  DELETE: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

export function MethodBadge({
  method,
  compact,
}: {
  method: HttpMethod;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded border font-mono uppercase tracking-wide ${colors[method]} ${
        compact ? "text-[10px] px-1.5 py-0.5 min-w-[48px]" : "text-xs px-2 py-1 min-w-[64px]"
      }`}
      style={{ fontWeight: 600 }}
    >
      {method}
    </span>
  );
}
