"use client";

import { useState } from "react";

// Self-contained note composer + thread for the operator console's NEW panels
// (squawk manager, Meta panel). Posts through the SAME conduit the owner dashboard
// already uses: POST /api/dashboard/notes -> Cockpit /api/owner/notes -> chat-Claude
// answers on sweep + nightly mining. Kept separate from dashboard-client's inline
// NoteThread so the proven live notes code is untouched (additive, no regression).

export type ConsoleNote = {
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

const C = {
  bg: "#0B0D0C",
  text: "#EDEFEE",
  muted: "#7E8682",
  emerald: "#2FD79B",
  amber: "#F5B544",
  line: "#222829",
};

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

export function ItemNotes({
  itemType,
  itemRef,
  itemLabel,
  notes,
  onPosted,
}: {
  itemType: string;
  itemRef: string;
  itemLabel: string;
  notes: ConsoleNote[];
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
        body: JSON.stringify({
          item_type: itemType,
          item_ref: itemRef,
          item_label: itemLabel,
          body: text.trim(),
        }),
      });
      setText("");
      setOpen(false);
      onPosted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      {mine.map((n) => (
        <div key={n.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 8 }}>
          <div style={{ color: C.text, fontSize: 13 }}>
            <span style={{ color: C.muted }}>note · </span>
            {n.body}
          </div>
          {n.answer_body ? (
            <div
              style={{
                marginTop: 5,
                paddingLeft: 10,
                borderLeft: `2px solid ${C.emerald}`,
                color: C.text,
                fontSize: 13,
              }}
            >
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
