import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BrandPage } from "@/components/brand/BrandCard";
import { getOpenAIConfig } from "@/lib/openai";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { STRIPE_GRACE_DAYS } from "@/lib/stripe/access";
import { ManageBillingButton } from "@/components/settings/ManageBillingButton";
import {
  absoluteReferralUrl,
  codeFromRestaurantId,
} from "@/lib/affiliate";
import { getTenantLlmStatus } from "@/lib/llm/router";
import { getDeviceType } from "@/lib/device";
import { isFeatureEnabled } from "@/config/features";

const SETTINGS_PLATFORMS = [
  { key: "uber_eats", label: "Uber Eats" },
  { key: "deliveroo", label: "Deliveroo" },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    tested?: string;
    error?: string;
    connected?: string;
    msg?: string;
    tab?: string;
    full?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rid = session.user.restaurantId;
  const device = await getDeviceType();
  const mobileMinimal =
    isFeatureEnabled("mobileThreeTabApp", device) && params.full !== "1";

  for (const p of SETTINGS_PLATFORMS) {
    await prisma.deliveryPlatformConnection.upsert({
      where: {
        restaurantId_platform: { restaurantId: rid, platform: p.key },
      },
      create: { restaurantId: rid, platform: p.key, status: "DISCONNECTED" },
      update: {},
    });
  }

  const [restaurantRaw, openai, connections, referralCount, llm] =
    await Promise.all([
      prisma.restaurant.findUniqueOrThrow({ where: { id: rid } }),
      getOpenAIConfig(rid),
      prisma.deliveryPlatformConnection.findMany({
        where: { restaurantId: rid },
      }),
      prisma.restaurant.count({ where: { referredByRestaurantId: rid } }),
      getTenantLlmStatus(rid).catch(() => ({
        configured: false,
        provider: null as null,
        status: "none" as const,
        fingerprintDisplay: null as null,
        source: null as null,
      })),
    ]);

  let restaurant = restaurantRaw;
  if (!restaurant.referralCode) {
    const code = codeFromRestaurantId(rid);
    restaurant = await prisma.restaurant.update({
      where: { id: rid },
      data: { referralCode: code },
    });
  }

  if (mobileMinimal) {
    const { SettingsScreen } = await import(
      "@/components/mobile/app/SettingsScreen"
    );
    const { PLANS } = await import("@/lib/plans");
    const planLabel =
      PLANS.find((p) => p.id === restaurant.plan)?.name || "Commerce";
    return (
      <SettingsScreen
        userName={session.user.name || ""}
        userEmail={session.user.email || ""}
        restaurantName={session.user.restaurantName}
        planLabel={planLabel}
        whatsappTo={restaurant.whatsappTo}
        showBilling={Boolean(restaurant.stripeCustomerId)}
      />
    );
  }

  const webhookUrl = process.env.WEBHOOK_BASE_URL
    ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/whatsapp`
    : "http://localhost:3000/api/webhooks/whatsapp";

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.WEBHOOK_BASE_URL ||
    "http://localhost:3020";

  const platforms = SETTINGS_PLATFORMS.map((p) => {
    const c = connections.find((x) => x.platform === p.key);
    return {
      platform: p.key,
      label: p.label,
      status: c?.status ?? "DISCONNECTED",
      storeId: c?.storeId ?? null,
      hasKey: Boolean(c?.apiKeyEncrypted),
      webhookSecret: c?.webhookSecret ?? null,
      webhookUrl: `${baseUrl}/api/webhooks/delivery/${p.key}`,
    };
  });

  const needsWa = !restaurant.whatsappTo;
  const billingWarn = Boolean(
    restaurant.paymentFailedAt &&
      restaurant.accessGraceUntil &&
      restaurant.accessGraceUntil.getTime() > Date.now()
  );

  const inkTitle = billingWarn
    ? "Paiement à mettre à jour"
    : needsWa
      ? "WhatsApp du commerce"
      : "Réglages OK";

  const inkDetail = billingWarn
    ? `Accès maintenu jusqu’au ${restaurant.accessGraceUntil!.toLocaleDateString(
        "fr-FR",
        { day: "numeric", month: "long" }
      )} — mettez à jour la carte.`
    : needsWa
      ? "Ajoutez le numéro pour envoyer listes et alertes."
      : "WhatsApp, facturation et options du commerce.";

  return (
    <BrandPage
      question="Vos réglages"
      guide="Chaque onglet a un guide popup — cliquez « Comprendre cet onglet » si besoin."
    >
      {params.saved ? <p className="flash">Enregistré.</p> : null}
      {params.tested === "1" ? (
        <p className="flash">Message de test envoyé sur WhatsApp.</p>
      ) : null}
      {params.tested === "simulated" ? (
        <p className="flash flash-warn">
          Test enregistré — l’envoi technique n’est pas encore actif. Le numéro
          est bien sauvé.
        </p>
      ) : null}
      {params.connected ? (
        <p className="flash">
          {decodeURIComponent(params.msg || "Connexion OK")}
        </p>
      ) : null}
      {params.error === "nonumber" ? (
        <p className="flash flash-warn">
          Pour envoyer sur WhatsApp, ajoutez d’abord votre numéro ci-dessous.
        </p>
      ) : null}
      {params.error === "whatsapp_taken" ? (
        <p className="flash flash-warn">
          Ce numéro est déjà utilisé par un autre compte.
        </p>
      ) : null}

      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">À faire maintenant</p>
        <p className="hub-now__title">{inkTitle}</p>
        <p className="hub-now__detail">{inkDetail}</p>
        <div className="hub-now__actions">
          {billingWarn ? (
            <ManageBillingButton
              label="Mettre à jour la carte"
              className="btn-lime"
            />
          ) : null}
          {needsWa && !billingWarn ? (
            <p className="hub-now__hint">Numéro dans l’onglet Simple ci-dessous.</p>
          ) : null}
          {!needsWa && !billingWarn ? (
            <p className="hub-now__hint">Rien d’urgent — changez un réglage si besoin.</p>
          ) : null}
        </div>
      </div>

      {billingWarn ? (
        <div className="flash flash-warn mb-4 space-y-2">
          <p>
            Paiement en échec — accès maintenu jusqu’au{" "}
            {restaurant.accessGraceUntil!.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            (grâce {STRIPE_GRACE_DAYS} jours).
          </p>
          <ManageBillingButton />
        </div>
      ) : null}

      <SettingsTabs
        restaurantId={rid}
        whatsappTo={restaurant.whatsappTo ?? ""}
        webhookUrl={webhookUrl}
        showBilling={Boolean(restaurant.stripeCustomerId)}
        initialTab={
          params.tab === "avance" ||
          params.tab === "affiliation" ||
          params.tab === "connexions" ||
          params.tab === "simple"
            ? params.tab
            : undefined
        }
        openai={{
          configured: openai.configured,
          source: openai.source,
          maskedKey: openai.maskedKey,
          model: openai.model,
        }}
        llm={llm}
        platforms={platforms}
        affiliate={{
          referralCode: restaurant.referralCode!,
          referralUrl: absoluteReferralUrl(restaurant.referralCode!, baseUrl),
          referralCount,
          creditMonths: restaurant.affiliateCreditMonths,
        }}
      />
    </BrandPage>
  );
}
