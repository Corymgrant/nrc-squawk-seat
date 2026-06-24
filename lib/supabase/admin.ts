import { createClient } from "@supabase/supabase-js";

/**
 * Server-only service-role client (new-style `sb_secret_…` key).
 * Used for Storage admin (upload + signed URLs) so the browser never needs
 * storage-RLS access and the secret never reaches the client bundle.
 * NEVER import this from a client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SQUAWK_IMAGES_BUCKET = "squawk-images";
export const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days
