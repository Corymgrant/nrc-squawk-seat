"use client";

// job 2610 — OBJECTIVE C DRIVER Stuck panel (Cory ruling 2026-09-02: "the
// autoresponder has had months and zero progress because nothing owns the
// goal ... it really doesn't need me"). Lists every standing objective (A-H)
// with dials/progress, days since last measured improvement, blocking
// reason, and the acting organ or row — Objective C pinned first. Reads
// objective_stuck_panel.py's nightly artifact via /api/owner/objective-stuck,
// a read-only passthrough — zero new measurement computed client-side.
//
// LIVENESS LAW: a stale snapshot (older than one missed nightly cycle) must
// never render as healthy — staleness is shown explicitly, client-side.
//
// KILL SWITCH: if the artifact is unreachable/absent, this panel hides
// itself entirely rather than rendering a false empty state as data.
//
// ROW 2415 NOTE: this panel does NOT replace components/graduation-
// scoreboard-panel.tsx (row 2415, still live, still correct) — that panel
// remains the detailed live-dial view for the autoresponder; this one is
// the objective-level "what's stuck and why" meta-view across all 8
// standing objectives. See objective_stuck_panel.py's module docstring for
// the verify-the-premise finding behind this decision.

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

type ObjectiveRow = {
  key: string;
  name: string;
  dials?: Record<string, unknown> | null;
  progress_pct?: number | null;
  days_since_last_measured_improvement?: number | null;
  blocking_reason: string;
  stall_verdict?: string;
  lowest_dial?: string | null;
  acting_organ: string;
  acting_organ_detail?: string | null;
  shadow_mode?: boolean | null;
};

type StuckSnapshot = {
  generated_at: string | null;
  age_hours: number | null;
  stale: boolean;
  objectives: ObjectiveRow[];
  row_2415_reconciliation?: string | null;
  error?: string;
};

function stuckColor(o: ObjectiveRow): string {
  if (o.stall_verdict === "breach") return C.red;
  if (o.blocking_reason && o.blocking_reason !== "no declared blocker") return C.amber;
  return C.emerald;
}

export function ObjectiveStuckPanel() {
  const [data, setData] = useState<StuckSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/objective-stuck", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j.error) {
        setErr(j.error || `HTTP ${r.status}`);
        return;
      }
      setErr(null);
      setData(j as StuckSnapshot);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000); // nightly artifact — 5min poll is plenty
    return () => clearInterval(t);
  }, [load]);

  // KILL SWITCH: artifact absent/unreachable → hide, never fabricate a state.
  if (err) return null;
  if (!data) return null;

  const asOfLabel = data.generated_at
    ? `as of ${new Date(data.generated_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} (${data.age_hours}h ago)`
    : "no snapshot timestamp";

  return (
    <div style={{ ...card, borderColor: data.stale ? C.red : C.line }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Stuck — Objectives</span>
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
        {data.stale ? " — snapshot outlived its nightly refresh cadence, treat as unknown" : ""}
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {data.objectives.map((o) => {
          const color = stuckColor(o);
          const days = o.days_since_last_measured_improvement;
          return (
            <div key={o.key} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 13, color: C.text, fontWeight: o.key === "C" ? 700 : 400 }}>
                  {o.key} · {o.name}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color, whiteSpace: "nowrap" }}>
                  {days != null ? `${days}d stuck` : o.progress_pct != null ? `${o.progress_pct}%` : "—"}
                </span>
              </div>
              <div style={def}>
                blocking: {o.blocking_reason}
                {o.lowest_dial ? ` · lowest dial: ${o.lowest_dial}` : ""}
              </div>
              <div style={def}>
                acting: {o.acting_organ}
                {o.shadow_mode ? " (SHADOW — pre-ignition, logging only)" : ""}
                {o.acting_organ_detail ? ` — ${o.acting_organ_detail}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {data.row_2415_reconciliation && (
        <div style={{ marginTop: 10, fontSize: 10.5, color: C.muted, lineHeight: 1.3 }}>
          {data.row_2415_reconciliation}
        </div>
      )}
    </div>
  );
}
