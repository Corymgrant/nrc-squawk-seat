"use client";

import { useCallback, useEffect, useState } from "react";

// job 1885: Accounting tab — cancellations / dunning-ladder status. This is a
// deliberately honest read: the dunning ladder is SHADOW-ONLY by design (Ship
// Rule 1 — live-send needs 72h clean shadow + Cory's one word), so there is no
// list of individually-ackable "cancellation events" to show yet — showing one
// would fabricate actionability for a feature that doesn't touch real
// customers. This surfaces the real shadow-coverage numbers instead of a fake
// recovered-$ figure, and will grow an ack-per-account list the moment the
// ladder graduates to live (gate tracked on the CS Autonomy Roadmap, job 1241).

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

type Gauge = {
  value: number | null;
  unit: string;
  state: string; // "live" | "awaiting_data"
  label: string;
  sublabel: string;
  basis: string;
  shadow_accounts?: number;
  shadow_touches?: number;
};

export function AccountingPanel() {
  const [dunning, setDunning] = useState<Gauge | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/dashboard/accounting", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.ok) {
        setDunning(j.dunning);
        setErr(null);
      } else {
        setErr(j.error || "could not load accounting data");
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isLive = dunning?.state === "live";

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Cancellations · dunning ladder</span>
        <span
          style={{
            fontSize: 10.5,
            color: isLive ? C.emerald : C.amber,
            border: `1px solid ${isLive ? C.emerald : C.amber}55`,
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {isLive ? "LIVE" : "SHADOW-ONLY"}
        </span>
      </div>

      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      {loading && !dunning && <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>loading…</div>}

      {dunning && (
        <>
          <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
            {isLive ? (
              <div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 24 }}>{dunning.value}</div>
                <div style={label}>saved via live ladder</div>
              </div>
            ) : (
              <>
                <div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 24 }}>{dunning.shadow_accounts ?? "—"}</div>
                  <div style={label}>accounts in shadow</div>
                </div>
                <div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 24 }}>{dunning.shadow_touches ?? "—"}</div>
                  <div style={label}>shadow touches logged</div>
                </div>
              </>
            )}
          </div>
          <div style={{ ...label, marginTop: 8, lineHeight: 1.4 }}>{dunning.sublabel}</div>
          {!isLive && (
            <div style={{ ...label, marginTop: 8, fontSize: 11, borderTop: `1px dashed ${C.line}`, paddingTop: 8 }}>
              No individual items to ack yet — nothing here reaches a real customer until the ladder
              graduates to live (Ship Rule 1: 72h clean shadow + your explicit go). Once live, each
              at-risk account will carry its own open / in-flight / handled state here.
            </div>
          )}
        </>
      )}
    </div>
  );
}
