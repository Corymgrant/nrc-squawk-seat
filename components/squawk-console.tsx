"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeachSandbox } from "@/components/teach-sandbox";
import { SquawkFeed, type SquawkNote } from "@/components/squawk-feed";

type Ticket = {
  id: string;
  reporter?: string | null;
  text: string;
  reply: string | null;
  status: string;
  created_at: string;
  status_updated_at?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  notes: SquawkNote[];
};
type Role = "owner" | "sales_rep";
type Tab = "report" | "teach" | "practice";
type Attachment = {
  id: string;
  path: string | null; // storage path once uploaded
  preview: string; // objectURL, then swapped to signed URL
  uploading: boolean;
  err: string | null;
};

const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic"];

const textareaClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function SquawkConsole({
  role,
  tickets,
}: {
  role: Role;
  tickets: Ticket[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("report");
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold leading-tight">Report or teach</h2>
          <p className="text-muted-foreground text-sm">
            Flag a problem, or show the assistant how you&apos;d handle it.
          </p>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="inline-flex w-full rounded-lg border border-input p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("report")}
          className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
            tab === "report" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Report a problem
        </button>
        <button
          type="button"
          onClick={() => setTab("teach")}
          className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
            tab === "teach" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Teach the Assistant
        </button>
        <button
          type="button"
          onClick={() => setTab("practice")}
          className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
            tab === "practice" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Practice drafts
        </button>
      </div>

      {tab === "report" ? (
        <ReportForm onDone={() => router.refresh()} />
      ) : tab === "teach" ? (
        <TeachForm />
      ) : (
        <TeachSandbox />
      )}

      {role === "owner" ? (
        <RecentReports role={role} tickets={tickets} onExpand={setExpanded} />
      ) : (
        <SquawkFeed
          tickets={tickets.map((t) => ({
            id: t.id,
            text: t.text,
            reply: t.reply,
            status: t.status,
            created_at: t.created_at,
            status_updated_at: t.status_updated_at ?? null,
            image_url: t.image_url,
            image_urls: t.image_urls ?? (t.image_url ? [t.image_url] : []),
            notes: t.notes,
          }))}
          onExpand={setExpanded}
        />
      )}

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpanded(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expanded}
            alt="Attachment"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}

/* ── Report a problem (with image drag/drop/paste) ──────────────────────────── */
function ReportForm({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [leadId, setLeadId] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // image attachments — N screenshots per ticket (no artificial cap)
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const uploading = attachments.some((a) => a.uploading);

  function updateAttachment(id: string, patch: Partial<Attachment>) {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function uploadOne(att: Attachment, file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/squawk/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Upload failed");
      updateAttachment(att.id, {
        path: j.path,
        uploading: false,
        preview: j.signed_url || att.preview,
      });
    } catch (e: unknown) {
      updateAttachment(att.id, {
        uploading: false,
        err: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }

  function handleFiles(files: File[] | FileList | null) {
    if (!files) return;
    setImgErr(null);
    for (const file of Array.from(files)) {
      if (!OK_TYPES.includes(file.type)) {
        setImgErr("Images only (png, jpg, webp, gif, heic).");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setImgErr(`"${file.name}" is too large (max 10MB).`);
        continue;
      }
      const att: Attachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        path: null,
        preview: URL.createObjectURL(file),
        uploading: true,
        err: null,
      };
      setAttachments((prev) => [...prev, att]);
      void uploadOne(att, file);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length) handleFiles(files);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function clearImages() {
    setAttachments([]);
    setImgErr(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setErr(null);
    setReply(null);
    try {
      const res = await fetch("/api/squawk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          lead_id: leadId || undefined,
          image_paths: attachments.map((a) => a.path).filter((p): p is string => !!p),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      setReply(j.reply || "Got it — looking into this.");
      setText("");
      setLeadId("");
      clearImages();
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report a problem</CardTitle>
        <CardDescription>
          Describe what is wrong — drag in or paste a screenshot if it helps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="text">What is going on?</Label>
            <textarea
              id="text"
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              rows={4}
              placeholder="e.g. Kevin says he never got his quote — can someone resend it?"
              className={textareaClass}
            />
          </div>

          {/* Image drop zone — attach as many screenshots as you like */}
          <div className="grid gap-2">
            <Label>Screenshots (optional)</Label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onPaste={onPaste}
              className={`flex flex-col items-center gap-3 rounded-md border border-dashed p-4 text-center text-sm transition-colors ${
                dragOver ? "border-foreground bg-foreground/5" : "border-input text-muted-foreground"
              }`}
            >
              {attachments.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex flex-col items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.preview}
                        alt="Attachment preview"
                        className="max-h-28 rounded-md border border-input object-contain"
                      />
                      <div className="flex items-center gap-2 text-xs">
                        {a.uploading ? (
                          <span className="text-muted-foreground">Uploading…</span>
                        ) : a.err ? (
                          <span className="text-red-500">{a.err}</span>
                        ) : a.path ? (
                          <span className="text-green-600">✓</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="text-red-500 underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <span>
                  {attachments.length > 0
                    ? "Drag, paste, or add more"
                    : "Drag & drop, paste, or"}
                </span>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-foreground/5"
                >
                  {attachments.length > 0 ? "Add images" : "Choose images"}
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  // allow re-picking the same file(s)
                  if (fileInput.current) fileInput.current.value = "";
                }}
              />
            </div>
            {imgErr && <p className="text-sm text-red-500">{imgErr}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lead">Close lead ID (optional)</Label>
            <Input id="lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="lead_..." />
          </div>

          {reply && (
            <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">✅ {reply}</div>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
          <Button type="submit" disabled={loading || uploading || !text.trim()}>
            {loading ? "Sending…" : "Send report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ── Teach the Assistant (correction window) ────────────────────────────────── */
const CATEGORIES: { value: string; label: string }[] = [
  { value: "compliance", label: "Compliance (loss-ratio / legal)" },
  { value: "wording", label: "Wording / tone" },
  { value: "factual", label: "Factual" },
];
const APPLIES: { value: string; label: string }[] = [
  { value: "michael", label: "Michael (sales)" },
  { value: "erika", label: "Erika (claims/CS)" },
  { value: "both", label: "Both" },
  { value: "a3", label: "A3 (engagement engine)" },
];
const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function TeachForm() {
  const [notSay, setNotSay] = useState("");
  const [shouldSay, setShouldSay] = useState("");
  const [ctx, setCtx] = useState("");
  const [category, setCategory] = useState("wording");
  const [appliesTo, setAppliesTo] = useState("michael");
  const [rule, setRule] = useState<string | null>(null);
  const [promoted, setPromoted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notSay.trim() || !shouldSay.trim()) return;
    setLoading(true);
    setErr(null);
    setRule(null);
    try {
      const res = await fetch("/api/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          not_say: notSay,
          should_say: shouldSay,
          context: ctx || undefined,
          category,
          applies_to: appliesTo,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      setRule(j.rule || "Got it — the assistant will use this going forward.");
      setPromoted(!!j.promoted);
      setNotSay("");
      setShouldSay("");
      setCtx("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teach the Assistant</CardTitle>
        <CardDescription>
          Tell the email assistant what it should say differently. This becomes a rule it follows going
          forward.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="notsay">It should NOT say:</Label>
            <textarea
              id="notsay"
              required
              value={notSay}
              onChange={(e) => setNotSay(e.target.value)}
              rows={2}
              placeholder="e.g. We guarantee your RV will be covered for any repair."
              className={textareaClass}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shouldsay">It SHOULD say instead:</Label>
            <textarea
              id="shouldsay"
              required
              value={shouldSay}
              onChange={(e) => setShouldSay(e.target.value)}
              rows={2}
              placeholder="e.g. Coverage depends on your plan and the cause of the failure — happy to walk you through it."
              className={textareaClass}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ctx">When does this come up? (optional)</Label>
            <Input
              id="ctx"
              value={ctx}
              onChange={(e) => setCtx(e.target.value)}
              placeholder="e.g. when a customer asks if everything is covered"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cat">Category</Label>
              <select
                id="cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="applies">Applies to</Label>
              <select
                id="applies"
                value={appliesTo}
                onChange={(e) => setAppliesTo(e.target.value)}
                className={selectClass}
              >
                {APPLIES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {category === "compliance" && !rule && (
            <p className="text-xs text-amber-600">
              Compliance corrections are flagged for Cory to review into the hard guardrail.
            </p>
          )}

          {rule && (
            <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">
              <div className="font-medium text-green-700">
                ✅ Got it — the assistant will use this going forward.
              </div>
              <div className="mt-1 text-muted-foreground">
                Rule learned: <span className="text-foreground">{rule}</span>
              </div>
              {promoted && (
                <div className="mt-1 text-xs text-amber-600">
                  Flagged for Cory to promote into the compliance guardrail.
                </div>
              )}
            </div>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
          <Button type="submit" disabled={loading || !notSay.trim() || !shouldSay.trim()}>
            {loading ? "Teaching…" : "Teach the assistant"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ── Recent reports (with inline image thumbnails) ──────────────────────────── */
function RecentReports({
  role,
  tickets,
  onExpand,
}: {
  role: Role;
  tickets: Ticket[];
  onExpand: (url: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{role === "owner" ? "All squawk reports (org-wide)" : "Your recent reports"}</CardTitle>
        <CardDescription>
          {role === "owner"
            ? "Every report across the team."
            : "What you have reported and the responses you got back."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/10">
            {tickets.map((t) => (
              <li key={t.id} className="py-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{t.text}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                </div>
                {role === "owner" && t.reporter && (
                  <span className="text-xs text-muted-foreground">from {t.reporter}</span>
                )}
                {(() => {
                  const urls = t.image_urls?.length ? t.image_urls : t.image_url ? [t.image_url] : [];
                  return urls.length ? (
                    <div className="mt-1 flex flex-wrap gap-2">
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
                {t.reply && <span className="text-sm text-muted-foreground">↳ {t.reply}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
