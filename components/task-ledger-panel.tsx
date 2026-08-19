"use client";

import { useCallback, useEffect, useState } from "react";

// job 1941: Build Queue / Task Ledger (ADR-479 gap-panel #9) + tap-to-ack
// target (a) "Cockpit board row status (done/ack)". Every ack PATCHes the
// Orchestrator ledger directly, then re-fetches GET to render the CONFIRMED
// state from the source of truth — never optimistic-UI-only.

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
function btn(bg: string, color = "#06120D"): React.CSSProperties {
  return {
    background: bg,
    color,
    border: bg === "transparent" ? `1px solid ${C.line}` : "none",
    borderRadius: 9,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

type Task = {
  id: number;
  title: string;
  lane: string;
  priority: string;
  status: string;
  progress_pct: number | null;
  hard_due: string | null;
  notes: string | null;
};

// job1941: the ledger's real status vocabulary is wide + legacy-messy
// (backlog/blocked/needs-decision/todo/waiting/parked/parked-legacy/...,
// 15 distinct values seen live) — not a clean linear cycle. Rather than
// guess a state machine across values this cook doesn't have doctrine on,
// ack is ONE explicit action matching the cook's own language "(done/ack)":
// tap marks the row done. Nothing else is inferred or cycled.
const STATUS_COLOR: Record<string, string> = {
  done: C.emerald,
  blocked: C.red,
  "in-progress": C.amber,
  "needs-decision": C.amber,
  waiting: C.muted,
  waiting_on_cory: C.amber,
};
function statusColor(s: string): string {
  return STATUS_COLOR[s] || C.muted;
}

export function TaskLedgerPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acking, setAcking] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/owner/task-ledger", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.tasks) {
        setTasks(j.tasks);
        setErr(null);
      } else {
        setErr(j.error || "could not load task ledger");
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

  async function ack(t: Task) {
    setAcking(t.id);
    try {
      await fetch("/api/owner/task-ledger", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, status: "done" }),
      });
    } finally {
      // source-of-truth re-read — confirmed render comes from GET, not the PATCH response
      await load();
      setAcking(null);
    }
  }

  const active = tasks.filter((t) => t.status !== "done");
  const visible = showAll ? tasks : active.slice(0, 8);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Build Queue · Task Ledger</span>
        <span style={{ ...label, fontSize: 11 }}>{active.length} open</span>
      </div>
      {err && <div style={{ color: C.amber, fontSize: 12, marginTop: 8 }}>{err}</div>}
      {loading && !tasks.length && <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>loading…</div>}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              borderBottom: `1px solid ${C.line}`,
              paddingBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{t.title}</div>
              <div style={{ ...label, fontSize: 11, marginTop: 2 }}>
                {t.lane} · {t.priority}
                {t.hard_due ? ` · due ${t.hard_due}` : ""}
              </div>
            </div>
            <span
              style={{
                fontSize: 10.5,
                color: statusColor(t.status),
                border: `1px solid ${statusColor(t.status)}55`,
                borderRadius: 4,
                padding: "1px 5px",
                whiteSpace: "nowrap",
              }}
            >
              {t.status}
            </span>
            {t.status !== "done" && (
              <button
                style={btn(C.emerald)}
                disabled={acking === t.id}
                onClick={() => ack(t)}
              >
                {acking === t.id ? "…" : "✓ mark done"}
              </button>
            )}
          </div>
        ))}
      </div>
      {tasks.length > 8 && (
        <button style={{ ...btn("transparent", C.text), marginTop: 8 }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? "show fewer" : `show all ${tasks.length}`}
        </button>
      )}
    </div>
  );
}
