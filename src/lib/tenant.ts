/**
 * Multi-tenant Margin — shared database + shared schema.
 *
 * Convention :
 * - Tenant = `Restaurant` (une entreprise / commerce)
 * - Clé tenant = `restaurantId` (= tenant_id métier)
 * - Isolation app : toutes les requêtes métier filtrent par `restaurantId`
 * - Isolation DB (Postgres/Supabase) : RLS via `app.tenant_id` (voir prisma/rls.sql)
 *
 * Ne pas introduire de schema-per-tenant avant ~100+ clients ou exigence contrat.
 */

export const TENANT_FIELD = "restaurantId" as const;

export type TenantId = string;

export type TenantContext = {
  tenantId: TenantId;
  userId: string;
  email?: string | null;
};

/** Clause Prisma `where` scopée au tenant. */
export function tenantWhere(tenantId: TenantId) {
  return { restaurantId: tenantId } as const;
}

/** Fusionne un where existant avec le filtre tenant. */
export function withTenantWhere<T extends Record<string, unknown>>(
  tenantId: TenantId,
  where?: T
): T & { restaurantId: string } {
  return { ...(where || ({} as T)), restaurantId: tenantId };
}

/**
 * Vérifie qu’une ressource appartient au tenant courant.
 * À appeler après un findUnique par id seul.
 */
export function assertSameTenant(
  tenantId: TenantId,
  resourceTenantId: string | null | undefined,
  label = "Ressource"
): asserts resourceTenantId is string {
  if (!resourceTenantId || resourceTenantId !== tenantId) {
    throw new Error(`${label} introuvable ou hors périmètre commerce.`);
  }
}

export function isTenantScopedModel(modelName: string): boolean {
  return TENANT_SCOPED_MODELS.has(modelName);
}

/**
 * Tables Prisma qui portent `restaurantId` (tenant_id).
 * Les tables enfants (RecipeIngredient, SaleItem…) héritent via le parent.
 * Maintenir à jour quand on ajoute un model — le script `test:tenant` le vérifie.
 */
export const TENANT_SCOPED_MODELS = new Set([
  "User",
  "Ingredient",
  "Dish",
  "Sale",
  "StockMovement",
  "Supplier",
  "PurchaseOrder",
  "SupplierReceipt",
  "IngredientPriceEvent",
  "InventoryCount",
  "Employee",
  "Kiosk",
  "DeliveryPlatformConnection",
  "DeliveryDriver",
  "DeliveryOrder",
  "ExternalPosConnection",
  "PosPendingProduct",
  "PosWebhookEvent",
  "PosReconciliationRun",
  "WhatsAppSession",
  "WhatsAppActionLog",
  "CommissionRule",
  "PlatformOutage",
  "Alert",
  "WhatsAppOutboundMessage",
  "CatalogIssue",
  "LlmProviderCredential",
  "AssistantDraft",
  "AssistantCommit",
  "NewsletterSubscriber",
  // Journaux billing Ops (restaurantId optionnel ; écritures via lib/stripe)
  "StripeWebhookEvent",
  "StripeReconciliationRun",
]);

/** Models enfants sans restaurantId (isolation via parent). */
export const TENANT_CHILD_MODELS = new Set([
  "RecipeIngredient",
  "SaleItem",
  "SupplierCatalogItem",
  "PurchaseOrderLine",
  "SupplierReceiptLine",
  "InventoryCountLine",
  "Shift",
  "Attendance",
  "PerformanceSnapshot",
  "DeliveryAssignment",
  "LlmProviderCredentialEvent",
  "SignupOtpChallenge",
  "MarketingProspect",
  "MarketingInfluencer",
  "AdminAuditLog",
  "PlatformLlmUsage",
]);
