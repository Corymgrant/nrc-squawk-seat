"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* ── Concept C palette ──────────────────────────────────────────────────────── */
const C = {
  bg: "#0B0D0C",
  card: "#14181A",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
  red: "#F2655A",
  line: "#222829",
};

/* ── tiny style helpers ─────────────────────────────────────────────────────── */
const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 18,
  padding: 16,
  marginBottom: 12,
  border: `1px solid ${C.line}`,
};
const label: React.CSSProperties = {
  color: C.muted,
  fontSize: 12.5,
  fontWeight: 500,
  letterSpacing: 0.2,
};
const big: React.CSSProperties = { color: C.text, fontWeight: 700, lineHeight: 1.05 };

type Note = {
  id: number;
  item_type: string;
  item_ref: string | null;
  item_label: string | null;
  body: string;
  status: string;
  answer_body: string | null;
  created_at: string;
  answered_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Panels = Record<string, any>;

function money(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}
function num(n: number | null | undefined, d = 0) {
  if (n == null || isNaN(Number(n))) return "—";
  return Number(n).toFixed(d);
}

/* ── add-note + render-notes for any item ───────────────────────────────────── */
function NoteThread({
  itemType,
  itemRef,
  itemLabel,
  notes,
  onPosted,
}: {
  itemType: string;
  itemRef: string;
  itemLabel: string;
  notes: Note[];
  onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = notes.filter((n) => n.item_ref === itemRef);

  async function post() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/dashboard/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: itemType, item_ref: itemRef, item_label: itemLabel, body: text.trim() }),
      });
      setText("");
      setOpen(false);
      onPosted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {mine.map((n) => (
        <div key={n.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8 }}>
          <div style={{ color: C.text, fontSize: 13 }}>
            <span style={{ color: C.muted }}>note · </span>
            {n.body}
          </div>
          {n.answer_body ? (
            <div style={{ marginTop: 5, paddingLeft: 10, borderLeft: `2px solid ${C.emerald}`, color: C.text, fontSize: 13 }}>
              <span style={{ color: C.emerald, fontWeight: 600 }}>answer · </span>
              {n.answer_body}
            </div>
          ) : (
            <div style={{ marginTop: 3, fontSize: 11.5, color: C.amber }}>awaiting answer</div>
          )}
        </div>
      ))}
      {open ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Note or ask — chat-Claude answers on sweep…"
            rows={2}
            style={{
              width: "100%",
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: 8,
              fontSize: 13,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={post} disabled={busy} style={btn(C.emerald)}>
              {busy ? "…" : "Add note"}
            </button>
            <button onClick={() => setOpen(false)} style={btn("transparent", C.muted)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ ...btn("transparent", C.muted), marginTop: 6 }}>
          + note
        </button>
      )}
    </div>
  );
}

function btn(bg: string, color = "#06120D"): React.CSSProperties {
  return {
    background: bg,
    color,
    border: bg === "transparent" ? `1px solid ${C.line}` : "none",
    borderRadius: 9,
    padding: "5px 11px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: ok ? C.emerald : C.red,
        boxShadow: ok ? `0 0 8px ${C.emerald}66` : `0 0 8px ${C.red}66`,
      }}
    />
  );
}

/* ── main ───────────────────────────────────────────────────────────────────── */
export function DashboardClient({ ownerName }: { ownerName: string }) {
  const [panels, setPanels] = useState<Panels | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/notes", { cache: "no-store" });
      const j = await r.json();
      setNotes(j.notes ?? []);
    } catch {
      /* keep last */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/summary", { cache: "no-store" });
      const j = await r.json();
      if (j.panels) {
        setPanels(j.panels);
        setUpdated(new Date());
        setErr(null);
      } else {
        setErr(j.error || "no data");
      }
    } catch (e) {
      setErr(String(e));
    }
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const openCount = useMemo(() => notes.filter((n) => n.status === "open").length, [notes]);

  const b = panels?.build ?? {};
  const ship = panels?.shipped ?? {};
  const leads = panels?.leads ?? {};
  const ads = panels?.ads ?? {};
  const health = panels?.health ?? {};
  const fly = panels?.flywheel ?? {};
  const squawk = panels?.squawk ?? {};

  // Close rate = closed-won ÷ quoted for the matured 90→14d cohort
  // (backend: data.get_close_rate_cohort).
  const cr = leads.close_rate ?? {};
  const closeRate = cr.close_rate_pct != null ? Number(cr.close_rate_pct) : null;
  const crWon = cr.won_count;
  const crQuoted = cr.quoted_count;
  const crLabel = cr.window_label ?? "last 90d";

  const freqColor =
    ads.frequency_level === "danger" ? C.red : ads.frequency_level === "warn" ? C.amber : C.emerald;

  return (
    <main
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        maxWidth: 440,
        margin: "0 auto",
        padding: "calc(env(safe-area-inset-top) + 16px) 14px 40px",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Cockpit</div>
          <div style={{ ...label }}>{ownerName.split(" ")[0]}&apos;s daily driver</div>
        </div>
        <button onClick={load} style={btn("transparent", C.muted)}>
          ↻ {updated ? updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "…"}
        </button>
      </div>

      {err && (
        <div style={{ ...card, borderColor: C.red, color: C.red, fontSize: 13 }}>
          Couldn&apos;t reach Cockpit: {err}
        </div>
      )}

      {/* Notes / Ask inbox */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={label}>Notes / Ask</span>
          <span style={{ ...label, color: openCount ? C.amber : C.muted }}>
            {openCount} open
          </span>
        </div>
        <NoteThread
          itemType="freeform"
          itemRef="freeform-inbox"
          itemLabel="Freeform"
          notes={notes}
          onPosted={loadNotes}
        />
        {notes.filter((n) => n.item_ref !== "freeform-inbox").length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: C.muted }}>
            {notes.filter((n) => n.status === "answered").length} answered ·{" "}
            notes also appear on their item below
          </div>
        )}
      </div>

      {/* 1 — hero build % */}
      <div style={card}>
        <span style={label}>Build completion</span>
        <div style={{ ...big, fontSize: 48, marginTop: 2 }}>
          {b.pct != null ? `${num(b.pct, 1)}%` : "—"}
        </div>
        <div style={{ height: 7, background: "#0c0f10", borderRadius: 5, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, Number(b.pct) || 0)}%`, height: "100%", background: C.emerald }} />
        </div>
        <div style={{ ...label, marginTop: 8 }}>
          {b.done ?? "—"} of {b.total ?? "—"} done
          {b.summary ? ` · ${b.summary.in_flight ?? 0} in flight · ${b.summary.blocked ?? 0} blocked` : ""}
        </div>
        <NoteThread itemType="build" itemRef="build-overview" itemLabel="Build completion" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 2 — in progress */}
      <div style={card}>
        <span style={label}>In progress</span>
        <div style={{ marginTop: 8 }}>
          {(b.in_progress ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
          {(b.in_progress ?? []).map((t: { id: number; title: string; progress_pct?: number; priority?: string }) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 13, color: C.text }}>{t.title?.slice(0, 84)}</span>
              <span style={{ fontSize: 12, color: C.emerald, whiteSpace: "nowrap" }}>
                {t.progress_pct != null ? `${Math.round(Number(t.progress_pct))}%` : t.priority ?? ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3 — shipped this week */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={label}>Shipped this week</span>
          <span style={{ ...label, color: C.emerald }}>{ship.shipped_count ?? "—"}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          {(ship.shipped ?? []).slice(0, 8).map((s: Record<string, unknown>, i: number) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", borderTop: i ? `1px solid ${C.line}` : "none", fontSize: 13 }}>
              <span style={{ color: C.emerald }}>✓</span>
              <span style={{ color: C.text }}>
                {String((s.title as string) || (s.name as string) || (s.row as string) || JSON.stringify(s)).slice(0, 84)}
              </span>
            </div>
          ))}
          {(ship.shipped ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        </div>
        <NoteThread itemType="build" itemRef="shipped-week" itemLabel="Shipped this week" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 4 — leads & quotes */}
      <div style={card}>
        <span style={label}>Leads &amp; quotes · month-to-date</span>
        <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
          <Stat k="Won" v={leads.won_count != null ? String(leads.won_count) : "—"} />
          <Stat k="Revenue" v={money(leads.won_revenue)} />
          <Stat k="Close rate" v={closeRate != null ? `${num(closeRate, 1)}%` : "—"} />
        </div>
        <div style={{ ...label, marginTop: 8 }}>
          {crWon != null && crQuoted != null
            ? `${Number(crWon).toLocaleString()} of ${Number(crQuoted).toLocaleString()} quoted (${crLabel}) = ${num(closeRate, 1)}%`
            : ""}
        </div>
        <NoteThread itemType="lead" itemRef="pipeline" itemLabel="Leads & quotes" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 5 — ad spend + frequency */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={label}>Ad spend today</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: freqColor,
              border: `1px solid ${freqColor}55`,
              borderRadius: 999,
              padding: "2px 9px",
            }}
          >
            Freq {ads.frequency_7d != null ? num(ads.frequency_7d, 2) : "—"}
          </span>
        </div>
        <div style={{ ...big, fontSize: 34, marginTop: 4 }}>{money(ads.spend_today)}</div>
        <div style={{ ...label, marginTop: 6 }}>
          {ads.leads_today != null ? `${ads.leads_today} leads today` : ""}
          {ads.cpl_today != null ? ` · ${money(ads.cpl_today)} cpl` : ""}
        </div>
        <NoteThread itemType="system" itemRef="ad-spend" itemLabel="Ad spend" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 6 — systems */}
      <div style={card}>
        <span style={label}>Systems</span>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          {(health.subsystems ?? []).map((s: { label: string; health: string; status: string }) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <Dot ok={s.health === "ok" || s.status === "active"} />
              <span style={{ fontSize: 11, color: C.muted }}>{s.label}</span>
            </div>
          ))}
          {(health.subsystems ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        </div>
        {(health.alerts ?? []).length > 0 && (
          <div style={{ ...label, color: C.amber, marginTop: 10 }}>{health.alerts.length} active alert(s)</div>
        )}
        <NoteThread itemType="system" itemRef="systems" itemLabel="Systems" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 7 — flywheel edit rate */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={label}>Flywheel edit rate · Michael</span>
          <span style={{ fontSize: 11.5, color: trendColor(fly.trend_direction) }}>
            {fly.trend_direction ?? ""} {fly.trend_delta_pct != null ? `${fly.trend_delta_pct > 0 ? "+" : ""}${num(fly.trend_delta_pct, 1)}%` : ""}
          </span>
        </div>
        <div style={{ ...big, fontSize: 34, marginTop: 4 }}>
          {fly.rolling_7d_pct != null ? `${num(fly.rolling_7d_pct, 1)}%` : "—"}
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}> 7-day</span>
        </div>
        {fly.category_breakdown && (
          <div style={{ ...label, marginTop: 7 }}>
            {num(fly.category_breakdown.substantive_rewrite_pct, 0)}% rewrite ·{" "}
            {num(fly.category_breakdown.boilerplate_insertion_pct, 0)}% canned ·{" "}
            {num(fly.category_breakdown.signature_removal_pct, 0)}% sig
            {fly.sample_size_ok === false ? " · small-n" : ""}
          </div>
        )}
        <NoteThread itemType="system" itemRef="flywheel" itemLabel="Flywheel edit rate" notes={notes} onPosted={loadNotes} />
      </div>

      {/* squawk box */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={label}>Squawk Box</span>
          <span style={label}>{squawk.count ?? 0}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          {(squawk.activity ?? []).slice(0, 8).map((a: { timestamp: number; sanitized_problem: string; tier: string; status: string }, i: number) => (
            <div key={i} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, color: C.text }}>{(a.sanitized_problem || "(activity)").slice(0, 70)}</span>
                <span style={{ fontSize: 11, color: squawkColor(a.status), whiteSpace: "nowrap" }}>{a.status}</span>
              </div>
              <NoteThread
                itemType="squawk"
                itemRef={`squawk-${a.timestamp}`}
                itemLabel={(a.sanitized_problem || "squawk").slice(0, 40)}
                notes={notes}
                onPosted={loadNotes}
              />
            </div>
          ))}
          {(squawk.activity ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        </div>
      </div>

      <div style={{ textAlign: "center", color: C.muted, fontSize: 11, marginTop: 18 }}>
        Owner-only · live · refreshes on open · NoRepairCost
      </div>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ ...big, fontSize: 24 }}>{v}</div>
      <div style={label}>{k}</div>
    </div>
  );
}

function trendColor(d?: string) {
  if (d === "down") return C.emerald; // lower edit rate = learning
  if (d === "up") return C.amber;
  return C.muted;
}
function squawkColor(s?: string) {
  if (s === "resolved" || s === "auto-fixed") return C.emerald;
  if (s === "failed") return C.red;
  if (s === "pending-approval") return C.amber;
  return C.muted;
}
