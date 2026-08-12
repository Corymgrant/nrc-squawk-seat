"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* Creative Review panel (job #347, extends #287). Reads the creative bench
   (creative_review_ledger) and shows finished creatives as THUMBNAILS grouped
   by batch and look, each labeled with its ratio. Pending items (no human
   verdict yet) float to the top. Thumbnails click to full size. Approve /
   Reject writes Cory's OWN verdict to the dedicated human_verdict column —
   the training signal that feeds the brand-soul corpus / flywheel.

   Drive copies of assets are preferred for display when present; otherwise
   the render preview_url is used. Voided duplicates and pre-j333 look-alike
   batches are hidden server-side by a REVERSIBLE view filter (rows are never
   deleted) — the footer reports how many are hidden. */

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
  drive_file_id?: string | null;
  preview_url?: string | null;
  status?: string;
  rating?: number | null;
  keep_kill?: string | null;
  tags?: string | null;
  notes?: string | null; // AI metadata (auto-generated) — read-only
  human_verdict?: string | null; // Cory's own verdict: approve | reject | ""
  human_notes?: string | null; // Cory's typed reason — empty by default
  rated_by?: string | null;
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

// job #1048 — flywheel reason capture: quick-pick chips so a reject carries
// WHY into human_notes (feeds creative_review_ledger -> brand-soul corpus ->
// future generation prompts). Chips just fill the freeform note field below;
// nothing here is required — approve stays one-tap friction-free.
const REJECT_REASON_CHIPS = [
  "RV looks old/dated",
  "wrong face / continuity",
  "text illegible at feed size",
  "off-brand framing",
  "compliance concern",
];
const APPROVE_CHIPS = ["great framing", "modern rig", "strong hook", "clean/on-brand"];

function chipStyle(kind: "reject" | "approve"): React.CSSProperties {
  const col = kind === "reject" ? C.red : C.emerald;
  return {
    cursor: "pointer",
    border: `1px solid ${col}55`,
    background: kind === "approve" ? `${col}14` : "transparent",
    color: col,
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 600,
    padding: "3px 8px",
  };
}

/* Prefer the Drive copy when present — served through our owner-gated pixel
   proxy (the Drive files are not link-shared, and drive.google.com URLs die on
   third-party-cookie blocking). Fall back to the render preview_url. A broken
   source (e.g. Drive has no poster for a video) demotes via onError. */
function isDriveUrl(u?: string | null): boolean {
  return Boolean(u && u.includes("drive.google.com"));
}
function thumbSrc(r: Creative, broken: Set<number>): string | null {
  if (r.drive_file_id && !broken.has(r.id))
    return `/api/dashboard/creatives/asset/${r.drive_file_id}?sz=grid`;
  if (r.preview_url && !r.preview_url.endsWith(".mp4") && !isDriveUrl(r.preview_url))
    return r.preview_url;
  return null;
}
function fullSrc(r: Creative, broken: Set<number>): string | null {
  if (r.drive_file_id && !broken.has(r.id))
    return `/api/dashboard/creatives/asset/${r.drive_file_id}?sz=full`;
  if (r.preview_url && !isDriveUrl(r.preview_url)) return r.preview_url;
  return null;
}
function isVideo(r: Creative): boolean {
  return (r.asset_type || "") === "video" || Boolean(r.preview_url?.endsWith(".mp4"));
}
function isPending(r: Creative): boolean {
  return !r.human_verdict;
}

type Look = { key: string; concept: string; variant: string; items: Creative[] };
type Batch = { key: string; looks: Look[]; pending: number; newest: string };

function groupCreatives(rows: Creative[]): Batch[] {
  const batches = new Map<string, Map<string, Look>>();
  for (const r of rows) {
    const bk = r.batch || "(no batch)";
    if (!batches.has(bk)) batches.set(bk, new Map());
    const looks = batches.get(bk)!;
    const lk = r.variant || r.concept || String(r.id);
    if (!looks.has(lk))
      looks.set(lk, { key: lk, concept: r.concept || lk, variant: r.variant || "", items: [] });
    looks.get(lk)!.items.push(r);
  }
  const out: Batch[] = [];
  for (const [bk, looks] of batches) {
    const ls = [...looks.values()];
    // pending looks first within the batch; item order inside a look is stable
    ls.sort((a, b) => Number(b.items.some(isPending)) - Number(a.items.some(isPending)));
    const all = ls.flatMap((l) => l.items);
    out.push({
      key: bk,
      looks: ls,
      pending: all.filter(isPending).length,
      newest: all.reduce((m, r) => (r.created_at && r.created_at > m ? r.created_at : m), ""),
    });
  }
  // batches with pending items first, then newest first
  out.sort((a, b) => Number(b.pending > 0) - Number(a.pending > 0) || (b.newest > a.newest ? 1 : -1));
  return out;
}

export function CreativesPanel() {
  const [items, setItems] = useState<Creative[]>([]);
  const [fresh, setFresh] = useState(0);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Creative | null>(null); // lightbox
  const [broken, setBroken] = useState<Set<number>>(new Set()); // rows whose Drive thumb 404'd
  // draft notes per row — Cory's OWN words, never pre-filled with AI text
  const [notes, setNotes] = useState<Record<number, string>>({});
  // job #1050 — critic default view is borderline + this week's ~5-item audit
  // sample only (clear-pass rows the critic already cleared stay out of your
  // way); flip this to see every row, including critic-approved-not-sampled
  // and machine auto-rejects (both reversible — nothing here is deleted).
  const [seeAll, setSeeAll] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const qs = seeAll ? "?include_hidden=1" : "";
      const res = await fetch(`/api/dashboard/creatives${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const rows: Creative[] = j?.creatives ?? [];
      setItems(rows);
      setFresh(j?.fresh_unrated ?? 0);
      setHiddenCount(j?.hidden_count ?? 0);
      setNotes((d) => {
        const next = { ...d };
        for (const r of rows)
          if (next[r.id] === undefined) next[r.id] = r.human_notes ?? "";
        return next;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [seeAll]);

  useEffect(() => {
    load();
  }, [load]);

  const verdict = useCallback(
    async (rows: Creative[], v: "approve" | "reject") => {
      setBusy((b) => new Set([...b, ...rows.map((r) => r.id)]));
      try {
        for (const r of rows) {
          const res = await fetch("/api/dashboard/creatives/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: r.id, human_verdict: v, human_notes: notes[r.id] ?? "" }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy((b) => {
          const n = new Set(b);
          rows.forEach((r) => n.delete(r.id));
          return n;
        });
      }
    },
    [notes, load],
  );

  const batches = useMemo(() => groupCreatives(items), [items]);

  const vBadge = (r: Creative) =>
    r.human_verdict === "approve" ? C.emerald : r.human_verdict === "reject" ? C.red : C.amber;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Creative Review</div>
        <div style={{ ...label, color: fresh > 0 ? C.amber : C.muted }}>
          {fresh > 0 ? `${fresh} pending review` : "all reviewed"}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ ...label, marginTop: 2 }}>
          Tap a thumbnail for full size. Approve / Reject is YOUR verdict — it trains the creative
          engine.
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            ...label,
            whiteSpace: "nowrap",
          }}
          title="Default view = borderline + this week's ~5-item audit sample only (job #1050 critic). Toggle to see everything, including critic-approved-not-sampled and machine auto-rejects."
        >
          <input
            type="checkbox"
            checked={seeAll}
            onChange={(e) => setSeeAll(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          see all
        </label>
      </div>

      {loading && <div style={{ ...label, marginTop: 12 }}>Loading…</div>}
      {err && <div style={{ color: C.red, marginTop: 12, fontSize: 13 }}>Error: {err}</div>}

      {!loading && !err && items.length === 0 && (
        <div style={{ ...label, marginTop: 14, lineHeight: 1.5 }}>
          No finished creatives in the bench yet. When the creative agent stages a render batch,
          finished assets land here for your review.
        </div>
      )}

      {batches.map((b) => (
        <div key={b.key} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 13.5 }}>Batch {b.key}</div>
            <div style={{ ...label, fontSize: 11.5 }}>
              {b.pending > 0 ? (
                <span style={{ color: C.amber }}>{b.pending} pending</span>
              ) : (
                <span style={{ color: C.emerald }}>reviewed ✓</span>
              )}
            </div>
          </div>

          {b.looks.map((lk) => {
            const lkPending = lk.items.filter(isPending);
            const lkBusy = lk.items.some((r) => busy.has(r.id));
            return (
              <div
                key={lk.key}
                style={{
                  background: C.inner,
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 180, flex: 1 }}>
                    <div style={{ color: C.text, fontWeight: 600, fontSize: 13.5 }}>{lk.concept}</div>
                    <div style={{ ...label, fontSize: 11.5, marginTop: 1 }}>
                      {lk.variant}
                      {lk.items[0]?.asset_type ? ` · ${lk.items[0].asset_type}` : ""}
                    </div>
                  </div>
                  {lkPending.length > 0 && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        disabled={lkBusy}
                        onClick={() => verdict(lkPending, "approve")}
                        style={lookBtn(C.emerald)}
                      >
                        ✓ Approve look
                      </button>
                      <button
                        disabled={lkBusy}
                        onClick={() => verdict(lkPending, "reject")}
                        style={lookBtn(C.red)}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  {lk.items.map((r) => {
                    const src = thumbSrc(r, broken);
                    return (
                      <div key={r.id} style={{ width: 108 }}>
                        <div
                          onClick={() => setOpen(r)}
                          style={{
                            position: "relative",
                            width: 108,
                            height: 108,
                            borderRadius: 10,
                            overflow: "hidden",
                            cursor: "pointer",
                            border: `2px solid ${r.human_verdict ? vBadge(r) : C.line}`,
                            background: "#0A0D0D",
                          }}
                        >
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={src}
                              alt={r.asset_id || lk.concept}
                              loading="lazy"
                              onError={() => setBroken((b) => new Set(b).add(r.id))}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: C.muted,
                                fontSize: 11,
                              }}
                            >
                              {isVideo(r) ? "▶ video" : "no preview"}
                            </div>
                          )}
                          {isVideo(r) && src && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: 22,
                                textShadow: "0 1px 6px rgba(0,0,0,.8)",
                              }}
                            >
                              ▶
                            </div>
                          )}
                          <div
                            style={{
                              position: "absolute",
                              top: 4,
                              left: 4,
                              background: "rgba(0,0,0,.72)",
                              color: C.text,
                              borderRadius: 6,
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "1px 5px",
                            }}
                          >
                            {r.ratio || "?"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <button
                            disabled={busy.has(r.id)}
                            onClick={() => verdict([r], "approve")}
                            title="Approve"
                            style={miniBtn(r.human_verdict === "approve", C.emerald)}
                          >
                            ✓
                          </button>
                          <button
                            disabled={busy.has(r.id)}
                            onClick={() => verdict([r], "reject")}
                            title="Reject"
                            style={miniBtn(r.human_verdict === "reject", C.red)}
                          >
                            ✗
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {!loading && hiddenCount > 0 && !seeAll && (
        <div style={{ ...label, marginTop: 12, fontSize: 11.5 }}>
          {hiddenCount} assets hidden from this view — voided duplicates, pre-restyle look-alike
          batches, machine auto-rejects (job #1049/#1050 pre-review critic, reasons in each row's
          AI-metadata notes), and critic-approved renders not in this week's audit sample. Nothing
          deleted — check &ldquo;see all&rdquo; above to view everything.
        </div>
      )}

      {/* ── lightbox: full size + verdict + YOUR notes ── */}
      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,.86)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 16,
              padding: 12,
              maxWidth: 720,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>
                {open.concept || open.asset_id}
                <span style={{ ...label, marginLeft: 8 }}>
                  {[open.ratio, open.asset_type, open.batch].filter(Boolean).join(" · ")}
                </span>
              </div>
              <button
                onClick={() => setOpen(null)}
                style={{ ...lookBtn(C.muted), minWidth: 44 }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 10, textAlign: "center" }}>
              {isVideo(open) && open.preview_url?.endsWith(".mp4") ? (
                <video
                  src={open.preview_url}
                  controls
                  style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 10 }}
                />
              ) : fullSrc(open, broken) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fullSrc(open, broken)!}
                  alt={open.asset_id || "creative"}
                  onError={() => setBroken((b) => new Set(b).add(open.id))}
                  style={{ maxWidth: "100%", maxHeight: "62vh", borderRadius: 10 }}
                />
              ) : (
                <div style={{ ...label, padding: 30 }}>
                  {isVideo(open) ? "▶ video — open in Drive to play" : "no preview available"}
                </div>
              )}
              {open.drive_file_id && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={`https://drive.google.com/file/d/${open.drive_file_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...label, color: C.emerald, textDecoration: "none", fontSize: 12.5 }}
                  >
                    Open in Drive ↗ {isVideo(open) ? "(plays the full video)" : "(original file)"}
                  </a>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {(["approve", "reject"] as const).map((v) => {
                const active = open.human_verdict === v;
                const col = v === "approve" ? C.emerald : C.red;
                return (
                  <button
                    key={v}
                    disabled={busy.has(open.id)}
                    onClick={async () => {
                      await verdict([open], v);
                      setOpen(null);
                    }}
                    style={{
                      cursor: "pointer",
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 10,
                      border: `1px solid ${active ? col : C.line}`,
                      background: active ? col : "transparent",
                      color: active ? "#0B0D0C" : C.text,
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {v === "approve" ? "✓ Approve" : "✗ Reject"}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {REJECT_REASON_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() =>
                    setNotes((p) => {
                      const cur = p[open.id] ?? "";
                      return { ...p, [open.id]: cur ? `${cur}; ${chip}` : chip };
                    })
                  }
                  style={chipStyle("reject")}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
              {APPROVE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() =>
                    setNotes((p) => {
                      const cur = p[open.id] ?? "";
                      return { ...p, [open.id]: cur ? `${cur}; ${chip}` : chip };
                    })
                  }
                  style={chipStyle("approve")}
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              value={notes[open.id] ?? ""}
              onChange={(e) => setNotes((p) => ({ ...p, [open.id]: e.target.value }))}
              placeholder="Your notes — why it works or doesn't (optional, saved with the verdict)"
              rows={2}
              style={{
                marginTop: 8,
                width: "100%",
                background: "#0A0D0D",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                color: C.text,
                fontSize: 16,
                padding: 10,
                resize: "vertical",
              }}
            />
            {(open.notes || open.tags) && (
              <details style={{ marginTop: 8 }}>
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
                  {open.notes}
                  {open.tags ? <div style={{ marginTop: 6 }}>tags: {open.tags}</div> : null}
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function lookBtn(col: string): React.CSSProperties {
  return {
    cursor: "pointer",
    minHeight: 34,
    padding: "6px 10px",
    borderRadius: 9,
    border: `1px solid ${col}`,
    background: "transparent",
    color: col,
    fontWeight: 700,
    fontSize: 12.5,
    whiteSpace: "nowrap",
  };
}

function miniBtn(active: boolean, col: string): React.CSSProperties {
  return {
    cursor: "pointer",
    flex: 1,
    minHeight: 30,
    borderRadius: 8,
    border: `1px solid ${active ? col : C.line}`,
    background: active ? col : "transparent",
    color: active ? "#0B0D0C" : C.muted,
    fontWeight: 700,
    fontSize: 13,
  };
}
