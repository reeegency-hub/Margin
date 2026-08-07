import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  callTenantLLM,
  LLMNotConfiguredError,
  type LLMChatMessage,
} from "@/lib/llm/router";
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
import { detectSecretsInText } from "@/lib/assistant/secrets";
import {
  extractInventoryFromText,
  extractTeamFromText,
  normalizeWhatsappPhone,
} from "@/lib/assistant/extract";
import { createAssistantDraft } from "@/lib/assistant/drafts";
import {
  extractTextFromPdfBuffer,
  isPdfFile,
} from "@/lib/assistant/pdf";
import {
  OpenPosWizardActionSchema,
  parseImportInventory,
  parseSetWhatsapp,
  parseUpsertTeam,
} from "@/lib/assistant/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatTurn = { role: "user" | "assistant"; content: string };

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "prepare_import_inventory",
      description:
        "Prépare un brouillon d’import inventaire à partir du fichier joint (pas d’écriture DB).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          note: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_upsert_team",
      description:
        "Prépare un brouillon équipe / créneaux à partir du texte ou fichier (pas d’écriture DB).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          note: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prepare_set_whatsapp",
      description:
        "Prépare un brouillon pour enregistrer le numéro WhatsApp du magasin.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          phone: { type: "string" },
        },
        required: ["phone"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_pos_wizard",
      description:
        "Ouvre le wizard caisse (hors chat). Aucun secret. provider: zelty|cashpad|square|tiller|lightspeed|laddition|custom|other",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          provider: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_products",
      description:
        "Petit ajout rapide de produits (max 80). Pour un fichier inventaire complet, préfère prepare_import_inventory.",
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

async function prepareInventoryDraft(opts: {
  restaurantId: string;
  userId: string;
  fileText: string;
  fileName?: string;
}) {
  const extracted = extractInventoryFromText(opts.fileText, {
    storeId: opts.restaurantId,
    fileName: opts.fileName,
  });
  const candidate = {
    storeId: opts.restaurantId,
    rows: extracted.rows,
    sourceFileId: extracted.sourceFileId,
    flags: extracted.flags,
  };
  const parsed = parseImportInventory(candidate);
  if (!parsed.ok) {
    return {
      type: "draft_error" as const,
      error: parsed.error,
      issues: parsed.issues,
    };
  }
  const draft = await createAssistantDraft({
    restaurantId: opts.restaurantId,
    userId: opts.userId,
    kind: "import_inventory",
    payload: parsed.data,
    flags: parsed.data.flags,
    sourceFileName: opts.fileName,
    sourceFileId: parsed.data.sourceFileId,
    status: "preview",
  });
  return {
    type: "setup_draft" as const,
    draftId: draft.id,
    kind: draft.kind,
    rowCount: parsed.data.rows.length,
    flagCount: parsed.data.flags.length,
  };
}

async function prepareTeamDraft(opts: {
  restaurantId: string;
  userId: string;
  text: string;
  fileName?: string;
}) {
  const extracted = extractTeamFromText(opts.text, {
    storeId: opts.restaurantId,
    fileName: opts.fileName,
  });
  const parsed = parseUpsertTeam(extracted);
  if (!parsed.ok) {
    return {
      type: "draft_error" as const,
      error: parsed.error,
      issues: parsed.issues,
    };
  }
  const draft = await createAssistantDraft({
    restaurantId: opts.restaurantId,
    userId: opts.userId,
    kind: "upsert_team",
    payload: parsed.data,
    flags: parsed.data.flags,
    sourceFileName: opts.fileName,
    sourceFileId: parsed.data.sourceFileId,
    status: "preview",
  });
  return {
    type: "setup_draft" as const,
    draftId: draft.id,
    kind: draft.kind,
    employeeCount: parsed.data.employees.length,
    flagCount: parsed.data.flags.length,
  };
}

async function prepareWhatsappDraft(opts: {
  restaurantId: string;
  userId: string;
  phoneRaw: string;
}) {
  const norm = normalizeWhatsappPhone(opts.phoneRaw);
  const flags = norm.flag ? [norm.flag] : [];
  const candidate = {
    storeId: opts.restaurantId,
    phone: norm.phone || opts.phoneRaw,
    sendTest: true,
    flags,
  };
  const parsed = parseSetWhatsapp(candidate);
  if (!parsed.ok && !norm.phone) {
    const draft = await createAssistantDraft({
      restaurantId: opts.restaurantId,
      userId: opts.userId,
      kind: "set_whatsapp",
      payload: candidate,
      flags,
      status: "preview",
    });
    return {
      type: "setup_draft" as const,
      draftId: draft.id,
      kind: draft.kind,
      flagCount: flags.length,
      blocked: true,
    };
  }
  if (!parsed.ok) {
    return {
      type: "draft_error" as const,
      error: parsed.error,
      issues: parsed.issues,
    };
  }
  const draft = await createAssistantDraft({
    restaurantId: opts.restaurantId,
    userId: opts.userId,
    kind: "set_whatsapp",
    payload: parsed.data,
    flags: parsed.data.flags,
    status: "preview",
  });
  return {
    type: "setup_draft" as const,
    draftId: draft.id,
    kind: draft.kind,
    flagCount: parsed.data.flags.length,
  };
}

async function runTool(
  ctx: {
    restaurantId: string;
    userId: string;
    fileText: string;
    fileName: string;
    message: string;
  },
  name: string,
  argsJson: string
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return { error: "Arguments invalides." };
  }

  if (name === "prepare_import_inventory") {
    if (!ctx.fileText) {
      return {
        error:
          "Joignez un fichier CSV/TXT d’inventaire pour préparer le brouillon.",
      };
    }
    return prepareInventoryDraft({
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      fileText: ctx.fileText,
      fileName: ctx.fileName,
    });
  }

  if (name === "prepare_upsert_team") {
    const text = ctx.fileText || ctx.message;
    if (!text || text.length < 3) {
      return { error: "Donnez la liste d’équipe (texte ou CSV)." };
    }
    return prepareTeamDraft({
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      text,
      fileName: ctx.fileName,
    });
  }

  if (name === "prepare_set_whatsapp") {
    const phone = String(args.phone || "");
    return prepareWhatsappDraft({
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      phoneRaw: phone,
    });
  }

  if (name === "open_pos_wizard") {
    const providerRaw = String(args.provider || "other");
    const mapped =
      providerRaw === "sumup" || providerRaw === "unknown"
        ? providerRaw === "sumup"
          ? "tiller"
          : "other"
        : providerRaw;
    const parsed = OpenPosWizardActionSchema.safeParse({
      type: "open_pos_wizard",
      provider: mapped,
    });
    const provider = parsed.success ? parsed.data.provider : "other";
    return {
      type: "open_pos_wizard",
      provider,
      href: provider !== "other" ? `/kiosks?pos=${provider}` : "/kiosks",
    };
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
    return createProducts(ctx.restaurantId, drafts);
  }

  if (name === "stock_summary") {
    return stockSummary(ctx.restaurantId);
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
    fileBase64?: string;
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
  let fileText = sanitizeAssistantText(
    body.fileText || "",
    ASSISTANT_MAX_FILE_CHARS
  );
  const fileName = sanitizeAssistantText(body.fileName || "", 120);
  const pathname = sanitizeAssistantText(body.pathname || "/", 200);

  if (!fileText && body.fileBase64 && isPdfFile(fileName)) {
    try {
      const buf = Buffer.from(String(body.fileBase64), "base64");
      if (buf.length > 1_500_000) {
        return NextResponse.json(
          { error: "PDF trop volumineux (max 1,5 Mo)." },
          { status: 400 }
        );
      }
      const pdf = await extractTextFromPdfBuffer(buf);
      if (!pdf.text) {
        return NextResponse.json({
          reply:
            pdf.flags[0]?.message ||
            "PDF illisible. Exportez en CSV ou collez le texte.",
        });
      }
      fileText = sanitizeAssistantText(pdf.text, ASSISTANT_MAX_FILE_CHARS);
    } catch {
      return NextResponse.json({
        reply: "Impossible de lire le PDF. Préférez un export CSV.",
      });
    }
  }

  if (!message && !fileText) {
    return NextResponse.json(
      { error: "Écrivez un message ou joignez un fichier." },
      { status: 400 }
    );
  }

  const secretHit = detectSecretsInText(`${message}\n${fileText}`);
  if (secretHit) {
    return NextResponse.json({
      reply: secretHit,
      actions: [
        {
          type: "open_pos_wizard",
          provider: "other",
          href: "/kiosks",
        },
      ],
      links: [{ label: "Ouvrir la caisse", href: "/kiosks" }],
    });
  }

  const toolCtx = {
    restaurantId,
    userId: session.user.id,
    fileText,
    fileName,
    message,
  };

  // Fichier inventaire → toujours brouillon (plus d’écriture directe silencieuse)
  if (
    fileText &&
    /créér|creer|import|ajoute|produit|stock|catalogue|inventaire/i.test(
      message || "import"
    )
  ) {
    const draft = await prepareInventoryDraft({
      restaurantId,
      userId: session.user.id,
      fileText,
      fileName,
    });
    if (draft.type === "setup_draft") {
      return NextResponse.json({
        reply: `J’ai préparé un aperçu inventaire (**${draft.rowCount}** ligne${draft.rowCount !== 1 ? "s" : ""})${draft.flagCount ? ` avec **${draft.flagCount}** point(s) à vérifier` : ""}. Rien n’est écrit tant que vous n’avez pas cliqué **Appliquer**.`,
        actions: [draft],
        links: [{ label: "Voir le stock", href: "/ingredients" }],
      });
    }
  }

  if (
    fileText &&
    /equipe|équipe|planning|employ|horaire|shift/i.test(message || "")
  ) {
    const draft = await prepareTeamDraft({
      restaurantId,
      userId: session.user.id,
      text: fileText,
      fileName,
    });
    if (draft.type === "setup_draft") {
      return NextResponse.json({
        reply: `Aperçu équipe prêt (**${draft.employeeCount}** personne${draft.employeeCount !== 1 ? "s" : ""}). Confirmez pour écrire.`,
        actions: [draft],
        links: [{ label: "Équipe", href: "/employees" }],
      });
    }
  }

  const waMatch = message.match(
    /(?:whatsapp|wa|num[eé]ro)[^\d+]*(\+?\d[\d\s.\-]{7,})/i
  );
  if (waMatch) {
    const draft = await prepareWhatsappDraft({
      restaurantId,
      userId: session.user.id,
      phoneRaw: waMatch[1]!,
    });
    if (draft.type === "setup_draft") {
      return NextResponse.json({
        reply: draft.blocked
          ? "Numéro détecté mais invalide — corrigez dans l’aperçu ou renvoyez au format +336…"
          : "Aperçu WhatsApp prêt. Confirmez pour enregistrer (envoi test possible).",
        actions: [draft],
        links: [{ label: "Réglages", href: "/settings" }],
      });
    }
  }

  if (/caisse|zelty|cashpad|square|brancher\s+pos/i.test(message)) {
    let provider = "other";
    if (/zelty/i.test(message)) provider = "zelty";
    else if (/cashpad/i.test(message)) provider = "cashpad";
    else if (/square/i.test(message)) provider = "square";
    else if (/tiller|sumup/i.test(message)) provider = "tiller";
    else if (/lightspeed/i.test(message)) provider = "lightspeed";
    else if (/addition/i.test(message)) provider = "laddition";
    return NextResponse.json({
      reply:
        "Pour brancher la caisse, utilisez le wizard (les secrets ne passent pas par le chat).",
      actions: [
        {
          type: "open_pos_wizard",
          provider,
          href: provider !== "other" ? `/kiosks?pos=${provider}` : "/kiosks",
        },
      ],
      links: [{ label: "Ouvrir la caisse", href: "/kiosks" }],
    });
  }

  // Chat libre LLM — BYOK uniquement (Option A). Imports déterministes déjà gérés plus haut.
  const history = Array.isArray(body.history)
    ? body.history
        .slice(-8)
        .map((h) => ({
          role:
            h.role === "assistant"
              ? ("assistant" as const)
              : ("user" as const),
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

  const messages: LLMChatMessage[] = [
    { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userContent },
  ];

  const actions: unknown[] = [];
  let finalText = "";

  try {
    for (let round = 0; round < 3; round++) {
      const llmRes = await callTenantLLM({
        tenantId: restaurantId,
        messages,
        tools: TOOLS,
        maxTokens: 1200,
        temperature: 0.2,
        allowPlatformFallback: false,
      });

      const msg = llmRes.message;
      messages.push({
        role: "assistant",
        content: msg.content,
        tool_calls: msg.tool_calls,
      });

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        finalText = String(msg.content || "").trim();
        break;
      }

      for (const call of toolCalls) {
        const toolName = call.function?.name || "";
        const result = await runTool(
          toolCtx,
          toolName,
          call.function?.arguments || "{}"
        );
        actions.push(
          typeof result === "object" && result && "type" in result
            ? result
            : { type: toolName, result }
        );
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
  } catch (err) {
    if (err instanceof LLMNotConfiguredError) {
      if (fileText) {
        const draft = await prepareInventoryDraft({
          restaurantId,
          userId: session.user.id,
          fileText,
          fileName,
        });
        if (draft.type === "setup_draft") {
          return NextResponse.json({
            reply: `Aperçu inventaire (sans IA) : **${draft.rowCount}** ligne(s). Confirmez pour appliquer. Pour le chat libre : Réglages → Assistant IA.`,
            actions: [draft],
            links: [
              { label: "Connecter mon IA", href: "/settings?tab=avance" },
              { label: "Voir le stock", href: "/ingredients" },
            ],
          });
        }
      }
      if (/stock|produit|critique|rupture/i.test(message)) {
        const summary = await stockSummary(restaurantId);
        return NextResponse.json({
          reply: `Stock : **${summary.productCount}** produit(s), **${summary.criticalCount}** en alerte${summary.criticalNames.length ? ` (${summary.criticalNames.join(", ")})` : ""}.\n\nPour l’assistant conversationnel, connectez votre clé IA (BYOK) dans Réglages.`,
          links: [
            { label: "Connecter mon IA", href: "/settings?tab=avance" },
            { label: "Ouvrir le stock", href: "/ingredients" },
          ],
        });
      }
      return NextResponse.json({
        reply: `${pageHelpFor(pathname)}\n\nConnectez votre clé Anthropic ou OpenAI dans **Réglages → Assistant IA** (facturée sur votre compte). Les imports CSV restent possibles sans clé.`,
        links: [
          { label: "Connecter mon IA", href: "/settings?tab=avance" },
          { label: "Aide de cette page", href: pathname || "/" },
        ],
      });
    }
    console.error("[assistant] llm", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "L’assistant est temporairement indisponible." },
      { status: 502 }
    );
  }

  if (!finalText) {
    finalText =
      actions.length > 0
        ? "C’est prêt. Vérifiez l’aperçu et confirmez si besoin."
        : "Je n’ai pas pu répondre. Reformulez en une phrase simple.";
  }

  const links: { label: string; href: string }[] = [];
  if (
    actions.some(
      (a) =>
        (a as { type?: string; kind?: string }).type === "setup_draft" &&
        (a as { kind?: string }).kind === "import_inventory"
    )
  ) {
    links.push({ label: "Voir le stock", href: "/ingredients" });
  }

  return NextResponse.json({
    reply: finalText,
    actions,
    links,
  });
}
