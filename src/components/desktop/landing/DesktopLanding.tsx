import Link from "next/link";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { MarginLogo, MarginLogoMark } from "@/components/brand/MarginLogo";
import { CookieBanner } from "@/components/legal/CookieBanner";
import { NewsletterSignupForm } from "@/components/marketing/NewsletterSignupForm";
import {
  CalendlyEmbed,
} from "@/components/marketing/CalendlyEmbed";
import { AFFILIATE, LAUNCH_OFFER } from "@/lib/affiliate";
import { getCalendlyUrl } from "@/lib/calendly";
import { supportMailto } from "@/lib/support";
import { SETUP_FEE_EUR } from "@/lib/plans";

/** Landing desktop — figée. Ne pas modifier pour le chantier mobile. */

const STEPS = [
  {
    n: "1",
    title: "La caisse fait le travail",
    text: "Chaque ticket de caisse met à jour votre stock. Rien à ressaisir le soir.",
    gain: "Temps",
    visual: "caisse",
  },
  {
    n: "2",
    title: "Vous voyez ce qu’il reste vraiment",
    text: "Fini les commandes au flair. Le stock affiché est celui du rayon.",
    gain: "Argent",
    visual: "stock",
  },
  {
    n: "3",
    title: "La vérification rayon en 10 minutes",
    text: "Comptez, corrigez les écarts, repartez. Pas de feuille à trimballer.",
    gain: "Temps",
    visual: "count",
  },
  {
    n: "4",
    title: "L’alerte arrive avant la rupture",
    text: "Un message WhatsApp vous prévient à temps pour recommander.",
    gain: "CA",
    visual: "wa",
  },
] as const;

const GAINS = [
  {
    label: "Temps",
    metric: "3 à 5 h",
    title: "Rendues chaque semaine",
    text: "Plus de ressaisie du soir",
    detail:
      "Plus de ressaisie du soir. Le ticket de caisse met le stock à jour tout seul.",
    visual: "temps" as const,
  },
  {
    label: "Argent",
    metric: "Moins de ruptures",
    title: "Protège votre marge",
    text: "Avant que le client le remarque",
    detail:
      "Vous voyez ce qui manque avant que le client le remarque à votre place.",
    visual: "argent" as const,
  },
  {
    label: "Rush",
    metric: "1 alerte, pas 1 liste",
    title: "Même en plein rush",
    text: "WhatsApp avant la rupture",
    detail:
      "WhatsApp vous prévient avant la rupture — pas de tableau à consulter.",
    visual: "serenite" as const,
  },
] as const;

function GainViz({ visual }: { visual: (typeof GAINS)[number]["visual"] }) {
  if (visual === "temps") {
    return (
      <>
        <header>
          <span>Ce soir</span>
          <em>fini</em>
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
            <span>Commerce fermé</span>
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
        Décision en deux clics
      </p>
    </>
  );
}

const FAQ_ITEMS = [
  {
    q: "Vous remplacez ma caisse ?",
    a: "Non. Margin se branche sur la caisse que vous avez déjà (Zelty, Cashpad, Square, SumUp/Tiller, Lightspeed, L’Addition…). Vous gardez votre caisse et vos habitudes.",
  },
  {
    q: "Quelles caisses sont compatibles ?",
    a: "Les principales caisses utilisées en commerce de proximité en France. Si la vôtre n’est pas listée, écrivez-nous avant de vous inscrire — réponse honnête sur la faisabilité.",
  },
  {
    q: "C’est quoi le setup à 400 € ?",
    a: `C’est le branchement technique entre votre caisse et Margin, fait une seule fois. Inclus dans le plan Franchise. En Commerce, vous le faites vous-même ou via un prestataire — comptez environ ${SETUP_FEE_EUR} € si vous préférez être accompagné.`,
  },
  {
    q: "Quelle différence entre Commerce et Franchise ?",
    a: "Commerce couvre 1 boutique jusqu’à 200 produits, setup caisse à votre charge. Franchise couvre 1 à 3 boutiques, produits illimités, gestion d’équipe, et le setup caisse est inclus.",
  },
  {
    q: "WhatsApp est obligatoire ?",
    a: "Non, mais recommandé — c’est le canal le plus rapide pour recevoir une alerte de rupture en plein rush. Sans WhatsApp configuré, vous gardez l’accès complet à l’app et voyez vos alertes depuis le tableau de bord.",
  },
  {
    q: "Mes données, si j’ai plusieurs boutiques ?",
    a: "Chaque boutique a ses propres données, cloisonnées. Le plan Franchise permet de piloter jusqu’à 3 boutiques depuis un seul compte, sans mélanger les stocks.",
  },
  {
    q: "Combien de temps pour être opérationnel ?",
    a: `Le stock et l’équipe peuvent être importés en quelques minutes via le Copilote (CSV ou PDF). Le branchement caisse dépend de votre caisse : pris en charge et inclus en Franchise ; environ ${LAUNCH_OFFER.setupMinutes} minutes à ${SETUP_FEE_EUR} € de setup en Commerce selon l’accompagnement choisi.`,
  },
] as const;

/** Scènes §6 — preuve sans logos / chiffres clients fictifs */
const SCENES = [
  {
    label: "Temps",
    text: "12h15, rush du midi. La caisse encaisse, le stock se met à jour tout seul. Personne n’a le temps d’y penser — c’est déjà fait.",
    visual: "temps" as const,
  },
  {
    label: "Argent",
    text: "Le produit qui dort en réserve depuis 3 mois ? Vous le voyez avant qu’il finisse à la benne.",
    visual: "argent" as const,
  },
  {
    label: "Rush",
    text: "18h40, l’alerte WhatsApp arrive. Une commande, deux clics, la rupture n’aura pas lieu.",
    visual: "serenite" as const,
  },
] as const;

const POPS = [
  {
    kind: "sale" as const,
    place: "tl",
    delay: "0s",
    tag: "Temps",
    title: "Caisse → stock",
    body: "Ticket #1842 · stock à jour",
    time: "à l’instant",
  },
  {
    kind: "wa" as const,
    place: "tr",
    delay: "0.9s",
    tag: "Rush",
    title: "Alerte WhatsApp",
    body: "Il reste 2 laits. Commander 12 ?",
    time: "maintenant",
  },
  {
    kind: "stock" as const,
    place: "ml",
    delay: "1.8s",
    tag: "Argent",
    title: "Marge protégée",
    body: "Rupture Coca évitée",
    time: "il y a 40 s",
  },
  {
    kind: "wa" as const,
    place: "mr",
    delay: "2.7s",
    tag: "Temps",
    title: "Décision claire",
    body: "Oui · commande en 1 tap",
    time: "il y a 1 min",
  },
  {
    kind: "stock" as const,
    place: "bl",
    delay: "3.6s",
    tag: "Rush",
    title: "Rush 12h15",
    body: "Rayon OK · seuils verts",
    time: "à jour",
  },
  {
    kind: "sale" as const,
    place: "br",
    delay: "4.5s",
    tag: "Argent",
    title: "Moins de stock mort",
    body: "Commande calée sur les ventes",
    time: "il y a 2 min",
  },
  {
    kind: "wa" as const,
    place: "tc",
    delay: "5.4s",
    tag: "Rush",
    title: "Seuil atteint",
    body: "Pain de mie · commander ?",
    time: "il y a 3 min",
  },
  {
    kind: "sale" as const,
    place: "bc",
    delay: "6.3s",
    tag: "Temps",
    title: "Zéro ressaisie",
    body: "Soirée libre · stock OK",
    time: "ce soir",
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

export default function DesktopLanding() {
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
            <a href="#produit">Produit</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#demo">Offre</a>
            <a href="#demo">Config offerte</a>
          </nav>
          <div className="land-nav__actions">
            <Link href="/login" className="land-btn land-btn--white">
              Connexion
            </Link>
          </div>
        </header>

        <div className="land-hero">
          <div className="land-hero__core">
            <div className="land-hero__brand">
              <MarginLogoMark className="land-hero__mark" />
              <span>Margin</span>
            </div>
            <h1 className="land-hero__title">
              Votre stock se met à jour à chaque vente.
            </h1>
            <p className="land-hero__lead">
              Connecté à la caisse que vous avez déjà. Zéro ressaisie le soir.
            </p>
            <div className="land-hero__cta">
              <a href="/signup" className="land-btn land-btn--lime land-btn--lg">
                Créer un compte
                <span aria-hidden>→</span>
              </a>
              <a href="#tarifs" className="land-btn land-btn--ghost-light">
                Voir les tarifs
              </a>
            </div>
            <p className="land-hero__trust">
              Programme pilote · places limitées · config WhatsApp offerte
            </p>
          </div>
        </div>

        <div className="land-peak" aria-hidden>
          <span className="land-peak__glow" />
          <svg
            className="land-peak__svg"
            viewBox="0 0 280 56"
            preserveAspectRatio="none"
          >
            <path
              className="land-peak__aura"
              d="M20 56 L140 4 L260 56 Z"
            />
            <path
              className="land-peak__fill"
              d="M0 56 L140 0 L280 56 Z"
            />
            <path
              className="land-peak__ridge"
              d="M70 56 L140 12 L210 56"
              fill="none"
            />
          </svg>
        </div>
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
            <h2>Trois problèmes réglés. Pas trente fonctions en plus.</h2>
            <p>
              Margin ne remplace rien de ce que vous utilisez déjà. Il branche
              votre stock dessus.
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
                        <span>Stock commerce</span>
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

          <div className="land-mid-cta" id="offre">
            <div className="land-mid-cta__copy">
              <h2>Programme pilote · 5 commerces</h2>
              <p>
                Places limitées. Configuration WhatsApp offerte, en{" "}
                {LAUNCH_OFFER.setupMinutes} minutes.
              </p>
            </div>
            <a href="/signup" className="land-btn land-btn--dark land-btn--lg">
              Créer un compte
              <span aria-hidden>→</span>
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
            <p className="land-demo__eyebrow">
              {LAUNCH_OFFER.setupMinutes} min
            </p>
            <h2>30 minutes pour être opérationnel</h2>
            <p className="land-demo__lead">
              On configure votre WhatsApp ensemble, en direct. Pas de formation
              à rallonge.
            </p>
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
                  Pas de créneau qui vous convient ? Écrivez-nous, on
                  s&apos;organise.
                </p>
                <a
                  href={supportMailto("Config WhatsApp offerte Margin")}
                  className="land-btn land-btn--lime land-btn--lg"
                >
                  Réserver mes 30 minutes
                  <span aria-hidden>→</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="land-reassure" aria-label="Dans le commerce">
        <div className="land-reassure__bg" aria-hidden />
        <div className="land-reassure__inner">
          <header className="land-reassure__head">
            <p className="land-reassure__eyebrow">Dans le commerce</p>
            <h2>Ce que ça change dans une journée</h2>
            <p>Trois moments où le stock suit la caisse — sans ressaisie.</p>
          </header>
          <ul className="land-features__show" aria-label="Scènes">
            {SCENES.map((s) => (
              <li key={s.label}>
                <strong>{s.label}</strong>
                <span>{s.text}</span>
                <div
                  className={`land-gain-viz land-gain-viz--${s.visual}`}
                  aria-hidden
                >
                  <GainViz visual={s.visual} />
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
            <p className="land-pricing__offer-kicker">Programme pilote · 5 commerces</p>
            <p className="land-pricing__offer-title">
              Places limitées · configuration WhatsApp offerte (
              {LAUNCH_OFFER.setupMinutes} min)
            </p>
            <a href="/signup" className="land-btn land-btn--lime">
              Créer un compte
              <span aria-hidden>→</span>
            </a>
          </div>
          <PricingPlans showSetupNote={false} />
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
            <h2>Recommandez Margin, gagnez du temps offert</h2>
            <p>
              Un commerçant que vous parrainez ? +
              {AFFILIATE.rewardMonthsReferrer} mois offert pour vous, −
              {AFFILIATE.discountPercentReferee}&nbsp;% le premier mois pour
              lui.
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

          <div className="land-affiliate__cta">
            <a href="/signup" className="land-btn land-btn--dark land-btn--lg">
              Créer un compte
              <span aria-hidden>→</span>
            </a>
            <Link href="/login" className="land-btn land-btn--ghost-dark">
              Je suis déjà client
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
          <a href="/signup" className="land-btn land-btn--dark land-btn--lg">
            Créer un compte
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
            Margin — le stock de votre commerce, relié à votre caisse.
            <br />© {new Date().getFullYear()} Margin
          </p>
        </div>
        <div className="land-foot__newsletter max-w-md">
          <p className="mb-2 text-[14px] font-semibold">
            Conseils stock — sans spam
          </p>
          <NewsletterSignupForm variant="light" />
          <nav className="land-foot__links" aria-label="Liens pied de page">
            <a href="#tarifs">Tarifs</a>
            <a href="#affiliation">Affiliation</a>
            <a href="#demo">Offre</a>
            <Link href="/signup">Créer un compte</Link>
            <Link href="/login">Se connecter</Link>
            <Link href="/legal/mentions">Mentions légales</Link>
            <Link href="/legal/confidentialite">Confidentialité</Link>
            <Link href="/legal/cgu">CGU</Link>
            <Link href="/legal/cgv">CGV</Link>
            <Link href="/legal/cookies">Cookies</Link>
            <a href={supportMailto()}>Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
