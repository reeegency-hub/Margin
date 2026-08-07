/**
 * Extraction inventaire / équipe depuis texte — flags si ambigu, jamais de guess silencieux.
 */
import { createHash } from "crypto";
import { detectDelimiter, parseCsvLine, parseCsvText } from "@/lib/pos/csv";
import { normalizeUnit } from "@/lib/assistant";
import {
  SETUP_MAX_PRODUCT_ROWS,
  type AmbiguityFlag,
  type ProductRow,
  type UpsertTeamInput,
} from "@/lib/assistant/schemas";

type TeamEmployee = UpsertTeamInput["employees"][number];

export function sourceFileIdFor(content: string, fileName?: string): string {
  const h = createHash("sha256")
    .update(fileName || "")
    .update("\n")
    .update(content.slice(0, 200_000))
    .digest("hex");
  return `file_${h.slice(0, 24)}`;
}

function mapHeaderIndex(headers: string[]) {
  const norm = headers.map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  );
  const find = (...keys: string[]) =>
    norm.findIndex((h) => keys.some((k) => h.includes(k)));
  return {
    name: find("nom", "name", "produit", "product", "article"),
    sku: find("sku", "code", "ref", "ean"),
    price: find("prix", "price", "cout", "cost", "achat"),
    stock: find("stock", "qte", "qty", "quantit", "inventaire"),
    threshold: find("seuil", "threshold", "alerte", "min"),
    unit: find("unite", "unit"),
  };
}

function parseNum(raw: string | undefined): number | undefined {
  if (raw == null || !String(raw).trim()) return undefined;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function looksLikeHeader(line: string): boolean {
  return /nom|name|produit|product|sku|prix|price|stock|qté|qty|seuil/i.test(
    line
  );
}

export function extractInventoryFromText(
  text: string,
  opts?: { fileName?: string; storeId: string }
): {
  rows: ProductRow[];
  flags: AmbiguityFlag[];
  sourceFileId: string;
} {
  const flags: AmbiguityFlag[] = [];
  const sourceFileId = sourceFileIdFor(text, opts?.fileName);
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return {
      rows: [],
      flags: [{ code: "empty", message: "Fichier / texte vide." }],
      sourceFileId,
    };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const rows: ProductRow[] = [];

  if (lines.length >= 2 && /[,;\t]/.test(lines[0]!)) {
    const delimiter = detectDelimiter(lines[0]!);
    const headers = parseCsvLine(lines[0]!, delimiter);
    const idx = mapHeaderIndex(headers);
    const records = parseCsvText(trimmed);

    if (idx.name < 0 && looksLikeHeader(lines[0]!)) {
      flags.push({
        code: "missing_name_column",
        message:
          "Colonne « nom / produit » introuvable — corrigez l’en-tête avant d’appliquer.",
      });
    }

    if (idx.price >= 0) {
      const sample = records
        .slice(0, 5)
        .map((r) => String(Object.values(r)[idx.price] || ""))
        .join(" ");
      if (sample && !/€|eur|\$|usd/i.test(sample) && /\d/.test(sample)) {
        flags.push({
          code: "price_no_currency",
          message:
            "Colonne prix sans devise détectée — vérifiez que les montants sont en € HT avant d’appliquer.",
        });
      }
    }

    let i = 0;
    for (const record of records) {
      if (rows.length >= SETUP_MAX_PRODUCT_ROWS) {
        flags.push({
          code: "truncated",
          message: `Import limité à ${SETUP_MAX_PRODUCT_ROWS} lignes.`,
        });
        break;
      }
      const values = headers.map((h) => String(record[h] ?? "").trim());
      const name =
        idx.name >= 0 ? values[idx.name] || "" : values[0] || "";
      if (!name || name.length < 2) {
        flags.push({
          code: "row_missing_name",
          message: `Ligne ${i + 1} : nom manquant — ligne ignorée.`,
          rowIndex: i,
          field: "name",
        });
        i += 1;
        continue;
      }

      const stockRaw = idx.stock >= 0 ? values[idx.stock] : undefined;
      const stockNum = parseNum(stockRaw);
      if (stockRaw && stockNum == null) {
        flags.push({
          code: "row_bad_stock",
          message: `Ligne ${i + 1} (« ${name} ») : stock non numérique — mis à 0, vérifiez.`,
          rowIndex: i,
          field: "stock",
        });
      }

      const priceRaw = idx.price >= 0 ? values[idx.price] : undefined;
      const priceNum = parseNum(priceRaw);
      if (priceRaw && priceNum == null) {
        flags.push({
          code: "row_bad_price",
          message: `Ligne ${i + 1} (« ${name} ») : prix invalide — laissé vide (pas de guess).`,
          rowIndex: i,
          field: "price",
        });
      }

      const unitRaw = idx.unit >= 0 ? values[idx.unit] : undefined;
      const thr = parseNum(
        idx.threshold >= 0 ? values[idx.threshold] : undefined
      );

      rows.push({
        name: name.slice(0, 120),
        sku:
          idx.sku >= 0 && values[idx.sku]
            ? values[idx.sku]!.slice(0, 64)
            : undefined,
        unit: normalizeUnit(unitRaw || "pcs"),
        price: priceNum != null && priceNum > 0 ? priceNum : undefined,
        stock: stockNum != null && stockNum >= 0 ? stockNum : 0,
        threshold:
          thr != null && Number.isInteger(thr) && thr >= 0
            ? Math.floor(thr)
            : undefined,
      });
      i += 1;
    }
  } else {
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.length < 2) continue;
      if (/^(nom|name|produit)/i.test(t) && /[,;\t]/.test(t)) continue;
      rows.push({ name: t.slice(0, 120), unit: "pcs", stock: 0 });
      if (rows.length >= SETUP_MAX_PRODUCT_ROWS) break;
    }
    if (rows.length) {
      flags.push({
        code: "free_text_inventory",
        message:
          "Liste sans colonnes stock/prix — stocks à 0. Complétez dans l’aperçu ou lancez une vérification après.",
      });
    }
  }

  return { rows, flags, sourceFileId };
}

function normalizeRole(raw: string): "salle" | "cuisine" | "livreur" | null {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/caisse|salle|vendeur|accueil/.test(t)) return "salle";
  if (/rayon|cuisine|reserve|stockiste/.test(t)) return "cuisine";
  if (/livreur|course|delivery/.test(t)) return "livreur";
  return null;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function findShiftOverlaps(
  shifts: { date: string; startTime: string; endTime: string }[]
): AmbiguityFlag[] {
  const flags: AmbiguityFlag[] = [];
  const byDate = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const list = byDate.get(s.date) || [];
    list.push(s);
    byDate.set(s.date, list);
  }
  for (const [date, list] of byDate) {
    const sorted = [...list].sort(
      (a, b) => timeToMin(a.startTime) - timeToMin(b.startTime)
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (timeToMin(cur.startTime) < timeToMin(prev.endTime)) {
        flags.push({
          code: "shift_overlap",
          message: `Chevauchement le ${date} : ${prev.startTime}–${prev.endTime} et ${cur.startTime}–${cur.endTime}. Corrigez avant d’appliquer.`,
          field: "shifts",
        });
      }
    }
  }
  return flags;
}

export function extractTeamFromText(
  text: string,
  opts: { storeId: string; fileName?: string }
): UpsertTeamInput {
  const flags: AmbiguityFlag[] = [];
  const sourceFileId = sourceFileIdFor(text, opts.fileName);
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const byName = new Map<string, TeamEmployee>();

  if (trimmed.split(/\n/).length >= 2 && /[,;\t]/.test(trimmed)) {
    const records = parseCsvText(trimmed);
    const headers = trimmed.split(/\r?\n/)[0]
      ? parseCsvLine(
          trimmed.split(/\r?\n/)[0]!,
          detectDelimiter(trimmed.split(/\r?\n/)[0]!)
        )
      : [];
    const hNorm = headers.map((h) => h.toLowerCase());
    const nameIdx = hNorm.findIndex((h) => /nom|name|prenom/.test(h));
    const roleIdx = hNorm.findIndex((h) => /poste|role|emploi/.test(h));
    const dateIdx = hNorm.findIndex((h) => /date|jour/.test(h));
    const startIdx = hNorm.findIndex((h) => /debut|start/.test(h));
    const endIdx = hNorm.findIndex((h) => /fin|end/.test(h));

    let i = 0;
    for (const record of records) {
      const vals = headers.map((h) => String(record[h] ?? "").trim());
      const name = nameIdx >= 0 ? vals[nameIdx] || "" : vals[0] || "";
      if (!name) {
        i += 1;
        continue;
      }
      const roleRaw = roleIdx >= 0 ? vals[roleIdx] || "" : vals[1] || "";
      let role = normalizeRole(roleRaw);
      if (!role) {
        flags.push({
          code: "unknown_role",
          message: `Ligne ${i + 1} (« ${name} ») : poste « ${roleRaw || "?"} » non reconnu — mis en caisse par défaut, vérifiez.`,
          rowIndex: i,
          field: "role",
        });
        role = "salle";
      }
      const key = name.toLowerCase();
      let emp = byName.get(key);
      if (!emp) {
        emp = { name, role, shifts: [] };
        byName.set(key, emp);
      }
      const date = dateIdx >= 0 ? vals[dateIdx] : undefined;
      const start = startIdx >= 0 ? vals[startIdx] : undefined;
      const end = endIdx >= 0 ? vals[endIdx] : undefined;
      if (date && start && end && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
          flags.push({
            code: "bad_time",
            message: `Ligne ${i + 1} : horaires invalides (${start}–${end}).`,
            rowIndex: i,
          });
        } else if (timeToMin(end) <= timeToMin(start)) {
          flags.push({
            code: "bad_time_order",
            message: `Ligne ${i + 1} : fin ≤ début — créneau ignoré.`,
            rowIndex: i,
          });
        } else {
          emp.shifts = [
            ...(emp.shifts || []),
            { date, startTime: start, endTime: end, role },
          ];
        }
      }
      i += 1;
    }
  }

  if (byName.size === 0) {
    for (const line of trimmed.split(/\r?\n/)) {
      const t = line.trim();
      if (t.length < 2) continue;
      const m = t.match(
        /^([A-Za-zÀ-ÿ\-'\s]+)\s+(caisse|rayon|livreur|salle|cuisine)\b/i
      );
      if (!m) {
        flags.push({
          code: "unparsed_team_line",
          message: `Ligne non comprise : « ${t.slice(0, 60)} » — format « Prénom poste » ou CSV.`,
        });
        continue;
      }
      const role = normalizeRole(m[2]!) || "salle";
      byName.set(m[1]!.trim().toLowerCase(), {
        name: m[1]!.trim(),
        role,
        shifts: [],
      });
    }
  }

  const employees = [...byName.values()];
  for (const e of employees) {
    flags.push(
      ...findShiftOverlaps(e.shifts || []).map((f) => ({
        ...f,
        message: `${e.name} — ${f.message}`,
      }))
    );
  }

  return {
    storeId: opts.storeId,
    employees,
    sourceFileId,
    flags,
  };
}

export function normalizeWhatsappPhone(raw: string): {
  phone: string | null;
  flag?: AmbiguityFlag;
} {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  let phone = digits;
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (phone.startsWith("0") && phone.length === 10) {
    phone = `+33${phone.slice(1)}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return {
      phone: null,
      flag: {
        code: "bad_phone",
        message:
          "Numéro WhatsApp invalide. Utilisez le format international (+336…).",
        field: "phone",
      },
    };
  }
  return { phone };
}
