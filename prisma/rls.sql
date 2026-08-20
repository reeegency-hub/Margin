-- Margin Shop — Row Level Security (Postgres / Neon)
-- tenant_id = restaurantId via set_config('app.tenant_id', …, true)
-- (voir withTenantRls dans src/lib/db.ts)
--
-- Noms physiques = @@map Prisma quand présent :
--   StockUnit→Ingredient, Product→Dish, ProductStock→RecipeIngredient,
--   StockUnitPriceEvent→IngredientPriceEvent
--
-- Appliquer : npx tsx scripts/setup-margin-app-rls.ts
--
-- IMPORTANT : ne basculez DATABASE_URL vers margin_app qu’après avoir
-- généralisé withTenantRls / requireTenantDb (sinon crons/admin/webhooks = 0 rows).
-- Pas de BEGIN/COMMIT : chaque statement est auto-commit (évite un ROLLBACK global).

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'User',
    'Ingredient',
    'CatalogIssue',
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
    'Alert',
    'LlmProviderCredential',
    'AssistantDraft',
    'AssistantCommit',
    'IngredientPriceEvent'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'skip missing table %', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- Pas de FORCE : le owner (migrations) continue de bypasser.
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
DO $$
BEGIN
  IF to_regclass('public."Restaurant"') IS NOT NULL THEN
    ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "Restaurant";
    CREATE POLICY tenant_isolation ON "Restaurant"
      USING (id = app_current_tenant())
      WITH CHECK (id = app_current_tenant());
  END IF;
END $$;

-- Enfants via parent (noms physiques)
DO $$
BEGIN
  IF to_regclass('public."RecipeIngredient"') IS NOT NULL THEN
    ALTER TABLE "RecipeIngredient" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "RecipeIngredient";
    CREATE POLICY tenant_isolation ON "RecipeIngredient"
      USING (
        EXISTS (
          SELECT 1 FROM "Dish" p
          WHERE p.id = "RecipeIngredient"."dishId"
            AND p."restaurantId" = app_current_tenant()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM "Dish" p
          WHERE p.id = "RecipeIngredient"."dishId"
            AND p."restaurantId" = app_current_tenant()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."SaleItem"') IS NOT NULL THEN
    ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
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
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."PurchaseOrderLine"') IS NOT NULL THEN
    ALTER TABLE "PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "PurchaseOrderLine";
    CREATE POLICY tenant_isolation ON "PurchaseOrderLine"
      USING (
        EXISTS (
          SELECT 1 FROM "PurchaseOrder" po
          WHERE po.id = "PurchaseOrderLine"."orderId"
            AND po."restaurantId" = app_current_tenant()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM "PurchaseOrder" po
          WHERE po.id = "PurchaseOrderLine"."orderId"
            AND po."restaurantId" = app_current_tenant()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."InventoryCountLine"') IS NOT NULL THEN
    ALTER TABLE "InventoryCountLine" ENABLE ROW LEVEL SECURITY;
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
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."SupplierReceiptLine"') IS NOT NULL THEN
    ALTER TABLE "SupplierReceiptLine" ENABLE ROW LEVEL SECURITY;
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
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."SupplierCatalogItem"') IS NOT NULL THEN
    ALTER TABLE "SupplierCatalogItem" ENABLE ROW LEVEL SECURITY;
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
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Shift"') IS NOT NULL THEN
    ALTER TABLE "Shift" ENABLE ROW LEVEL SECURITY;
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
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Attendance"') IS NOT NULL THEN
    ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
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
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."PerformanceSnapshot"') IS NOT NULL THEN
    ALTER TABLE "PerformanceSnapshot" ENABLE ROW LEVEL SECURITY;
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
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."DeliveryAssignment"') IS NOT NULL THEN
    ALTER TABLE "DeliveryAssignment" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "DeliveryAssignment";
    CREATE POLICY tenant_isolation ON "DeliveryAssignment"
      USING (
        EXISTS (
          SELECT 1 FROM "DeliveryOrder" o
          WHERE o.id = "DeliveryAssignment"."deliveryOrderId"
            AND o."restaurantId" = app_current_tenant()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM "DeliveryOrder" o
          WHERE o.id = "DeliveryAssignment"."deliveryOrderId"
            AND o."restaurantId" = app_current_tenant()
        )
      );
  END IF;
END $$;
