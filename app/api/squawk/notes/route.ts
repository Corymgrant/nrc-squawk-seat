import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

// Append a note to a squawk ticket's thread. Append-only — there is no edit or
// delete path anywhere. Reps may only note their OWN tickets; the owner may note
// any ticket in the org. Service-role client is used after the explicit ownership
// check (same pattern as the owner console routes).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { ticket_id?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const ticket_id = (body.ticket_id || "").trim();
  const text = (body.text || "").trim();
  if (!ticket_id || !text) {
    return NextResponse.json({ error: "ticket_id and text are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("squawk_tickets")
    .select("id,org_id,user_id")
    .eq("id", ticket_id)
    .single();
  if (!ticket || ticket.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (profile.role !== "owner" && ticket.user_id !== profile.id) {
    return NextResponse.json({ error: "Not your ticket" }, { status: 403 });
  }

  const { data: note, error } = await admin
    .from("squawk_ticket_notes")
    .insert({
      ticket_id,
      org_id: ticket.org_id,
      author_user_id: profile.id,
      author_role: profile.role === "owner" ? "owner" : "rep",
      author_name: profile.full_name || profile.email || "Rep",
      text,
    })
    .select("id,author_role,author_name,text,created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note });
}
