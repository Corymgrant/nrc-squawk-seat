import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const WEBHOOK = process.env.SQUAWK_WEBHOOK_URL;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,org_id,email,full_name,role")
    .eq("id", claims.sub)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 403 });
  }

  let body: { text?: string; lead_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Please describe the problem." }, { status: 400 });
  }
  const lead_id = (body.lead_id || "").trim() || undefined;

  if (!WEBHOOK) {
    return NextResponse.json({ error: "Squawk intake not configured" }, { status: 500 });
  }

  let reply = "Got it — looking into this.";
  try {
    const r = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reporter: profile.full_name || profile.email || "michael",
        text,
        lead_id,
      }),
    });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      if (j && typeof j.reply === "string" && j.reply) reply = j.reply;
    }
  } catch {
    // Could not reach the intake right now — still log the ticket and reply gracefully.
  }

  await supabase.from("squawk_tickets").insert({
    org_id: profile.org_id,
    user_id: profile.id,
    reporter: profile.full_name || profile.email,
    text,
    lead_id: lead_id ?? null,
    reply,
  });

  return NextResponse.json({ reply });
}
