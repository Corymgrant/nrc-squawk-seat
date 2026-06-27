import { NextResponse } from "next/server";
import { requireOwner, cockpitFetch } from "@/lib/cockpit";

// GET /api/owner/opportunities[?status=]  -> ranked opportunities + engine status.
export async function GET(req: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";

  const [opps, engine] = await Promise.all([
    cockpitFetch(`/api/owner/opportunities${qs}`),
    cockpitFetch(`/api/owner/opportunities/engine`),
  ]);
  return NextResponse.json(
    { opportunities: opps.json, engine: engine.json },
    { status: opps.status === 200 ? 200 : opps.status }
  );
}
