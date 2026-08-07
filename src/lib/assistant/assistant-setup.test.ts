import assert from "node:assert/strict";
import {
  parseImportInventory,
  parseSetWhatsapp,
  parseUpsertTeam,
} from "@/lib/assistant/schemas";
import {
  extractInventoryFromText,
  findShiftOverlaps,
  normalizeWhatsappPhone,
} from "@/lib/assistant/extract";
import { detectSecretsInText } from "@/lib/assistant/secrets";

// Inventaire CSV
{
  const csv = `Nom;Stock;Prix
Lait 1L;12;0.85
Pain;3;1.2`;
  const extracted = extractInventoryFromText(csv, {
    storeId: "store_1",
    fileName: "inv.csv",
  });
  assert.equal(extracted.rows.length, 2);
  assert.equal(extracted.rows[0]!.name, "Lait 1L");
  assert.equal(extracted.rows[0]!.stock, 12);
  const parsed = parseImportInventory({
    storeId: "store_1",
    rows: extracted.rows,
    sourceFileId: extracted.sourceFileId,
    flags: extracted.flags,
  });
  assert.equal(parsed.ok, true);
}

// Prix sans devise → flag
{
  const csv = `Nom,Prix,Stock
Eau,1.1,5`;
  const extracted = extractInventoryFromText(csv, { storeId: "s" });
  assert.ok(
    extracted.flags.some((f) => f.code === "price_no_currency"),
    "doit flager devise manquante"
  );
}

// Chevauchement shifts
{
  const flags = findShiftOverlaps([
    { date: "2026-08-08", startTime: "09:00", endTime: "14:00" },
    { date: "2026-08-08", startTime: "13:00", endTime: "18:00" },
  ]);
  assert.ok(flags.some((f) => f.code === "shift_overlap"));
}

// WhatsApp
{
  const ok = normalizeWhatsappPhone("0612345678");
  assert.equal(ok.phone, "+33612345678");
  const bad = normalizeWhatsappPhone("123");
  assert.equal(bad.phone, null);
  const parsed = parseSetWhatsapp({
    storeId: "s",
    phone: ok.phone!,
    sendTest: true,
    flags: [],
  });
  assert.equal(parsed.ok, true);
}

// Équipe schema
{
  const parsed = parseUpsertTeam({
    storeId: "s",
    employees: [{ name: "Julie", role: "salle", shifts: [] }],
    flags: [],
  });
  assert.equal(parsed.ok, true);
}

// Secrets
{
  assert.ok(detectSecretsInText("ma clé sk_live_abc123XYZ"));
  assert.equal(detectSecretsInText("importe mon stock lait pain"), null);
}

console.log("assistant-setup.test.ts: ok");
