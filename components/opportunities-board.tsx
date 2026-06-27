"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Opp = {
  opp_id: string;
  agent: string;
  metric: string;
  title: string;
  finding: string;
  evidence: string;
  proposed_action: string;
  expected_impact: string;
  confidence: number;
  blast_radius: string;
  auto_eligible: boolean;
  status: string;
  cook_ref?: string;
  result?: string;
  score?: number;
};
type AgentState = { enabled: boolean; allow_autofire: boolean; metric: string; runnable: boolean; stub: boolean };
type Engine = { ok: boolean; kill_switch: boolean; agents: Record<string, AgentState> };

const BLAST_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  reversible: "secondary",
  spend: "destructive",
  publish: "destructive",
  customer_facing: "destructive",
  irreversible: "outline",
};

export function OpportunitiesBoard() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/owner/opportunities", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setOpps(j?.opportunities?.opportunities ?? []);
      setEngine(j?.engine ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(opp_id: string, decision: "approve" | "deny") {
    setBusy(opp_id);
    try {
      await fetch("/api/owner/opportunities/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opp_id, decision }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function toggle(body: Record<string, unknown>) {
    setBusy("engine");
    try {
      await fetch("/api/owner/opportunities/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const killed = engine?.kill_switch ?? false;

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Opportunities</h1>
          <p className="text-muted-foreground text-sm">
            Observe → Propose → (gated) Act. Agents find improvements and draft the fix;
            spend / publish / customer-facing waits for your tap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={killed ? "destructive" : "secondary"}>
            {killed ? "KILL SWITCH ON — all agents paused" : "Engine live"}
          </Badge>
          <Button
            size="sm"
            variant={killed ? "default" : "outline"}
            disabled={busy === "engine"}
            onClick={() => toggle({ kill_switch: !killed })}
          >
            {killed ? "Resume engine" : "Kill switch"}
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* per-agent toggles */}
      {engine?.agents && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Agents</CardTitle>
            <CardDescription>Per-agent enable + auto-fire (reversible class only).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Object.entries(engine.agents).map(([name, a]) => (
              <div key={name} className="flex items-center justify-between gap-3 flex-wrap border-b last:border-0 pb-2">
                <div className="text-sm">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground"> — {a.metric}</span>
                  {a.stub && <Badge variant="outline" className="ml-2">charter only</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={a.enabled ? "secondary" : "outline"}
                    disabled={busy === "engine" || a.stub}
                    onClick={() => toggle({ agent: name, enabled: !a.enabled })}
                  >
                    {a.enabled ? "Enabled" : "Disabled"}
                  </Button>
                  <Button
                    size="sm"
                    variant={a.allow_autofire ? "default" : "outline"}
                    disabled={busy === "engine" || !a.enabled || a.stub}
                    onClick={() => toggle({ agent: name, allow_autofire: !a.allow_autofire })}
                  >
                    {a.allow_autofire ? "Auto-fire ON" : "Propose-only"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {err && <p className="text-destructive text-sm">Error: {err}</p>}
      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {!loading && opps.length === 0 && (
        <p className="text-muted-foreground text-sm">No opportunities yet — agents run on cadence.</p>
      )}

      <div className="flex flex-col gap-4">
        {opps.map((o) => (
          <Card key={o.opp_id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">{o.title}</CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={BLAST_VARIANT[o.blast_radius] ?? "outline"}>{o.blast_radius}</Badge>
                  <Badge variant="outline">conf {Math.round((o.confidence ?? 0) * 100)}%</Badge>
                </div>
              </div>
              <CardDescription>
                {o.agent} · {o.metric}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>{o.finding}</p>
              <p className="text-muted-foreground font-mono text-xs break-words">{o.evidence}</p>
              <p>
                <span className="font-medium">Proposed:</span> {o.proposed_action}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Impact:</span> {o.expected_impact}
              </p>
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <Badge variant="outline">status: {o.status}</Badge>
                {o.status === "auto_fired" ? (
                  <Badge variant="secondary">auto-fired ✓ (stage-only)</Badge>
                ) : o.status === "new" ? (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === o.opp_id} onClick={() => decide(o.opp_id, "approve")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === o.opp_id}
                      onClick={() => decide(o.opp_id, "deny")}
                    >
                      Deny
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">{o.result}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
