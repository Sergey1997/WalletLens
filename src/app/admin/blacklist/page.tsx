import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth/supabase-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon, categoryLabel } from "@/components/category-icon";

export const dynamic = "force-dynamic";

const RISKY = [
  "sanctioned",
  "us_ofac_sanctions",
  "us_enforcement",
  "mixer",
  "exploit",
  "hacking",
  "conti_hacking",
  "conti_leaks_hacking",
  "dharma_hacking",
  "stolen_coins",
  "exmo_stolen_coins",
  "liquid_stolen_coins",
  "ronin_stolen_coins",
  "phishing",
  "scam",
  "gainbitcoin_scam",
  "plus_token_scam",
  "abuse_reported",
  "illicit_reported",
  "user_reported",
  "autodetected_alert",
  "banned_by_contract",
  "darknet_market",
  "dark_service",
  "nested_illicit",
  "hydra_nested",
  "suex_nested",
  "ransom",
  "extortion_ransom",
  "master_extortion_ransom",
  "robbinhood_extortion_ransom",
  "terrorism",
  "terrorism_financing",
  "hamas_terrorism",
  "russian_terrorism",
  "child_exploitation",
  "child_sexual_abuse_material",
  "illegal_service",
  "exchange_fraudulent",
  "exchange_unlicensed",
];

interface Row {
  id: string;
  name: string;
  category_id: string;
  risk_level: number;
  status: string;
  updated_at: string;
  risk_entity_addresses: { id: string }[] | null;
}

export default async function AdminBlacklistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/blacklist");
  if (!(await getCurrentAdmin())) redirect("/");

  const sb = getSupabaseServer();
  let rows: Row[] = [];
  let supabaseConfigured = !!sb;
  if (sb) {
    const { data, error } = await sb
      .from("risk_entities")
      .select("id, name, category_id, risk_level, status, updated_at, risk_entity_addresses(id)")
      .in("category_id", RISKY)
      .order("risk_level", { ascending: false })
      .limit(200);
    if (!error) rows = (data ?? []) as Row[];
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">Blacklist</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            All entities currently scored as risky. This is the live picture every user sees in their reports.
          </p>
        </div>
        <Badge variant="outline">{rows.length}</Badge>
      </CardHeader>
      <CardContent>
        {!supabaseConfigured && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Supabase env vars are missing. The blacklist UI works only against the DB.
          </p>
        )}
        {supabaseConfigured && rows.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            The risky-entities table is empty. Add rows via Entities or Import.
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Entity</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Risk</th>
                  <th className="px-3 py-2 text-right font-medium">Addresses</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="px-3 py-2">
                      <Link
                        href={`/directory?focus=${r.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <CategoryIcon category={r.category_id} size="sm" />
                        <span className="font-medium">{r.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {categoryLabel(r.category_id)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.risk_level}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(r.risk_entity_addresses?.length ?? 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "active" ? "danger" : "outline"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
