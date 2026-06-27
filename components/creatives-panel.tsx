"use client";

import { useCallback, useEffect, useState } from "react";

/* Finished Creatives review panel. Lists finished creative assets from the
   Cockpit creative bench (creative_review_ledger) and lets the owner rate,
   keep/kill, and annotate them. Revision/annotation writes back to the bench so
   the creative agent learns from it. Read + bounded-write, owner-gated upstream. */

const C = {
  card: "#14181A",
  inner: "#0F1314",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
  red: "#F2655A",
  line: "#222829",
};

type Creative = {
  id: number;
  asset_id?: string;
  batch?: string;
  asset_type?: string;
  concept?: string;
  variant?: string;
  ratio?: string;
  drive_file_id?: string;
  preview_url?: string;
  gate_results?: string;
  status?: string;
  rating?: number | null;
  keep_kill?: string | null;
  tags?: string | null;
  notes?: string | null;
  rated_by?: string | null;
  rated_at?: string | null;
  created_at?: string;
};

const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 18,
  padding: 16,
  marginBottom: 12,
  border: `1px solid ${C.line}`,
};
const label: React.CSSProperties = { color: C.muted, fontSize: 12.5, fontWeight: 500 };

export function CreativesPanel() {
  const [items, setItems] = useState<Creative[]>([]);
  const [fresh, setFresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // local draft of notes/tags per row so typing doesn't fight the fetched value
  const [draft, setDraft] = useState<Record<number, { notes: string; tags: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/creatives", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const rows: Creative[] = j?.creatives ?? [];
      setItems(rows);
      setFresh(j?.fresh_unrated ?? 0);
      setDraft((d) => {
        const next = { ...d };
        for (const r of rows) {
          if (next[r.id] === undefined) {
            next[r.id] = { notes: r.notes ?? "", tags: r.tags ?? "" };
          }
        }
        return next;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = useCallback(
    async (id: number, patch: Record<string, unknown>) => {
      setBusy(id);
      try {
        const res = await fetch("/api/dashboard/creatives/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Finished Creatives</div>
        <div style={label}>
          {fresh > 0 ? `${fresh} awaiting review` : `${items.length} reviewed`}
        </div>
      </div>
      <div style={{ ...label, marginTop: 2 }}>
        Rate, keep/kill, and annotate finished assets — feedback trains the creative agent.
      </div>

      {loading && <div style={{ ...label, marginTop: 12 }}>Loading…</div>}
      {err && <div style={{ color: C.red, marginTop: 12, fontSize: 13 }}>Error: {err}</div>}

      {!loading && !err && items.length === 0 && (
        <div style={{ ...label, marginTop: 14, lineHeight: 1.5 }}>
          No finished creatives in the bench yet. When the creative agent stages a render
          batch, finished assets land here for your review.
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => {
          const d = draft[it.id] ?? { notes: it.notes ?? "", tags: it.tags ?? "" };
          const rated = !!(it.rating || it.keep_kill);
          return (
            <div
              key={it.id}
              style={{
                background: C.inner,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                padding: 12,
                display: "flex",
                gap: 12,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.preview_url ? (
                <img
                  src={it.preview_url}
                  alt={it.concept || it.asset_id || "creative"}
                  style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, flex: "0 0 auto" }}
                />
              ) : (
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 10,
                    flex: "0 0 auto",
                    background: "#0A0D0D",
                    border: `1px dashed ${C.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: C.muted,
                    fontSize: 11,
                  }}
                >
                  {it.ratio || "no preview"}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>
                  {it.concept || it.asset_id || `asset #${it.id}`}
                  {it.variant ? ` · ${it.variant}` : ""}
                </div>
                <div style={{ ...label, marginTop: 2 }}>
                  {[it.asset_type, it.ratio, it.batch, it.status].filter(Boolean).join(" · ")}
                  {rated && it.rated_by ? ` · reviewed by ${it.rated_by}` : ""}
                </div>

                {/* rating 0-5 */}
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={label}>Rating</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      disabled={busy === it.id}
                      onClick={() => review(it.id, { rating: n })}
                      style={{
                        cursor: "pointer",
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border: `1px solid ${C.line}`,
                        background: (it.rating || 0) >= n ? C.amber : "transparent",
                        color: (it.rating || 0) >= n ? "#0B0D0C" : C.muted,
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {/* keep / hold / kill */}
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  {(["keep", "hold", "kill"] as const).map((k) => {
                    const active = it.keep_kill === k;
                    const col = k === "keep" ? C.emerald : k === "kill" ? C.red : C.amber;
                    return (
                      <button
                        key={k}
                        disabled={busy === it.id}
                        onClick={() => review(it.id, { keep_kill: k })}
                        style={{
                          cursor: "pointer",
                          padding: "4px 12px",
                          borderRadius: 8,
                          border: `1px solid ${active ? col : C.line}`,
                          background: active ? col : "transparent",
                          color: active ? "#0B0D0C" : C.muted,
                          fontWeight: 600,
                          fontSize: 12,
                          textTransform: "capitalize",
                        }}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>

                {/* annotation: notes + tags */}
                <textarea
                  value={d.notes}
                  disabled={busy === it.id}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [it.id]: { ...d, notes: e.target.value } }))
                  }
                  placeholder="Revision notes / annotation…"
                  rows={2}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    background: "#0A0D0D",
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 13,
                    padding: 8,
                    resize: "vertical",
                  }}
                />
                <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                  <input
                    value={d.tags}
                    disabled={busy === it.id}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [it.id]: { ...d, tags: e.target.value } }))
                    }
                    placeholder="tags (comma-separated)"
                    style={{
                      flex: 1,
                      background: "#0A0D0D",
                      border: `1px solid ${C.line}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 13,
                      padding: "6px 8px",
                    }}
                  />
                  <button
                    disabled={busy === it.id}
                    onClick={() => review(it.id, { notes: d.notes, tags: d.tags })}
                    style={{
                      cursor: "pointer",
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: `1px solid ${C.emerald}`,
                      background: C.emerald,
                      color: "#0B0D0C",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {busy === it.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
