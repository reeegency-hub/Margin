import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BrandPage } from "@/components/brand/BrandCard";
import { MenuAiWorkflow } from "@/components/menu/MenuAiWorkflow";
import { getOpenAIConfig } from "@/lib/openai";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function MenuAiPage() {
  const jar = await cookies();
  if (jar.get("margin_mobile")?.value === "1") {
    redirect("/");
  }

  const session = await requireSession();
  const [ingredients, dishCount, openai] = await Promise.all([
    prisma.stockUnit.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.count({
      where: { restaurantId: session.user.restaurantId, active: true },
    }),
    getOpenAIConfig(session.user.restaurantId),
  ]);

  return (
    <BrandPage
      question="Importer votre catalogue"
      guide="Collez votre liste de prix ou un PDF. Corrigez avant d’enregistrer, puis renseignez le stock."
    >
      <MenuAiWorkflow
        ingredientCount={ingredients.length}
        dishCount={dishCount}
        existingIngredientNames={ingredients.map((i) => i.name)}
        autoOpen={dishCount === 0}
        openaiConfigured={openai.configured}
      />
    </BrandPage>
  );
}
