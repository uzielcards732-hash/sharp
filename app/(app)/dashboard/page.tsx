import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { AnalyzeForm } from "@/components/analyze-form";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, lifetime_analyses_used")
    .eq("id", user.id)
    .single();

  const analysesUsed = profile?.lifetime_analyses_used ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold tracking-tight text-foreground">Sharp</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <AnalyzeForm initialAnalysesUsed={analysesUsed} />
      </main>
    </div>
  );
}
