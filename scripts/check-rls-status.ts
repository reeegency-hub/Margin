import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  try {
    const role = await p.$queryRawUnsafe<
      { u: string; bypass: boolean; super: boolean }[]
    >(
      `SELECT current_user as u,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as bypass,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) as super`
    );
    const rls = await p.$queryRawUnsafe<
      { t: string; rls: boolean; force: boolean }[]
    >(
      `SELECT c.relname as t, c.relrowsecurity as rls, c.relforcerowsecurity as force
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND c.relname IN ('User','Sale','Alert','Restaurant','StockUnit')
       ORDER BY 1`
    );
    console.log(JSON.stringify({ role, rls }, null, 2));
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
