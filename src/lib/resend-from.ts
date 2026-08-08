/**
 * Adresses From Resend — essaie le domaine custom, puis fallback onboarding.
 * Tant que marginshop.app n’est pas Verified chez Resend, onboarding@resend.dev
 * permet l’OTP vers l’email du compte Resend.
 */
export function resendFromCandidates(): string[] {
  const primary =
    process.env.NEWSLETTER_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Margin <contact@marginshop.app>";
  const fallback = "Margin <onboarding@resend.dev>";
  const list = [primary];
  if (!primary.includes("onboarding@resend.dev")) {
    list.push(fallback);
  }
  return list;
}

export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html?: string;
  text: string;
}): Promise<
  | { ok: true; from: string }
  | { ok: false; error: string; userMessage?: string }
> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "no_provider" };
  }

  let lastError = "send_failed";
  let userMessage: string | undefined;
  for (const from of resendFromCandidates()) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      });
      if (res.ok) {
        return { ok: true, from };
      }
      const body = await res.text().catch(() => "");
      lastError = `resend_${res.status}`;
      console.error(
        `[resend] ${res.status} from=${from}: ${body.slice(0, 300)}`
      );
      const lower = body.toLowerCase();
      if (
        res.status === 403 &&
        (lower.includes("not verified") || lower.includes("domain"))
      ) {
        userMessage =
          "Domaine email pas encore vérifié chez Resend. Vérifiez marginshop.app, ou utilisez le SMS.";
        continue;
      }
      if (
        lower.includes("only send testing") ||
        lower.includes("you can only send") ||
        lower.includes("testing emails")
      ) {
        userMessage =
          "Resend est encore en mode test : l’email n’arrive que sur l’adresse du compte Resend. Vérifiez le domaine, ou utilisez le SMS.";
        break;
      }
      if (res.status === 422 || res.status === 400) {
        userMessage =
          "Adresse email refusée par le fournisseur. Vérifiez l’orthographe ou essayez le SMS.";
        break;
      }
    } catch (err) {
      lastError = "network";
      userMessage = "Réseau email indisponible. Réessayez dans une minute.";
      console.error("[resend] network", err);
    }
  }
  return { ok: false, error: lastError, userMessage };
}
