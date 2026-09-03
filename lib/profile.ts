import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "sales_rep";
export type Profile = {
  id: string;
  org_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
};

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,org_id,email,full_name,role")
    .eq("id", sub)
    .single();
  return (profile as Profile) ?? null;
}
