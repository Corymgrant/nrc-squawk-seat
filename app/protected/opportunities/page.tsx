import { getSessionProfile } from "@/lib/profile";
import { OpportunitiesBoard } from "@/components/opportunities-board";
import { LogoutButton } from "@/components/logout-button";

// Owner-only Opportunities board. The decision surface for the always-on
// improvement engine: ranked findings with blast-radius badges + Approve/Deny,
// kill switch, and per-agent toggles.
export default async function OpportunitiesPage() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Owner only</h1>
        <p className="text-muted-foreground max-w-md">
          The Opportunities board is restricted to the owner seat.
        </p>
        <LogoutButton />
      </div>
    );
  }
  return <OpportunitiesBoard />;
}
