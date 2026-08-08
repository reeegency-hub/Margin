import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation",
  description: "Conditions générales d’utilisation du service Margin.",
};

export default function CguPage() {
  return (
    <article>
      <h1>Conditions générales d’utilisation (CGU)</h1>
      <p className="legal-page__updated">Dernière mise à jour : août 2026</p>

      <h2>Objet</h2>
      <p>
        Les présentes CGU régissent l’accès et l’usage de la plateforme Margin
        (gestion de stock reliée à la caisse, alertes, outils d’équipe).
      </p>

      <h2>Compte</h2>
      <p>
        L’utilisateur s’engage à fournir des informations exactes, à protéger
        ses identifiants et à n’utiliser le service que pour son activité
        professionnelle légitime.
      </p>

      <h2>Usage acceptable</h2>
      <p>
        Il est interdit de contourner la sécurité, d’accéder aux données d’autres
        clients, de surcharger le service de façon abusive ou d’utiliser Margin
        à des fins illicites.
      </p>

      <h2>Disponibilité</h2>
      <p>
        Margin s’efforce d’assurer une disponibilité raisonnable, sans garantie
        d’absence d’interruption. Des maintenances peuvent être nécessaires.
      </p>

      <h2>Données client</h2>
      <p>
        Le client reste propriétaire des données de son commerce. Margin les
        traite pour fournir le service, conformément à la politique de
        confidentialité.
      </p>

      <h2>Résiliation / suspension</h2>
      <p>
        Margin peut suspendre un compte en cas de non-paiement, d’usage abusif
        ou de risque de sécurité. Le client peut cesser d’utiliser le service
        selon les modalités d’abonnement (voir CGV).
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:contact@marginshop.app">contact@marginshop.app</a>
      </p>
    </article>
  );
}
