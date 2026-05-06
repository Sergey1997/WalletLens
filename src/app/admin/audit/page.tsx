import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target_kind: string | null;
  target_id: string | null;
  payload: unknown;
  created_at: string;
}

export default async function AdminAuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/audit");
  if (!(await getCurrentAdmin())) redirect("/");

  const sb = getSupabaseServer();
  let rows: AuditRow[] = [];
  if (sb) {
    const { data } = await sb
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as AuditRow[];
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Audit log</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Every admin write is recorded here. Useful when a label change leaks through to production.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No audit events yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <details key={r.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="mono text-[10px]">
                      {r.action}
                    </Badge>
                    <span className="text-muted-foreground">{r.target_kind ?? "—"}</span>
                    {r.target_id && (
                      <span className="mono text-xs text-muted-foreground">{r.target_id.slice(0, 8)}…</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · {r.actor}
                  </span>
                </summary>
                <pre className="code-block mono mt-2 max-h-72 overflow-auto rounded-lg p-2 text-[11px]">
                  {JSON.stringify(r.payload, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
