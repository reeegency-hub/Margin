export function formatQty(qty: number, unit: string): string {
  const n = Math.round(qty * 100) / 100;
  return `${n} ${unit}`;
}
