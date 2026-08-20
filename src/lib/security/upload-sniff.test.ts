/**
 * Tests sniff uploads (magic bytes).
 */
import assert from "node:assert/strict";
import { sniffUpload } from "@/lib/security/upload-sniff";

function main() {
  const pdf = Buffer.from("%PDF-1.4 fake");
  const okPdf = sniffUpload(pdf, "application/octet-stream", "x.bin", "menu");
  assert.equal(okPdf.ok, true);
  if (okPdf.ok) assert.equal(okPdf.kind, "pdf");

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const okJpeg = sniffUpload(jpeg, "image/gif", "x.gif", "menu");
  assert.equal(okJpeg.ok, true);
  if (okJpeg.ok) assert.equal(okJpeg.kind, "jpeg");

  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);
  const okPng = sniffUpload(png, "", "x", "invoice");
  assert.equal(okPng.ok, true);
  if (okPng.ok) assert.equal(okPng.kind, "png");

  const csv = Buffer.from("produit;qte;prix\nLait;2;1.2\n", "utf8");
  const okCsv = sniffUpload(csv, "text/csv", "stock.csv", "invoice");
  assert.equal(okCsv.ok, true);
  if (okCsv.ok) assert.equal(okCsv.kind, "csv");

  const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ
  const bad = sniffUpload(exe, "application/pdf", "evil.pdf", "menu");
  assert.equal(bad.ok, false);

  console.log("upload-sniff.test.ts: OK");
}

main();
