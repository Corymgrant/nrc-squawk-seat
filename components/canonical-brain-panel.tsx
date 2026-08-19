"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Canonical Brain status (ADR-479 gap-panel #11).

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

type Item = {
  item_name: string;
  status: string;
  last_checked: string;
  last_diff: string | null;
  live_kind: string;
};

export function CanonicalBrainPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/canonical-status", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.items) {
        setItems(j.items);
        setErr(null);
      } else {
        setErr(j.error || "could not load canonical status");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const drifted = items.filter((i) => i.status !== "IN_SYNC");
  const visible = showAll ? items : drifted.length ? drifted : items.slice(0, 8);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Canonical Brain</span>
        <span style={{ ...label, fontSize: 11, color: drifted.length ? C.amber : C.emerald }}>
          {drifted.length ? `${drifted.length} drifted` : "all in sync"}
        </span>
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((i, idx) => (
          <div key={idx} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: C.text, fontSize: 13 }}>{i.item_name}</span>
              <span
                style={{
                  fontSize: 10.5,
                  color: i.status === "IN_SYNC" ? C.emerald : C.amber,
                  border: `1px solid ${i.status === "IN_SYNC" ? C.emerald : C.amber}55`,
                  borderRadius: 4,
                  padding: "1px 5px",
                  whiteSpace: "nowrap",
                }}
              >
                {i.status}
              </span>
            </div>
            {i.last_diff && <div style={{ ...label, fontSize: 11, marginTop: 2 }}>{i.last_diff}</div>}
          </div>
        ))}
      </div>
      {items.length > visible.length && (
        <button
          style={{ ...label, background: "transparent", border: "none", marginTop: 8, cursor: "pointer" }}
          onClick={() => setShowAll((s) => !s)}
        >
          show all {items.length}
        </button>
      )}
    </div>
  );
}
