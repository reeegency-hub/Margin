import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique cookies",
  description: "Informations sur les cookies utilisés par Margin.",
};

export default function CookiesPage() {
  return (
    <article>
      <h1>Politique cookies</h1>
      <p className="legal-page__updated">Dernière mise à jour : août 2026</p>

      <h2>Qu’est-ce qu’un cookie ?</h2>
      <p>
        Un cookie est un petit fichier déposé sur votre appareil lors de la
        visite du site ou de l’usage de l’application.
      </p>

      <h2>Cookies essentiels</h2>
      <p>
        Nécessaires au fonctionnement du service (session de connexion,
        sécurité, préférences techniques). Ils ne requièrent pas de
        consentement.
      </p>

      <h2>Cookies optionnels</h2>
      <p>
        Mesure d’audience, marketing ou outils tiers : uniquement avec votre
        consentement. Une bannière en bas de page permet d’accepter ou de
        limiter aux cookies essentiels (<code>margin_cookie_consent</code>).
      </p>

      <h2>Gestion</h2>
      <p>
        Vous pouvez supprimer ou bloquer les cookies via les paramètres de
        votre navigateur. Sans cookies essentiels, certaines fonctions
        (connexion) peuvent être indisponibles.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:contact@marginshop.app">contact@marginshop.app</a>
      </p>
    </article>
  );
}
