import { CookieBanner } from "@/components/legal/CookieBanner";
import { MobileLandingHero } from "./MobileLandingHero";
import { MobileLandingProof } from "./MobileLandingProof";
import { MobileLandingBenefits } from "./MobileLandingBenefits";
import { MobileLandingPricingLink } from "./MobileLandingPricingLink";
import { MobileLandingOffer } from "./MobileLandingOffer";
import { MobileLandingFooter } from "./MobileLandingFooter";
import "./mobile-landing.css";

/**
 * Landing mobile — expérience indépendante.
 * Ne partage pas le markup desktop (DesktopLanding).
 */
export default function MobileLanding() {
  return (
    <div className="mland">
      <CookieBanner />
      <MobileLandingHero />
      <main className="mland-main">
        <MobileLandingProof />
        <MobileLandingBenefits />
        <MobileLandingPricingLink />
        <MobileLandingOffer />
      </main>
      <MobileLandingFooter />
    </div>
  );
}
