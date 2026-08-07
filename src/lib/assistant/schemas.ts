/**
 * Contrats stricts assistant setup — le LLM propose, Zod valide, le serveur écrit.
 * Aucun write direct depuis la sortie modèle.
 */
import { z } from "zod";

export const DRAFT_TTL_MS = 60 * 60 * 1000; // 1 h
export const SETUP_MAX_PRODUCT_ROWS = 500;
export const SETUP_MAX_EMPLOYEES = 40;
export const SETUP_MAX_SHIFTS = 120;

export const AmbiguityFlagSchema = z.object({
  code: z.string(),
  message: z.string(),
  rowIndex: z.number().int().optional(),
  field: z.string().optional(),
});
export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;

export const ProductRowSchema = z.object({
  name: z.string().min(1).max(120),
  sku: z.string().max(64).optional(),
  unit: z.enum(["g", "ml", "pcs"]).default("pcs"),
  /** Prix d’achat unitaire — optionnel ; si absent + colonne prix ambiguë → flag */
  price: z.number().positive().optional(),
  stock: z.number().min(0).default(0),
  threshold: z.number().int().min(0).optional(),
  /** Ligne flaguée : ne pas commit tant que non corrigée si blocking */
  blocked: z.boolean().optional(),
});
export type ProductRow = z.infer<typeof ProductRowSchema>;

export const ImportInventoryInputSchema = z.object({
  storeId: z.string().min(1),
  rows: z.array(ProductRowSchema).min(1).max(SETUP_MAX_PRODUCT_ROWS),
  sourceFileId: z.string().min(1),
  flags: z.array(AmbiguityFlagSchema).default([]),
});
export type ImportInventoryInput = z.infer<typeof ImportInventoryInputSchema>;

export const TeamShiftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  role: z.enum(["salle", "cuisine", "livreur"]).optional(),
});

export const TeamEmployeeSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.enum(["salle", "cuisine", "livreur"]).default("salle"),
  hourlyRate: z.number().min(0).max(200).optional(),
  shifts: z.array(TeamShiftSchema).max(14).default([]),
});

export const UpsertTeamInputSchema = z.object({
  storeId: z.string().min(1),
  employees: z.array(TeamEmployeeSchema).min(1).max(SETUP_MAX_EMPLOYEES),
  sourceFileId: z.string().optional(),
  flags: z.array(AmbiguityFlagSchema).default([]),
});
export type UpsertTeamInput = z.infer<typeof UpsertTeamInputSchema>;

export const SetWhatsappInputSchema = z.object({
  storeId: z.string().min(1),
  /** E.164-ish ; normalisé côté serveur */
  phone: z.string().min(8).max(20),
  sendTest: z.boolean().default(true),
  flags: z.array(AmbiguityFlagSchema).default([]),
});
export type SetWhatsappInput = z.infer<typeof SetWhatsappInputSchema>;

/** Action UI — jamais de credentials dans le payload LLM */
export const OpenPosWizardActionSchema = z.object({
  type: z.literal("open_pos_wizard"),
  provider: z
    .enum([
      "zelty",
      "cashpad",
      "square",
      "tiller",
      "lightspeed",
      "laddition",
      "custom",
      "other",
    ])
    .default("other"),
});
export type OpenPosWizardAction = z.infer<typeof OpenPosWizardActionSchema>;

export type DraftKind =
  | "import_inventory"
  | "upsert_team"
  | "set_whatsapp";

export type DraftStatus =
  | "draft"
  | "preview"
  | "confirmed"
  | "committed"
  | "expired"
  | "cancelled";

export function parseImportInventory(
  raw: unknown
):
  | { ok: true; data: ImportInventoryInput }
  | { ok: false; error: string; issues: string[] } {
  const parsed = ImportInventoryInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "root"} : ${i.message}`
    );
    return {
      ok: false,
      error: "Schéma inventaire invalide — aucune écriture.",
      issues,
    };
  }
  return { ok: true, data: parsed.data };
}

export function parseUpsertTeam(
  raw: unknown
):
  | { ok: true; data: UpsertTeamInput }
  | { ok: false; error: string; issues: string[] } {
  const parsed = UpsertTeamInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "root"} : ${i.message}`
    );
    return {
      ok: false,
      error: "Schéma équipe invalide — aucune écriture.",
      issues,
    };
  }
  return { ok: true, data: parsed.data };
}

export function parseSetWhatsapp(
  raw: unknown
):
  | { ok: true; data: SetWhatsappInput }
  | { ok: false; error: string; issues: string[] } {
  const parsed = SetWhatsappInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "root"} : ${i.message}`
    );
    return {
      ok: false,
      error: "Schéma WhatsApp invalide — aucune écriture.",
      issues,
    };
  }
  return { ok: true, data: parsed.data };
}
