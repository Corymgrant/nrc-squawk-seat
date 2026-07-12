import { AuthButton } from "@/components/auth-button";
import Link from "next/link";
import { Suspense } from "react";
import { activeKit } from "@/lib/kit-config";

// Unified Cockpit seat shell (job 685). One chrome for the whole seat — squawk
// box + systems status + apprentice window all live inside this frame, so the
// rep's seat and the owner cockpit read as the same product. Brand/labels come
// from the active kit (multi-tenant), never hard-coded.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const kit = activeKit;
  return (
    <main className="relative flex min-h-screen flex-col items-center">
      <nav className="sticky top-0 z-20 flex w-full justify-center border-b border-border/70 bg-background/70 backdrop-blur-xl">
        {/* emerald hairline — the cockpit signature */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${kit.accent}66, transparent)` }}
        />
        <div className="flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <Link href="/protected" className="group flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground shadow-[0_0_18px_-4px] transition-transform group-hover:scale-105"
              style={{ background: kit.accent, boxShadow: `0 0 18px -4px ${kit.accent}` }}
            >
              {kit.monogram}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                {kit.product}
                <span className="ml-1.5 font-normal text-muted-foreground">· {kit.seatLabel}</span>
              </span>
              <span className="text-[11px] text-muted-foreground/80">{kit.brand}</span>
            </span>
          </Link>
          <Suspense>
            <AuthButton />
          </Suspense>
        </div>
      </nav>

      <div className="flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
        {children}
      </div>

      <footer className="flex w-full items-center justify-center gap-2 border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: kit.accent }}
        />
        {kit.tagline}
      </footer>
    </main>
  );
}
