import Link from "next/link";
import { DisclaimerFooter } from "@/components/disclaimer-footer";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col justify-center px-5 py-12">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Live parlay discipline
            </span>
          </div>

          <h1 className="font-sans text-6xl font-black leading-none tracking-[-0.04em]">
            Sharp.
          </h1>

          <p className="text-base leading-relaxed text-muted-foreground">
            AI-powered live parlay analysis for NBA, NFL, and MLB. Two legs.
            No regression calls before Q3. No begging the model for a third
            leg. Discipline enforcement, not parlay generation.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              $29/month. Cancel anytime. 3 free analyses to start.
            </p>
          </div>

          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-foreground">→</span>
              Live box score + props pulled at request time.
            </li>
            <li className="flex gap-3">
              <span className="text-foreground">→</span>
              Confidence rating, kill conditions, explicit NO PLAY calls.
            </li>
            <li className="flex gap-3">
              <span className="text-foreground">→</span>
              Streamed token-by-token. Built for your phone.
            </li>
          </ul>
        </div>
      </main>
      <DisclaimerFooter />
    </div>
  );
}
