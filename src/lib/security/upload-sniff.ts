/**
 * Validation défensive des uploads — allowlist MIME + magic bytes.
 * Pas de confiance seule sur file.type / extension client.
 */

export type UploadKind = "menu" | "invoice";

export type UploadSniffResult =
  | {
      ok: true;
      kind: "pdf" | "jpeg" | "png" | "webp" | "csv" | "text";
      mime: string;
    }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;

function hasPrefix(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 2048));
  let weird = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) weird += 1;
  }
  return weird / Math.max(sample.length, 1) < 0.05;
}

/**
 * Sniffe le buffer. `claimedMime` / `fileName` aident pour CSV/texte
 * mais ne remplacent pas les magic bytes pour binaires.
 */
export function sniffUpload(
  buffer: Buffer,
  claimedMime: string,
  fileName: string,
  kind: UploadKind
): UploadSniffResult {
  if (!buffer.length) {
    return { ok: false, error: "Fichier vide." };
  }
  if (buffer.length > MAX_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (max 10 Mo)." };
  }

  const lower = (fileName || "").toLowerCase();
  const mime = (claimedMime || "").toLowerCase().split(";")[0].trim();

  // PDF
  if (hasPrefix(buffer, [0x25, 0x50, 0x44, 0x46])) {
    return { ok: true, kind: "pdf", mime: "application/pdf" };
  }

  // JPEG
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) {
    return { ok: true, kind: "jpeg", mime: "image/jpeg" };
  }

  // PNG
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, kind: "png", mime: "image/png" };
  }

  // WEBP (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ok: true, kind: "webp", mime: "image/webp" };
  }

  // Texte / CSV (menu + facture)
  const textish =
    mime.includes("csv") ||
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    lower.endsWith(".txt");

  if (textish && looksLikeText(buffer)) {
    const isCsv =
      mime.includes("csv") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".tsv") ||
      buffer.includes(Buffer.from(";")) ||
      buffer.includes(Buffer.from(","));
    return {
      ok: true,
      kind: isCsv ? "csv" : "text",
      mime: isCsv ? "text/csv" : "text/plain",
    };
  }

  // Facture : texte brut sans extension parfois
  if (kind === "invoice" && looksLikeText(buffer)) {
    return { ok: true, kind: "text", mime: "text/plain" };
  }

  return {
    ok: false,
    error:
      kind === "invoice"
        ? "Format non supporté. PDF, image (JPEG/PNG/WebP), CSV ou texte."
        : "Format non supporté. PDF, image (JPEG/PNG/WebP) ou texte.",
  };
}

export { MAX_BYTES as UPLOAD_MAX_BYTES };
