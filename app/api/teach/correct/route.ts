import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";
import { teachConfigured, teachFetch } from "@/lib/teach";

// Teach-sandbox correction: Michael's edit + reason is distilled (local Qwen) into
// ONE imperative rule and retained to Hindsight (bank nrc, tag michael-edit-lesson)
// — the SAME store the live drafters recall from, so the lesson applies to every
// future draft. Draft-only backend; nothing is emailed.
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

  let body: {
    question?: string;
    original?: string;
    corrected?: string;
    why?: string;
    lane?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const question = (body.question || "").trim().slice(0, 4000);
  const corrected = (body.corrected || "").trim().slice(0, 8000);
  if (!question || !corrected) {
    return NextResponse.json(
      { error: "Need the question and your corrected draft." },
      { status: 400 },
    );
  }

  try {
    const r = await teachFetch("/api/correct", {
      question,
      original: (body.original || "").trim().slice(0, 8000),
      corrected,
      why: (body.why || "").trim().slice(0, 1000),
      lane: body.lane === "claims" ? "claims" : "sales",
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json(
      { error: `Teach sandbox unreachable: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }
}
