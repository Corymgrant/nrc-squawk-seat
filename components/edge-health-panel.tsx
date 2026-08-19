"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Edge-health panel (Phase 1 item 4). Fed by halo_pulse.py (job
// 1801 PULSE) — per-component alive/last-used/gap on a 15-min cron. This is
// a rendering panel only; zero new telemetry plumbing (per the cook's own
// scope rule). Red (suspected_dead / declared_gap) sorted first, server-side.

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

type Rec = {
  key: string;
  category: string;
  label: string;
  alive_status: string;
  alive_detail: string;
  classification: "alive" | "declared_gap" | "suspected_dead";
  who_used_me_count: number;
  what_did_i_miss: string | null;
};

const CLASS_COLOR: Record<string, string> = {
  alive: C.emerald,
  declared_gap: C.amber,
  suspected_dead: C.red,
};

function staleness(generatedAt: string | null): { stale: boolean; ageMin: number } {
  if (!generatedAt) return { stale: true, ageMin: Infinity };
  const ageMin = (Date.now() - new Date(generatedAt).getTime()) / 60000;
  return { stale: ageMin > 10, ageMin };
}

export function EdgeHealthPanel() {
  const [records, setRecords] = useState<Rec[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/halo-pulse", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.records) {
        setRecords(j.records);
        setGeneratedAt(j.generated_at || null);
        setCounts(j.counts || {});
        setErr(null);
      } else {
        setErr(j.error || "could not load edge-health pulse");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { stale, ageMin } = staleness(generatedAt);
  const notAlive = records.filter((r) => r.classification !== "alive");
  const visible = showAll ? records : notAlive.length ? notAlive.slice(0, 12) : records.slice(0, 8);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Edge health · PULSE</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ ...label, fontSize: 11, color: C.emerald }}>{counts.alive ?? 0} alive</span>
          <span style={{ ...label, fontSize: 11, color: C.amber }}>{counts.declared_gap ?? 0} gap</span>
          <span style={{ ...label, fontSize: 11, color: C.red }}>{counts.suspected_dead ?? 0} dead</span>
        </span>
      </div>
      <div style={{ ...label, fontSize: 10.5, marginTop: 4, color: stale ? C.red : C.muted }}>
        {generatedAt ? `as of ${new Date(generatedAt).toLocaleTimeString()} (${Math.round(ageMin)}m ago)${stale ? " — STALE" : ""}` : "no pulse yet"}
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((r) => (
          <div key={r.key} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: C.text, fontSize: 12.5 }}>{r.label}</span>
              <span
                style={{
                  fontSize: 10.5,
                  color: CLASS_COLOR[r.classification] || C.muted,
                  border: `1px solid ${(CLASS_COLOR[r.classification] || C.muted)}55`,
                  borderRadius: 4,
                  padding: "1px 5px",
                  whiteSpace: "nowrap",
                }}
              >
                {r.classification}
              </span>
            </div>
            <div style={{ ...label, fontSize: 11, marginTop: 2 }}>
              {r.category} · {r.who_used_me_count} consumer{r.who_used_me_count === 1 ? "" : "s"}
            </div>
            {r.classification !== "alive" && (
              <div style={{ ...label, fontSize: 11, marginTop: 2, color: C.amber }}>
                {r.what_did_i_miss || r.alive_detail}
              </div>
            )}
          </div>
        ))}
      </div>
      {records.length > visible.length && (
        <button
          style={{ ...label, background: "transparent", border: "none", marginTop: 8, cursor: "pointer" }}
          onClick={() => setShowAll((s) => !s)}
        >
          show all {records.length}
        </button>
      )}
    </div>
  );
}
