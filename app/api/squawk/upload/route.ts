import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  SQUAWK_IMAGES_BUCKET,
  SIGNED_URL_TTL,
} from "@/lib/supabase/admin";

// Feature 2 — image upload for the squawk composer.
// Browser posts the dragged/pasted/picked image here; we authenticate the rep,
// validate type + size, then store it in the private squawk-images bucket via the
// service client (no browser storage-RLS needed). Returns the canonical storage
// path (stored on the squawk record) plus a signed URL for immediate preview.
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const OK_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/heic",
];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,org_id")
    .eq("id", claims.sub)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (!OK_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Images only (png, jpg, webp, gif, heic)." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10MB)." }, { status: 413 });
  }

  const rawExt = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = rawExt || "png";
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${profile.org_id}/${profile.id}/${Date.now()}-${rand}.${ext}`;

  const admin = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(SQUAWK_IMAGES_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (upErr) {
    return NextResponse.json(
      { error: `Upload failed: ${upErr.message}` },
      { status: 500 },
    );
  }

  const { data: signed } = await admin.storage
    .from(SQUAWK_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  return NextResponse.json({ path, signed_url: signed?.signedUrl ?? null });
}
