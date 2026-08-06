"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StockSheetPanel } from "@/components/stock/StockSheetPanel";
import { IngredientAddPanel } from "@/components/stock/IngredientAddPanel";
import { StockMobileHero } from "@/components/stock/StockMobileHero";
import { DishCreateModal } from "@/components/dishes/DishCreateModal";
import { DishList, type DishListItem } from "@/components/dishes/DishList";
import {
  CatalogCleanupPanel,
  type CleanupIssue,
} from "@/components/catalog/CatalogCleanupPanel";

export type StockSheetRow = {
  id: string;
  name: string;
  unit: string;
  stockTheoretical: number;
  criticalThreshold: number;
  reorderQty: number;
  stockLabel: string;
  thresholdLabel: string;
  reorderLabel: string;
  critical: boolean;
};

export type StockCriticalItem = {
  name: string;
  unit: string;
  stockTheoretical: number;
  criticalThreshold: number;
};

export type StockIngredientOption = {
  id: string;
  name: string;
  unit: string;
};

type Tab = "niveaux" | "catalogue" | "qualite";

function parseTab(raw: string | null): Tab {
  if (raw === "catalogue" || raw === "produits") return "catalogue";
  if (raw === "qualite" || raw === "qualité") return "qualite";
  return "niveaux";
}

export function StockWorkspace({
  restaurantName,
  whatsappTo,
  sheetRows,
  critical,
  productCount,
  dishes,
  ingredientOptions,
  catalogIssues = [],
  catalogOpenCount = 0,
}: {
  restaurantName: string;
  whatsappTo: string | null;
  sheetRows: StockSheetRow[];
  critical: StockCriticalItem[];
  productCount: number;
  dishes: DishListItem[];
  ingredientOptions: StockIngredientOption[];
  catalogIssues?: CleanupIssue[];
  catalogOpenCount?: number;
  /** @deprecated stats retirées */
  okPercent?: number;
  okCount?: number;
  withoutThreshold?: number;
  worstSubtitle?: string;
  chartPoints?: { x: number; y: number }[];
  avgPriceLabel?: string;
  withAllergens?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() =>
    parseTab(searchParams.get("tab"))
  );

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const selectTab = useCallback(
    (next: string) => {
      const value = parseTab(next);
      setTab(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value === "niveaux") params.delete("tab");
      else params.set("tab", value === "qualite" ? "qualite" : "catalogue");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="stock-workspace" data-tour="stock-levels">
      <SegmentedControl
        value={tab}
        onChange={selectTab}
        options={[
          {
            value: "niveaux",
            label: `Niveaux${critical.length ? ` (${critical.length})` : ""}`,
          },
          {
            value: "catalogue",
            label: `Produits${dishes.length ? ` (${dishes.length})` : ""}`,
          },
          {
            value: "qualite",
            label: `Qualité${catalogOpenCount ? ` (${catalogOpenCount})` : ""}`,
          },
        ]}
      />

      {tab === "niveaux" ? (
        <div className="stock-workspace__panel mt-4">
          <div className="phone-only">
            <StockMobileHero
              critical={critical}
              productCount={productCount}
            />
          </div>
          <StockSheetPanel
            ingredients={sheetRows}
            restaurantName={restaurantName}
            whatsappTo={whatsappTo}
          />
        </div>
      ) : tab === "qualite" ? (
        <div className="stock-workspace__panel mt-4" data-tour="stock-quality">
          <CatalogCleanupPanel
            issues={catalogIssues}
            openCount={catalogOpenCount}
          />
        </div>
      ) : (
        <div className="stock-workspace__panel mt-4 stock-catalog">
          {dishes.length > 0 ? (
            <div className="stock-catalog__list">
              <header className="stock-catalog__head">
                <div>
                  <p className="stock-catalog__eyebrow">Produits</p>
                  <h2 className="stock-catalog__title">
                    {dishes.length} fiche{dishes.length > 1 ? "s" : ""}
                  </h2>
                </div>
                <DishCreateModal
                  ingredients={ingredientOptions}
                  variant="button"
                />
              </header>
              <DishList dishes={dishes} from="stock" />
            </div>
          ) : null}

          <section
            className={`stock-catalog__import${
              dishes.length === 0 ? " is-hero" : ""
            }`}
            data-tour="stock-add"
            data-guide-action="stock-add"
          >
            <IngredientAddPanel
              mode={dishes.length === 0 ? "hero" : "compact"}
            />
          </section>
        </div>
      )}
    </div>
  );
}
