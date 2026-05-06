"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/auth/supabase-browser";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(true);

  useEffect(() => {
    setSupabaseReady(getSupabaseBrowser() !== null);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error: err } = await sb.auth.signUp({ email, password });
        if (err) throw err;
        setInfo("Check your inbox to confirm the email, then sign in.");
        setMode("signin");
      } else {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace(next);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-xl">{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {mode === "signin"
            ? "Personal watchlist and admin access require an account."
            : "Use a working email — confirmation is sent before sign-in works."}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">Email</label>
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy || !supabaseReady}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">Password</label>
            <Input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={busy || !supabaseReady}
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {info && <p className="text-sm text-emerald-700">{info}</p>}
          {!supabaseReady && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Supabase env vars are missing. The app keeps working in public-signal mode, but you can&rsquo;t sign in.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy || !supabaseReady}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setInfo(null);
              setMode((m) => (m === "signin" ? "signup" : "signin"));
            }}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Don't have an account? Create one" : "Already have an account? Sign in"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
