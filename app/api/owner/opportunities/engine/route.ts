import { NextResponse } from "next/server";
import { requireOwner, cockpitFetch } from "@/lib/cockpit";

// POST /api/owner/opportunities/engine  { kill_switch?, agent?, enabled?, allow_autofire? }
// Kill switch + per-agent toggles. Owner-gated; token held server-side.
export async function POST(req: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const r = await cockpitFetch(`/api/owner/opportunities/engine`, { method: "POST", body });
  return NextResponse.json(r.json, { status: r.status });
}
