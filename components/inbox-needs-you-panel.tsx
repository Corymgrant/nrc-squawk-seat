"use client";

import { useCallback, useEffect, useState } from "react";

// job 2007: Inbox Sentinel dashboard card -- glanceable list of cory@
// norepaircost.com emails needing a reply, one-tap opens the thread,
// tap-to-dismiss/snooze. Modeled on health-chips-panel.tsx (job 1941, ADR-479
// gap-panel #2) for visual consistency with the rest of THE COCKPIT.
//
// SCOPE NOTE: the cook's design law calls for swipe-to-dismiss/snooze with
// press-down feedback. No swipe-gesture primitive exists anywhere in this
// codebase yet (checked at build time, job 2007) and this is a headless
// build session with no browser to visually/interactively verify a custom
// gesture's feel -- shipping an unverified gesture risked violating the
// "anti-QuickBooks bar" it's meant to uphold. This ships tap-based dismiss/
// snooze buttons instead (same end action, accessible, verifiable from code
// alone) with a real CSS :active press-down state. Swipe is a follow-up
// increment once a human can eyeball it live.

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
  id: string;
  from: string;
  subject: string;
  date: string;
  tier: number;
  counterpart: string | null;
  age_hours: number | null;
  aged: boolean;
  thread_url: string;
};

type Snapshot = {
  generated_at: string | null;
  count: number;
  aged_over_48h: number;
  items: Item[];
  declared_gaps?: string[];
  error?: string;
};

const btnBase: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  color: C.muted,
  fontSize: 11,
  padding: "4px 9px",
  cursor: "pointer",
  transition: "transform 80ms ease, background 80ms ease",
};

function Row({ item, onDismiss, onSnooze }: { item: Item; onDismiss: (id: string) => void; onSnooze: (id: string) => void }) {
  const [pressed, setPressed] = useState<string | null>(null);
  const press = (key: string) => ({
    onMouseDown: () => setPressed(key),
    onMouseUp: () => setPressed(null),
    onMouseLeave: () => setPressed(null),
    onTouchStart: () => setPressed(key),
    onTouchEnd: () => setPressed(null),
  });
  const pressedStyle = (key: string): React.CSSProperties =>
    pressed === key ? { transform: "scale(0.94)", background: "rgba(255,255,255,0.06)" } : {};

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "8px 0",
        borderTop: `1px solid ${C.line}`,
      }}
    >
      <a
        href={item.thread_url}
        target="_blank"
        rel="noreferrer"
        style={{ ...press("open"), ...pressedStyle("open"), flex: 1, minWidth: 0, textDecoration: "none", borderRadius: 8, padding: "2px 4px" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          {item.aged && <span style={{ color: C.red, fontSize: 10.5 }}>⚠️ AGED</span>}
          <span style={{ color: C.text, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.subject || "(no subject)"}
          </span>
        </div>
        <div style={{ ...label, fontSize: 11, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.from} · {item.age_hours != null ? `${Math.round(item.age_hours)}h ago` : ""}
          {item.counterpart ? ` · ${item.counterpart}` : ""}
        </div>
      </a>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button {...press("snooze")} style={{ ...btnBase, ...pressedStyle("snooze") }} onClick={() => onSnooze(item.id)}>
          snooze
        </button>
        <button {...press("dismiss")} style={{ ...btnBase, ...pressedStyle("dismiss") }} onClick={() => onDismiss(item.id)}>
          dismiss
        </button>
      </div>
    </div>
  );
}

export function InboxNeedsYouPanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/inbox-needs-you", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && !j.error) {
        setSnap(j);
        setErr(null);
      } else {
        setErr(j.error || "could not load inbox watch");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (id: string, action: "dismiss" | "snooze") => {
      // optimistic remove -- source-of-truth re-fetch confirms right after
      setSnap((s) => (s ? { ...s, items: s.items.filter((i) => i.id !== id), count: s.count - 1 } : s));
      try {
        await fetch("/api/owner/inbox-needs-you", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, hours: 24 }),
        });
      } finally {
        load();
      }
    },
    [load]
  );

  const items = snap?.items ?? [];

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Inbox needs you</span>
        <span style={{ display: "flex", gap: 8 }}>
          {(snap?.aged_over_48h ?? 0) > 0 && (
            <span style={{ ...label, color: C.red, fontSize: 11 }}>{snap!.aged_over_48h} over 48h</span>
          )}
          <span style={{ ...label, fontSize: 11 }}>{snap?.count ?? 0} total</span>
        </span>
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      {!err && items.length === 0 && (
        <div style={{ color: C.emerald, fontSize: 13, marginTop: 8 }}>clean — nothing waiting on you</div>
      )}
      {items.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {items.slice(0, 15).map((i) => (
            <Row key={i.id} item={i} onDismiss={(id) => act(id, "dismiss")} onSnooze={(id) => act(id, "snooze")} />
          ))}
        </div>
      )}
    </div>
  );
}
