"use client";

import { useCallback, useEffect, useState } from "react";

/* Finished Creatives review panel. Lists finished creative assets from the
   Cockpit creative bench (creative_review_ledger) and lets the owner record
   HIS OWN verdict (approve/reject) + typed notes after watching the ad.

   The verdict + notes field is DEDICATED and EMPTY by default — it is never
   pre-filled with AI text, so there is nothing to delete. Any AI-generated
   metadata is shown read-only in a clearly-labeled, separate block so the two
   can never be confused. The typed verdict + reason is the TRAINING SIGNAL that
   feeds the brand-soul corpus / flywheel (job #287). Owner-gated upstream. */

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
  notes?: string | null; // AI metadata (auto-generated) — read-only
  human_verdict?: string | null; // Cory's own verdict: approve | reject | ""
  human_notes?: string | null; // Cory's typed reason/notes — empty by default
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
  // local draft of the HUMAN verdict + notes per row. Seeded ONLY from the
  // dedicated human_* columns (never from the AI `notes` field) so the box is
  // empty until Cory has typed something himself.
  const [draft, setDraft] = useState<Record<number, { verdict: string; notes: string }>>({});

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
            // EMPTY by default — seeded only from Cory's own prior input.
            next[r.id] = { verdict: r.human_verdict ?? "", notes: r.human_notes ?? "" };
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

  // One-tap submit: pick a verdict and fire the current typed note in a single
  // write (fast on mobile). The note can be empty — the verdict alone is a valid
  // signal — but it is HIS note, never pre-filled.
  const submitVerdict = useCallback(
    (id: number, verdict: "approve" | "reject") => {
      const d = draft[id] ?? { verdict: "", notes: "" };
      review(id, { human_verdict: verdict, human_notes: d.notes });
    },
    [draft, review],
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
        Watch the ad, then type YOUR verdict + notes — that&apos;s what trains the creative engine.
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
          const d = draft[it.id] ?? { verdict: it.human_verdict ?? "", notes: it.human_notes ?? "" };
          const verdict = d.verdict || it.human_verdict || "";
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
                flexWrap: "wrap",
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

              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>
                  {it.concept || it.asset_id || `asset #${it.id}`}
                  {it.variant ? ` · ${it.variant}` : ""}
                </div>
                <div style={{ ...label, marginTop: 2 }}>
                  {[it.asset_type, it.ratio, it.batch, it.status].filter(Boolean).join(" · ")}
                  {it.rated_by && verdict ? ` · ${verdict} by ${it.rated_by}` : ""}
                </div>

                {/* ── YOUR verdict + notes (dedicated, empty by default) ── */}
                <div style={{ ...label, marginTop: 12, color: C.text, fontWeight: 700 }}>
                  Your verdict + notes
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                  {(["approve", "reject"] as const).map((v) => {
                    const active = verdict === v;
                    const col = v === "approve" ? C.emerald : C.red;
                    return (
                      <button
                        key={v}
                        disabled={busy === it.id}
                        onClick={() => submitVerdict(it.id, v)}
                        style={{
                          cursor: "pointer",
                          flex: 1,
                          minHeight: 44, // mobile-friendly tap target
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1px solid ${active ? col : C.line}`,
                          background: active ? col : "transparent",
                          color: active ? "#0B0D0C" : C.text,
                          fontWeight: 700,
                          fontSize: 15,
                          textTransform: "capitalize",
                        }}
                      >
                        {v === "approve" ? "✓ Approve" : "✗ Reject"}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={d.notes}
                  disabled={busy === it.id}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [it.id]: { ...d, notes: e.target.value } }))
                  }
                  placeholder="Your notes after watching — why it works or doesn't (optional)"
                  rows={2}
                  inputMode="text"
                  style={{
                    marginTop: 8,
                    width: "100%",
                    background: "#0A0D0D",
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 16, // 16px avoids iOS zoom-on-focus
                    padding: 10,
                    resize: "vertical",
                  }}
                />
                <button
                  disabled={busy === it.id}
                  onClick={() =>
                    review(it.id, { human_verdict: verdict || undefined, human_notes: d.notes })
                  }
                  style={{
                    marginTop: 8,
                    width: "100%",
                    minHeight: 44,
                    cursor: "pointer",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${C.emerald}`,
                    background: C.emerald,
                    color: "#0B0D0C",
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {busy === it.id ? "Saving…" : "Save verdict + notes"}
                </button>

                {/* ── AI metadata (auto-generated) — read-only, clearly separate ── */}
                {(it.notes || it.tags) && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ ...label, cursor: "pointer" }}>
                      AI metadata (auto-generated) — not your notes
                    </summary>
                    <div
                      style={{
                        ...label,
                        marginTop: 6,
                        lineHeight: 1.45,
                        background: "#0A0D0D",
                        border: `1px solid ${C.line}`,
                        borderRadius: 8,
                        padding: 8,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {it.notes ? it.notes : null}
                      {it.tags ? (
                        <div style={{ marginTop: it.notes ? 6 : 0 }}>tags: {it.tags}</div>
                      ) : null}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
