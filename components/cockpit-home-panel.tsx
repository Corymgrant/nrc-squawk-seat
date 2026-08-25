"use client";

// job 2120 — THE COCKPIT DASHBOARD v1. One consolidated "Home" surface,
// modes-not-panes (Apple-HIG anti-Meta/anti-QuickBooks bar): a single
// continuous card stack, not another layer of sub-tabs. Five sections per
// the row-2120 cook:
//   1. Needs-Cory to-do card  — merges Inbox Sentinel + open gate/notes cards
//      + expired-default objective taps into one sorted, tappable list.
//   2. Objectives Rail (A-H) + honest Autonomy Gauge.
//   3. KPI tiles — leads vs floor(80), spend pace vs glide, real CPL, Lane B
//      shadow count, batch-1 recovery (explicitly "no live source" if unwired).
//   4. Squawk + Page feed — reuses the same panels.squawk data the Squawk tab
//      already loads (no new plumbing).
//   5. Cook Queue strip — running/queued/parked/blocked with age.
//
// HALO freshness invariant: every section renders its own `stale` flag as a
// visible badge rather than silently showing a possibly-old number.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
const big: React.CSSProperties = { color: C.text, fontWeight: 700, lineHeight: 1.05 };

function StaleBadge({ stale, reason }: { stale?: boolean; reason?: string | null }) {
  if (!stale) return null;
  return (
    <span
      title={reason || "data may be out of date"}
      style={{
        fontSize: 10,
        color: C.amber,
        border: `1px solid ${C.amber}66`,
        borderRadius: 5,
        padding: "1px 5px",
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      STALE
    </span>
  );
}

function money(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "—";
  return "$" + Math.round(Number(n)).toLocaleString();
}

// ── types (mirrors cockpit_v1.py's assemble() shape) ─────────────────────────
type InboxItem = {
  id: string; from: string; subject: string; age_hours: number | null;
  aged: boolean; thread_url: string; counterpart: string | null;
};
type NoteLike = {
  id: number; item_type: string; item_ref: string | null; item_label: string | null;
  body: string; status: string; created_at: string;
};
type ExpiredDefault = {
  key: string; objective: string; action: string; reason: string; deadline: string;
};
type ObjectiveItem = {
  key: string; name: string; progress_pct: number | null; status: string;
  next_step: string | null; blocker: string | null; last_advanced_date: string | null;
};
type CookQueueItem = {
  id: number; title: string; status: string; priority: string | null;
  owner: string | null; age_hours: number | null; waiting_on: string | null;
};
type CockpitV1 = {
  generated_at: string;
  objectives: { items: ObjectiveItem[]; stale?: boolean; stale_reason?: string | null; no_data?: boolean };
  autonomy_gauge: {
    autonomy_pct: number | null; n_auto_resolved: number; n_cory_input: number;
    n_ambiguous: number; n_touched_total: number; sample_size_ok: boolean;
    window_days: number; definition: string; no_data?: boolean;
  };
  kpi_tiles: {
    leads: { leads_today?: number; leads_yesterday?: number; floor?: number; today_vs_floor?: string; no_data?: boolean };
    spend_pace: { budget_line_glide?: number; spend?: number; pace_pct?: number; verdict?: string; stale?: boolean; no_data?: boolean };
    cpl_cvr: { real_cpl_usd?: number | null; close_rate_pct?: number | null; quote_rate_pct?: number | null; lp_cvr_no_source?: boolean; stale?: boolean; no_data?: boolean };
    batch1_recovery_sends: { no_data?: boolean; reason?: string };
    lane_b_shadow: { real_drafts?: number; total_drafts?: number; graduation_threshold?: number; stale?: boolean; no_data?: boolean };
  };
  cook_queue: { items: CookQueueItem[]; by_status: Record<string, number>; no_data?: boolean };
  expired_defaults: { items: ExpiredDefault[]; no_data?: boolean };
  error?: string;
};

function statusColor(s: string) {
  if (s === "blocked" || s === "failed") return C.red;
  if (s === "parked" || s === "needs-decision" || s === "queued") return C.amber;
  if (s === "in-progress") return C.emerald;
  return C.muted;
}
function objStatusColor(s: string) {
  if (s === "blocked_on_cory") return C.amber;
  if (s === "gated") return C.muted;
  return C.emerald;
}

// ── Needs-Cory unified card ───────────────────────────────────────────────────
function NeedsCoryCard({
  inboxItems,
  onInboxAction,
  gateNotes,
  onAckNote,
  expired,
}: {
  inboxItems: InboxItem[];
  onInboxAction: (id: string, action: "dismiss" | "snooze") => void;
  gateNotes: NoteLike[];
  onAckNote: (id: number) => void;
  expired: ExpiredDefault[];
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  const total = inboxItems.length + gateNotes.length + expired.length;
  const INBOX_CAP = 8;
  const shownInbox = inboxItems.slice(0, INBOX_CAP);
  const hiddenInboxCount = inboxItems.length - shownInbox.length;

  return (
    <div style={{ ...card, borderColor: total > 0 ? C.amber : C.line }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...label, color: C.text, fontSize: 15, fontWeight: 700 }}>Needs you</span>
        <span style={{ ...label, color: total > 0 ? C.amber : C.emerald }}>{total} open</span>
      </div>

      {total === 0 && <div style={{ color: C.emerald, fontSize: 13, marginTop: 8 }}>clean — nothing waiting on you</div>}

      {expired.map((e) => (
        <div key={`exp-${e.key}`} style={{ padding: "8px 0", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ color: C.amber, fontSize: 10.5, fontWeight: 700 }}>⏰ EXPIRED DEFAULT</span>
            <span style={{ color: C.muted, fontSize: 10.5 }}>{e.key} · was due {e.deadline}</span>
          </div>
          <div style={{ color: C.text, fontSize: 13, marginTop: 3 }}>{e.action}</div>
        </div>
      ))}

      {gateNotes.map((n) => (
        <div key={`note-${n.id}`} style={{ padding: "8px 0", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ color: C.muted, fontSize: 10.5 }}>gate · {n.item_label || n.item_type}</span>
              <div style={{ color: C.text, fontSize: 13, marginTop: 2 }}>{n.body.slice(0, 140)}</div>
            </div>
            <button
              onMouseDown={() => setPressed(`note-${n.id}`)}
              onMouseUp={() => setPressed(null)}
              onTouchStart={() => setPressed(`note-${n.id}`)}
              onTouchEnd={() => setPressed(null)}
              onClick={() => onAckNote(n.id)}
              style={{
                background: "transparent", border: `1px solid ${C.emerald}`, color: C.emerald,
                borderRadius: 8, padding: "4px 9px", fontSize: 11, flexShrink: 0, cursor: "pointer",
                transform: pressed === `note-${n.id}` ? "scale(0.94)" : undefined,
              }}
            >
              ✓ handled
            </button>
          </div>
        </div>
      ))}

      {shownInbox.map((i) => (
        <div key={`inbox-${i.id}`} style={{ padding: "8px 0", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <a href={i.thread_url} target="_blank" rel="noreferrer" style={{ minWidth: 0, textDecoration: "none", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                {i.aged && <span style={{ color: C.red, fontSize: 10.5 }}>⚠️ AGED</span>}
                <span style={{ color: C.muted, fontSize: 10.5 }}>email</span>
              </div>
              <div style={{ color: C.text, fontSize: 13, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {i.subject || "(no subject)"}
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
                {i.from} · {i.age_hours != null ? `${Math.round(i.age_hours)}h ago` : ""}
              </div>
            </a>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => onInboxAction(i.id, "snooze")} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "4px 9px", fontSize: 11, cursor: "pointer" }}>snooze</button>
              <button onClick={() => onInboxAction(i.id, "dismiss")} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "4px 9px", fontSize: 11, cursor: "pointer" }}>dismiss</button>
            </div>
          </div>
        </div>
      ))}
      {hiddenInboxCount > 0 && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11.5, color: C.muted }}>
          +{hiddenInboxCount} more in Inbox — see full list on the Ops tab
        </div>
      )}
    </div>
  );
}

// ── Objectives Rail + Autonomy Gauge ─────────────────────────────────────────
function ObjectivesRail({ data }: { data: CockpitV1["objectives"] }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...label, color: C.text, fontSize: 15, fontWeight: 700 }}>Objectives · A–H</span>
        <StaleBadge stale={data.stale} reason={data.stale_reason} />
      </div>
      {data.no_data && <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>—</div>}
      {(data.items || []).map((o) => (
        <div key={o.key} style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{o.key} · {o.name}</span>
            <span style={{ fontSize: 12, color: objStatusColor(o.status) }}>{o.progress_pct != null ? `${Math.round(o.progress_pct)}%` : "—"}</span>
          </div>
          <div style={{ height: 5, background: "#0c0f10", borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, Number(o.progress_pct) || 0)}%`, height: "100%", background: objStatusColor(o.status) }} />
          </div>
          {o.blocker && <div style={{ fontSize: 11, color: C.amber, marginTop: 3 }}>blocked: {o.blocker}</div>}
        </div>
      ))}
    </div>
  );
}

function AutonomyGauge({ data }: { data: CockpitV1["autonomy_gauge"] }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Autonomy gauge · {data.window_days ?? 7}d</span>
        {!data.sample_size_ok && !data.no_data && <span style={{ ...label, fontSize: 10 }}>small-n</span>}
      </div>
      {data.no_data ? (
        <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>—</div>
      ) : (
        <>
          <div style={{ ...big, fontSize: 40, marginTop: 4 }}>
            {data.autonomy_pct != null ? `${data.autonomy_pct}%` : "—"}
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}> resolved without you</span>
          </div>
          <div style={{ ...label, marginTop: 6 }}>
            {data.n_auto_resolved} auto-resolved · {data.n_cory_input} needed you · {data.n_ambiguous} unclassified
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{data.definition}</div>
        </>
      )}
    </div>
  );
}

// ── KPI tiles ─────────────────────────────────────────────────────────────────
function KpiTile({ title, children, stale, noData, reason }: { title: string; children?: React.ReactNode; stale?: boolean; noData?: boolean; reason?: string }) {
  return (
    <div style={{ ...card, flex: "1 1 45%", minWidth: 150, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...label, fontSize: 11 }}>{title}</span>
        <StaleBadge stale={stale} />
      </div>
      {noData ? (
        <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>no live source{reason ? ` — ${reason.slice(0, 60)}` : ""}</div>
      ) : (
        <div style={{ marginTop: 6 }}>{children}</div>
      )}
    </div>
  );
}

function KpiTiles({ data }: { data: CockpitV1["kpi_tiles"] }) {
  const leads = data.leads || {};
  const spend = data.spend_pace || {};
  const cpl = data.cpl_cvr || {};
  const laneB = data.lane_b_shadow || {};
  const batch1 = data.batch1_recovery_sends || {};
  const belowFloor = leads.today_vs_floor === "below";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <KpiTile title="Leads today vs floor(80)" noData={leads.no_data}>
        <div style={{ ...big, fontSize: 26, color: belowFloor ? C.amber : C.emerald }}>{leads.leads_today ?? "—"}</div>
        <div style={label}>yesterday {leads.leads_yesterday ?? "—"} · floor {leads.floor ?? 80}</div>
      </KpiTile>
      <KpiTile title="Spend pace vs glide" stale={spend.stale} noData={spend.no_data}>
        <div style={{ ...big, fontSize: 26, color: spend.verdict === "breach" ? C.red : C.emerald }}>
          {spend.pace_pct != null ? `${spend.pace_pct}%` : "—"}
        </div>
        <div style={label}>{money(spend.spend)} of {money(spend.budget_line_glide)} glide</div>
      </KpiTile>
      <KpiTile title="Real CPL · Close-side" stale={cpl.stale} noData={cpl.no_data}>
        <div style={{ ...big, fontSize: 26 }}>{cpl.real_cpl_usd != null ? `$${cpl.real_cpl_usd}` : "—"}</div>
        <div style={label}>close rate {cpl.close_rate_pct != null ? `${cpl.close_rate_pct}%` : "—"}</div>
      </KpiTile>
      <KpiTile title="LP CVR" noData reason="no visitor-level LP conversion source wired for v1">
        <span />
      </KpiTile>
      <KpiTile title="Batch-1 recovery sends" noData={batch1.no_data} reason={batch1.reason}>
        <span />
      </KpiTile>
      <KpiTile title="Lane B shadow drafts" stale={laneB.stale} noData={laneB.no_data}>
        <div style={{ ...big, fontSize: 26 }}>{laneB.real_drafts ?? "—"} <span style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>/ {laneB.graduation_threshold ?? 10}</span></div>
        <div style={label}>{laneB.total_drafts ?? 0} total drafts</div>
      </KpiTile>
    </div>
  );
}

// ── Cook Queue strip ───────────────────────────────────────────────────────────
function CookQueueStrip({ data }: { data: CockpitV1["cook_queue"] }) {
  const items = data.items || [];
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...label, color: C.text, fontSize: 15, fontWeight: 700 }}>Cook queue · why we're waiting</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {Object.entries(data.by_status || {}).map(([s, n]) => (
          <span key={s} style={{ fontSize: 11, color: statusColor(s), border: `1px solid ${statusColor(s)}55`, borderRadius: 999, padding: "2px 9px" }}>
            {s} {n}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 10, maxHeight: 320, overflowY: "auto" }}>
        {items.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        {items.map((it, i) => (
          <div key={it.id} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                #{it.id} {it.title}
              </span>
              <span style={{ fontSize: 11, color: statusColor(it.status), whiteSpace: "nowrap" }}>
                {it.status} · {it.age_hours != null ? `${it.age_hours}h` : "—"}
              </span>
            </div>
            {it.waiting_on && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>waiting on: {it.waiting_on}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Squawk + Page feed (reuses panels.squawk already fetched by dashboard-client) ─
function SquawkPageFeed({ squawk }: { squawk: { count?: number; activity?: Array<{ timestamp: number; sanitized_problem: string; tier: string; status: string }> } }) {
  const activity = (squawk?.activity ?? []).slice(0, 10);
  const cutoff = Date.now() / 1000 - 48 * 3600;
  const recent = activity.filter((a) => !a.timestamp || a.timestamp >= cutoff);
  function color(s?: string) {
    if (s === "resolved" || s === "auto-fixed") return C.emerald;
    if (s === "failed") return C.red;
    if (s === "pending-approval") return C.amber;
    return C.muted;
  }
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...label, color: C.text, fontSize: 15, fontWeight: 700 }}>Squawk + page feed · 48h</span>
        <span style={label}>{squawk?.count ?? 0}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {recent.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        {recent.map((a, i) => (
          <div key={i} style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {(a.sanitized_problem || "(activity)").slice(0, 70)}
            </span>
            <span style={{ fontSize: 11, color: color(a.status), whiteSpace: "nowrap" }}>{a.status}</span>
          </div>
        ))}
      </div>
      <Link href="#" onClick={(e) => { e.preventDefault(); document.querySelector<HTMLButtonElement>('[data-tab-btn="squawk"]')?.click(); }}
        style={{ display: "block", marginTop: 10, textAlign: "center", color: C.emerald, fontSize: 12.5, textDecoration: "none" }}>
        full Squawk tab →
      </Link>
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export function CockpitHomePanel({
  squawk,
  notes,
  loadNotes,
}: {
  squawk: { count?: number; activity?: Array<{ timestamp: number; sanitized_problem: string; tier: string; status: string }> };
  notes: NoteLike[];
  loadNotes: () => void;
}) {
  const [v1, setV1] = useState<CockpitV1 | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [v1Err, setV1Err] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/cockpit-v1", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && !j.error) {
        setV1(j);
        setV1Err(null);
      } else {
        setV1Err(j.error || "could not load cockpit-v1");
      }
    } catch (e) {
      setV1Err(String(e));
    }
    try {
      const ri = await fetch("/api/owner/inbox-needs-you", { cache: "no-store" });
      const ji = await ri.json();
      if (ri.ok && !ji.error) setInbox(ji.items ?? []);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);

  const inboxAction = useCallback(
    async (id: string, action: "dismiss" | "snooze") => {
      setInbox((s) => s.filter((i) => i.id !== id));
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

  const ackNote = useCallback(
    async (id: number) => {
      try {
        await fetch("/api/dashboard/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } finally {
        loadNotes();
      }
    },
    [loadNotes]
  );

  const gateNotes = notes.filter((n) => n.status === "open" && n.item_ref !== "freeform-inbox");
  const expired = v1?.expired_defaults?.items ?? [];

  return (
    <div>
      {v1Err && (
        <div style={{ ...card, borderColor: C.red, color: C.red, fontSize: 13 }}>
          Couldn&apos;t reach Cockpit v1: {v1Err}
        </div>
      )}

      <NeedsCoryCard
        inboxItems={inbox}
        onInboxAction={inboxAction}
        gateNotes={gateNotes}
        onAckNote={ackNote}
        expired={expired}
      />

      {v1 && <AutonomyGauge data={v1.autonomy_gauge} />}
      {v1 && <ObjectivesRail data={v1.objectives} />}
      {v1 && <KpiTiles data={v1.kpi_tiles} />}
      <SquawkPageFeed squawk={squawk} />
      {v1 && <CookQueueStrip data={v1.cook_queue} />}
    </div>
  );
}
