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
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rid = session.user.restaurantId;

  for (const p of SETTINGS_PLATFORMS) {
    await prisma.deliveryPlatformConnection.upsert({
      where: {
        restaurantId_platform: { restaurantId: rid, platform: p.key },
      },
      create: { restaurantId: rid, platform: p.key, status: "DISCONNECTED" },
      update: {},
    });
  }

  const [restaurantRaw, openai, connections, referralCount] =
    await Promise.all([
      prisma.restaurant.findUniqueOrThrow({ where: { id: rid } }),
      getOpenAIConfig(rid),
      prisma.deliveryPlatformConnection.findMany({
        where: { restaurantId: rid },
      }),
      prisma.restaurant.count({ where: { referredByRestaurantId: rid } }),
    ]);

  let restaurant = restaurantRaw;
  if (!restaurant.referralCode) {
    const code = codeFromRestaurantId(rid);
    restaurant = await prisma.restaurant.update({
      where: { id: rid },
      data: { referralCode: code },
    });
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

  return (
    <BrandPage
      question="Vos réglages"
      guide="WhatsApp du magasin et options utiles."
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

      {restaurant.paymentFailedAt &&
      restaurant.accessGraceUntil &&
      restaurant.accessGraceUntil.getTime() > Date.now() ? (
        <div className="flash flash-warn mb-4 space-y-2">
          <p>
            Paiement en échec — accès maintenu jusqu’au{" "}
            {restaurant.accessGraceUntil.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            (grâce {STRIPE_GRACE_DAYS} jours). Mettez à jour votre carte pour
            éviter la coupure.
          </p>
          <ManageBillingButton />
        </div>
      ) : null}

      <SettingsTabs
        whatsappTo={restaurant.whatsappTo ?? ""}
        webhookUrl={webhookUrl}
        openai={{
          configured: openai.configured,
          source: openai.source,
          maskedKey: openai.maskedKey,
          model: openai.model,
        }}
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
