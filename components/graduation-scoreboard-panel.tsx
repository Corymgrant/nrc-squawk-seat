"use client";

// job 2415 — AUTORESPONDER GRADUATION panel (Cory directive 2026-08-30):
// "this panel is what lets Cory watch the responder walk toward green from
// his phone instead of asking a seat." Reads job2370's nightly scorer
// snapshot (lane_b_graduation_scorer.py -> lane_b_graduation_scoreboard.json)
// via /api/owner/graduation-scoreboard — a read-only passthrough, zero new
// measurement computed client-side beyond the shadow-volume-per-day rollup
// the backend already derives from the SAME artifact's own fields.
//
// EXPOSURE LAW: scores and counts ONLY, never draft content — nothing here
// ever renders a draft body, citation text, or anything a human could read
// as "what the autoresponder would have said." Only the four published
// dials (supervisor pass / groundedness / judge min dimension / n8n mirror),
// their sample counts, shadow volume, and the flywheel edit rate.
//
// LIVENESS LAW: a stale snapshot (older than one missed nightly cycle) must
// never render as green, no matter what overall_verdict says — staleness
// overrides the verdict color/label here, client-side, on every render.
//
// KILL SWITCH: if the scoring artifact is unreachable/absent, this panel
// hides itself entirely rather than rendering a false empty state as data.

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

type Dial = {
  status: "PASS" | "FAIL" | "INSUFFICIENT_SAMPLE" | string;
  value: number | null;
  sample_n: number;
  threshold?: number;
};

type Scoreboard = {
  as_of: string | null;
  age_hours: number | null;
  stale: boolean;
  window_days: number;
  overall_verdict: "GREEN" | "RED" | string;
  dials: Record<string, Dial>;
  shadow_draft_volume_per_day: number | null;
  gaps: string[];
  definitions: Record<string, string>;
  error?: string;
};

const DIAL_ORDER: Array<[key: string, label: string]> = [
  ["supervisor_pass", "Supervisor pass rate"],
  ["groundedness", "Groundedness"],
  ["judge_min_dim", "Judge min dimension"],
  ["n8n_mirror", "n8n mirror agreement"],
];

function dialColor(status: string): string {
  if (status === "PASS") return C.emerald;
  if (status === "FAIL") return C.red;
  return C.amber; // INSUFFICIENT_SAMPLE — neither passed nor failed
}

function dialText(d: Dial): string {
  if (d.status === "INSUFFICIENT_SAMPLE") return `insufficient sample (n=${d.sample_n})`;
  if (d.value == null) return "—";
  const pct = d.value <= 1 ? `${(d.value * 100).toFixed(1)}%` : d.value.toFixed(2);
  return `${pct} of ${d.threshold != null && d.threshold <= 1 ? `${(d.threshold * 100).toFixed(0)}%` : d.threshold} · n=${d.sample_n}`;
}

export function GraduationScoreboardPanel({
  fly,
  flyE,
}: {
  fly?: { rolling_7d_pct?: number | null };
  flyE?: { rolling_7d_pct?: number | null; no_data?: boolean };
}) {
  const [data, setData] = useState<Scoreboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/graduation-scoreboard", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j.error) {
        setErr(j.error || `HTTP ${r.status}`);
        return;
      }
      setErr(null);
      setData(j as Scoreboard);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000); // scorer runs nightly — 5min poll is plenty
    return () => clearInterval(t);
  }, [load]);

  // KILL SWITCH: artifact absent/unreachable → hide, never fabricate a state.
  if (err) return null;
  if (!data) return null;

  // LIVENESS LAW: stale always overrides the cached verdict, never reads green.
  const verdictColor = data.stale ? C.red : data.overall_verdict === "GREEN" ? C.emerald : C.amber;
  const verdictText = data.stale
    ? "STALE"
    : data.overall_verdict === "GREEN"
      ? "GRADUATED"
      : "not yet graduated";

  const asOfLabel = data.as_of
    ? `as of ${new Date(data.as_of).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} (${data.age_hours}h ago)`
    : "no snapshot timestamp";

  return (
    <div style={{ ...card, borderColor: data.stale ? C.red : C.line }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Autoresponder Graduation</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: verdictColor,
            border: `1px solid ${verdictColor}55`,
            borderRadius: 999,
            padding: "2px 9px",
          }}
        >
          {verdictText}
        </span>
      </div>
      <div style={{ ...label, fontSize: 10.5, marginTop: 4, color: data.stale ? C.red : C.muted }}>
        {asOfLabel}
        {data.stale ? " — snapshot outlived its nightly refresh cadence, treat as unknown, not green" : ""}
        {" · "}
        {data.window_days}-day trailing window
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {DIAL_ORDER.map(([key, dlabel]) => {
          const d = data.dials?.[key];
          if (!d) return null;
          const color = dialColor(d.status);
          return (
            <div key={key} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 13, color: C.text }}>{dlabel}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color, whiteSpace: "nowrap" }}>
                  {dialText(d)}
                </span>
              </div>
              <div style={def}>{data.definitions?.[key] ?? ""}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            {data.shadow_draft_volume_per_day != null ? data.shadow_draft_volume_per_day : "—"}
          </div>
          <div style={label}>shadow rows/day</div>
          <div style={def}>{data.definitions?.shadow_draft_volume_per_day ?? ""}</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            {fly?.rolling_7d_pct != null ? `${fly.rolling_7d_pct.toFixed(1)}%` : "—"}
          </div>
          <div style={label}>flywheel edit % · Michael</div>
          <div style={def}>7-day rolling share of sent drafts a human edited before send.</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            {flyE?.rolling_7d_pct != null ? `${flyE.rolling_7d_pct.toFixed(1)}%` : flyE?.no_data ? "no data" : "—"}
          </div>
          <div style={label}>flywheel edit % · Erika</div>
          <div style={def}>7-day rolling share of sent drafts a human edited before send.</div>
        </div>
      </div>

      {data.gaps.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: C.amber }}>
          gaps: {data.gaps.join(", ")} — ledger unreadable for this persona, not counted as a fabricated pass
        </div>
      )}
    </div>
  );
}
