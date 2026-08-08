import Link from "next/link";

/** CTA secondaire — chip plein largeur. */
export function MobileLandingPricingLink() {
  return (
    <section className="mland-pricing-link">
      <Link href="/welcome/details" className="mland-btn mland-btn--ghost">
        Voir les tarifs
      </Link>
    </section>
  );
}
