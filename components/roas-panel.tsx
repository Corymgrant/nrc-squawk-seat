"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Closed-Loop ROAS panel (ADR-479 gap-panel #5) — top ads by ROAS.
// Read-only; does not touch the live n8n Closed-Loop ROAS workflow (ENRXZKwEHOmeRB4G).

const C = {
  card: "#14181A",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
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

type Row = {
  rank: string;
  ad: string;
  campaign: string;
  deals: string;
  revenue: string;
  spend: string;
  roas: string;
};

export function RoasPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/roas", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.rows) {
        setRows(j.rows);
        setSource(j.source_file || "");
        setErr(null);
      } else {
        setErr(j.error || "could not load ROAS report");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = showAll ? rows : rows.slice(0, 5);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Closed-Loop ROAS · top ads</span>
        {source && <span style={{ ...label, fontSize: 10.5 }}>{source}</span>}
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((r, idx) => (
          <div key={idx} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: C.text, fontSize: 12.5 }}>
                #{r.rank} {r.ad}
              </span>
              <span style={{ color: C.emerald, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{r.roas}</span>
            </div>
            <div style={{ ...label, fontSize: 11, marginTop: 2 }}>
              {r.deals} deals · {r.revenue} rev · {r.spend} spend
            </div>
          </div>
        ))}
      </div>
      {rows.length > 5 && (
        <button
          style={{ ...label, background: "transparent", border: "none", marginTop: 8, cursor: "pointer" }}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? "show fewer" : `show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
