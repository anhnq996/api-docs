export function StatusBadge({ status }: { status: number }) {
  const color =
    status < 300
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      : status < 400
        ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
        : status < 500
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
          : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs ${color}`}
      style={{ fontWeight: 600 }}
    >
      {status}
    </span>
  );
}
