import { DirectoryView } from "@/components/directory-view";

export const metadata = { title: "Directory · WalletLens" };
export const dynamic = "force-dynamic";

export default function DirectoryPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <DirectoryView />
    </main>
  );
}
