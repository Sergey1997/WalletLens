import { NextResponse } from "next/server";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }
  const admin = await getCurrentAdmin();
  return NextResponse.json({
    authenticated: true,
    email: user.email,
    id: user.id,
    is_admin: admin !== null,
    role: admin?.role ?? null,
  });
}
