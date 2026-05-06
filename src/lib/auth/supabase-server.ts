import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * Supabase client bound to the current request cookies. Uses the **anon key**, so
 * it respects RLS using the signed-in user's JWT. For privileged server-side reads
 * (cache writes, admin imports) keep using `getSupabaseServer()` from `lib/supabase.ts`,
 * which holds the service-role key.
 */
export function getSupabaseRSC(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const store = cookies();
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          store.set({ name, value, ...options });
        } catch {
          /* in RSC we may be in read-only context; safe to ignore */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          store.set({ name, value: "", ...options });
        } catch {
          /* read-only context */
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const sb = getSupabaseRSC();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export type AdminRole = "admin" | "analyst";

export interface AdminRecord {
  user_id: string;
  email: string;
  role: AdminRole;
  note?: string | null;
  created_at?: string;
}

/**
 * Look up the admin record for the **currently signed-in user**. Reads
 * `public.admin_users` through the user's own RLS context, so it never
 * leaks the full admin roster to the client. Returns `null` when the user
 * is signed out or simply isn't an admin.
 */
export async function getCurrentAdmin(): Promise<AdminRecord | null> {
  const sb = getSupabaseRSC();
  if (!sb) return null;
  const { data: userRes } = await sb.auth.getUser();
  const user = userRes.user;
  if (!user) return null;
  const { data, error } = await sb
    .from("admin_users")
    .select("user_id, email, role, note, created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as AdminRecord;
}

export async function isAdmin(): Promise<boolean> {
  return (await getCurrentAdmin()) !== null;
}

export async function requireAdmin(): Promise<
  { ok: true; email: string; user_id: string; role: AdminRole } | { ok: false; reason: "anon" | "not_admin" }
> {
  const sb = getSupabaseRSC();
  if (!sb) return { ok: false, reason: "anon" };
  const { data: userRes } = await sb.auth.getUser();
  const user = userRes.user;
  if (!user) return { ok: false, reason: "anon" };
  const { data } = await sb
    .from("admin_users")
    .select("role, email")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_admin" };
  return {
    ok: true,
    user_id: user.id,
    email: (data.email as string) ?? user.email ?? "",
    role: (data.role as AdminRole) ?? "admin",
  };
}

