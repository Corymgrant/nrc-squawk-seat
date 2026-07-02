"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// In-app Teach Sandbox (job 335): the job-331 practice flow, one click from
// Michael's seat. Type a customer question → see the LIVE autoresponder draft
// (same Intelligence Spine the real lanes use) → edit it the way you'd actually
// send it → say why → Teach. The correction becomes a Hindsight lesson the
// drafters recall on every future draft. Draft-only: nothing is ever emailed.

const textareaClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type DraftMeta = {
  faq_intent?: string | null;
  must_hedge?: boolean;
  edit_lessons_used?: string[];
};

export function TeachSandbox() {
  const [lane, setLane] = useState("sales");
  const [question, setQuestion] = useState("");
  const [tier, setTier] = useState("");
  const [deductible, setDeductible] = useState("");

  const [original, setOriginal] = useState("");
  const [draft, setDraft] = useState("");
  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [why, setWhy] = useState("");

  const [drafting, setDrafting] = useState(false);
  const [teaching, setTeaching] = useState(false);
  const [taught, setTaught] = useState<{ rule: string; note?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const getDraft = async () => {
    if (!question.trim()) return;
    setDrafting(true);
    setErr(null);
    setTaught(null);
    try {
      const lead_meta: Record<string, string> = {};
      if (tier.trim()) lead_meta.coverage_tier = tier.trim();
      if (deductible.trim()) lead_meta.deductible = deductible.trim();
      const r = await fetch("/api/teach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, lane, lead_meta }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Draft failed");
      setOriginal(j.draft || "");
      setDraft(j.draft || "");
      setMeta({
        faq_intent: j.faq_intent,
        must_hedge: j.must_hedge,
        edit_lessons_used: j.edit_lessons_used || [],
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  };

  const teach = async () => {
    if (!question.trim() || !draft.trim()) return;
    setTeaching(true);
    setErr(null);
    try {
      const r = await fetch("/api/teach/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, original, corrected: draft, why, lane }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Teach failed");
      setTaught({ rule: j.rule, note: j.note });
      setWhy("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Teach failed");
    } finally {
      setTeaching(false);
    }
  };

  const unchanged = draft.trim() === original.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice drafts (teach sandbox)</CardTitle>
        <CardDescription>
          See what the assistant would draft for a real customer question, fix it the way you&apos;d
          actually send it, and teach it the lesson. Nothing here is ever emailed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="ts-lane">Lane</Label>
              <select id="ts-lane" value={lane} onChange={(e) => setLane(e.target.value)} className={selectClass}>
                <option value="sales">Sales (Michael)</option>
                <option value="claims">Claims (Erika)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ts-tier">Coverage tier (optional)</Label>
              <Input id="ts-tier" value={tier} onChange={(e) => setTier(e.target.value)} placeholder="e.g. PREMIER" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ts-ded">Deductible (optional)</Label>
              <Input id="ts-ded" value={deductible} onChange={(e) => setDeductible(e.target.value)} placeholder="e.g. $100" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ts-q">Customer / prospect question</Label>
            <textarea
              id="ts-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="e.g. Is my slide-out covered? What would I pay monthly?"
              className={textareaClass}
            />
          </div>

          <Button type="button" onClick={getDraft} disabled={drafting || !question.trim()}>
            {drafting ? "Drafting… (takes a few seconds)" : "See the draft"}
          </Button>

          {meta && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="ts-draft">The assistant&apos;s draft — edit it to how you&apos;d send it</Label>
                <textarea
                  id="ts-draft"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  className={textareaClass}
                />
                <p className="text-xs text-muted-foreground">
                  intent: {meta.faq_intent || "—"} · hedged: {meta.must_hedge ? "yes" : "no"} · past
                  lessons applied: {meta.edit_lessons_used?.length ?? 0}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ts-why">Why did you change it? (this becomes the lesson)</Label>
                <textarea
                  id="ts-why"
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  rows={2}
                  placeholder="e.g. Lead with the deductible, don't bury it. Warmer close."
                  className={textareaClass}
                />
              </div>
              {unchanged && !taught && (
                <p className="text-xs text-muted-foreground">
                  Edit the draft above first — the teach step learns from your changes.
                </p>
              )}
              <Button type="button" variant="secondary" onClick={teach} disabled={teaching || unchanged || !draft.trim()}>
                {teaching ? "Teaching…" : "Teach this correction"}
              </Button>
            </>
          )}

          {taught && (
            <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">
              <div className="font-medium text-green-700">✓ Taught — the assistant will use this going forward.</div>
              <div className="mt-1 text-muted-foreground">
                Lesson stored: <span className="text-foreground">{taught.rule}</span>
              </div>
              {taught.note && <div className="mt-1 text-xs text-muted-foreground">{taught.note}</div>}
            </div>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
