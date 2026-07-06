"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Michael-facing squawk feed: every ticket shows its REAL lifecycle status straight
// from squawk_tickets (never a mock), a progress trail, the append-only notes thread,
// and a reopen control — because a squawk isn't fixed just because we think it is.

export type SquawkNote = {
  id: string;
  author_role: "rep" | "system" | "owner";
  author_name: string;
  text: string;
  created_at: string;
};

export type SquawkTicket = {
  id: string;
  text: string;
  reply: string | null;
  status: string;
  created_at: string;
  status_updated_at: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  notes: SquawkNote[];
};

const STAGES = ["Received", "Triaged", "In progress", "Resolved", "Watching", "Archived"];

// status → { plain-English label, badge tone, position on the progress trail }
const STATUS_META: Record<string, { label: string; tone: "amber" | "blue" | "green" | "red" | "muted"; stage: number | null }> = {
  open: { label: "Received — in the queue", tone: "amber", stage: 0 },
  triaged: { label: "Triaged", tone: "blue", stage: 1 },
  in_progress: { label: "Being worked", tone: "blue", stage: 2 },
  needs_info: { label: "Needs info from you", tone: "amber", stage: 1 },
  resolved: { label: "Resolved — watching it holds", tone: "green", stage: 3 },
  resolved_verified: { label: "Fix verified — watching it holds", tone: "green", stage: 3 },
  green_soak: { label: "Green — soaking before archive", tone: "green", stage: 4 },
  reopened: { label: "Reopened — back in the queue", tone: "red", stage: 0 },
  archived: { label: "Archived (stayed green)", tone: "muted", stage: 5 },
  dismissed: { label: "Closed — checked, not an issue", tone: "muted", stage: null },
};

const TONE_CLASS: Record<string, string> = {
  amber: "bg-amber-500/15 text-amber-600 border-amber-600/30",
  blue: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  green: "bg-green-600/15 text-green-600 border-green-600/30",
  red: "bg-red-500/15 text-red-500 border-red-500/30",
  muted: "bg-foreground/5 text-muted-foreground border-foreground/15",
};

const REOPENABLE = new Set(["resolved", "resolved_verified", "green_soak", "archived", "dismissed"]);

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "muted" as const, stage: null };
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASS[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}

function ProgressTrail({ status }: { status: string }) {
  const meta = STATUS_META[status];
  if (!meta || meta.stage === null) return null;
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {STAGES.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          {i > 0 && <span className="text-foreground/20">→</span>}
          <span className={i === meta.stage ? "font-semibold text-foreground" : i < meta.stage! ? "text-foreground/60" : ""}>
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

function NoteRow({ note }: { note: SquawkNote }) {
  const isSystem = note.author_role === "system";
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-foreground/[0.03] px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className={isSystem ? "italic" : "font-medium text-foreground/80"}>{note.author_name}</span>
        <span>{new Date(note.created_at).toLocaleString()}</span>
      </div>
      <p className="text-sm">{note.text}</p>
    </div>
  );
}

function TicketCard({ ticket, onExpand }: { ticket: SquawkTicket; onExpand: (url: string) => void }) {
  const router = useRouter();
  const [noteText, setNoteText] = useState("");
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, body: object) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      router.refresh();
      return true;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const addNote = async () => {
    if (!noteText.trim()) return;
    if (await post("/api/squawk/notes", { ticket_id: ticket.id, text: noteText.trim() })) {
      setNoteText("");
    }
  };

  const reopen = async () => {
    if (await post("/api/squawk/reopen", { ticket_id: ticket.id, reason: reason.trim() || undefined })) {
      setReopening(false);
      setReason("");
    }
  };

  const updated = ticket.status_updated_at ?? ticket.created_at;

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{ticket.text}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(ticket.created_at).toLocaleString()}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ticket.status} />
        <span className="text-xs text-muted-foreground">
          updated {new Date(updated).toLocaleString()}
        </span>
      </div>
      <ProgressTrail status={ticket.status} />

      {(() => {
        const urls = ticket.image_urls?.length
          ? ticket.image_urls
          : ticket.image_url
            ? [ticket.image_url]
            : [];
        return urls.length ? (
          <div className="flex flex-wrap gap-2">
            {urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={u}
                alt={`Report attachment ${i + 1}`}
                onClick={() => onExpand(u)}
                className="max-h-24 w-fit cursor-pointer rounded-md border border-input object-cover"
              />
            ))}
          </div>
        ) : null;
      })()}

      {(ticket.reply || ticket.notes.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {ticket.reply && (
            <NoteRow
              note={{
                id: `${ticket.id}-ack`,
                author_role: "system",
                author_name: "System",
                text: ticket.reply,
                created_at: ticket.created_at,
              }}
            />
          )}
          {ticket.notes.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={1}
          placeholder="Add a note — updates, more detail, still happening…"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="sm" variant="outline" disabled={busy || !noteText.trim()} onClick={addNote}>
          Add note
        </Button>
      </div>

      {REOPENABLE.has(ticket.status) &&
        (reopening ? (
          <div className="flex flex-col gap-2 rounded-md border border-red-500/30 p-3">
            <p className="text-xs text-muted-foreground">
              Still happening? Reopening puts this straight back in the queue.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="What are you still seeing? (optional but helps)"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={busy} onClick={reopen}>
                {busy ? "Reopening…" : "Reopen this squawk"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReopening(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReopening(true)}
            className="w-fit text-xs text-red-500 underline underline-offset-2"
          >
            Not actually fixed? Reopen it
          </button>
        ))}

      {err && <p className="text-sm text-red-500">{err}</p>}
    </li>
  );
}

export function SquawkFeed({
  tickets,
  onExpand,
}: {
  tickets: SquawkTicket[];
  onExpand: (url: string) => void;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const active = tickets.filter((t) => !["archived", "dismissed"].includes(t.status));
  const closed = tickets.filter((t) => ["archived", "dismissed"].includes(t.status));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your squawks</CardTitle>
        <CardDescription>
          Everything you&apos;ve reported, with live status. Add notes as things develop — and if
          something comes back after a fix, reopen it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {active.length === 0 && closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-foreground/10">
              {active.map((t) => (
                <TicketCard key={t.id} ticket={t} onExpand={onExpand} />
              ))}
            </ul>
            {closed.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowClosed(!showClosed)}
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  {showClosed ? "Hide" : "Show"} closed ({closed.length})
                </button>
                {showClosed && (
                  <ul className="flex flex-col divide-y divide-foreground/10">
                    {closed.map((t) => (
                      <TicketCard key={t.id} ticket={t} onExpand={onExpand} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
