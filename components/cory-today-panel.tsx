"use client";

// job 2642 — CORY TODAY panel (Cory amendment 2026-09-02: "the dashboard as
// the home surface" — the NRC-Cory-Today render must reach Cory where he
// already looks, not wait for him to open a Google Doc; Sarah Runnels'
// unanswered NAARVA W-9 thread was captured at 12:47 and never reached him
// the day this was built). Mirrors the doc's sections: UNANSWERED on cory@,
// NEEDS INFO FROM CORY, PARKED ON CORY, MONEY — every email item linking to
// its Gmail thread, parked rows naming their board row — michael@/erika@ as
// a one-line count (their items live on the board, per the ruling). Reads
// cory_today_doc.py's panel artifact via /api/owner/cory-today, a read-only
// passthrough — zero new measurement computed client-side.
//
// LIVENESS LAW: a render older than one missed hourly cycle (>100min, the
// same truth the cory_today_fresh HALO invariant breaches at 90min on)
// renders STALE, never silently green.
//
// KILL SWITCH: if the artifact is unreachable/absent, this panel hides
// itself entirely rather than rendering a false empty state as data.

import { useCallback, useEffect, useState } from "react";

const C = {
  card: "#14181A",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
  red: "#F2655A",
  line: "#222829",
};
const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 18,
  padding: 16,
  marginBottom: 12,
  border: `1px solid ${C.line}`,
};
const label: React.CSSProperties = { color: C.muted, fontSize: 12.5, fontWeight: 500, letterSpacing: 0.2 };
const def: React.CSSProperties = { color: C.muted, fontSize: 10.5, marginTop: 2, lineHeight: 1.3 };
const linkStyle: React.CSSProperties = { color: C.emerald, textDecoration: "none" };

type ThreadItem = {
  from: string | null;
  subject: string | null;
  age_hours: number | null;
  link: string;
  need_type?: string | null;
  crosscheck_note?: string | null;
};

type ParkedRow = {
  row_id: number;
  title: string | null;
  status: string;
  waiting_on: string | null;
  updated_at: string;
};

type GateCard = { page_id: number; ts: string | null; title: string | null };

type CoryToday = {
  generated_at: string | null;
  generated_at_ct: string | null;
  last_render_at: string | null;
  age_minutes: number | null;
  stale: boolean;
  view_url: string | null;
  counts: Record<string, number>;
  unanswered: ThreadItem[];
  needs_info: ThreadItem[];
  parked_rows: ParkedRow[];
  gate_cards: GateCard[];
  money: ThreadItem[];
  seat_counts: Record<string, number>;
  sweep?: { last_scan?: string | null; conservation_ok?: boolean | null; qwen_down?: boolean | null };
  error?: string;
};

function Thread({ item, showType }: { item: ThreadItem; showType?: boolean }) {
  return (
    <div style={{ marginTop: 6 }}>
      <a href={item.link} target="_blank" rel="noreferrer" style={linkStyle}>
        {showType && item.need_type ? `[${item.need_type}] ` : ""}
        {item.age_hours != null ? `[${item.age_hours}h] ` : ""}
        {item.from || "unknown"} — {item.subject || "(no subject)"}
      </a>
      {item.crosscheck_note && <div style={def}>cross-check: {item.crosscheck_note}</div>}
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8 }}>
      <span style={label}>
        {title} ({count})
      </span>
      {count === 0 ? <div style={{ ...def, marginTop: 6 }}>{empty}</div> : children}
    </div>
  );
}

export function CoryTodayPanel() {
  const [data, setData] = useState<CoryToday | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/cory-today", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j.error) {
        setErr(j.error || `HTTP ${r.status}`);
        return;
      }
      setErr(null);
      setData(j as CoryToday);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000); // hourly artifact — 5min poll is plenty
    return () => clearInterval(t);
  }, [load]);

  // KILL SWITCH: artifact absent/unreachable → hide, never fabricate a state.
  if (err) return null;
  if (!data) return null;

  const asOfLabel = data.generated_at_ct
    ? `data as of ${data.generated_at_ct}${data.age_minutes != null ? ` (${Math.round(data.age_minutes)}min ago)` : ""}`
    : "no render timestamp";

  return (
    <div style={{ ...card, borderColor: data.stale ? C.red : C.line }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Cory Today — nothing in the cory@ inbox gets missed</span>
        {data.stale && (
          <span
            style={{
              fontSize: 11, fontWeight: 700, color: C.red,
              border: `1px solid ${C.red}55`, borderRadius: 999, padding: "2px 9px",
            }}
          >
            STALE
          </span>
        )}
      </div>
      <div style={{ ...label, fontSize: 10.5, marginTop: 4, color: data.stale ? C.red : C.muted }}>
        {asOfLabel}
        {data.stale ? " — render outlived its hourly cadence, treat as unknown (cory_today_fresh is paging)" : ""}
        {data.view_url ? (
          <>
            {" · "}
            <a href={data.view_url} target="_blank" rel="noreferrer" style={linkStyle}>
              open the doc
            </a>
          </>
        ) : null}
      </div>

      <Section title="UNANSWERED ON CORY@" count={data.unanswered.length} empty="none — cory@ is clean for the window.">
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {data.unanswered.map((i, k) => (
            <Thread key={k} item={i} />
          ))}
        </div>
      </Section>

      <Section
        title="NEEDS INFO FROM CORY"
        count={data.needs_info.length}
        empty="none — no thread is currently asking Cory for a decision, document, signature or payment."
      >
        {data.needs_info.map((i, k) => (
          <Thread key={k} item={i} showType />
        ))}
      </Section>

      <Section
        title="PARKED ON CORY"
        count={data.parked_rows.length + data.gate_cards.length}
        empty="none — nothing on the board is blocked/parked on Cory and no decision gate card is open."
      >
        {data.parked_rows.map((r) => (
          <div key={r.row_id} style={{ marginTop: 6 }}>
            <a href="/dashboard" style={linkStyle}>
              board #{r.row_id} [{r.status}] {(r.title || "").slice(0, 110)}
            </a>
            <div style={def}>waiting_on: {(r.waiting_on || "").slice(0, 160)}</div>
          </div>
        ))}
        {data.gate_cards.map((g) => (
          <div key={g.page_id} style={{ ...def, marginTop: 6 }}>
            gate card ({(g.ts || "").slice(0, 16)}) {(g.title || "").slice(0, 130)}
          </div>
        ))}
      </Section>

      <Section title="MONEY" count={data.money.length} empty="none — no open MONEY-class thread for Cory in the window.">
        {data.money.map((i, k) => (
          <Thread key={k} item={i} />
        ))}
      </Section>

      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8, ...def }}>
        michael@: {data.seat_counts["michael@"] ?? 0} open item(s); erika@: {data.seat_counts["erika@"] ?? 0} open
        item(s) — these live on the board (status=needs-decision), not here.
      </div>
      {data.sweep?.conservation_ok === false && (
        <div style={{ ...def, color: C.red, marginTop: 4 }}>
          sweep conservation breach: messages-in ≠ messages-classified on the last scan
        </div>
      )}
    </div>
  );
}
