import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { SquawkConsole } from "@/components/squawk-console";
import { LogoutButton } from "@/components/logout-button";


export default async function SeatPage() {
  const profile = await getSessionProfile();
  // Defence-in-depth: the owner's home is /dashboard — bounce there if they
  // land on the rep seat (e.g. an old bookmark).
  if (profile?.role === "owner") redirect("/dashboard");
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Account not provisioned</h1>
        <p className="text-muted-foreground max-w-md">
          This email isn&apos;t set up for the Cockpit seat yet. Ask Cory to provision your
          account, then sign in again.
        </p>
        <LogoutButton />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("squawk_tickets")
    .select("id,reporter,text,reply,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <SquawkConsole
      role={profile.role}
      fullName={profile.full_name ?? profile.email ?? "there"}
      tickets={tickets ?? []}
    />
  );
}
