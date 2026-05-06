import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ListChecks, ShieldAlert, Upload } from "lucide-react";

export default function AdminHome() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AdminCard
        title="Add suspicious entity"
        description="Manually create a risky service and attach its known addresses across chains."
        href="/admin/entities"
        icon={<ListChecks className="h-4 w-4" />}
      />
      <AdminCard
        title="Bulk import"
        description="Upload a CSV/JSON file to add many addresses at once. Existing entities are reused by name."
        href="/admin/import"
        icon={<Upload className="h-4 w-4" />}
      />
      <AdminCard
        title="Blacklist"
        description="Browse the full live blacklist that influences scoring for every user."
        href="/admin/blacklist"
        icon={<ShieldAlert className="h-4 w-4" />}
      />
      <AdminCard
        title="Providers"
        description="Manage the data sources used in the directory and the trust level we attach to each."
        href="/admin/providers"
        icon={<ListChecks className="h-4 w-4" />}
      />
    </div>
  );
}

function AdminCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
              {icon}
            </span>
            {title}
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
