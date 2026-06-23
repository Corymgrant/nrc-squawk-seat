"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Ticket = {
  id: string;
  reporter?: string | null;
  text: string;
  reply: string | null;
  created_at: string;
};
type Role = "owner" | "sales_rep";

export function SquawkConsole({
  role,
  fullName,
  tickets,
}: {
  role: Role;
  fullName: string;
  tickets: Ticket[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [leadId, setLeadId] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ text, lead_id: leadId || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      setReply(j.reply || "Got it — looking into this.");
      setText("");
      setLeadId("");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {fullName} 👋</h1>
          <p className="text-muted-foreground text-sm">
            Spot a problem? Report it here and it goes straight to the team.
          </p>
        </div>
        <Badge variant={role === "owner" ? "default" : "secondary"}>
          {role === "owner" ? "Owner" : "Sales Rep"}
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Report a problem</CardTitle>
          <CardDescription>Describe what is wrong — you will get a confirmation back.</CardDescription>
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
                rows={4}
                placeholder="e.g. Kevin says he never got his quote — can someone resend it?"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead">Close lead ID (optional)</Label>
              <Input id="lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="lead_..." />
            </div>
            {reply && (
              <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">✅ {reply}</div>
            )}
            {err && <p className="text-sm text-red-500">{err}</p>}
            <Button type="submit" disabled={loading || !text.trim()}>
              {loading ? "Sending…" : "Send report"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ask about your pipeline <Badge variant="outline">Coming soon</Badge>
          </CardTitle>
          <CardDescription>
            Soon you will be able to ask things like &quot;Is my quote to Kevin delivered?&quot; right here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input disabled placeholder="Ask about your pipeline…" />
            <Button disabled>Ask</Button>
          </div>
        </CardContent>
      </Card>

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
                  {t.reply && <span className="text-sm text-muted-foreground">↳ {t.reply}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
