"use client";

// job 2682 — BOARD NOW panel (Cory 2026-09-02 ~22:55 CT: "I need to see
// everything we are cooking so I remember in the morning and do not get
// buried by new tasks"). The board itself on the glass: COOKING NOW (every
// in-progress row — lane, engine, progress, minutes running, one-line
// purpose from its unlocks), LANDED SINCE 22:00 CT (done rows with their
// handoff link + a one-line receipt from the handoff's own TL;DR), NEEDS
// CORY (parked rows + open gate cards as one-liners — the detail lives on
// the Cory Today panel above, linked not duplicated), QUEUED top 10 by
// priority with why-not-yet. Reads /api/owner/board-now?kit=nrc, a
// read-only passthrough of cockpit/owner_dash.py's live board read — zero
// new measurement computed client-side. Kit-generic: the endpoint takes a
// kit name; NRC is the first consumer.
//
// LIVENESS LAW: a board read older than 5 minutes (the endpoint's own
// stale_after_seconds, the same threshold the board_now_fresh HALO
// invariant breaches on) renders STALE, never silently green.
//
// KILL SWITCH: if the endpoint read fails, this panel hides itself
// entirely rather than rendering a false empty state as data.
//
// CONTENT LAW (acceptance test): only title, status, lane, engine,
// progress, purpose line and links are rendered — never a row's cook text
// or acceptance test.

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
const rowTitle: React.CSSProperties = { color: C.text, fontSize: 12, lineHeight: 1.35 };

type CookingRow = {
  id: number; title: string | null; lane: string | null; priority: string | null;
  engine: string | null; progress_pct: number | null; minutes_running: number | null;
  purpose: string | null;
};
type LandedRow = {
  id: number; title: string | null; landed_at_ct: string | null;
  handoff_file: string | null; handoff_link: string | null; receipt: string | null;
};
type NeedsCoryRow = {
  kind: string; id: number; title: string | null; status: string; waits_on: string | null;
};
type QueuedRow = {
  id: number; title: string | null; lane: string | null; priority: string | null;
  queued_minutes: number | null; why_not_yet: string | null;
};
type BoardNow = {
  ok: boolean; kit: string;
  read_at: string | null; read_at_ct: string | null;
  stale_after_seconds: number; landed_since_ct: string | null;
  cooking_now: CookingRow[]; landed: LandedRow[];
  needs_cory: NeedsCoryRow[]; queued_top: QueuedRow[];
  counts: Record<string, number>;
  error?: string;
};

function Section({
  title, count, empty, children,
}: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8 }}>
      <span style={label}>{title} ({count})</span>
      {count === 0 ? <div style={{ ...def, marginTop: 6 }}>{empty}</div> : children}
    </div>
  );
}

function fmtDur(min: number | null): string {
  if (min == null) return "";
  if (min < 120) return `${Math.round(min)}min`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function BoardNowPanel() {
  const [data, setData] = useState<BoardNow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/board-now?kit=nrc", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j.error) {
        setErr(j.error || `HTTP ${r.status}`);
        return;
      }
      setErr(null);
      setData(j as BoardNow);
      setFetchedAt(Date.now());
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);        // 60-second poll, per the cook
    const tick = setInterval(() => setTick((n) => n + 1), 15_000); // age badge refresh
    return () => { clearInterval(t); clearInterval(tick); };
  }, [load]);

  // KILL SWITCH: endpoint read failed → hide, never fabricate a state.
  if (err) return null;
  if (!data) return null;

  const readAtMs = data.read_at ? Date.parse(data.read_at) : NaN;
  const ageSec = isNaN(readAtMs) ? Infinity : (Date.now() - readAtMs) / 1000;
  const stale = !(ageSec <= (data.stale_after_seconds || 300));
  const ageMin = isFinite(ageSec) ? Math.floor(ageSec / 60) : null;

  return (
    <div style={{ ...card, borderColor: stale ? C.red : C.line }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Board Now — everything we are cooking, so the morning reads itself</span>
        {stale && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.red,
            border: `1px solid ${C.red}55`, borderRadius: 999, padding: "2px 9px",
          }}>
            STALE
          </span>
        )}
      </div>
      <div style={{ ...label, fontSize: 10.5, marginTop: 4, color: stale ? C.red : C.muted }}>
        {data.read_at_ct
          ? `board read ${data.read_at_ct}${ageMin != null ? ` (${ageMin}min ago)` : ""} · kit ${data.kit}`
          : "no read timestamp"}
        {stale ? " — board read outlived its 5-minute freshness budget, treat as unknown (board_now_fresh is paging)" : ""}
      </div>

      <Section title="COOKING NOW" count={data.cooking_now.length} empty="nothing in flight — the board is idle.">
        {data.cooking_now.map((r) => (
          <div key={r.id} style={{ marginTop: 6 }}>
            <div style={rowTitle}>
              🔥 #{r.id} [{r.lane || "—"}/{r.priority || "—"}] {(r.title || "").slice(0, 130)}
            </div>
            <div style={def}>
              {r.engine || "conductor"}
              {r.progress_pct != null ? ` · ${Math.round(r.progress_pct)}%` : ""}
              {r.minutes_running != null ? ` · ${fmtDur(r.minutes_running)} running` : ""}
              {r.purpose ? ` — ${r.purpose}` : ""}
            </div>
          </div>
        ))}
      </Section>

      <Section
        title={`LANDED SINCE ${data.landed_since_ct ? data.landed_since_ct.slice(11) : "22:00 CT"}`}
        count={data.landed.length}
        empty="nothing landed in the window yet."
      >
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {data.landed.map((r) => (
            <div key={r.id} style={{ marginTop: 6 }}>
              <div style={rowTitle}>
                ✅ #{r.id} {r.landed_at_ct ? `[${r.landed_at_ct}] ` : ""}{(r.title || "").slice(0, 130)}
              </div>
              {r.handoff_link ? (
                <div style={def}>
                  <a href={r.handoff_link} target="_blank" rel="noreferrer" style={linkStyle}>
                    {r.handoff_file || "handoff"}
                  </a>
                  {r.receipt ? ` — ${r.receipt}` : ""}
                </div>
              ) : (
                <div style={def}>no handoff on file{r.receipt ? ` — ${r.receipt}` : ""}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="NEEDS CORY"
        count={data.needs_cory.length}
        empty="nothing parked on Cory and no open gate card."
      >
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {data.needs_cory.map((r) => (
            <div key={`${r.kind}-${r.id}`} style={{ marginTop: 6 }}>
              <a href="/dashboard" style={{ ...linkStyle, fontSize: 12 }}>
                {r.kind === "gate-card-page" ? "🟡" : "⏸️"} #{r.id} [{r.status}] {(r.title || "").slice(0, 110)}
              </a>
              {r.waits_on && <div style={def}>waits on: {r.waits_on}</div>}
            </div>
          ))}
        </div>
        <div style={{ ...def, marginTop: 6 }}>
          detail lives on the Cory Today panel above (PARKED ON CORY) — linked, never duplicated.
        </div>
      </Section>

      <Section
        title={`QUEUED — top ${data.queued_top.length} of ${data.counts.queued_total ?? data.queued_top.length}`}
        count={data.queued_top.length}
        empty="queue is empty."
      >
        {data.queued_top.map((r) => (
          <div key={r.id} style={{ marginTop: 6 }}>
            <div style={rowTitle}>
              ⏳ #{r.id} [{r.priority || "—"}/{r.lane || "—"}] {(r.title || "").slice(0, 120)}
            </div>
            <div style={def}>
              why not yet: {r.why_not_yet || "unknown"}
              {r.queued_minutes != null ? ` · queued ${fmtDur(r.queued_minutes)}` : ""}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
