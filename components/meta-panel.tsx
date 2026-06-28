"use client";

import { useCallback, useEffect, useState } from "react";
import { ItemNotes, type ConsoleNote } from "@/components/item-notes";

// Operator-console Meta ads review panel. READ-ONLY live pull from the Graph API
// (via /api/dashboard/meta) for the metrics Cory reviews — spend, CPL, CTR, frequency,
// reach, results, status — with a per-campaign notes box (existing notes→Claude conduit).
// Frequency > 2.5 flagged (NRC's tighter threshold). No ad edits from here in v1.

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
const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 18,
  padding: 16,
  marginBottom: 12,
  border: `1px solid ${C.line}`,
};
const label: React.CSSProperties = { color: C.muted, fontSize: 12.5, fontWeight: 500, letterSpacing: 0.2 };
function chip(active: boolean): React.CSSProperties {
  return {
    background: active ? "#0c0f10" : "transparent",
    color: active ? C.text : C.muted,
    border: `1px solid ${active ? C.emerald : C.line}`,
    borderRadius: 9,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}
function money(v: number | null | undefined) {
  if (v == null || isNaN(Number(v))) return "—";
  return "$" + Math.round(Number(v)).toLocaleString();
}
function money2(v: number | null | undefined) {
  if (v == null || isNaN(Number(v))) return "—";
  return "$" + Number(v).toFixed(2);
}
function num(v: number | null | undefined, d = 2) {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toFixed(d);
}

type Row = {
  id: string;
  ref: string;
  name: string;
  campaign_name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  freq_flag: boolean;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  leads: number;
  cpl: number | null;
};
type Resp = {
  ok?: boolean;
  error?: string;
  account: string;
  range: string;
  level: string;
  freq_flag_threshold: number;
  totals: { spend: number; leads: number; cpl: number | null };
  rows: Row[];
};

const RANGES: { k: string; lbl: string }[] = [
  { k: "today", lbl: "today" },
  { k: "last_7d", lbl: "7d" },
  { k: "last_14d", lbl: "14d" },
  { k: "last_30d", lbl: "30d" },
];

function statusColor(s: string) {
  if (s === "ACTIVE") return C.emerald;
  if (s === "PAUSED" || s === "CAMPAIGN_PAUSED") return C.muted;
  return C.amber;
}

export function MetaPanel({ notes, onNotePosted }: { notes: ConsoleNote[]; onNotePosted: () => void }) {
  const [data, setData] = useState<Resp | null>(null);
  const [range, setRange] = useState("last_7d");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/dashboard/meta?range=${range}&level=campaign`, { cache: "no-store" });
      const j: Resp = await r.json();
      if (r.ok && j.ok) {
        setData(j);
        setErr(null);
      } else {
        setErr(j.error || "could not load Meta");
        setData(null);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Meta ads · review (read-only)</span>
        <span style={{ ...label, fontSize: 10.5, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 4, padding: "1px 5px" }}>
          {data?.account || "act_623088029316611"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        {RANGES.map((rg) => (
          <button key={rg.k} onClick={() => setRange(rg.k)} style={chip(range === rg.k)}>
            {rg.lbl}
          </button>
        ))}
        <button onClick={load} style={{ ...chip(false), marginLeft: "auto" }}>
          {loading ? "…" : "↻"}
        </button>
      </div>

      {/* totals */}
      {data?.totals && (
        <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 24 }}>{money(data.totals.spend)}</div>
            <div style={label}>spend</div>
          </div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 24 }}>{data.totals.leads}</div>
            <div style={label}>results</div>
          </div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 24 }}>{money2(data.totals.cpl)}</div>
            <div style={label}>cpl</div>
          </div>
        </div>
      )}

      {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}

      <div style={{ marginTop: 10 }}>
        {(data?.rows ?? []).length === 0 && !err && (
          <div style={{ color: C.muted, fontSize: 13 }}>{loading ? "loading…" : "No campaigns with delivery in range."}</div>
        )}
        {(data?.rows ?? []).map((r, i) => {
          const isOpen = open === r.id;
          return (
            <div key={r.id} style={{ padding: "8px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <button
                onClick={() => setOpen(isOpen ? null : r.id)}
                style={{ width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: C.text, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ color: C.muted, fontSize: 11 }}>{isOpen ? "▾" : "▸"}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  </span>
                  <span style={{ fontSize: 12, color: r.freq_flag ? C.red : C.muted, whiteSpace: "nowrap" }}>
                    {money(r.spend)} · {r.leads} res
                  </span>
                </div>
                <div style={{ ...label, marginTop: 3, fontSize: 11, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: statusColor(r.status) }}>{r.status}</span>
                  <span>cpl {money2(r.cpl)}</span>
                  <span>ctr {num(r.ctr, 2)}%</span>
                  <span style={{ color: r.freq_flag ? C.red : C.muted }}>
                    freq {num(r.frequency, 2)}
                    {r.freq_flag ? " ⚑ rotate" : ""}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div style={{ marginTop: 6, paddingLeft: 18 }}>
                  <div style={{ ...label, fontSize: 11.5, lineHeight: 1.5 }}>
                    reach {r.reach != null ? r.reach.toLocaleString() : "—"} · impressions{" "}
                    {r.impressions != null ? r.impressions.toLocaleString() : "—"} · clicks{" "}
                    {r.clicks != null ? r.clicks.toLocaleString() : "—"} · cpc {money2(r.cpc)}
                    {r.objective ? ` · ${r.objective}` : ""}
                  </div>
                  <ItemNotes
                    itemType="ad"
                    itemRef={r.ref}
                    itemLabel={r.name.slice(0, 48)}
                    notes={notes}
                    onPosted={onNotePosted}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ ...label, fontSize: 10.5, marginTop: 10, color: C.muted }}>
        Frequency &gt; {data?.freq_flag_threshold ?? 2.5} flagged. Notes sweep to chat-Claude. Read-only — no ad edits here.
      </div>
    </div>
  );
}
