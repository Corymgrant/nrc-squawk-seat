"use client";

import { useCallback, useEffect, useState } from "react";

// job 2664: Build Ledger + Estate Census panel. Cory ruling 2026-09-02: the
// FB Comment Guardian sat finished-in-shadow five weeks and nothing told
// anyone -- this panel is the fix. Derived view only (build_ledger.py's
// 30-min-cron snapshot); this component computes nothing, it renders.

const C = {
  card: "#14181A",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
  red: "#F2655A",
  blue: "#5AA9F2",
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

type Cap = {
  id: string;
  label: string;
  state: string;
  state_reason: string;
  builder_row: string | null;
  last_proof: string | null;
  dependents: string[];
};

type Pair = {
  capability_a: string;
  capability_b: string;
  label_a: string;
  label_b: string;
  classification: string;
  proposed_verdict: string;
  why: string;
};

const STATE_COLOR: Record<string, string> = {
  live: C.emerald,
  shadow_graduating: C.blue,
  shadow_awaiting_authorization: C.amber,
  half_built: C.amber,
  dead: C.red,
  superseded: C.muted,
  unknown: C.red,
};

function staleness(generatedAt: string | null): { stale: boolean; ageMin: number } {
  if (!generatedAt) return { stale: true, ageMin: Infinity };
  const ageMin = (Date.now() - new Date(generatedAt).getTime()) / 60000;
  return { stale: ageMin > 60, ageMin };
}

export function BuildLedgerPanel() {
  const [caps, setCaps] = useState<Cap[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/build-ledger", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.capabilities) {
        setCaps(j.capabilities);
        setPairs(j.redundancy_pairs || []);
        setCounts(j.counts || {});
        setGeneratedAt(j.generated_at || null);
        setErr(null);
      } else {
        setErr(j.error || "could not load build ledger");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { stale, ageMin } = staleness(generatedAt);
  const filtered = filter ? caps.filter((c) => c.state === filter) : caps;
  const visible = showAll ? filtered : filtered.slice(0, 15);
  const states = ["live", "shadow_awaiting_authorization", "shadow_graduating", "half_built", "superseded", "dead", "unknown"];

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <span style={label}>Build Ledger · Estate Census</span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {states.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? null : s)}
              style={{
                ...label,
                fontSize: 10.5,
                color: STATE_COLOR[s] || C.muted,
                border: `1px solid ${(STATE_COLOR[s] || C.muted)}${filter === s ? "" : "55"}`,
                borderRadius: 4,
                padding: "1px 5px",
                background: filter === s ? `${STATE_COLOR[s]}22` : "transparent",
                cursor: "pointer",
              }}
            >
              {counts[s] ?? 0} {s}
            </button>
          ))}
        </span>
      </div>
      <div style={{ ...label, fontSize: 10.5, marginTop: 4, color: stale ? C.red : C.muted }}>
        {generatedAt
          ? `as of ${new Date(generatedAt).toLocaleTimeString()} (${Math.round(ageMin)}m ago)${stale ? " — STALE" : ""}`
          : "no census yet"}
        {counts.total ? ` · ${counts.total} capabilities tracked` : ""}
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((c) => (
          <div key={c.id} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: C.text, fontSize: 12.5 }}>{c.label || c.id}</span>
              <span
                style={{
                  fontSize: 10.5,
                  color: STATE_COLOR[c.state] || C.muted,
                  border: `1px solid ${(STATE_COLOR[c.state] || C.muted)}55`,
                  borderRadius: 4,
                  padding: "1px 5px",
                  whiteSpace: "nowrap",
                }}
              >
                {c.state}
              </span>
            </div>
            <div style={{ ...label, fontSize: 11, marginTop: 2 }}>
              {c.builder_row ? `job ${c.builder_row} · ` : ""}
              {c.dependents?.length ?? 0} dependent{(c.dependents?.length ?? 0) === 1 ? "" : "s"}
            </div>
            <div style={{ ...label, fontSize: 11, marginTop: 2 }}>{c.state_reason}</div>
          </div>
        ))}
      </div>
      {filtered.length > visible.length && (
        <button
          style={{ ...label, background: "transparent", border: "none", marginTop: 8, cursor: "pointer" }}
          onClick={() => setShowAll((s) => !s)}
        >
          show all {filtered.length}
        </button>
      )}

      {pairs.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
          <span style={label}>Redundancy · {pairs.length} pair{pairs.length === 1 ? "" : "s"} for Cory to rule on</span>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {pairs.map((p, i) => (
              <div key={i} style={{ fontSize: 11.5, color: C.text }}>
                <span>{p.label_a}</span> <span style={{ color: C.muted }}>vs</span> <span>{p.label_b}</span>{" "}
                <span style={{ color: C.amber }}>[{p.classification} → {p.proposed_verdict}]</span>
                <div style={{ ...label, fontSize: 10.5 }}>{p.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
