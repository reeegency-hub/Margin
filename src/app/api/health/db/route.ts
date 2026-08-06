import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Health check DB — pour distinguer « mauvais mdp » vs base saturée. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const quota = /exceeded the data transfer quota/i.test(msg);
    return NextResponse.json(
      {
        ok: false,
        reason: quota ? "quota" : "unreachable",
      },
      { status: 503 }
    );
  }
}
