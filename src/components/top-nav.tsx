"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Bookmark,
  Compass,
  Diamond,
  HelpCircle,
  LayoutGrid,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  Sliders,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavEntry {
  href: string;
  label: string;
  icon: typeof Diamond;
  adminOnly?: boolean;
}

const NAV: NavEntry[] = [
  { href: "/", label: "Check", icon: ShieldCheck },
  { href: "/directory", label: "Directory", icon: Compass },
  { href: "/profiles", label: "Profiles", icon: Sliders },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/admin", label: "Admin", icon: UserCog, adminOnly: true },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
];

interface Identity {
  authenticated: boolean;
  email?: string;
  is_admin?: boolean;
}

function avatarInitial(email?: string | null) {
  if (!email) return "?";
  const trimmed = email.trim();
  return trimmed.charAt(0).toUpperCase();
}

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/whoami", { cache: "no-store" });
      if (!res.ok) {
        setIdentity({ authenticated: false });
        return;
      }
      setIdentity((await res.json()) as Identity);
    } catch {
      setIdentity({ authenticated: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    setIdentity({ authenticated: false });
    setMenuOpen(false);
    router.replace("/");
    router.refresh();
  }, [router]);

  const navItems = useMemo(
    () => NAV.filter((n) => !n.adminOnly || identity?.is_admin),
    [identity?.is_admin],
  );

  const goSearch = useCallback(() => {
    if (pathname !== "/") {
      router.push("/");
      return;
    }
    const el = document.getElementById("wallet-search-input");
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pathname, router]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 pr-3 font-semibold tracking-tight text-foreground"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
            <Diamond className="h-4 w-4" />
          </span>
          <span className="hidden text-[15px] sm:inline">WalletLens</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 border-l border-border pl-3 md:flex">
          {navItems.map((entry) => {
            const isActive =
              entry.href === "/"
                ? pathname === "/"
                : pathname.startsWith(entry.href);
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={cn("nav-link", isActive && "nav-link-active")}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{entry.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-1 md:flex-initial">
          <button
            type="button"
            className="icon-btn"
            aria-label="Search wallets"
            title="Search wallets"
            onClick={goSearch}
          >
            <Search className="h-4 w-4" />
          </button>
          <Link
            href="/methodology"
            className="icon-btn"
            aria-label="Methodology"
            title="Methodology"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
          <span className="mx-1 hidden h-6 w-px bg-border sm:inline-block" />
          {identity?.authenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full pl-1 pr-2 transition-colors hover:bg-muted"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-primary-foreground",
                    identity.is_admin ? "bg-primary" : "bg-foreground",
                  )}
                  title={identity.email}
                >
                  {avatarInitial(identity.email)}
                </span>
                {identity.is_admin && (
                  <span className="hidden rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent-foreground sm:inline">
                    admin
                  </span>
                )}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 w-56 rounded-xl border border-border bg-card p-2 shadow-lg"
                >
                  <div className="px-3 py-2 text-xs">
                    <div className="font-medium text-foreground">{identity.email}</div>
                    <div className="mt-0.5 text-muted-foreground">
                      {identity.is_admin ? "Admin" : "Signed in"}
                    </div>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    role="menuitem"
                    href="/settings"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Settings
                  </Link>
                  <Link
                    role="menuitem"
                    href="/watchlist"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    My watchlist
                  </Link>
                  {identity.is_admin && (
                    <Link
                      role="menuitem"
                      href="/admin"
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <UserCog className="h-3.5 w-3.5" />
                      Admin panel
                    </Link>
                  )}
                  <div className="my-1 h-px bg-border" />
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.5)] hover:bg-primary/90"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav: pill scroller below header */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border bg-card/80 px-3 py-2 md:hidden">
        {navItems.map((entry) => {
          const isActive =
            entry.href === "/"
              ? pathname === "/"
              : pathname.startsWith(entry.href);
          const Icon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={cn("nav-link shrink-0", isActive && "nav-link-active")}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">{entry.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
