import { NextResponse } from "next/server";
import { requireOwner, cockpitFetch } from "@/lib/cockpit";

// POST /api/owner/opportunities/decide  { opp_id, decision: approve|deny, note? }
// Approve -> backend enqueues the opp's cook (@@QUEUE) + status in_progress.
// Deny    -> status denied. The owner token never leaves the server.
export async function POST(req: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: { opp_id?: string; decision?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const opp_id = (body.opp_id || "").trim();
  const decision = (body.decision || "").trim();
  if (!opp_id || !decision) {
    return NextResponse.json({ error: "opp_id and decision required" }, { status: 422 });
  }

  const r = await cockpitFetch(`/api/owner/opportunities/decide`, {
    method: "POST",
    body: { opp_id, decision, note: (body.note || "").trim() },
  });
  return NextResponse.json(r.json, { status: r.status });
}
