import { ProfilesView } from "@/components/profiles-view";

export const metadata = { title: "Risk Score Profiles · WalletLens" };
export const dynamic = "force-dynamic";

export default function ProfilesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ProfilesView />
    </main>
  );
}
