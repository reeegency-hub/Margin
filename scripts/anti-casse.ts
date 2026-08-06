/**
 * Check anti-casse — inventaire + invariants du produit.
 * À lancer après chaque feature : npm run check:quick | npm run check
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const errors: string[] = [];

function mustExist(rel: string) {
  assert.ok(existsSync(join(ROOT, rel)), `Manquant: ${rel}`);
}

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function mustContain(rel: string, needle: string | RegExp, label?: string) {
  const src = read(rel);
  const ok =
    typeof needle === "string" ? src.includes(needle) : needle.test(src);
  assert.ok(ok, `${label || rel} — attendu: ${String(needle)}`);
}

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

async function main() {
  console.log("=== Anti-casse Margin ===\n");

  console.log("1) Pages critiques");
  check("fichiers présents", () => {
    for (const f of [
      "src/app/welcome/page.tsx",
      "src/app/signup/page.tsx",
      "src/app/login/page.tsx",
      "src/app/onboarding/page.tsx",
      "src/app/(app)/page.tsx",
      "src/app/(app)/layout.tsx",
      "src/app/(app)/ingredients/page.tsx",
      "src/app/(app)/orders/page.tsx",
      "src/app/(app)/kiosks/page.tsx",
      "src/app/(app)/settings/page.tsx",
      "src/app/(app)/employees/page.tsx",
      "src/app/(app)/admin/page.tsx",
      "src/app/(app)/inventory/page.tsx",
      "src/components/auth/SignupForm.tsx",
      "src/components/auth/LoginForm.tsx",
      "src/components/onboarding/OnboardingWizard.tsx",
      "src/components/home/FirstHourChecklist.tsx",
      "src/components/AppChrome.tsx",
      "src/components/layout/AppShell.tsx",
      "src/components/ui/BottomNav.tsx",
      "src/lib/admin.ts",
      "src/lib/auth.ts",
      "src/lib/nav.ts",
      "src/lib/stock-engine.ts",
      "src/lib/whatsapp/outbound.ts",
      "src/lib/plans.ts",
    ]) {
      mustExist(f);
    }
  });

  console.log("\n2) Parcours commerçant");
  check("signup → compte magasin", () => {
    mustContain(
      "src/components/auth/SignupForm.tsx",
      "Créer mon magasin"
    );
    mustContain("src/components/auth/SignupForm.tsx", "signIn");
  });
  check("login paiement reçu", () => {
    mustContain("src/components/auth/LoginForm.tsx", "paid");
  });
  check("onboarding chemin dynamique", () => {
    mustContain(
      "src/components/onboarding/OnboardingWizard.tsx",
      "ob-journey"
    );
    mustContain(
      "src/components/onboarding/OnboardingWizard.tsx",
      "Vous êtes ici"
    );
    mustContain(
      "src/components/onboarding/OnboardingWizard.tsx",
      "normalizeFrMobile"
    );
  });
  check("première heure chemin", () => {
    mustContain(
      "src/components/home/FirstHourChecklist.tsx",
      "first-hour__path"
    );
    mustContain("src/components/home/FirstHourChecklist.tsx", "Ensuite");
  });

  console.log("\n3) Espace fondateur isolé");
  check("fondateur = reeegency uniquement", () => {
    mustContain(
      "src/lib/admin.ts",
      'FOUNDER_EMAIL = "reeegency@gmail.com"'
    );
    mustContain("src/lib/admin.ts", "getAdminEmails().includes");
    const chrome = read("src/components/AppChrome.tsx");
    assert.ok(
      chrome.includes("Espace fondateur") && /isAdmin\s*\?/.test(chrome),
      "AppChrome doit conditionner Espace fondateur avec isAdmin"
    );
    const bottom = read("src/components/ui/BottomNav.tsx");
    assert.ok(
      bottom.includes("Espace fondateur") && /isAdmin/.test(bottom),
      "BottomNav doit exposer Espace fondateur si isAdmin"
    );
  });

  console.log("\n4) Nav & app shell");
  check("sections nav commerçant", () => {
    const nav = read("src/lib/nav.ts");
    for (const id of ["home", "stock", "courses", "equipe", "magasin"]) {
      assert.ok(nav.includes(`id: "${id}"`), `nav section ${id}`);
    }
  });
  check("layout gate onboarding", () => {
    mustContain("src/app/(app)/layout.tsx", "onboardingCompletedAt");
    mustContain("src/app/(app)/layout.tsx", 'redirect("/onboarding")');
  });

  console.log("\n5) Modules métier importables");
  try {
    await import("../src/lib/plans");
    await import("../src/lib/admin");
    await import("../src/lib/nav");
    await import("../src/lib/whatsapp/config");
    await import("../src/lib/stripe/access");
    console.log("  ✓ imports critiques");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`imports: ${msg}`);
    console.log(`  ✗ imports: ${msg}`);
  }

  console.log("\n6) API / webhooks présents");
  check("routes API", () => {
    for (const f of [
      "src/app/api/stripe/webhook/route.ts",
      "src/app/api/webhooks/twilio/status/route.ts",
      "src/app/api/webhooks/whatsapp/route.ts",
      "src/app/api/cron/stock-alerts/route.ts",
    ]) {
      mustExist(f);
    }
  });

  if (errors.length) {
    console.log(`\n=== ÉCHEC ${errors.length} point(s) ===`);
    for (const e of errors) console.log(` - ${e}`);
    process.exit(1);
  }

  console.log("\n=== OK — rien de critique cassé ===");
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});

