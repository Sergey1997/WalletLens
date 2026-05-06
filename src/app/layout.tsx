import type { Metadata } from "next";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "WalletLens — EVM wallet risk reports",
  description:
    "Analyze any EVM wallet across Ethereum and Base. Transparent scoring with public signals, weights and confidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
