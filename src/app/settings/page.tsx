import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings · WalletLens" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <SettingsView email={user.email ?? ""} />
    </main>
  );
}
