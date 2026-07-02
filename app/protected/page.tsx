import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  SQUAWK_IMAGES_BUCKET,
  SIGNED_URL_TTL,
} from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/profile";
import { SquawkConsole } from "@/components/squawk-console";
import { SystemsStatus } from "@/components/systems-status";
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
    .select("id,reporter,text,reply,created_at,image_path")
    .order("created_at", { ascending: false })
    .limit(50);

  // Sign URLs for any attached images (private bucket → short-lived signed URLs).
  const admin = createAdminClient();
  const withUrls = await Promise.all(
    (tickets ?? []).map(async (t) => {
      let image_url: string | null = null;
      if (t.image_path) {
        const { data } = await admin.storage
          .from(SQUAWK_IMAGES_BUCKET)
          .createSignedUrl(t.image_path, SIGNED_URL_TTL);
        image_url = data?.signedUrl ?? null;
      }
      return { ...t, image_url };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <SystemsStatus />
      <SquawkConsole
        role={profile.role}
        fullName={profile.full_name ?? profile.email ?? "there"}
        tickets={withUrls}
      />
    </div>
  );
}
