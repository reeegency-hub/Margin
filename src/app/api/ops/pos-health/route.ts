import { NextResponse } from "next/server";
import {
  getPosHealthSnapshot,
  notifyPosHealthAlerts,
} from "@/lib/pos/health";
import { requireAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Santé sync caisse — Ops.
 * - Admin session cookie OU Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : url.searchParams.get("secret");
  const cronOk = Boolean(secret && token === secret);

  if (!cronOk) {
    const session = await requireAdminSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const hours = Math.min(
    168,
    Math.max(1, Number(url.searchParams.get("hours") || 24))
  );
  const snap = await getPosHealthSnapshot(hours);

  if (url.searchParams.get("notify") === "1") {
    await notifyPosHealthAlerts(snap);
  }

  return NextResponse.json({ ok: true, ...snap });
}
