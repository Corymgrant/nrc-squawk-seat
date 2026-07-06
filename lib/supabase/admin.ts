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

/**
 * A squawk ticket can carry N screenshots. To stay schema-additive/reversible we
 * store the storage paths newline-joined in the existing `image_path text` column
 * (a legacy single-path row has no newline → a clean 1-element list). These helpers
 * are the single source of truth for splitting + signing so every reader stays in sync.
 */
export function splitImagePaths(image_path?: string | null): string[] {
  if (!image_path) return [];
  return image_path
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function signImagePaths(
  admin: ReturnType<typeof createAdminClient>,
  image_path?: string | null,
): Promise<string[]> {
  const paths = splitImagePaths(image_path);
  const urls = await Promise.all(
    paths.map(async (p) => {
      const { data } = await admin.storage
        .from(SQUAWK_IMAGES_BUCKET)
        .createSignedUrl(p, SIGNED_URL_TTL);
      return data?.signedUrl ?? null;
    }),
  );
  return urls.filter((u): u is string => !!u);
}

/** Join N storage paths for storage in the `image_path` column (null when empty). */
export function joinImagePaths(paths: string[]): string | null {
  const clean = paths.map((p) => p.trim()).filter(Boolean);
  return clean.length ? clean.join("\n") : null;
}
