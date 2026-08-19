"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Autonomy & Gauntlet board, gauntlet half (ADR-479 gap-panel #7).

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

type Layer = { key: string; title: string; passed: boolean; metric: string };
type Readiness = {
  available: boolean;
  rung: string;
  recommendation: string;
  green_streak: number;
  layers: Layer[];
};

export function GauntletPanel() {
  const [d, setD] = useState<Readiness | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/gauntlet-readiness", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) {
        setD(j);
        setErr(null);
      } else {
        setErr(j.error || "could not load gauntlet readiness");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Gauntlet readiness</span>
        {d?.rung && (
          <span
            style={{
              fontSize: 10.5,
              color: d.rung.includes("NOT_READY") ? C.amber : C.emerald,
              border: `1px solid ${d.rung.includes("NOT_READY") ? C.amber : C.emerald}55`,
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            {d.rung}
          </span>
        )}
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      {d && !d.available && <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>no gauntlet run yet</div>}
      {d?.available && (
        <>
          <div style={{ ...label, marginTop: 8, lineHeight: 1.4 }}>{d.recommendation}</div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {(d.layers || []).map((l) => (
              <div key={l.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: C.text, fontSize: 12.5 }}>{l.title}</span>
                <span style={{ fontSize: 11, color: l.passed ? C.emerald : C.red }}>{l.metric}</span>
              </div>
            ))}
          </div>
          <div style={{ ...label, fontSize: 11, marginTop: 8 }}>green streak: {d.green_streak}</div>
        </>
      )}
    </div>
  );
}
