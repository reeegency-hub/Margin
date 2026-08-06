/** WhatsApp glyph for send buttons */
export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm5.7 14.3c-.2.6-1.4 1.2-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.6.7 2 .8 2.1.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.5.3.1.2.1 1-.1 1.6z" />
    </svg>
  );
}

export type WaLabelKind =
  | "send"
  | "list"
  | "alert"
  | "test"
  | "help"
  | "sent";

const LABELS: Record<WaLabelKind, string> = {
  send: "Envoyer sur WhatsApp",
  list: "Envoyer la liste",
  alert: "Alerter l’équipe",
  test: "Message test",
  help: "Contacter Margin",
  sent: "Envoyé",
};

/** Libellé WhatsApp contextualisé — jamais le même verbe pour 5 actions. */
export function WaSendLabel({
  sent = false,
  kind = "send",
}: {
  sent?: boolean;
  kind?: Exclude<WaLabelKind, "sent">;
}) {
  return (
    <span className="wa-send-label">
      <WhatsAppIcon size={15} />
      {sent ? LABELS.sent : LABELS[kind]}
    </span>
  );
}
