import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";
import { teachConfigured, teachFetch } from "@/lib/teach";

// Teach-sandbox draft: any provisioned seat (Michael or owner) can ask the LIVE
// Intelligence Spine what the autoresponder would draft for a question. Read-only
// on the backend — no email is ever sent, no lesson is written by this route.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!teachConfigured()) {
    return NextResponse.json({ error: "Teach sandbox not configured" }, { status: 500 });
  }

  let body: { question?: string; lane?: string; lead_meta?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const question = (body.question || "").trim().slice(0, 4000);
  if (!question) {
    return NextResponse.json({ error: "Type the customer's question first." }, { status: 400 });
  }
  const lane = body.lane === "claims" ? "claims" : "sales";
  const lead_meta =
    body.lead_meta && typeof body.lead_meta === "object" ? body.lead_meta : {};

  try {
    const r = await teachFetch("/api/draft", { question, lane, lead_meta });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json(
      { error: `Teach sandbox unreachable: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }
}
