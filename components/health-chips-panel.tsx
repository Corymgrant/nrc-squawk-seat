"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Health organ chips (ADR-479 gap-panel #2) — full per-organ detail,
// distinct from the plain-English summary.panels.health rollup already live.

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
  key: string;
  platform: string;
  name: string;
  status: string;
  health: string;
  detail: string;
};

export function HealthChipsPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/systems-health", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.items) {
        setItems(j.items);
        setCounts(j.counts || {});
        setErr(null);
      } else {
        setErr(j.error || "could not load systems health");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notOk = items.filter((i) => i.health !== "ok");
  const visible = showAll ? items : notOk.slice(0, 10);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Health organ chips</span>
        <span style={{ display: "flex", gap: 8 }}>
          <span style={{ ...label, color: C.red, fontSize: 11 }}>{counts.alerts_red ?? 0} red</span>
          <span style={{ ...label, color: C.amber, fontSize: 11 }}>{counts.alerts_amber ?? 0} amber</span>
          <span style={{ ...label, fontSize: 11 }}>{counts.items ?? items.length} total</span>
        </span>
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      {notOk.length === 0 && !err && (
        <div style={{ color: C.emerald, fontSize: 13, marginTop: 8 }}>all organs healthy</div>
      )}
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {visible.map((i) => (
          <div
            key={i.key}
            style={{
              border: `1px solid ${i.health === "ok" ? C.line : C.red}55`,
              borderRadius: 10,
              padding: "6px 10px",
              minWidth: 0,
              maxWidth: 220,
            }}
            title={i.detail}
          >
            <div style={{ color: C.text, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {i.name || i.key}
            </div>
            <div style={{ ...label, fontSize: 10.5, marginTop: 2 }}>
              {i.platform} · {i.status}
            </div>
          </div>
        ))}
      </div>
      {notOk.length > 10 && (
        <button
          style={{ ...label, background: "transparent", border: "none", marginTop: 8, cursor: "pointer" }}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? "show fewer" : `show all ${items.length}`}
        </button>
      )}
    </div>
  );
}
