import { analyzeMenuText, type OpenAICallOptions } from "@/lib/menu-ai";

export type MenuExtractResult =
  | { ok: true; text: string; source: "pdf" | "image" | "text" }
  | { ok: false; error: string };

export async function extractTextFromMenuFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  options: OpenAICallOptions = {}
): Promise<MenuExtractResult> {
  const lower = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      await parser.destroy();
      const text = (textResult.text || "").trim();
      if (text.length < 10) {
        return {
          ok: false,
          error: "PDF illisible ou vide. Essayez une photo ou collez le texte.",
        };
      }
      return { ok: true, text, source: "pdf" };
    } catch {
      return { ok: false, error: "Impossible de lire le PDF." };
    }
  }

  if (
    mimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp)$/i.test(lower)
  ) {
    const apiKey = (options.apiKey || process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
      return {
        ok: false,
        error:
          "Photo reçue mais clé OpenAI manquante. Collez le texte du menu ou configurez OpenAI dans Réglages.",
      };
    }

    const model =
      (options.model || process.env.OPENAI_MODEL || "gpt-4o-mini").trim() ||
      "gpt-4o-mini";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${base64}`;

    const payload = {
      model,
      messages: [
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: "Extrais tout le texte de ce catalogue produits (noms, prix, sections). Retourne uniquement le texte brut, une ligne par produit si possible.",
            },
            {
              type: "image_url" as const,
              image_url: { url: dataUrl, detail: "low" as const },
            },
          ],
        },
      ],
      max_tokens: 2000,
    };

    let res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Rate limit / soft quota — one retry after a short wait
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || "3");
      await new Promise((r) =>
        setTimeout(r, Math.min(Math.max(retryAfter, 2), 12) * 1000)
      );
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) {
        return {
          ok: false,
          error:
            "OpenAI est saturé (quota / trop de requêtes). Attendez 1 minute, ou collez le texte du menu à la place.",
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error:
            "Clé OpenAI refusée. Vérifiez-la dans Réglages, ou collez le texte du menu.",
        };
      }
      return {
        ok: false,
        error: `Lecture photo impossible (${res.status}). Collez le texte du menu. ${body.slice(0, 120)}`,
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = (data.choices?.[0]?.message?.content || "").trim();
    if (text.length < 5) {
      return {
        ok: false,
        error: "Image illisible — reprenez la photo ou collez le texte.",
      };
    }
    return { ok: true, text, source: "image" };
  }

  if (mimeType.startsWith("text/") || lower.endsWith(".txt")) {
    const text = buffer.toString("utf8").trim();
    if (text.length < 3) return { ok: false, error: "Fichier texte vide." };
    return { ok: true, text, source: "text" };
  }

  return {
    ok: false,
    error: "Format non supporté. Utilisez PDF, JPG ou PNG (max 10 Mo).",
  };
}

export async function analyzeMenuFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  existingIngredientNames: string[],
  options: OpenAICallOptions = {}
) {
  const extracted = await extractTextFromMenuFile(
    buffer,
    mimeType,
    fileName,
    options
  );
  if (!extracted.ok) return { ok: false as const, error: extracted.error };

  const result = await analyzeMenuText(
    extracted.text,
    existingIngredientNames,
    options
  );
  if (!result.dishes.length) {
    return {
      ok: false as const,
      error: "Aucun plat détecté dans le fichier. Vérifiez la qualité du scan.",
    };
  }

  return {
    ok: true as const,
    dishes: result.dishes,
    engine: result.engine,
    source: extracted.source,
    extractedText: extracted.text,
    openaiError: result.openaiError,
  };
}
