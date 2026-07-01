"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreativesPanel } from "@/components/creatives-panel";
import { OpportunitiesBoard } from "@/components/opportunities-board";
import { SquawkManager } from "@/components/squawk-manager";
import { MetaPanel } from "@/components/meta-panel";

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

type DrillItem = {
  id: number;
  title: string;
  status?: string;
  progress_pct?: number | null;
  priority?: string | null;
  code?: string | null;
  owner?: string | null;
  track?: string | null;
  blocked_reason?: string;
};

type AdItem = {
  ad_name: string;
  campaign: string;
  reach: number;
  frequency: number;
  spend: number;
  leads: number;
  cpl: number | null;
  rotation: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Panels = Record<string, any>;

type CorrItem = {
  id: number | string;
  not_say: string;
  should_say: string;
  distilled_rule: string | null;
  category?: string;
  applies_to?: string;
  status?: string;
  promote_to_gate?: boolean;
  gate_promoted_at?: string | null;
  created_at?: string;
  reporter?: string | null;
};
type CorrData = {
  total: number;
  active: number;
  compliance_pending_count: number;
  compliance_pending: CorrItem[];
  recent: CorrItem[];
};

function money(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}
function num(n: number | null | undefined, d = 0) {
  if (n == null || isNaN(Number(n))) return "—";
  return Number(n).toFixed(d);
}
function rotationStyle(r?: string) {
  if (r === "danger") return { color: C.red, text: "rotate now" };
  if (r === "warn") return { color: C.amber, text: "rotate soon" };
  return { color: C.emerald, text: "ok" };
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

/* ── expandable row: any board item → click to open detail + its own note field ─ */
function ItemRow({
  title,
  right,
  rightColor,
  detail,
  itemType,
  itemRef,
  itemLabel,
  notes,
  onPosted,
  topBorder = true,
}: {
  title: string;
  right?: string;
  rightColor?: string;
  detail?: React.ReactNode;
  itemType: string;
  itemRef: string;
  itemLabel: string;
  notes: Note[];
  onPosted: () => void;
  topBorder?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mine = notes.filter((n) => n.item_ref === itemRef);
  const openCount = mine.filter((n) => n.status !== "answered").length;
  const answered = mine.some((n) => n.status === "answered");
  const dotColor = openCount ? C.amber : answered ? C.emerald : null;

  return (
    <div style={{ padding: "6px 0", borderTop: topBorder ? `1px solid ${C.line}` : "none" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13, color: C.text, display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: C.muted, fontSize: 11 }}>{open ? "▾" : "▸"}</span>
          {title.slice(0, 86)}
          {dotColor && (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
          )}
        </span>
        {right != null && (
          <span style={{ fontSize: 12, color: rightColor ?? C.emerald, whiteSpace: "nowrap" }}>{right}</span>
        )}
      </button>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 18 }}>
          {detail && <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{detail}</div>}
          <NoteThread
            itemType={itemType}
            itemRef={itemRef}
            itemLabel={itemLabel}
            notes={notes}
            onPosted={onPosted}
          />
        </div>
      )}
    </div>
  );
}

function taskItemRef(id: number | string) {
  return `task-${id}`;
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
  const [asOf, setAsOf] = useState<string | null>(null); // server-side ledger freshness stamp
  const [drill, setDrill] = useState<string | null>(null); // "done" | "in_flight" | "blocked" | null
  const [ksOpen, setKsOpen] = useState(false); // keystone downstream expand
  const [corr, setCorr] = useState<CorrData | null>(null); // "Teach the Assistant" flywheel

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
        setAsOf(j?.data_as_of?.label ?? null);
        setErr(null);
      } else {
        setErr(j.error || "no data");
      }
    } catch (e) {
      setErr(String(e));
    }
    try {
      const rc = await fetch("/api/dashboard/corrections", { cache: "no-store" });
      const jc = await rc.json();
      if (rc.ok) setCorr(jc);
    } catch {
      /* keep last */
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
  const flyE = panels?.flywheel_erika ?? {};
  const dm = panels?.drafter_maturity ?? {}; // Drafter Maturity gauge (READ-ONLY readiness gauge — nothing fires)
  const content = panels?.content ?? {};
  const squawk = panels?.squawk ?? {};
  const ks = panels?.keystone ?? {}; // sequencer keystone (highest-leverage Cory move)

  // Close rate + all-time milestone now ship at the TOP LEVEL of the leads
  // panel (backend: data.get_close_summary — Cory's 2026-06-30 directive =
  // this-month closes ÷ this-month new leads). The old nested `leads.close_rate`
  // matured-cohort object was retired when the headline tile switched to
  // month-to-date (jobs #282/#287), so read close_rate_pct from the top level.
  const closeRate = leads.close_rate_pct != null ? Number(leads.close_rate_pct) : null;
  const allTimeWon = leads.all_time_won;
  const avgDeal =
    leads.won_count && leads.won_revenue ? Number(leads.won_revenue) / Number(leads.won_count) : null;

  const freqColor =
    ads.frequency_level === "danger" ? C.red : ads.frequency_level === "warn" ? C.amber : C.emerald;

  const drillItems: DrillItem[] = drill ? (b.drill?.[drill] ?? []) : [];
  const drillCountColor = (state: string) =>
    state === "blocked" ? C.red : state === "in_flight" ? C.amber : C.emerald;

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button onClick={load} style={btn("transparent", C.muted)}>
            ↻ {updated ? updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "…"}
          </button>
          {asOf && (
            <span style={{ ...label, fontSize: 10, color: C.muted }} title="Ledger read time (server)">
              {asOf}
            </span>
          )}
        </div>
      </div>

      {err && (
        <div style={{ ...card, borderColor: C.red, color: C.red, fontSize: 13 }}>
          Couldn&apos;t reach Cockpit: {err}
        </div>
      )}

      {/* 0 — KEYSTONE: the single highest-leverage Cory move (sequencer) */}
      {ks.keystone ? (
        <div style={{ ...card, borderColor: C.amber }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...label, color: C.amber }}>🎯 Do this next</span>
            <span style={{ ...label, color: C.amber }}>unlocks {ks.n}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, lineHeight: 1.25 }}>
            {ks.keystone.code ? `${ks.keystone.code} · ` : ""}
            {(ks.keystone.title || "").replace(/^\s*[A-G][1-9]\s*·\s*/, "")}
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.35 }}>
            <span style={{ color: C.text, fontWeight: 600 }}>You provide: </span>
            {ks.keystone.needs_from_cory}
          </div>
          <button
            onClick={() => setKsOpen((o) => !o)}
            style={{ ...btn("transparent", C.amber), marginTop: 10, paddingLeft: 0 }}
          >
            {ksOpen ? "▾" : "▸"} unblocks {ks.n} downstream
          </button>
          {ksOpen && (
            <div style={{ marginTop: 4, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
              {(ks.downstream ?? []).map((d: { id: number; code?: string; title?: string; status?: string }) => (
                <ItemRow
                  key={d.id}
                  title={d.title || `#${d.id}`}
                  right={d.status ?? ""}
                  rightColor={C.muted}
                  detail={<>{d.code ? `${d.code} · ` : ""}#{d.id}</>}
                  itemType="build"
                  itemRef={taskItemRef(d.id)}
                  itemLabel={(d.title || `task ${d.id}`).slice(0, 48)}
                  notes={notes}
                  onPosted={loadNotes}
                />
              ))}
            </div>
          )}
          <NoteThread itemType="build" itemRef="keystone" itemLabel="Keystone — do this next" notes={notes} onPosted={loadNotes} />
        </div>
      ) : ks.all_clear ? (
        <div style={{ ...card, borderColor: C.emerald }}>
          <span style={{ ...label, color: C.emerald }}>🎯 Do this next</span>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>No blockers — all clear.</div>
        </div>
      ) : null}

      {/* Notes / Ask inbox */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={label}>Notes / Ask</span>
          <span style={{ ...label, color: openCount ? C.amber : C.muted }}>{openCount} open</span>
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
            {notes.filter((n) => n.status === "answered").length} answered · notes also appear on their item below
          </div>
        )}
      </div>

      {/* 1 — hero build % + tappable drill-down */}
      <div style={card}>
        <span style={label}>Build completion</span>
        <div style={{ ...big, fontSize: 48, marginTop: 2 }}>{b.pct != null ? `${num(b.pct, 1)}%` : "—"}</div>
        <div style={{ height: 7, background: "#0c0f10", borderRadius: 5, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, Number(b.pct) || 0)}%`, height: "100%", background: C.emerald }} />
        </div>

        {/* tappable counts */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <CountChip
            label="done"
            n={b.done}
            active={drill === "done"}
            color={drillCountColor("done")}
            onClick={() => setDrill((d) => (d === "done" ? null : "done"))}
          />
          <CountChip
            label="in flight"
            n={b.summary?.in_flight}
            active={drill === "in_flight"}
            color={drillCountColor("in_flight")}
            onClick={() => setDrill((d) => (d === "in_flight" ? null : "in_flight"))}
          />
          <CountChip
            label="blocked"
            n={b.summary?.blocked}
            active={drill === "blocked"}
            color={drillCountColor("blocked")}
            onClick={() => setDrill((d) => (d === "blocked" ? null : "blocked"))}
          />
        </div>
        <div style={{ ...label, marginTop: 8 }}>
          {b.done ?? "—"} of {b.total ?? "—"} done
          {b.autopilot_pct != null ? ` · ${num(b.autopilot_pct, 0)}% to autopilot` : ""}
        </div>

        {drill && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
            <div style={{ ...label, color: drillCountColor(drill), marginBottom: 2 }}>
              {drill === "in_flight" ? "in flight" : drill} · {drillItems.length}
            </div>
            {drillItems.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
            {drillItems.map((t) => (
              <ItemRow
                key={t.id}
                title={t.title || `#${t.id}`}
                right={
                  t.progress_pct != null && drill !== "done"
                    ? `${Math.round(Number(t.progress_pct))}%`
                    : t.priority ?? ""
                }
                rightColor={drillCountColor(drill)}
                detail={
                  <>
                    {t.code ? `${t.code} · ` : ""}
                    {t.status}
                    {t.owner ? ` · ${t.owner}` : ""}
                    {t.blocked_reason ? ` · blocked on: ${t.blocked_reason}` : ""}
                  </>
                }
                itemType="build"
                itemRef={taskItemRef(t.id)}
                itemLabel={(t.title || `task ${t.id}`).slice(0, 48)}
                notes={notes}
                onPosted={loadNotes}
              />
            ))}
          </div>
        )}

        <NoteThread itemType="build" itemRef="build-overview" itemLabel="Build completion" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 2 — in progress (each row expandable w/ its own note) */}
      <div style={card}>
        <span style={label}>In progress</span>
        <div style={{ marginTop: 8 }}>
          {(b.in_progress ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
          {(b.in_progress ?? []).map(
            (t: { id: number; title: string; progress_pct?: number; priority?: string; status?: string }) => (
              <ItemRow
                key={t.id}
                title={t.title || `#${t.id}`}
                right={t.progress_pct != null ? `${Math.round(Number(t.progress_pct))}%` : t.priority ?? ""}
                detail={<>{t.status}</>}
                itemType="build"
                itemRef={taskItemRef(t.id)}
                itemLabel={(t.title || `task ${t.id}`).slice(0, 48)}
                notes={notes}
                onPosted={loadNotes}
              />
            ),
          )}
        </div>
      </div>

      {/* 3 — shipped this week (each item expandable w/ its own note) */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={label}>Shipped this week</span>
          <span style={{ ...label, color: C.emerald }}>{ship.shipped_count ?? "—"}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          {(ship.shipped ?? []).slice(0, 10).map((s: Record<string, unknown>, i: number) => {
            const sid = (s.id as number) ?? i;
            const stitle = String((s.title as string) || (s.name as string) || (s.row as string) || "shipped");
            return (
              <ItemRow
                key={sid}
                title={`✓ ${stitle}`}
                detail={
                  <>
                    {(s.code as string) ? `${s.code} · ` : ""}
                    {(s.shipped_date as string) || ""}
                    {(s.owner as string) ? ` · ${s.owner}` : ""}
                  </>
                }
                itemType="build"
                itemRef={`ship-${sid}`}
                itemLabel={stitle.slice(0, 48)}
                notes={notes}
                onPosted={loadNotes}
                topBorder={i > 0}
              />
            );
          })}
          {(ship.shipped ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        </div>
        <NoteThread itemType="build" itemRef="shipped-week" itemLabel="Shipped this week" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 4 — leads & quotes */}
      <div style={card}>
        <span style={label}>Leads &amp; quotes · month-to-date</span>
        <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
          <Stat k="Won" v={leads.won_count != null ? String(leads.won_count) : "—"} />
          <Stat k="Revenue" v={money(leads.won_revenue)} />
          <Stat k="Close rate" v={closeRate != null ? `${num(closeRate, 1)}%` : "—"} />
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
          <Stat k="Leads" v={leads.total_leads != null ? String(leads.total_leads) : "—"} sm />
          <Stat k="GCP" v={money(leads.gcp_total)} sm />
          <Stat k="Avg deal" v={money(avgDeal)} sm />
        </div>
        <div style={{ ...label, marginTop: 8 }}>
          {leads.won_count != null && leads.total_leads != null
            ? `${Number(leads.won_count).toLocaleString()} closed of ${Number(leads.total_leads).toLocaleString()} new leads this month${closeRate != null ? ` = ${num(closeRate, 1)}%` : ""}`
            : ""}
          {allTimeWon != null
            ? `  ·  🎉 ${Number(allTimeWon).toLocaleString()} closed all-time`
            : ""}
        </div>
        {(leads.recent_won ?? []).length > 0 && (
          <div style={{ marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 4 }}>
            <div style={{ ...label, marginBottom: 2 }}>recent wins</div>
            {(leads.recent_won ?? [])
              .slice(0, 8)
              .map((w: { lead_name: string; value: number; gcp: number; date_won: string }, i: number) => (
                <ItemRow
                  key={`${w.lead_name}-${i}`}
                  title={w.lead_name || "(won)"}
                  right={money(w.value)}
                  detail={
                    <>
                      won {w.date_won || "—"} · GCP {money(w.gcp)}
                    </>
                  }
                  itemType="lead"
                  itemRef={`won-${w.lead_name}-${w.date_won}`}
                  itemLabel={(w.lead_name || "won").slice(0, 48)}
                  notes={notes}
                  onPosted={loadNotes}
                  topBorder={i > 0}
                />
              ))}
          </div>
        )}
        <NoteThread itemType="lead" itemRef="pipeline" itemLabel="Leads & quotes" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 5 — ad spend + frequency + per-ad rotation */}
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
            Acct freq {ads.frequency_7d != null ? num(ads.frequency_7d, 2) : "—"}
          </span>
        </div>
        <div style={{ ...big, fontSize: 34, marginTop: 4 }}>{money(ads.spend_today)}</div>
        <div style={{ ...label, marginTop: 6 }}>
          {ads.leads_today != null ? `${ads.leads_today} leads today` : ""}
          {ads.cpl_today != null ? ` · ${money(ads.cpl_today)} cpl` : ""}
        </div>

        {/* worst-frequency ad surfaced */}
        {ads.worst_freq_ad && (
          <div
            style={{
              marginTop: 10,
              padding: 9,
              borderRadius: 10,
              border: `1px solid ${rotationStyle(ads.worst_freq_ad.rotation).color}55`,
              background: "#0c0f10",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11.5, color: C.muted }}>highest frequency (7d)</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: rotationStyle(ads.worst_freq_ad.rotation).color }}>
                freq {num(ads.worst_freq_ad.frequency, 2)} · {rotationStyle(ads.worst_freq_ad.rotation).text}
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.text, marginTop: 3 }}>
              {String(ads.worst_freq_ad.ad_name).slice(0, 60)}
            </div>
          </div>
        )}
        {ads.top_ad && (
          <div style={{ ...label, marginTop: 8 }}>
            top performer: {String(ads.top_ad.ad_name).slice(0, 44)} ·{" "}
            {ads.top_ad.cpl != null ? `${money(ads.top_ad.cpl)} cpl` : `${ads.top_ad.leads} leads`}
          </div>
        )}

        {/* per-ad breakdown */}
        {(ads.breakdown ?? []).length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 4 }}>
            <div style={{ ...label, marginBottom: 2 }}>active ads · 7d (worst frequency first)</div>
            {(ads.breakdown as AdItem[]).slice(0, 10).map((a, i) => {
              const rs = rotationStyle(a.rotation);
              return (
                <ItemRow
                  key={`${a.ad_name}-${i}`}
                  title={a.ad_name || "(ad)"}
                  right={`freq ${num(a.frequency, 2)}`}
                  rightColor={rs.color}
                  detail={
                    <>
                      {money(a.spend)} · {a.leads} leads · {a.cpl != null ? `${money(a.cpl)} cpl` : "no cpl"} ·{" "}
                      <span style={{ color: rs.color }}>{rs.text}</span>
                      {a.campaign ? ` · ${a.campaign}` : ""}
                    </>
                  }
                  itemType="system"
                  itemRef={`ad-${a.ad_name}`}
                  itemLabel={(a.ad_name || "ad").slice(0, 48)}
                  notes={notes}
                  onPosted={loadNotes}
                  topBorder={i > 0}
                />
              );
            })}
          </div>
        )}

        <NoteThread itemType="system" itemRef="ad-spend" itemLabel="Ad spend" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 5b — Meta ads review (live Graph API, read-only, per-campaign notes) */}
      <MetaPanel notes={notes} onNotePosted={loadNotes} />

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
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
            <div style={{ ...label, color: C.amber, marginBottom: 2 }}>{health.alerts.length} active alert(s)</div>
            {(health.alerts as Array<Record<string, unknown>>).slice(0, 5).map((al, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.text, padding: "3px 0" }}>
                ⚠ {String(al.message || al.name || al.detail || JSON.stringify(al)).slice(0, 90)}
              </div>
            ))}
          </div>
        )}
        <NoteThread itemType="system" itemRef="systems" itemLabel="Systems" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 7 — flywheel edit rate (Michael + Erika) */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={label}>Flywheel edit rate · Michael</span>
          <span style={{ fontSize: 11.5, color: trendColor(fly.trend_direction) }}>
            {fly.trend_direction ?? ""}{" "}
            {fly.trend_delta_pct != null ? `${fly.trend_delta_pct > 0 ? "+" : ""}${num(fly.trend_delta_pct, 1)}%` : ""}
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
        {/* Erika lane */}
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ ...label }}>Erika</span>
            <span style={{ ...big, fontSize: 18 }}>
              {flyE.rolling_7d_pct != null ? `${num(flyE.rolling_7d_pct, 1)}%` : flyE.no_data ? "no data" : "—"}
              {flyE.rolling_7d_pct != null && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}> 7-day</span>}
            </span>
          </div>
          {flyE.sample_size_ok === false && flyE.rolling_7d_pct != null && (
            <div style={{ ...label, marginTop: 2 }}>small-n</div>
          )}
        </div>
        <NoteThread itemType="system" itemRef="flywheel" itemLabel="Flywheel edit rate" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 7a — Drafter Maturity gauge · email auto-answer readiness (READ-ONLY; nothing fires) */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={label}>Drafter Maturity · auto-answer readiness</span>
          <span style={{ fontSize: 10.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 4, padding: "1px 5px" }}>GAUGE · READ-ONLY</span>
        </div>
        {["michael", "erika"].map((k) => {
          const ld: any = (dm.lanes ?? {})[k] ?? {};
          const name = k.charAt(0).toUpperCase() + k.slice(1);
          const rd = ld.readiness ?? {};
          const span = ld.data_span ?? {};
          const candColor = rd.candidate ? C.emerald : C.muted;
          return (
            <div key={k} style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ ...label, color: C.text, fontWeight: 600 }}>{name}</span>
                    <span style={{ fontSize: 11, color: maturityTrendColor(ld.trend_direction) }}>
                      {ld.trend_direction ?? ""}
                      {ld.trend_delta_pct != null ? ` ${ld.trend_delta_pct > 0 ? "+" : ""}${num(ld.trend_delta_pct, 1)}%` : ""}
                    </span>
                  </div>
                  {ld.no_data ? (
                    <div style={{ ...big, fontSize: 24, marginTop: 4, color: C.muted }}>no sent drafts</div>
                  ) : (
                    <div style={{ ...big, fontSize: 30, marginTop: 4 }}>
                      {ld.rolling_7d_pct != null ? `${num(ld.rolling_7d_pct, 1)}%` : "—"}
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}> 7-day edit-rate</span>
                    </div>
                  )}
                  {!ld.no_data && (
                    <div style={{ ...label, marginTop: 4 }}>
                      {ld.n_7d ?? 0} drafts/7d · {ld.n_today ?? 0} today · {span.days_with_data ?? 0}d of data
                      {ld.sample_size_ok === false ? " · small-n" : ""}
                    </div>
                  )}
                </div>
                {!ld.no_data && (
                  <div style={{ alignSelf: "center", flex: "0 0 auto" }}>
                    <Sparkline daily={ld.daily ?? []} ok={!!rd.candidate} />
                  </div>
                )}
              </div>
              {/* deterministic readiness read — no LLM */}
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ marginTop: 4, width: 8, height: 8, borderRadius: 8, background: candColor, flex: "0 0 auto", boxShadow: `0 0 6px ${candColor}66` }} />
                <span style={{ fontSize: 12, color: C.text, lineHeight: 1.35 }}>{rd.read ?? "—"}</span>
              </div>
            </div>
          );
        })}
        {/* lane split status — canonical vs Sonnet generation lane */}
        <div style={{ marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.35, borderTop: `1px dashed ${C.line}`, paddingTop: 8 }}>
          Lane split (canonical vs Sonnet):{" "}
          {dm.lanes?.michael?.lane_split?.captured ? "captured" : "not captured yet"} — {dm.lanes?.michael?.lane_split?.note ?? ""}
        </div>
        <NoteThread itemType="system" itemRef="drafter_maturity" itemLabel="Drafter Maturity" notes={notes} onPosted={loadNotes} />
      </div>

      {/* 7b — Teach the Assistant flywheel (corrections from the rep seat) */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={label}>Teach the Assistant · corrections</span>
          <span style={{ ...label, color: (corr?.compliance_pending_count ?? 0) ? C.amber : C.muted }}>
            {corr?.compliance_pending_count ?? 0} to gate
          </span>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
          <Stat k="Submitted" v={corr ? String(corr.total) : "—"} />
          <Stat k="Active rules" v={corr ? String(corr.active) : "—"} />
        </div>

        {(corr?.compliance_pending ?? []).length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
            <div style={{ ...label, color: C.amber, marginBottom: 2 }}>
              promote into hard compliance gate
            </div>
            {(corr?.compliance_pending ?? []).map((c) => (
              <ItemRow
                key={`cg-${c.id}`}
                title={c.distilled_rule || c.should_say || "(compliance rule)"}
                right="compliance"
                rightColor={C.amber}
                detail={
                  <>
                    NOT: {String(c.not_say).slice(0, 80)} → SHOULD: {String(c.should_say).slice(0, 80)}
                    {c.reporter ? ` · from ${c.reporter}` : ""}
                  </>
                }
                itemType="squawk"
                itemRef={`correction-${c.id}`}
                itemLabel={(c.distilled_rule || c.should_say || "correction").slice(0, 48)}
                notes={notes}
                onPosted={loadNotes}
              />
            ))}
          </div>
        )}

        {(corr?.recent ?? []).length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
            <div style={{ ...label, marginBottom: 2 }}>recent corrections</div>
            {(corr?.recent ?? []).map((c, i) => (
              <ItemRow
                key={`cr-${c.id}`}
                title={c.distilled_rule || c.should_say || "(rule)"}
                right={c.status === "active" ? "active" : c.status ?? ""}
                rightColor={c.status === "active" ? C.emerald : C.muted}
                detail={
                  <>
                    {c.category ? `${c.category} · ` : ""}
                    {c.applies_to ? `${c.applies_to} · ` : ""}
                    NOT: {String(c.not_say).slice(0, 70)}
                  </>
                }
                itemType="squawk"
                itemRef={`correction-${c.id}`}
                itemLabel={(c.distilled_rule || c.should_say || "correction").slice(0, 48)}
                notes={notes}
                onPosted={loadNotes}
                topBorder={i > 0}
              />
            ))}
          </div>
        )}
        {corr && corr.total === 0 && (
          <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>No corrections yet.</div>
        )}
        <NoteThread itemType="system" itemRef="corrections" itemLabel="Teach the Assistant" notes={notes} onPosted={loadNotes} />
        {/* surface the live correction window + screenshot/image drag (reuses SquawkConsole; not a rebuild) */}
        <Link
          href="/dashboard/teach"
          style={{
            display: "block",
            marginTop: 10,
            textAlign: "center",
            background: "#0c0f10",
            color: C.emerald,
            border: `1px solid ${C.emerald}55`,
            borderRadius: 10,
            padding: "9px 11px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ✎ Teach the Assistant · report with screenshot →
        </Link>
      </div>

      {/* 8 — content queue (read-only) */}
      {!content.no_data && ((content.items ?? []).length > 0 || (content.summary?.total ?? 0) > 0) && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={label}>Content queue</span>
            <span style={{ ...label, color: (content.summary?.need_eyes ?? 0) ? C.amber : C.muted }}>
              {content.summary?.need_eyes ?? 0} need eyes · {content.summary?.total ?? 0} total
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            {(content.items ?? []).map(
              (it: { id: number; title: string; status: string; excerpt?: string }, i: number) => (
                <ItemRow
                  key={it.id}
                  title={it.title || "(untitled)"}
                  right={it.status}
                  rightColor={it.status === "flagged" ? C.amber : C.muted}
                  detail={<>{it.excerpt || it.status}</>}
                  itemType="system"
                  itemRef={`content-${it.id}`}
                  itemLabel={(it.title || "content").slice(0, 48)}
                  notes={notes}
                  onPosted={loadNotes}
                  topBorder={i > 0}
                />
              ),
            )}
            {(content.items ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
          </div>
        </div>
      )}

      {/* squawk box */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={label}>Squawk Box</span>
          <span style={label}>{squawk.count ?? 0}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          {(squawk.activity ?? [])
            .slice(0, 8)
            .map(
              (
                a: { timestamp: number; sanitized_problem: string; tier: string; status: string },
                i: number,
              ) => (
                <div key={i} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.text }}>
                      {(a.sanitized_problem || "(activity)").slice(0, 70)}
                    </span>
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
              ),
            )}
          {(squawk.activity ?? []).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        </div>
      </div>

      {/* squawk tickets — full-text read + manage (resolve/archive/dismiss/edit) */}
      <SquawkManager notes={notes} onNotePosted={loadNotes} />

      {/* 9 — Finished Creatives review (rate / keep-kill / annotate finished assets) */}
      <CreativesPanel />

      {/* 10 — Opportunities board: ranked findings + Approve/Deny (owner-gated, bounded) */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 8 }}>Opportunities · approve / deny</div>
        <OpportunitiesBoard />
      </div>

      <div style={{ textAlign: "center", color: C.muted, fontSize: 11, marginTop: 18 }}>
        Owner-only · live · refreshes on open · NoRepairCost
      </div>
    </main>
  );
}

function CountChip({
  label: lbl,
  n,
  active,
  color,
  onClick,
}: {
  label: string;
  n: number | null | undefined;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? `${color}22` : "#0c0f10",
        border: `1px solid ${active ? color : C.line}`,
        borderRadius: 12,
        padding: "8px 6px",
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      <div style={{ ...big, fontSize: 20, color }}>{n ?? "—"}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{lbl}</div>
    </button>
  );
}

function Stat({ k, v, sm = false }: { k: string; v: string; sm?: boolean }) {
  return (
    <div>
      <div style={{ ...big, fontSize: sm ? 18 : 24 }}>{v}</div>
      <div style={label}>{k}</div>
    </div>
  );
}

function trendColor(d?: string) {
  if (d === "down") return C.emerald; // lower edit rate = learning
  if (d === "up") return C.amber;
  return C.muted;
}
// Drafter-maturity trend: backend emits "down (learning)" / "up (regressing)" / "flat".
function maturityTrendColor(d?: string) {
  if (!d) return C.muted;
  if (d.startsWith("down")) return C.emerald; // edit-rate falling = maturing = good
  if (d.startsWith("up")) return C.amber; // edit-rate rising = regressing
  return C.muted;
}
// Mini edit-rate sparkline: daily normalized_pct over the window. Lower = more
// mature. Dot color = readiness candidate (emerald) vs not (amber). Read-only.
function Sparkline({
  daily,
  ok,
}: {
  daily: { day: string; n: number; normalized_pct: number | null; small_n?: boolean }[];
  ok: boolean;
}) {
  const pts = (daily ?? []).filter((d) => d && d.normalized_pct != null);
  if (pts.length < 2) {
    return <span style={{ fontSize: 11, color: C.muted }}>not enough days to chart</span>;
  }
  const W = 132, H = 34, pad = 3;
  const vals = pts.map((p) => Number(p.normalized_pct));
  const lo = Math.min(...vals, 0);
  const hi = Math.max(...vals, 1);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const line = pts.map((p, i) => `${x(i)},${y(Number(p.normalized_pct))}`).join(" ");
  const stroke = ok ? C.emerald : C.amber;
  const last = pts[pts.length - 1];
  return (
    <svg width={W} height={H} style={{ display: "block" }} aria-label="edit-rate trend">
      <polyline points={line} fill="none" stroke={stroke} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      <circle cx={x(pts.length - 1)} cy={y(Number(last.normalized_pct))} r={2.6} fill={stroke} />
    </svg>
  );
}
function squawkColor(s?: string) {
  if (s === "resolved" || s === "auto-fixed") return C.emerald;
  if (s === "failed") return C.red;
  if (s === "pending-approval") return C.amber;
  return C.muted;
}
