/**
 * Alertes Ops POS (Slack si OPS_SLACK_WEBHOOK_URL, sinon console).
 */
export async function notifyPosOpsAlert(opts: {
  level: "dead" | "schema" | "recon";
  restaurantId: string;
  connectionId: string;
  message: string;
  eventId?: string;
}) {
  const text = `[POS ${opts.level}] tenant=${opts.restaurantId} conn=${opts.connectionId || "—"} event=${opts.eventId || "—"} — ${opts.message}`;
  const url = process.env.OPS_SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn(text);
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("OPS Slack notify failed", err);
    console.warn(text);
  }
}
