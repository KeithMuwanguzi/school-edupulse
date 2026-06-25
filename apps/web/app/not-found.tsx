import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-700">
          SkulPulse
        </div>
        <h1 className="mt-3 font-display text-5xl font-semibold text-slate-800">404</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
          We couldn&apos;t find that page. It may have been moved, or the link is
          incorrect.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link href="/app">
            <Button size="sm">Go to dashboard</Button>
          </Link>
          <Link href="/">
            <Button size="sm" variant="secondary">
              Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
