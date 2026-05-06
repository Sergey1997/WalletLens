"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldOff, ShieldPlus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminRow {
  user_id: string;
  email: string;
  role: "admin" | "analyst";
  note?: string | null;
  created_at?: string;
  created_by?: string | null;
}

interface ListResponse {
  admins: AdminRow[];
  current_user_id?: string;
}

export function AdminUsers() {
  const [list, setList] = useState<AdminRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "analyst">("admin");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      setList(json.admins ?? []);
      setCurrentUserId(json.current_user_id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setFeedback(`Granted ${role} to ${email.trim()}`);
      setEmail("");
      setNote("");
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (row: AdminRow) => {
    if (row.user_id === currentUserId) {
      setError("You cannot remove yourself");
      return;
    }
    setBusyId(row.user_id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: row.user_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Grant admin / analyst</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            The user must have signed up first. We look them up in <span className="mono">auth.users</span>{" "}
            by email and add them to <span className="mono">admin_users</span>. <strong>Admins</strong> can do
            everything in this panel; <strong>analysts</strong> get read-only access (UI gating coming soon).
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto]">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "analyst")}
              className="flex h-10 rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="admin">admin</option>
              <option value="analyst">analyst</option>
            </select>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
            <Button type="submit" disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
              Grant
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          {feedback && <p className="mt-3 text-sm text-emerald-700">{feedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Current admins</CardTitle>
          <Badge variant="outline">{list.length}</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> loading…
            </div>
          ) : list.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No admins yet. The first signed-in user can promote themselves via the bootstrap call.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    <th className="px-3 py-2 text-left font-medium">Added</th>
                    <th className="px-3 py-2 text-left font-medium">Note</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.user_id} className="table-row">
                      <td className="px-3 py-2 mono text-xs">
                        {r.email}
                        {r.user_id === currentUserId && (
                          <span className="ml-2 text-[10px] uppercase text-primary">you</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.role === "admin" ? "info" : "outline"}>{r.role}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.note ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === r.user_id || r.user_id === currentUserId}
                          onClick={() => void remove(r)}
                          title={r.user_id === currentUserId ? "You cannot remove yourself" : "Revoke"}
                        >
                          {busyId === r.user_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : r.user_id === currentUserId ? (
                            <ShieldOff className="h-3.5 w-3.5" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
