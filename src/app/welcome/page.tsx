import Link from "next/link";
import type { Metadata } from "next";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { MarginLogo, MarginLogoMark } from "@/components/brand/MarginLogo";
import { CookieBanner } from "@/components/legal/CookieBanner";
import { NewsletterSignupForm } from "@/components/marketing/NewsletterSignupForm";
import {
  CalendlyEmbed,
} from "@/components/marketing/CalendlyEmbed";
import { AFFILIATE, LAUNCH_OFFER } from "@/lib/affiliate";
import { getCalendlyUrl } from "@/lib/calendly";

export const metadata: Metadata = {
  title: "Margin — Stock magasin relié à votre caisse",
  description:
    "Gagnez du temps et de la marge : stock relié à la caisse, moins de ruptures, alertes WhatsApp. −20 % le 1er mois + config offerte en 30 min.",
  keywords: [
    "logiciel stock magasin",
    "gestion stock commerce de proximité",
    "lien caisse stock",
    "alerte rupture stock",
    "Zelty stock",
  ],
  alternates: { canonical: "/welcome" },
};

const STEPS = [
  {
    n: "1",
    title: "Gagnez vos soirées",
    text: "Plus de ressaisie Excel après la fermeture. Chaque ticket met le stock à jour tout seul — vous gardez votre caisse.",
    gain: "Temps",
    visual: "caisse",
  },
  {
    n: "2",
    title: "Voyez ce qui reste vraiment",
    text: "Fini les approximations. Vous savez quoi commander — moins de surstock mort et moins d’argent immobilisé.",
    gain: "Argent",
    visual: "stock",
  },
  {
    n: "3",
    title: "Inventaire sans prise de tête",
    text: "Un passage rayon de temps en temps. Margin montre l’écart — vous corrigez en minutes, pas en heures.",
    gain: "Temps",
    visual: "count",
  },
  {
    n: "4",
    title: "Ne perdez plus de ventes",
    text: "Alerte WhatsApp avant la rupture. Une décision claire : commander ou ignorer. Le client trouve ce qu’il cherche.",
    gain: "CA",
    visual: "wa",
  },
] as const;

const GAINS = [
  {
    label: "Temps",
    metric: "3–5 h",
    title: "Rendues chaque semaine",
    text: "Des heures de saisie évitées chaque semaine",
    detail:
      "Plus de ressaisie après fermeture. Le stock suit la caisse — vous récupérez vos soirées.",
    visual: "temps" as const,
  },
  {
    label: "Argent",
    metric: "+ marge",
    title: "Protégée sur le rayon",
    text: "Moins de ruptures, moins de stock mort",
    detail:
      "Moins de ventes perdues faute de stock, moins d’argent dormi dans la réserve.",
    visual: "argent" as const,
  },
  {
    label: "Sérénité",
    metric: "Tête libre",
    title: "Même en plein rush",
    text: "Le rayon sous contrôle, même en rush",
    detail:
      "Une alerte claire, une décision en un geste. Vous restez sur la file — pas coincé derrière l’écran.",
    visual: "serenite" as const,
  },
] as const;

function GainViz({ visual }: { visual: (typeof GAINS)[number]["visual"] }) {
  if (visual === "temps") {
    return (
      <>
        <header>
          <span>Ce soir</span>
          <em>libre</em>
        </header>
        <div className="land-gain-viz__clock">
          <div className="is-old">
            <small>Avant</small>
            <strong>22h30</strong>
            <span>Excel ouvert</span>
          </div>
          <span className="land-gain-viz__arrow" aria-hidden>
            →
          </span>
          <div className="is-new">
            <small>Avec Margin</small>
            <strong>20h10</strong>
            <span>Magasin fermé</span>
          </div>
        </div>
        <p className="land-gain-viz__toast">
          <b>✓</b> Stock à jour · aucune saisie
        </p>
      </>
    );
  }
  if (visual === "argent") {
    return (
      <>
        <header>
          <span>Rayon boissons</span>
          <em>sauvé</em>
        </header>
        <div className="land-gain-viz__sku">
          <div className="land-gain-viz__sku-main">
            <strong>Coca 33 cl</strong>
            <span>Seuil atteint · alerte envoyée</span>
          </div>
          <b>OK</b>
        </div>
        <ul className="land-gain-viz__delta">
          <li>
            <span>Vente</span>
            <strong>+1,80 €</strong>
          </li>
          <li>
            <span>Stock mort</span>
            <strong>évité</strong>
          </li>
        </ul>
      </>
    );
  }
  return (
    <>
      <header>
        <span>Rush 12h15</span>
        <em>calme</em>
      </header>
      <div className="land-gain-viz__wa">
        <div className="land-gain-viz__wa-bubble">
          <p>Il reste 2 laits.</p>
          <p>On en commande 12 ?</p>
        </div>
        <div className="land-gain-viz__wa-actions">
          <span className="is-yes">Commander</span>
          <span>Ignorer</span>
        </div>
      </div>
      <p className="land-gain-viz__toast land-gain-viz__toast--soft">
        Vous restez sur la file
      </p>
    </>
  );
}

const FAQ_ITEMS = [
  {
    q: "Quelle formule choisir ?",
    a: "Commerce (89 € HT/mois) : 1 boutique, jusqu’à 200 produits — vous branchez la caisse. Franchise (249 € HT/mois) : 1 à 3 boutiques, produits illimités — branchement caisse par Margin inclus (~400 € économisés / magasin).",
  },
  {
    q: "Qui branche la caisse ?",
    a: "Sur Commerce, vous (ou votre prestataire). Sur Franchise, Margin le fait sur chaque magasin — environ 400 € économisés par site.",
  },
  {
    q: "Est-ce que je dois exporter des fichiers ?",
    a: "Non. Une fois la caisse branchée, plus d’export au magasin. En Franchise, vous indiquez votre logiciel dans l’appli et on s’occupe du reste. En Commerce, vous branchez de votre côté.",
  },
  {
    q: "Comment démarrer ?",
    a: `${LAUNCH_OFFER.hook}. Réservez un créneau de ${LAUNCH_OFFER.setupMinutes} min ou créez votre compte, puis indiquez votre caisse. En Franchise, on branche. En Commerce, vous branchez.`,
  },
  {
    q: "L’offre −20 % le 1er mois, c’est quoi ?",
    a: `Sur le 1er mois (Commerce ou Franchise), −${LAUNCH_OFFER.discountPercent} % via le programme d’affiliation / offre de lancement. On configure aussi WhatsApp avec vous en ${LAUNCH_OFFER.setupMinutes} minutes sur un appel dédié.`,
  },
  {
    q: "Ça remplace mon Excel ?",
    a: "Oui pour le suivi stock au quotidien. La caisse reste la vôtre : Margin s’occupe du stock, des alertes et de la vérification.",
  },
  {
    q: "Puis-je changer de formule plus tard ?",
    a: "Oui. Vous pouvez passer de Commerce à Franchise si vous ouvrez d’autres magasins. Le changement se fait avec l’équipe Margin.",
  },
  {
    q: "Y a-t-il un engagement ?",
    a: "Non d’engagement long. Vous résiliez à l’échéance de votre période (mensuelle ou annuelle). Paiement sécurisé via Stripe.",
  },
] as const;

const POPS = [
  {
    kind: "sale" as const,
    place: "tl",
    delay: "0s",
    tag: "Temps",
    title: "Caisse → stock",
    body: "Ticket #1842 · stock à jour tout seul",
    time: "à l’instant",
  },
  {
    kind: "wa" as const,
    place: "tr",
    delay: "1.1s",
    tag: "Sérénité",
    title: "Alerte WhatsApp",
    body: "Il reste 2 laits. Commander 12 ?",
    time: "maintenant",
  },
  {
    kind: "stock" as const,
    place: "ml",
    delay: "2.2s",
    tag: "Argent",
    title: "Marge protégée",
    body: "Rupture Coca évitée · vente sauvée",
    time: "il y a 40 s",
  },
  {
    kind: "wa" as const,
    place: "mr",
    delay: "3.3s",
    tag: "Temps",
    title: "Décision claire",
    body: "Oui · commande envoyée en 1 tap",
    time: "il y a 1 min",
  },
  {
    kind: "stock" as const,
    place: "bl",
    delay: "4.4s",
    tag: "Sérénité",
    title: "Rush 12h15",
    body: "Rayon OK · 12 / 12 seuils verts",
    time: "à jour",
  },
  {
    kind: "sale" as const,
    place: "br",
    delay: "5.5s",
    tag: "Argent",
    title: "Moins de stock mort",
    body: "Commande calée sur les vraies ventes",
    time: "il y a 2 min",
  },
] as const;

function HeroPops() {
  return (
    <div className="land-pops" aria-hidden>
      {POPS.map((pop) => (
        <aside
          key={`${pop.place}-${pop.title}-${pop.body}`}
          className={`land-pop land-pop--${pop.kind} land-pop--${pop.place}`}
          style={{ animationDelay: pop.delay }}
        >
          <span className="land-pop__avatar" />
          <div className="land-pop__body">
            <p className="land-pop__tag">{pop.tag}</p>
            <header>
              <strong>{pop.title}</strong>
              <time>{pop.time}</time>
            </header>
            <p>{pop.body}</p>
          </div>
        </aside>
      ))}
    </div>
  );
}

function FaqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function ProductJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Margin",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Logiciel de stock pour commerces de proximité : caisse reliée, stock à jour, alertes WhatsApp.",
    offers: [
      {
        "@type": "Offer",
        name: "Commerce",
        price: "89",
        priceCurrency: "EUR",
        description: "1 boutique, jusqu’à 200 produits",
      },
      {
        "@type": "Offer",
        name: "Franchise",
        price: "249",
        priceCurrency: "EUR",
        description: "1 à 3 boutiques, produits illimités",
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function WelcomePage() {
  const calendlyUrl = getCalendlyUrl();

  return (
    <div className="land-page">
      <FaqJsonLd />
      <ProductJsonLd />
      <CookieBanner />

      <section className="land-top" aria-label="Accueil Margin">
        <div className="land-top__bg" aria-hidden />
        <HeroPops />

        <header className="land-nav">
          <MarginLogo tone="light" />
          <nav className="land-nav__tabs" aria-label="Sections">
            <a href="#features">Vos gains</a>
            <a href="#demo">Démo 30 min</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#affiliation">Affiliation</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="land-nav__actions">
            <Link href="/login" className="land-link land-link--light">
              Se connecter
            </Link>
            <a href="#demo" className="land-btn land-btn--white">
              L’offre
            </a>
          </div>
        </header>

        <div className="land-hero">
          <div className="land-hero__brand">
            <MarginLogoMark className="land-hero__mark" />
            <span>Margin</span>
          </div>
          <h1 className="land-hero__title">
            Du temps.
            <br />
            De la marge.
            <br />
            <em>La tête libre.</em>
          </h1>
          <p className="land-hero__lead">
            Stock relié à votre caisse — sans changer de logiciel.
          </p>
          <ul className="land-hero__gains" aria-label="Vos avantages">
            {GAINS.map((g) => (
              <li key={g.label}>
                <strong>{g.label}</strong>
                <span>{g.text}</span>
              </li>
            ))}
          </ul>
          <div className="land-hero__cta">
            <a href="#demo" className="land-btn land-btn--lime land-btn--lg">
              Profiter de l’offre · 30&nbsp;min
              <span aria-hidden>→</span>
            </a>
            <a href="#tarifs" className="land-btn land-btn--ghost-light">
              Voir les tarifs
            </a>
          </div>
          <p className="land-hero__trust">
            Offre lancement · {LAUNCH_OFFER.short}
          </p>
        </div>

        <div className="land-peak" aria-hidden />
      </section>

      <section
        className="land-features"
        id="features"
        aria-label="Comment ça marche"
      >
        <div className="land-features__bg" aria-hidden />
        <div className="land-features__inner">
          <header className="land-features__head" id="produit">
            <p className="land-features__eyebrow">Ce que vous gagnez</p>
            <h2>Du temps. De l’argent. La tête libre.</h2>
            <p>
              Margin s’occupe du stock pour que vous restiez sur le magasin —
              pas sur un tableur.
            </p>
          </header>

          <ul className="land-reassure__list" aria-label="Résultats attendus">
            {GAINS.map((g) => (
              <li key={g.label}>
                <p className="land-reassure__tag">{g.label}</p>
                <p className="land-reassure__metric">{g.metric}</p>
                <strong>{g.title}</strong>
                <span>{g.detail}</span>
              </li>
            ))}
          </ul>

          <ol className="land-steps">
            {STEPS.map((step) => (
              <li key={step.n} className="land-step">
                <div
                  className={`land-step__visual land-step__visual--${step.visual}`}
                  aria-hidden
                >
                  {step.visual === "caisse" ? (
                    <div className="land-viz land-viz--caisse">
                      <header>
                        <span className="land-viz__dot" />
                        <span>Caisse · Zelty</span>
                        <em>relié</em>
                      </header>
                      <div className="land-viz__ticket">
                        <p className="land-viz__ticket-id">Ticket #1842</p>
                        <ul>
                          <li>
                            <span>2× Croissant</span>
                            <b>3,20 €</b>
                          </li>
                          <li>
                            <span>1× Coca 33 cl</span>
                            <b>1,80 €</b>
                          </li>
                        </ul>
                        <footer>
                          <span>Total</span>
                          <strong>5,00 €</strong>
                        </footer>
                      </div>
                      <p className="land-viz__pulse">→ envoyé à Margin</p>
                    </div>
                  ) : null}
                  {step.visual === "stock" ? (
                    <div className="land-viz land-viz--stock">
                      <header>
                        <span>Stock magasin</span>
                        <em>à jour</em>
                      </header>
                      <ul className="land-viz__rows">
                        <li>
                          <div>
                            <span>Coca 33 cl</span>
                            <small>vente à l’instant</small>
                          </div>
                          <div className="land-viz__delta">
                            <s>42</s>
                            <b>41</b>
                          </div>
                        </li>
                        <li>
                          <div>
                            <span>Croissant</span>
                            <small>2 vendus</small>
                          </div>
                          <div className="land-viz__delta">
                            <s>8</s>
                            <b>6</b>
                          </div>
                        </li>
                      </ul>
                      <div className="land-viz__bar" />
                    </div>
                  ) : null}
                  {step.visual === "count" ? (
                    <div className="land-viz land-viz--count">
                      <header>
                        <span>Vérification rayon</span>
                        <em>en cours</em>
                      </header>
                      <div className="land-viz__count-main">
                        <div className="land-viz__pad">
                          <span>1</span>
                          <span>8</span>
                          <span className="is-ok">✓</span>
                        </div>
                        <div>
                          <p className="land-viz__product">Pain de mie</p>
                          <p className="land-viz__meta">
                            Rayon frais · théorique 16
                          </p>
                          <p className="land-viz__gap">
                            Écart <b>+2</b>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {step.visual === "wa" ? (
                    <div className="land-viz land-viz--wa">
                      <header>
                        <span className="land-viz__wa-avatar" />
                        <div>
                          <strong>Margin</strong>
                          <small>WhatsApp · maintenant</small>
                        </div>
                      </header>
                      <div className="land-viz__bubble">
                        <p>
                          Il reste <b>2</b> laits demi-écrémé.
                        </p>
                        <p>
                          On en commande <b>12</b> ?
                        </p>
                      </div>
                      <div className="land-viz__actions">
                        <span className="is-yes">Oui, commander</span>
                        <span className="is-no">Plus tard</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="land-step__copy">
                  <span className="land-step__n">
                    {step.gain} · étape {step.n}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="land-mid-cta">
            <a href="#demo" className="land-btn land-btn--dark land-btn--lg">
              Profiter de l’offre · 30&nbsp;min
              <span aria-hidden>→</span>
            </a>
            <a href="#tarifs" className="land-btn land-btn--ghost-dark">
              Voir les tarifs
            </a>
          </div>
        </div>
      </section>

      <section
        className="land-demo"
        id="demo"
        aria-label="Configuration WhatsApp offerte"
      >
        <div className="land-demo__glow" aria-hidden />
        <div className="land-demo__inner">
          <div className="land-demo__copy">
            <p className="land-demo__eyebrow">Offert · {LAUNCH_OFFER.setupMinutes} min</p>
            <h2>On vous offre la configuration WhatsApp</h2>
            <p className="land-demo__lead">
              On le fait avec vous en visioconférence — numéro branché, première
              alerte testée. Vous repartez opérationnel, sans frais de mise en
              route.
            </p>
            <ol className="land-demo__beats">
              <li>
                <span className="land-demo__beat-n" aria-hidden>
                  01
                </span>
                <span>
                  <strong>Votre magasin</strong>
                  <em>caisse + rayon en 2 minutes</em>
                </span>
              </li>
              <li>
                <span className="land-demo__beat-n" aria-hidden>
                  02
                </span>
                <span>
                  <strong>Config offerte</strong>
                  <em>WhatsApp, test d’alerte, liste de courses</em>
                </span>
              </li>
              <li>
                <span className="land-demo__beat-n" aria-hidden>
                  03
                </span>
                <span>
                  <strong>Puis −{LAUNCH_OFFER.discountPercent} % le 1er mois</strong>
                  <em>si vous démarrez après l’appel</em>
                </span>
              </li>
            </ol>
          </div>

          <div className="land-demo__book">
            {calendlyUrl ? (
              <div className="land-demo__widget">
                <CalendlyEmbed
                  url={calendlyUrl}
                  title={`Config WhatsApp offerte — ${LAUNCH_OFFER.setupMinutes} min`}
                />
              </div>
            ) : (
              <div className="land-demo__fallback">
                <div className="land-demo__wa" aria-hidden>
                  <span className="land-demo__wa-dot" />
                  <p>
                    Config WhatsApp offerte
                    <small>
                      Avec vous en direct · {LAUNCH_OFFER.setupMinutes} min
                    </small>
                  </p>
                </div>
                <p className="land-demo__fallback-lead">
                  Choisissez un créneau — on configure pour vous, puis −
                  {LAUNCH_OFFER.discountPercent} % le 1er mois si vous démarrez.
                </p>
                <a
                  href="mailto:contact@marginshop.app?subject=Config%20WhatsApp%20offerte%20Margin"
                  className="land-btn land-btn--lime land-btn--lg"
                >
                  Réserver ma config offerte
                  <span aria-hidden>→</span>
                </a>
                <p className="land-demo__fallback-note">
                  Gratuit · sans engagement · réponse sous 24 h
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="land-reassure" aria-label="Vos gains illustrés">
        <div className="land-reassure__bg" aria-hidden />
        <div className="land-reassure__inner">
          <header className="land-reassure__head">
            <p className="land-reassure__eyebrow">Dans le magasin</p>
            <h2>Du temps. De la marge. La tête libre.</h2>
            <p>
              Trois bénéfices concrets, chaque semaine — illustrés comme dans le
              magasin.
            </p>
          </header>
          <ul className="land-features__show" aria-label="Vos avantages">
            {GAINS.map((g) => (
              <li key={g.label}>
                <strong>{g.label}</strong>
                <span>{g.text}</span>
                <div
                  className={`land-gain-viz land-gain-viz--${g.visual}`}
                  aria-hidden
                >
                  <GainViz visual={g.visual} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="land-pricing" id="tarifs" aria-label="Tarifs">
        <div className="land-pricing__bg" aria-hidden />
        <div className="land-pricing__inner">
          <div className="land-pricing__offer">
            <p className="land-pricing__offer-kicker">Offre lancement</p>
            <p className="land-pricing__offer-title">
              −{LAUNCH_OFFER.discountPercent}&nbsp;% le 1er mois
            </p>
            <p className="land-pricing__offer-sub">
              + configuration WhatsApp offerte en {LAUNCH_OFFER.setupMinutes}
              &nbsp;min — pour démarrer sans friction.
            </p>
            <a href="#demo" className="land-btn land-btn--lime">
              Réserver ma config offerte
              <span aria-hidden>→</span>
            </a>
          </div>
          <PricingPlans />
        </div>
      </section>

      <section
        className="land-affiliate"
        id="affiliation"
        aria-label="Programme d’affiliation"
      >
        <div className="land-affiliate__bg" aria-hidden />
        <div className="land-affiliate__inner">
          <header className="land-affiliate__head">
            <p className="land-affiliate__eyebrow">Affiliation</p>
            <h2>Parrainez un commerce — vous gagnez, ils démarrent mieux</h2>
            <p>
              Partagez votre lien après inscription. Simple pour un confrère du
              quartier, un franchiseux ou un installateur caisse.
            </p>
          </header>

          <ul className="land-affiliate__split">
            <li>
              <p className="land-affiliate__who">Vous</p>
              <p className="land-affiliate__metric">
                +{AFFILIATE.rewardMonthsReferrer}&nbsp;mois
              </p>
              <strong>Offert sur votre abo</strong>
              <span>
                Pour chaque filleul qui paie son 1<sup>er</sup> mois — le crédit
                s’accumule dans Réglages → Affiliation.
              </span>
            </li>
            <li>
              <p className="land-affiliate__who">Eux</p>
              <p className="land-affiliate__metric">
                −{AFFILIATE.discountPercentReferee}&nbsp;%
              </p>
              <strong>Sur le 1<sup>er</sup> mois</strong>
              <span>
                Commerce ou Franchise — plus la config WhatsApp offerte en{" "}
                {LAUNCH_OFFER.setupMinutes}&nbsp;min.
              </span>
            </li>
          </ul>

          <p className="land-affiliate__hook">« {LAUNCH_OFFER.hook} »</p>

          <div className="land-affiliate__cta">
            <Link href="/signup" className="land-btn land-btn--dark land-btn--lg">
              Créer mon compte
              <span aria-hidden>→</span>
            </Link>
            <Link href="/login" className="land-btn land-btn--ghost-dark">
              Déjà client · voir mon lien
            </Link>
          </div>
        </div>
      </section>

      <section className="land-faq" id="faq" aria-label="Questions fréquentes">
        <h2>Questions fréquentes</h2>
        <p className="land-faq__lead">
          Ce que les commerçants demandent avant de démarrer.
        </p>
        <div className="land-faq__list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="land-faq__item">
              <summary>{item.q}</summary>
              <div className="land-faq__answer">
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
        <div className="land-mid-cta land-mid-cta--faq">
          <a href="#demo" className="land-btn land-btn--dark land-btn--lg">
            Profiter de l’offre · 30&nbsp;min
            <span aria-hidden>→</span>
          </a>
          <a href="#tarifs" className="land-btn land-btn--ghost-dark">
            Voir les tarifs
          </a>
        </div>
      </section>

      <footer className="land-foot">
        <div className="land-foot__brand">
          <MarginLogo />
          <p>
            © {new Date().getFullYear()} Margin — logiciel de stock pour
            commerces de proximité
          </p>
        </div>
        <div className="land-foot__newsletter max-w-md">
          <p className="mb-2 text-[14px] font-semibold">
            Conseils stock — sans spam
          </p>
          <NewsletterSignupForm variant="light" />
        </div>
        <nav className="land-foot__links" aria-label="Liens pied de page">
          <a href="#tarifs">Tarifs</a>
          <a href="#affiliation">Affiliation</a>
          <a href="#demo">Démo {LAUNCH_OFFER.setupMinutes} min</a>
          <Link href="/login">Se connecter</Link>
          <Link href="/legal/mentions">Mentions légales</Link>
          <Link href="/legal/confidentialite">Confidentialité</Link>
          <Link href="/legal/cgu">CGU</Link>
          <Link href="/legal/cgv">CGV</Link>
          <Link href="/legal/cookies">Cookies</Link>
        </nav>
      </footer>
    </div>
  );
}
