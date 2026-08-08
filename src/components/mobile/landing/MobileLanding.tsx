import { CookieBanner } from "@/components/legal/CookieBanner";
import { MobileLandingHero } from "./MobileLandingHero";
import { MobileLandingProof } from "./MobileLandingProof";
import { MobileLandingBenefits } from "./MobileLandingBenefits";
import { MobileLandingTeam } from "./MobileLandingTeam";
import { MobileLandingPricing } from "./MobileLandingPricing";
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
      <div className="mland-frame">
        <MobileLandingHero />
        <main className="mland-main">
          <MobileLandingBenefits />
          <MobileLandingOffer />
          <MobileLandingProof />
          <MobileLandingPricing />
          <MobileLandingTeam />
        </main>
        <MobileLandingFooter />
      </div>
    </div>
  );
}
