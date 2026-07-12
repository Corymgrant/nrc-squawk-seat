import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Optional coach affordance for the Apprentice window (job 663). The rep may leave an
// improved version of a past shadow draft — a highest-weight training signal, harvested
// later by the flywheel. Zero obligation: nothing depends on this, no task, no counter.
// Append-only; RLS enforces author_user_id = auth.uid() and org scoping.
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

  let body: { ledger_id?: string; improved_text?: string; why?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const ledger_id = (body.ledger_id || "").trim();
  const improved_text = (body.improved_text || "").trim();
  const why = (body.why || "").trim() || null;
  if (!ledger_id || improved_text.length < 4) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const { error } = await supabase.from("apprentice_coach_notes").insert({
    ledger_id,
    org_id: profile.org_id,
    author_user_id: profile.id,
    author_name: profile.full_name || profile.email || "rep",
    improved_text,
    why,
  });
  if (error) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
