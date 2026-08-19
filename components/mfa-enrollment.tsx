"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// job 1941: THE COCKPIT Phase 1 — self-service TOTP MFA enrollment. The
// secret/QR is generated client-side by Supabase Auth and shown ONLY in this
// authenticated browser session for the account owner to scan with THEIR OWN
// authenticator app — it is never transmitted anywhere else, never logged,
// never seen by the build process. This is the safe way to add MFA: no one
// but the account holder ever holds the secret, so there is no lockout risk
// from a cook enrolling a factor on Cory's behalf.

type Factor = { id: string; factor_type: string; status: string; friendly_name?: string | null };

export function MfaEnrollment() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setErr(error.message);
    else setFactors([...(data.totp ?? []), ...((data as unknown as { phone?: Factor[] }).phone ?? [])]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const verifiedCount = factors.filter((f) => f.status === "verified").length;

  async function startEnroll() {
    setErr(null);
    setMsg(null);
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) {
      setErr(error.message);
      setEnrolling(false);
      return;
    }
    setPendingFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function confirmEnroll() {
    if (!pendingFactorId) return;
    setErr(null);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
    if (chErr) {
      setErr(chErr.message);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challenge.id,
      code,
    });
    if (vErr) {
      setErr(vErr.message);
      return;
    }
    setMsg("MFA enrolled — you will be asked for a code on future sign-ins.");
    setEnrolling(false);
    setQr(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode("");
    await loadFactors();
  }

  async function unenroll(factorId: string) {
    setErr(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) setErr(error.message);
    else {
      setMsg("Factor removed.");
      await loadFactors();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          Scan the QR with your own authenticator app (Google Authenticator, 1Password, Authy…). The
          secret is generated for this session only and never leaves your browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">loading…</p>}
        {err && <p className="text-sm text-red-500">{err}</p>}
        {msg && <p className="text-sm text-emerald-500">{msg}</p>}

        {!loading && factors.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {f.factor_type} · {f.friendly_name || f.id.slice(0, 8)} ·{" "}
                  <span className={f.status === "verified" ? "text-emerald-500" : "text-amber-500"}>{f.status}</span>
                </span>
                <Button variant="outline" size="sm" onClick={() => unenroll(f.id)}>
                  remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {!loading && verifiedCount === 0 && !qr && (
          <Button onClick={startEnroll} disabled={enrolling}>
            {enrolling ? "…" : "Enroll a TOTP authenticator"}
          </Button>
        )}

        {qr && (
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="TOTP QR code" width={200} height={200} />
            <p className="text-xs text-muted-foreground break-all">Manual entry secret: {secret}</p>
            <div className="grid gap-2">
              <Label htmlFor="mfa-code">Enter the 6-digit code from your app</Label>
              <Input id="mfa-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <Button onClick={confirmEnroll} disabled={code.length !== 6}>
              Confirm
            </Button>
          </div>
        )}

        {!loading && verifiedCount > 0 && !qr && (
          <p className="text-sm text-muted-foreground">
            MFA is active on this account — sign-in will ask for a code from your app.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
