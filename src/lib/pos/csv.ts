/**
 * Minimal CSV / TSV parser (handles quotes, ; or , or tab delimiters).
 * Excel users should export as CSV — .xlsx binary is rejected with a clear error.
 */

export function detectDelimiter(headerLine: string): string {
  const counts = {
    ",": (headerLine.match(/,/g) || []).length,
    ";": (headerLine.match(/;/g) || []).length,
    "\t": (headerLine.match(/\t/g) || []).length,
  };
  let best: string = ",";
  let max = -1;
  for (const [d, n] of Object.entries(counts)) {
    if (n > max) {
      max = n;
      best = d;
    }
  }
  return best;
}

export function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsvText(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    let empty = true;
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c}`;
      const val = (cols[c] ?? "").trim();
      if (val) empty = false;
      row[key] = val;
    }
    if (!empty) rows.push(row);
  }
  return rows;
}

export function assertTextImport(fileName: string, buffer: Buffer): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    throw new Error(
      "Fichier Excel binaire non supporté — exportez en CSV (séparateur ; ou ,) depuis votre caisse."
    );
  }
  // Reject obvious zip/xlsx magic
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    throw new Error(
      "Fichier compressé / Excel détecté — exportez en CSV depuis votre caisse."
    );
  }
  return buffer.toString("utf8");
}
