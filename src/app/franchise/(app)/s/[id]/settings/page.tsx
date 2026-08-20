import { ManageBillingButton } from "@/components/settings/ManageBillingButton";
import { STRIPE_GRACE_DAYS } from "@/lib/stripe/access";
import { prisma } from "@/lib/db";
import {
  requireFranchiseSession,
  updateFranchiseWhatsAppAction,
} from "../../../../actions";

export default async function FranchiseSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireFranchiseSession();
  const { id: rid } = await params;
  const q = await searchParams;

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: rid },
    select: {
      name: true,
      whatsappTo: true,
      plan: true,
      stripeCustomerId: true,
      paymentFailedAt: true,
      accessGraceUntil: true,
      networkId: true,
    },
  });

  const hq = restaurant.networkId
    ? await prisma.franchiseNetwork.findUnique({
        where: { id: restaurant.networkId },
        select: {
          hqRestaurant: {
            select: {
              stripeCustomerId: true,
              paymentFailedAt: true,
              accessGraceUntil: true,
              plan: true,
            },
          },
        },
      })
    : null;

  const billing = hq?.hqRestaurant ?? {
    stripeCustomerId: restaurant.stripeCustomerId,
    paymentFailedAt: restaurant.paymentFailedAt,
    accessGraceUntil: restaurant.accessGraceUntil,
    plan: restaurant.plan,
  };

  const billingWarn = Boolean(
    billing.paymentFailedAt &&
      billing.accessGraceUntil &&
      billing.accessGraceUntil.getTime() > Date.now()
  );

  return (
    <div className="franchise-page">
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">{restaurant.name}</p>
        <h1>Réglages</h1>
        <p className="franchise-page-head__lead">
          WhatsApp boutique · facturation réseau (HQ).
        </p>
      </header>

      {q.saved ? <p className="franchise-form__ok">Enregistré.</p> : null}
      {q.error ? (
        <p className="franchise-form__error" role="alert">
          {q.error}
        </p>
      ) : null}

      <section style={{ marginTop: "1.5rem" }}>
        <h2>WhatsApp</h2>
        <form action={updateFranchiseWhatsAppAction} className="franchise-form">
          <label className="franchise-field">
            <span>Numéro WhatsApp</span>
            <input
              name="whatsappTo"
              defaultValue={restaurant.whatsappTo ?? ""}
              placeholder="+33…"
            />
          </label>
          <button type="submit" className="franchise-btn">
            Enregistrer
          </button>
        </form>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Facturation (HQ)</h2>
        <p className="franchise-store-row__meta">
          Plan {billing.plan === "reseau" ? "Franchise" : billing.plan || "—"}
          {billingWarn
            ? ` · grâce ${STRIPE_GRACE_DAYS} j — mettez à jour la carte`
            : ""}
        </p>
        {billing.stripeCustomerId ? (
          <div style={{ marginTop: "0.75rem" }}>
            <ManageBillingButton
              label="Portail Stripe"
              className="franchise-btn"
            />
          </div>
        ) : (
          <p className="franchise-store-row__meta">
            Pas encore de client Stripe sur le HQ.
          </p>
        )}
      </section>

      <p className="franchise-store-row__meta" style={{ marginTop: "1.5rem" }}>
        Session : {session.user.email}
      </p>
    </div>
  );
}
