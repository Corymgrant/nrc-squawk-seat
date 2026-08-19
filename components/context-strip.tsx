// job 1966: "WHAT'S CHANGING THIS WEEK" strip — 1-2 plain-English heads-up lines at
// the top of the rep seat, sourced from cockpit_michael_context (chat-Claude-writable
// only; the app never writes this table). Renders NOTHING when the table has no
// current rows — no card, no heading, no empty state. Server component: reads once
// per page render via the caller's session-scoped Supabase client, same as the rest
// of /protected.

export type ContextRow = {
  id: string;
  message: string;
  created_at: string;
};

export function ContextStrip({ rows }: { rows: ContextRow[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-700/80">
        What&apos;s changing this week
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <p key={r.id} className="text-sm leading-relaxed text-foreground/90">
            {r.message}
          </p>
        ))}
      </div>
    </section>
  );
}
