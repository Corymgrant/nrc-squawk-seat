"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Session Log (ADR-479 gap-panel #10) — read-only running log.

const C = {
  card: "#14181A",
  text: "#EDEFEE",
  muted: "#7E8682",
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

type Entry = { ts?: string; text?: string; note?: string; [k: string]: unknown };

export function SessionLogPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [noData, setNoData] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/session-log", { cache: "no-store" });
      const j = await r.json();
      if (r.ok) {
        setEntries(j.entries || []);
        setNoData(!!j.no_data);
        setErr(null);
      } else {
        setErr(j.error || "could not load session log");
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
      <span style={label}>Session Log</span>
      {err && <div style={{ color: "#F5B544", fontSize: 12, marginTop: 8 }}>{err}</div>}
      {noData && !err && <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>no entries logged today</div>}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {entries.slice(0, 20).map((e, idx) => (
          <div key={idx} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>
            <div style={{ color: C.text, fontSize: 12.5 }}>{String(e.text ?? e.note ?? JSON.stringify(e))}</div>
            {e.ts && <div style={{ ...label, fontSize: 10.5, marginTop: 2 }}>{String(e.ts)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
