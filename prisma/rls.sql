-- Margin Shop — Row Level Security (Postgres / Supabase)
-- Architecture : shared database + shared schema, tenant_id = restaurantId
--
-- Appliquer APRÈS `prisma db push` sur Supabase :
--   psql "$DIRECT_URL" -f prisma/rls.sql
--
-- L’app pose le tenant via : SELECT set_config('app.tenant_id', '<id>', true);
-- (voir withTenantRls dans src/lib/db.ts)
--
-- Rôle applicatif recommandé : pas de BYPASSRLS (le rôle `postgres` owner bypass RLS).
-- Sur Supabase, créez un rôle `margin_app` et utilisez-le dans DATABASE_URL.

BEGIN;

-- Helper : lit le tenant courant (vide = aucune ligne visible si FORCED)
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$;

-- Active RLS + policy tenant sur chaque table scopée
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'User',
    'Ingredient',
    'Dish',
    'Sale',
    'StockMovement',
    'Supplier',
    'PurchaseOrder',
    'SupplierReceipt',
    'InventoryCount',
    'Employee',
    'Kiosk',
    'DeliveryPlatformConnection',
    'DeliveryDriver',
    'DeliveryOrder',
    'ExternalPosConnection',
    'PosPendingProduct',
    'PosWebhookEvent',
    'WhatsAppSession',
    'WhatsAppActionLog',
    'CommissionRule',
    'PlatformOutage',
    'Alert'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING ("restaurantId" = app_current_tenant())
         WITH CHECK ("restaurantId" = app_current_tenant())',
      t
    );
  END LOOP;
END $$;

-- Restaurant : un tenant ne voit que SA ligne
ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Restaurant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Restaurant";
CREATE POLICY tenant_isolation ON "Restaurant"
  USING (id = app_current_tenant())
  WITH CHECK (id = app_current_tenant());

-- Tables enfants : isolation via parent
ALTER TABLE "RecipeIngredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecipeIngredient" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RecipeIngredient";
CREATE POLICY tenant_isolation ON "RecipeIngredient"
  USING (
    EXISTS (
      SELECT 1 FROM "Dish" d
      WHERE d.id = "RecipeIngredient"."dishId"
        AND d."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Dish" d
      WHERE d.id = "RecipeIngredient"."dishId"
        AND d."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SaleItem";
CREATE POLICY tenant_isolation ON "SaleItem"
  USING (
    EXISTS (
      SELECT 1 FROM "Sale" s
      WHERE s.id = "SaleItem"."saleId"
        AND s."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Sale" s
      WHERE s.id = "SaleItem"."saleId"
        AND s."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PurchaseOrderLine";
CREATE POLICY tenant_isolation ON "PurchaseOrderLine"
  USING (
    EXISTS (
      SELECT 1 FROM "PurchaseOrder" po
      WHERE po.id = "PurchaseOrderLine"."purchaseOrderId"
        AND po."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "PurchaseOrder" po
      WHERE po.id = "PurchaseOrderLine"."purchaseOrderId"
        AND po."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "InventoryCountLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryCountLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "InventoryCountLine";
CREATE POLICY tenant_isolation ON "InventoryCountLine"
  USING (
    EXISTS (
      SELECT 1 FROM "InventoryCount" ic
      WHERE ic.id = "InventoryCountLine"."inventoryCountId"
        AND ic."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "InventoryCount" ic
      WHERE ic.id = "InventoryCountLine"."inventoryCountId"
        AND ic."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "SupplierReceiptLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierReceiptLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SupplierReceiptLine";
CREATE POLICY tenant_isolation ON "SupplierReceiptLine"
  USING (
    EXISTS (
      SELECT 1 FROM "SupplierReceipt" sr
      WHERE sr.id = "SupplierReceiptLine"."receiptId"
        AND sr."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "SupplierReceipt" sr
      WHERE sr.id = "SupplierReceiptLine"."receiptId"
        AND sr."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "SupplierCatalogItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierCatalogItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SupplierCatalogItem";
CREATE POLICY tenant_isolation ON "SupplierCatalogItem"
  USING (
    EXISTS (
      SELECT 1 FROM "Supplier" s
      WHERE s.id = "SupplierCatalogItem"."supplierId"
        AND s."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Supplier" s
      WHERE s.id = "SupplierCatalogItem"."supplierId"
        AND s."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "Shift" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shift" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Shift";
CREATE POLICY tenant_isolation ON "Shift"
  USING (
    EXISTS (
      SELECT 1 FROM "Employee" e
      WHERE e.id = "Shift"."employeeId"
        AND e."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Employee" e
      WHERE e.id = "Shift"."employeeId"
        AND e."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Attendance";
CREATE POLICY tenant_isolation ON "Attendance"
  USING (
    EXISTS (
      SELECT 1 FROM "Employee" e
      WHERE e.id = "Attendance"."employeeId"
        AND e."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Employee" e
      WHERE e.id = "Attendance"."employeeId"
        AND e."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "PerformanceSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceSnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PerformanceSnapshot";
CREATE POLICY tenant_isolation ON "PerformanceSnapshot"
  USING (
    EXISTS (
      SELECT 1 FROM "Employee" e
      WHERE e.id = "PerformanceSnapshot"."employeeId"
        AND e."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Employee" e
      WHERE e.id = "PerformanceSnapshot"."employeeId"
        AND e."restaurantId" = app_current_tenant()
    )
  );

ALTER TABLE "DeliveryAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DeliveryAssignment";
CREATE POLICY tenant_isolation ON "DeliveryAssignment"
  USING (
    EXISTS (
      SELECT 1 FROM "DeliveryOrder" o
      WHERE o.id = "DeliveryAssignment"."orderId"
        AND o."restaurantId" = app_current_tenant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "DeliveryOrder" o
      WHERE o.id = "DeliveryAssignment"."orderId"
        AND o."restaurantId" = app_current_tenant()
    )
  );

COMMIT;
