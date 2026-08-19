"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Channel Command (ADR-479 gap-panel #4) — per-channel CPL / close-rate / verdict.

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

type Channel = {
  leads: number;
  cpl_usd: number;
  close_rate_pct: number;
  verdict: string;
  verdict_reason: string;
};

const VERDICT_COLOR: Record<string, string> = { scale: "#2FD79B", hold: "#F5B544", cut: "#F2655A" };

export function ChannelCommandPanel() {
  const [channels, setChannels] = useState<Record<string, Channel>>({});
  const [windowLabel, setWindowLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/channel-scoreboard", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.channels) {
        setChannels(j.channels);
        setWindowLabel(j.window_label || "");
        setErr(null);
      } else {
        setErr(j.error || "could not load channel scoreboard");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = Object.entries(channels).filter(([, c]) => c.leads > 0);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Channel Command</span>
        {windowLabel && <span style={{ ...label, fontSize: 11 }}>{windowLabel}</span>}
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 10, overflowX: "auto" }}>
        {rows.map(([name, c]) => (
          <div
            key={name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              borderBottom: `1px solid ${C.line}`,
              padding: "6px 0",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: C.text, fontSize: 13, textTransform: "capitalize", minWidth: 70 }}>{name}</span>
            <span style={{ ...label, fontSize: 11 }}>{c.leads} leads</span>
            <span style={{ ...label, fontSize: 11 }}>CPL ${c.cpl_usd?.toFixed(2) ?? "—"}</span>
            <span style={{ ...label, fontSize: 11 }}>{c.close_rate_pct?.toFixed(1) ?? "—"}% close</span>
            <span
              style={{
                fontSize: 10.5,
                color: VERDICT_COLOR[c.verdict] || C.muted,
                border: `1px solid ${(VERDICT_COLOR[c.verdict] || C.muted)}55`,
                borderRadius: 4,
                padding: "1px 5px",
              }}
              title={c.verdict_reason}
            >
              {c.verdict}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
