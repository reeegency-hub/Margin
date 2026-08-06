/**
 * Idempotence POS — fingerprints stables + règles DEAD soft.
 * Run: npx tsx src/lib/pos/idempotence.test.ts
 */
import {
  hashSaleFingerprint,
  POS_RETRY_MAX_ATTEMPTS,
  nextRetryAt,
} from "./schema";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  connectionId: "conn_1",
  externalOrderId: "ORD-99",
  occurredAt: new Date("2026-08-01T12:00:00.000Z"),
  lines: [
    { name: "Pizza", quantity: 1, externalSku: "PZ1", unitPrice: 12 },
    { name: "Coca", quantity: 2, externalSku: "COC", unitPrice: 3 },
  ],
};

const a = hashSaleFingerprint(base);
const b = hashSaleFingerprint({
  ...base,
  lines: [...base.lines].reverse(),
});
assert(a === b, "fingerprint stable si ordre lignes inversé");

const c = hashSaleFingerprint({
  ...base,
  externalOrderId: "ORD-100",
});
assert(a !== c, "fingerprint change si orderId change");

const d = hashSaleFingerprint({
  ...base,
  lines: [{ name: "Pizza", quantity: 2, externalSku: "PZ1", unitPrice: 12 }],
});
assert(a !== d, "fingerprint change si quantité change");

// DEAD soft : schema hard ≠ retry ; attempts ceiling
assert(POS_RETRY_MAX_ATTEMPTS === 8, "max attempts");
const t1 = nextRetryAt(0).getTime();
const t2 = nextRetryAt(3).getTime();
assert(t2 > t1, "backoff augmente");

const schemaErr = "[schema] Aucune ligne produit";
assert(schemaErr.startsWith("[schema]"), "préfixe schema pour skip drain");
assert(
  !("ops-replay: timeout".startsWith("[schema]")),
  "replay soft éligible au drain"
);

console.log("pos/idempotence.test.ts — OK");
