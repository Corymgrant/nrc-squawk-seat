"use client";

import { useCallback, useEffect, useState } from "react";
import { ItemNotes, type ConsoleNote } from "@/components/item-notes";

// Operator-console squawk management: the read-only viewer becomes a control surface.
// Full text (no truncation), edit, resolve, archive, dismiss test/PROOF — all reversible
// (soft status, never hard-delete). Notes on a ticket flow to chat-Claude via ItemNotes.

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
function btn(bg: string, color = "#06120D"): React.CSSProperties {
  return {
    background: bg,
    color,
    border: bg === "transparent" ? `1px solid ${C.line}` : "none",
    borderRadius: 9,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

type Ticket = {
  id: string;
  reporter: string | null;
  text: string;
  reply: string | null;
  tier: string | null;
  lead_id: string | null;
  image_path: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  archived_at: string | null;
};

function statusColor(s: string) {
  if (s === "resolved") return C.emerald;
  if (s === "dismissed") return C.muted;
  if (s === "archived") return C.muted;
  return C.amber; // open
}

export function SquawkManager({
  notes,
  onNotePosted,
}: {
  notes: ConsoleNote[];
  onNotePosted: () => void;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<"active" | "all" | "archived" | "dismissed">("active");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null); // image lightbox
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/dashboard/squawks?status=${filter}`, { cache: "no-store" });
      const j = await r.json();
      if (r.ok) {
        setTickets(j.tickets ?? []);
        setCounts(j.counts ?? {});
        setErr(null);
      } else {
        setErr(j.error || "could not load");
      }
    } catch (e) {
      setErr(String(e));
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: string, text?: string) {
    setBusy(id + action);
    try {
      await fetch("/api/dashboard/squawks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, text }),
      });
      setEditing(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function dismissTests() {
    setBusy("dismiss_tests");
    try {
      const r = await fetch("/api/dashboard/squawks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_tests" }),
      });
      const j = await r.json();
      await load();
      if (j.dismissed === 0) setErr("No test/PROOF tickets found to dismiss.");
    } finally {
      setBusy(null);
    }
  }

  const filters: { k: typeof filter; lbl: string }[] = [
    { k: "active", lbl: `open+resolved` },
    { k: "all", lbl: "all" },
    { k: "archived", lbl: `archived ${counts.archived ?? 0}` },
    { k: "dismissed", lbl: `dismissed ${counts.dismissed ?? 0}` },
  ];

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={label}>Squawk tickets · manage</span>
        <span style={{ ...label, color: (counts.open ?? 0) ? C.amber : C.muted }}>{counts.open ?? 0} open</span>
      </div>

      {/* filter chips + bulk dismiss */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        {filters.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            style={{
              ...btn(filter === f.k ? "#0c0f10" : "transparent", filter === f.k ? C.text : C.muted),
              border: `1px solid ${filter === f.k ? C.emerald : C.line}`,
            }}
          >
            {f.lbl}
          </button>
        ))}
        <button onClick={dismissTests} disabled={busy === "dismiss_tests"} style={{ ...btn("transparent", C.red), marginLeft: "auto", border: `1px solid ${C.red}55` }}>
          {busy === "dismiss_tests" ? "…" : "⌫ dismiss test/PROOF"}
        </button>
      </div>

      {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}

      <div style={{ marginTop: 10 }}>
        {tickets.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No tickets.</div>}
        {tickets.map((t, i) => (
          <div key={t.id} style={{ padding: "10px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* FULL text — no truncation */}
                {editing === t.id ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
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
                ) : (
                  <div style={{ fontSize: 13.5, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{t.text}</div>
                )}
                <div style={{ ...label, marginTop: 4, fontSize: 11 }}>
                  {t.reporter ? `${t.reporter} · ` : ""}
                  {new Date(t.created_at).toLocaleString()}
                  {t.tier ? ` · ${t.tier}` : ""}
                  {t.lead_id ? ` · ${t.lead_id}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(t.status), whiteSpace: "nowrap" }}>
                {t.status}
              </span>
            </div>

            {t.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.image_url}
                alt="attachment"
                onClick={() => setExpanded(t.image_url)}
                style={{
                  marginTop: 6,
                  maxHeight: 90,
                  borderRadius: 8,
                  border: `1px solid ${C.line}`,
                  cursor: "pointer",
                  objectFit: "cover",
                }}
              />
            )}

            {t.reply && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: C.muted, paddingLeft: 10, borderLeft: `2px solid ${C.line}` }}>
                ↳ {t.reply}
              </div>
            )}

            {/* actions */}
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {editing === t.id ? (
                <>
                  <button onClick={() => act(t.id, "edit", editText)} disabled={busy === t.id + "edit"} style={btn(C.emerald)}>
                    Save
                  </button>
                  <button onClick={() => setEditing(null)} style={btn("transparent", C.muted)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {t.status !== "resolved" ? (
                    <button onClick={() => act(t.id, "resolve")} disabled={busy === t.id + "resolve"} style={btn("transparent", C.emerald)}>
                      ✓ resolve
                    </button>
                  ) : (
                    <button onClick={() => act(t.id, "reopen")} style={btn("transparent", C.amber)}>
                      ↺ reopen
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditing(t.id);
                      setEditText(t.text);
                    }}
                    style={btn("transparent", C.muted)}
                  >
                    ✎ edit
                  </button>
                  {t.status !== "archived" ? (
                    <button onClick={() => act(t.id, "archive")} style={btn("transparent", C.muted)}>
                      ⌷ archive
                    </button>
                  ) : (
                    <button onClick={() => act(t.id, "unarchive")} style={btn("transparent", C.amber)}>
                      ↑ unarchive
                    </button>
                  )}
                  {t.status !== "dismissed" && (
                    <button onClick={() => act(t.id, "dismiss")} style={btn("transparent", C.red)}>
                      ⌫ dismiss
                    </button>
                  )}
                </>
              )}
            </div>

            <ItemNotes
              itemType="squawk"
              itemRef={`squawk-ticket-${t.id}`}
              itemLabel={(t.text || "squawk").slice(0, 48)}
              notes={notes}
              onPosted={onNotePosted}
            />
          </div>
        ))}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setExpanded(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expanded} alt="attachment" style={{ maxHeight: "90vh", maxWidth: "100%", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
