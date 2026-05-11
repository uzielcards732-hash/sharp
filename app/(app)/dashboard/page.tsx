import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, subscription_tier, lifetime_analyses_used")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Logged in as <span className="text-foreground font-medium">{user.email}</span>
        </p>
        {profile && (
          <p className="text-sm text-muted-foreground">
            Plan: <span className="capitalize">{profile.subscription_tier}</span>
            {" · "}
            Analyses used: {profile.lifetime_analyses_used}
          </p>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}
