import { WatchlistView } from "@/components/watchlist-view";

export const metadata = { title: "Watchlist · WalletLens" };
export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <WatchlistView />
    </main>
  );
}
