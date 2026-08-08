import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const dups = await p.$queryRawUnsafe<
    Array<{ whatsappTo: string; c: number }>
  >(
    `SELECT "whatsappTo", COUNT(*)::int as c FROM "Restaurant" WHERE "whatsappTo" IS NOT NULL GROUP BY "whatsappTo" HAVING COUNT(*) > 1`
  );
  console.log("whatsappTo_duplicates:", JSON.stringify(dups));

  try {
    const founders = await p.user.findMany({
      where: { role: "FOUNDER" },
      select: { id: true, email: true, role: true },
    });
    console.log("founders:", JSON.stringify(founders));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("founder_query_error:", msg.slice(0, 200));
  }

  try {
    const cols = await p.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'role'`
    );
    console.log("user_role_column:", JSON.stringify(cols));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("schema_query_error:", msg.slice(0, 200));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
