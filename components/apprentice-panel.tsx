"use client";

// Your Apprentice — read-only window on Michael's seat (job 663).
// Shows how the apprentice would have replied vs what Michael actually sent, how
// close it's getting over time, and which topics it has learned best.
//
// BINDING framing (MICHAEL-SEAT-DOCTRINE, job 512): apprentice/learning/match language ONLY.
// Never surface "AI", model/tool names, edit ratios, autonomy/graduation status, or any
// control/veto/send affordance. Zero workload by construction. Compartmentalization locked:
// this shows apprentice progress ONLY — nothing about how the capability is used elsewhere.

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Pair = {
  id: string;
  category: string | null;
  inbound_excerpt: string | null;
  shadow_draft: string;
  sent_reply: string | null;
  similarity: number | null;
  drafted_at: string;
};

// qualitative match band — we never show a raw percentage that could read as a grade
function band(sim: number | null): { label: string; tone: string; dot: string } {
  const s = sim ?? 0;
  if (s >= 0.7) return { label: "Nailed it", tone: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
  if (s >= 0.45) return { label: "Close", tone: "text-sky-600 dark:text-sky-400", dot: "bg-sky-500" };
  return { label: "Still learning", tone: "text-muted-foreground", dot: "bg-amber-500" };
}

const CAT_LABEL: Record<string, string> = {
  price: "Pricing questions",
  price_basic: "Pricing questions",
  coverage: "What's covered",
  whats_covered: "What's covered",
  claim: "Claims",
  objection: "Handling objections",
  escalation: "Tough / escalations",
  ready_to_buy: "Ready-to-buy",
  schedule_call: "Booking a call",
  other: "General replies",
};
const catLabel = (c: string | null) => (c && CAT_LABEL[c]) || "General replies";

function Trend({ points }: { points: { day: string; avg: number }[] }) {
  if (points.length < 2)
    return <span className="text-xs text-muted-foreground">Gathering its first weeks — check back soon.</span>;
  const W = 160, H = 40, pad = 4;
  const vals = points.map((p) => p.avg);
  const lo = Math.min(...vals, 0), hi = Math.max(...vals, 1);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const line = points.map((p, i) => `${x(i)},${y(p.avg)}`).join(" ");
  const rising = points[points.length - 1].avg >= points[0].avg;
  const stroke = rising ? "rgb(16 185 129)" : "rgb(56 189 248)";
  return (
    <div className="flex items-center gap-3">
      <svg width={W} height={H} className="block" aria-label="how close it's getting, over time">
        <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.75}
          strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
        <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].avg)} r={3} fill={stroke} />
      </svg>
      <span className="text-xs text-muted-foreground">
        {rising ? "Getting closer to how you'd say it" : "Steady — still studying you"}
      </span>
    </div>
  );
}

function CoachEdit({ pairId }: { pairId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  if (!open)
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        Show it a better way (optional)
      </button>
    );
  if (state === "done")
    return <span className="text-xs text-emerald-600 dark:text-emerald-400">Thanks — it&apos;ll study that.</span>;
  return (
    <div className="flex flex-col gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="How you'd rather it phrased this…"
        className="w-full rounded-md border bg-background p-2 text-sm" />
      <div className="flex gap-2">
        <button disabled={state === "saving" || text.trim().length < 4}
          onClick={async () => {
            setState("saving");
            try {
              const r = await fetch("/api/apprentice/coach", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ledger_id: pairId, improved_text: text.trim() }),
              });
              setState(r.ok ? "done" : "idle");
            } catch { setState("idle"); }
          }}
          className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50">
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Cancel</button>
      </div>
    </div>
  );
}

export function ApprenticePanel({
  pairs, pendingCount, totalStudied,
}: {
  pairs: Pair[];
  pendingCount: number;
  totalStudied: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const trend = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const p of pairs) {
      if (p.similarity == null) continue;
      const day = (p.drafted_at || "").slice(0, 10);
      if (!day) continue;
      const b = byDay.get(day) ?? { sum: 0, n: 0 };
      b.sum += p.similarity; b.n += 1; byDay.set(day, b);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, b]) => ({ day, avg: b.sum / b.n }));
  }, [pairs]);

  const maturity = useMemo(() => {
    const byCat = new Map<string, { sum: number; n: number }>();
    for (const p of pairs) {
      if (p.similarity == null) continue;
      const c = catLabel(p.category);
      const b = byCat.get(c) ?? { sum: 0, n: 0 };
      b.sum += p.similarity; b.n += 1; byCat.set(c, b);
    }
    return [...byCat.entries()]
      .map(([cat, b]) => ({ cat, avg: b.sum / b.n, n: b.n }))
      .sort((a, b) => b.avg - a.avg);
  }, [pairs]);

  const recent = useMemo(
    () => pairs.filter((p) => p.similarity != null && p.sent_reply).slice(0, expanded ? 12 : 4),
    [pairs, expanded],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Your apprentice</CardTitle>
          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            just for your curiosity
          </span>
        </div>
        <CardDescription>
          It quietly studies how you handle replies and gets a little sharper each week. Nothing here
          needs you — it never sends anything, and only you reply to customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Glance row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{totalStudied.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">of your replies studied</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{pendingCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">watching alongside you right now</div>
          </div>
          <div className="col-span-2 rounded-lg border p-3 sm:col-span-1">
            <div className="mb-1 text-xs font-medium">Getting closer over time</div>
            <Trend points={trend} />
          </div>
        </div>

        {/* What it's best at */}
        {maturity.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">What it&apos;s picking up fastest</div>
            <ul className="flex flex-col gap-2">
              {maturity.map((m) => {
                const b = band(m.avg);
                const pct = Math.max(6, Math.round(m.avg * 100));
                return (
                  <li key={m.cat} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm">{m.cat}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
                      <div className={`h-full rounded-full ${b.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`w-24 shrink-0 text-right text-xs ${b.tone}`}>{b.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Side by side */}
        {recent.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">
              How it would&apos;ve replied — next to what you actually sent
            </div>
            <ul className="flex flex-col gap-4">
              {recent.map((p) => {
                const b = band(p.similarity);
                return (
                  <li key={p.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {catLabel(p.category)}
                      </span>
                      <span className={`flex items-center gap-1 text-[11px] ${b.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />{b.label}
                      </span>
                    </div>
                    {p.inbound_excerpt && (
                      <p className="mb-2 line-clamp-2 text-xs italic text-muted-foreground">
                        Customer: {p.inbound_excerpt}
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[11px] font-medium text-muted-foreground">Your apprentice&apos;s try</div>
                        <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">{p.shadow_draft}</p>
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] font-medium text-muted-foreground">What you sent</div>
                        <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">{p.sent_reply}</p>
                      </div>
                    </div>
                    <div className="mt-2"><CoachEdit pairId={p.id} /></div>
                  </li>
                );
              })}
            </ul>
            {pairs.filter((p) => p.similarity != null && p.sent_reply).length > 4 && (
              <button onClick={() => setExpanded((v) => !v)}
                className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                {expanded ? "Show fewer" : "Show more"}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
