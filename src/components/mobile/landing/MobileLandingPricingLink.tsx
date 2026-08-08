import Link from "next/link";

/** CTA secondaire — pas de cartes pricing. */
export function MobileLandingPricingLink() {
  return (
    <section className="mland-pricing-link">
      <Link href="/welcome/details" className="mland-link">
        Voir les tarifs
      </Link>
    </section>
  );
}
