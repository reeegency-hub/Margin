/**
 * Extraction texte depuis PDF (inventaire / listes) — pdf-parse.
 * En cas d’échec : flag, pas de guess.
 */
import type { AmbiguityFlag } from "@/lib/assistant/schemas";

export async function extractTextFromPdfBuffer(
  buffer: Buffer
): Promise<{ text: string; flags: AmbiguityFlag[] }> {
  const flags: AmbiguityFlag[] = [];
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text = String(result?.text || "").trim();
    if (!text) {
      flags.push({
        code: "pdf_empty",
        message:
          "PDF sans texte extractible (scan image ?). Exportez en CSV ou collez le texte.",
      });
    }
    return { text, flags };
  } catch (e) {
    flags.push({
      code: "pdf_parse_failed",
      message: `Lecture PDF impossible : ${e instanceof Error ? e.message : "erreur"}. Préférez un CSV.`,
    });
    return { text: "", flags };
  }
}

export function isPdfFile(fileName: string, mime?: string | null): boolean {
  const n = fileName.toLowerCase();
  if (n.endsWith(".pdf")) return true;
  if (mime && /pdf/i.test(mime)) return true;
  return false;
}
