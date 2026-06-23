import { AuthButton } from "@/components/auth-button";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16 sticky top-0 z-10 bg-background/80 backdrop-blur">
          <div className="w-full max-w-4xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/protected" className="flex items-center gap-2 font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-foreground text-background text-xs font-bold">C</span>
              Cockpit <span className="text-muted-foreground font-normal">· Squawk Seat</span>
            </Link>
            <Suspense><AuthButton /></Suspense>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-8 max-w-4xl w-full p-5">{children}</div>
        <footer className="w-full flex items-center justify-center border-t text-center text-xs py-8 text-muted-foreground">
          NoRepairCost · powered by Cockpit
        </footer>
      </div>
    </main>
  );
}
