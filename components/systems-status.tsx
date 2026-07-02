"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Glanceable systems panel for Michael (job 335): TOP line = is the public site
// up and is the quote form accepting (real synthetic checks from the internet),
// then the internal pieces. Green = live. Amber/red = investigate before
// assuming a customer complaint is real — and before pinging Cory.

type Light = "green" | "amber" | "red";
type Row = { key: string; label: string; light: Light; detail: string };
type StatusPayload = {
  ok: boolean;
  checked_at: string;
  overall: Light;
  verdict: string;
  public: Row[];
  internal: Row[];
  error?: string;
};

const DOT: Record<Light, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};
const LABEL: Record<Light, string> = {
  green: "All systems green",
  amber: "Needs a look",
  red: "Problem detected",
};

function StatusRow({ row }: { row: Row }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[row.light]}`} />
      <div className="min-w-0">
        <span className="text-sm font-medium">{row.label}</span>
        <span className="ml-2 text-xs text-muted-foreground">{row.detail}</span>
      </div>
    </li>
  );
}

export function SystemsStatus() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Status check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const overall: Light = data?.overall ?? "amber";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={`h-3 w-3 rounded-full ${loading && !data ? "bg-muted-foreground animate-pulse" : DOT[overall]}`} />
            {loading && !data ? "Checking systems…" : err ? "Status check failed" : LABEL[overall]}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {data && <span>{new Date(data.checked_at).toLocaleTimeString()}</span>}
            <button type="button" onClick={load} disabled={loading} className="underline hover:text-foreground">
              {loading ? "checking…" : "re-check"}
            </button>
          </div>
        </div>
        {data && <CardDescription>{data.verdict}</CardDescription>}
        {err && <CardDescription className="text-red-500">{err}</CardDescription>}
      </CardHeader>
      {data && (
        <CardContent className="pt-0">
          <ul className="flex flex-col divide-y divide-foreground/5">
            {data.public.map((r) => (
              <StatusRow key={r.key} row={r} />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 text-xs text-muted-foreground underline hover:text-foreground"
          >
            {open ? "hide internal systems" : `internal systems (${data.internal.length}) ▸`}
          </button>
          {open && (
            <ul className="mt-1 flex flex-col divide-y divide-foreground/5">
              {data.internal.map((r) => (
                <StatusRow key={r.key} row={r} />
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}
