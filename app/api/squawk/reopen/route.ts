import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

// Reopen a squawk ticket. Per the self-heal spec, a reopen always wins over an
// assumed fix: status → 'reopened' and a system note records the transition, so
// the thread stays an honest history. Reps may only reopen their OWN tickets.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { ticket_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const ticket_id = (body.ticket_id || "").trim();
  const reason = (body.reason || "").trim();
  if (!ticket_id) {
    return NextResponse.json({ error: "ticket_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("squawk_tickets")
    .select("id,org_id,user_id,status")
    .eq("id", ticket_id)
    .single();
  if (!ticket || ticket.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (profile.role !== "owner" && ticket.user_id !== profile.id) {
    return NextResponse.json({ error: "Not your ticket" }, { status: 403 });
  }
  if (ticket.status === "reopened") {
    return NextResponse.json({ error: "Already reopened" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("squawk_tickets")
    .update({ status: "reopened", reopened_at: now, status_updated_at: now })
    .eq("id", ticket_id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const authorName = profile.full_name || profile.email || "Rep";
  const notes = [
    {
      ticket_id,
      org_id: ticket.org_id,
      author_user_id: profile.id,
      author_role: "system",
      author_name: "System",
      text: `Reopened by ${authorName} (was: ${ticket.status}).`,
    },
    ...(reason
      ? [
          {
            ticket_id,
            org_id: ticket.org_id,
            author_user_id: profile.id,
            author_role: profile.role === "owner" ? "owner" : "rep",
            author_name: authorName,
            text: reason,
          },
        ]
      : []),
  ];
  const { error: noteErr } = await admin.from("squawk_ticket_notes").insert(notes);
  if (noteErr) return NextResponse.json({ error: noteErr.message }, { status: 500 });

  return NextResponse.json({ status: "reopened" });
}
