import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bookmark,
  Building2,
  ListChecks,
  ShieldAlert,
  Upload,
  UserCog,
} from "lucide-react";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth/supabase-server";

export const metadata = { title: "Admin · WalletLens" };
export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/entities", label: "Entities", icon: ListChecks },
  { href: "/admin/import", label: "Import", icon: Upload },
  { href: "/admin/providers", label: "Providers", icon: Building2 },
  { href: "/admin/blacklist", label: "Blacklist", icon: ShieldAlert },
  { href: "/admin/users", label: "Admins", icon: UserCog },
  { href: "/admin/audit", label: "Audit log", icon: Bookmark },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage shared risk directory, providers and blacklist. Changes here apply to all users
            of the platform. Personal settings live on the user&rsquo;s own profile.
          </p>
        </div>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-primary">
          {user.email} · {admin.role}
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="surface rounded-2xl p-2">
          <ul className="space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div>{children}</div>
      </div>
    </main>
  );
}
