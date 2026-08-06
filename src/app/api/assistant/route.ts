import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOpenAIConfig } from "@/lib/openai";
import { isAdminEmail } from "@/lib/admin";
import { hasAppAccess } from "@/lib/stripe/access";
import { defaultThresholdForIngredient } from "@/lib/catalog/thresholds";
import {
  ASSISTANT_MAX_FILE_CHARS,
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_PRODUCTS_PER_CALL,
  ASSISTANT_SYSTEM_PROMPT,
  checkAssistantRateLimit,
  normalizeUnit,
  pageHelpFor,
  parseProductListText,
  sanitizeAssistantText,
  type AssistantProductDraft,
} from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatTurn = { role: "user" | "assistant"; content: string };

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_products",
      description:
        "Crée des produits / articles dans le stock du magasin connecté.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          products: {
            type: "array",
            maxItems: ASSISTANT_MAX_PRODUCTS_PER_CALL,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                unit: { type: "string", enum: ["g", "ml", "pcs"] },
                stockTheoretical: { type: "number" },
              },
              required: ["name"],
            },
          },
        },
        required: ["products"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "stock_summary",
      description: "Résumé du stock du magasin (nb produits, alertes).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "page_help",
      description: "Explique quoi faire sur la page actuelle.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          pathname: { type: "string" },
        },
        required: ["pathname"],
      },
    },
  },
];

async function createProducts(
  restaurantId: string,
  drafts: AssistantProductDraft[]
) {
  const capped = drafts.slice(0, ASSISTANT_MAX_PRODUCTS_PER_CALL);
  const existing = await prisma.ingredient.findMany({
    where: { restaurantId },
    select: { name: true },
  });
  const known = new Set(
    existing.map((i) =>
      i.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
    )
  );

  let created = 0;
  let skipped = 0;
  const names: string[] = [];

  for (const item of capped) {
    const name = sanitizeAssistantText(item.name, 120);
    if (!name) continue;
    const key = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    if (known.has(key)) {
      skipped += 1;
      continue;
    }
    const unit = normalizeUnit(item.unit);
    const thr = defaultThresholdForIngredient(name, unit);
    await prisma.ingredient.create({
      data: {
        restaurantId,
        name,
        unit,
        stockTheoretical: Math.max(0, Number(item.stockTheoretical) || 0),
        criticalThreshold:
          Number(item.criticalThreshold) || thr.criticalThreshold,
        reorderQty: Number(item.reorderQty) || thr.reorderQty,
      },
    });
    known.add(key);
    created += 1;
    names.push(name);
  }

  if (created > 0) {
    revalidatePath("/ingredients");
    revalidatePath("/");
  }

  return { created, skipped, names };
}

async function stockSummary(restaurantId: string) {
  const ingredients = await prisma.ingredient.findMany({
    where: { restaurantId },
    select: {
      name: true,
      stockTheoretical: true,
      criticalThreshold: true,
    },
  });
  const critical = ingredients.filter(
    (i) =>
      i.criticalThreshold > 0 && i.stockTheoretical <= i.criticalThreshold
  );
  return {
    productCount: ingredients.length,
    criticalCount: critical.length,
    criticalNames: critical.slice(0, 8).map((c) => c.name),
  };
}

async function runTool(
  restaurantId: string,
  name: string,
  argsJson: string
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return { error: "Arguments invalides." };
  }

  if (name === "create_products") {
    const raw = Array.isArray(args.products) ? args.products : [];
    const drafts: AssistantProductDraft[] = raw
      .map((p) => {
        const row = p as Record<string, unknown>;
        return {
          name: String(row.name || ""),
          unit: normalizeUnit(String(row.unit || "pcs")),
          stockTheoretical: Number(row.stockTheoretical) || 0,
        };
      })
      .filter((p) => p.name.trim().length >= 2);
    return createProducts(restaurantId, drafts);
  }

  if (name === "stock_summary") {
    return stockSummary(restaurantId);
  }

  if (name === "page_help") {
    const pathname = sanitizeAssistantText(String(args.pathname || "/"), 200);
    return { help: pageHelpFor(pathname) };
  }

  return { error: "Outil non autorisé." };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const restaurantId = session?.user?.restaurantId;
  if (!session?.user?.id || !restaurantId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      active: true,
      stripeStatus: true,
      accessGraceUntil: true,
    },
  });
  if (
    !restaurant ||
    (!hasAppAccess(restaurant) && !isAdminEmail(session.user.email))
  ) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  if (!checkAssistantRateLimit(restaurantId)) {
    return NextResponse.json(
      { error: "Limite atteinte. Réessayez dans une heure." },
      { status: 429 }
    );
  }

  let body: {
    message?: string;
    pathname?: string;
    fileText?: string;
    fileName?: string;
    history?: ChatTurn[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const message = sanitizeAssistantText(
    body.message || "",
    ASSISTANT_MAX_MESSAGE_CHARS
  );
  const fileText = sanitizeAssistantText(
    body.fileText || "",
    ASSISTANT_MAX_FILE_CHARS
  );
  const fileName = sanitizeAssistantText(body.fileName || "", 120);
  const pathname = sanitizeAssistantText(body.pathname || "/", 200);

  if (!message && !fileText) {
    return NextResponse.json(
      { error: "Écrivez un message ou joignez un fichier." },
      { status: 400 }
    );
  }

  // Fichier sans LLM : import direct si liste détectée
  if (fileText && /créer|import|ajoute|produit|stock|catalogue/i.test(message || "import")) {
    const drafts = parseProductListText(fileText);
    if (drafts.length > 0 && (!message || message.length < 80)) {
      const result = await createProducts(restaurantId, drafts);
      return NextResponse.json({
        reply: `J’ai traité « ${fileName || "votre fichier"} » : **${result.created}** produit${result.created > 1 ? "s" : ""} créé${result.created > 1 ? "s" : ""}${result.skipped ? `, ${result.skipped} déjà présent${result.skipped > 1 ? "s" : ""}` : ""}.\nVous les retrouvez dans Stock.`,
        actions: [{ type: "create_products", ...result }],
        links: [{ label: "Voir le stock", href: "/ingredients" }],
      });
    }
  }

  const openai = await getOpenAIConfig(restaurantId);
  if (!openai.configured) {
    // Fallback sans clé : parse fichier / intentions simples
    if (fileText) {
      const drafts = parseProductListText(fileText);
      if (drafts.length) {
        const result = await createProducts(restaurantId, drafts);
        return NextResponse.json({
          reply: `Import effectué (mode local) : **${result.created}** produit(s). Activez OpenAI dans Réglages pour un assistant plus souple.`,
          actions: [{ type: "create_products", ...result }],
          links: [{ label: "Voir le stock", href: "/ingredients" }],
        });
      }
    }
    if (/stock|produit|critique|rupture/i.test(message)) {
      const summary = await stockSummary(restaurantId);
      return NextResponse.json({
        reply: `Stock : **${summary.productCount}** produit(s), **${summary.criticalCount}** en alerte${summary.criticalNames.length ? ` (${summary.criticalNames.join(", ")})` : ""}.`,
        links: [{ label: "Ouvrir le stock", href: "/ingredients" }],
      });
    }
    return NextResponse.json({
      reply: `${pageHelpFor(pathname)}\n\nPour l’assistant conversationnel complet (fichiers, création de fiches…), configurez une clé OpenAI dans Réglages → IA.`,
      links: [
        { label: "Réglages", href: "/settings" },
        { label: "Aide de cette page", href: pathname || "/" },
      ],
    });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .slice(-8)
        .map((h) => ({
          role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: sanitizeAssistantText(h.content, ASSISTANT_MAX_MESSAGE_CHARS),
        }))
        .filter((h) => h.content)
    : [];

  const userContent = [
    message || "Traite le fichier joint.",
    fileText
      ? `\n\n[Fichier joint: ${fileName || "sans-nom"}]\n${fileText.slice(0, ASSISTANT_MAX_FILE_CHARS)}`
      : "",
    `\n\n[Page actuelle: ${pathname}]`,
  ].join("");

  type OaiMsg = {
    role: string;
    content?: string | null;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  };

  const messages: OaiMsg[] = [
    { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userContent },
  ];

  const actions: unknown[] = [];
  let finalText = "";

  for (let round = 0; round < 3; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openai.model || "gpt-4o-mini",
        temperature: 0.2,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[assistant] openai", res.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: "L’assistant est temporairement indisponible." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: OaiMsg }>;
    };
    const msg = data.choices?.[0]?.message;
    if (!msg) {
      return NextResponse.json(
        { error: "Réponse vide de l’assistant." },
        { status: 502 }
      );
    }

    messages.push(msg);

    const toolCalls = msg.tool_calls || [];
    if (toolCalls.length === 0) {
      finalText = String(msg.content || "").trim();
      break;
    }

    for (const call of toolCalls) {
      const toolName = call.function?.name || "";
      const result = await runTool(
        restaurantId,
        toolName,
        call.function?.arguments || "{}"
      );
      actions.push({ type: toolName, result });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (!finalText) {
    finalText =
      actions.length > 0
        ? "C’est fait. Dites-moi si vous voulez ajuster quelque chose."
        : "Je n’ai pas pu répondre. Reformulez en une phrase simple.";
  }

  const links: { label: string; href: string }[] = [];
  if (actions.some((a) => (a as { type?: string }).type === "create_products")) {
    links.push({ label: "Voir le stock", href: "/ingredients" });
  }

  return NextResponse.json({
    reply: finalText,
    actions,
    links,
  });
}
