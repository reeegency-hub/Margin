import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et protection des données Margin.",
};

export default function ConfidentialitePage() {
  return (
    <article>
      <h1>Politique de confidentialité</h1>
      <p className="legal-page__updated">Dernière mise à jour : août 2026</p>

      <h2>Responsable du traitement</h2>
      <p>
        Margin traite des données personnelles pour fournir le service SaaS de
        gestion de stock et d’abonnement. Contact&nbsp;:{" "}
        <a href="mailto:contact@marginshop.app">contact@marginshop.app</a>.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>Compte : nom, e-mail, mot de passe (hashé), boutique</li>
        <li>Newsletter : e-mail et consentement (inscription compte ou formulaire site)</li>
        <li>Facturation : données transmises via Stripe (nous ne stockons pas le numéro de carte)</li>
        <li>Usage produit : stock, ventes synchronisées, alertes, paramètres caisse</li>
        <li>Techniques : logs, cookies de session, données de navigation si analytics activé</li>
      </ul>

      <h2>Finalités et bases légales</h2>
      <ul>
        <li>Exécution du contrat : fourniture du service, support, facturation</li>
        <li>Intérêt légitime : sécurité, amélioration produit, prévention des abus</li>
        <li>Consentement : cookies non essentiels / newsletter et communications marketing</li>
        <li>Obligation légale : conservation comptable</li>
      </ul>

      <h2>Durée de conservation</h2>
      <p>
        Données de compte et d’activité : durée du contrat + délais légaux.
        Données de facturation : selon obligations comptables (en général 10
        ans).
      </p>

      <h2>Destinataires</h2>
      <p>
        Sous-traitants techniques (hébergement, paiement Stripe, e-mail
        transactionnel, messagerie WhatsApp Business le cas échéant), dans la
        limite nécessaire au service.
      </p>

      <h2>Vos droits (RGPD)</h2>
      <p>
        Accès, rectification, effacement, limitation, portabilité,
        opposition — et réclamation auprès de la CNIL. Demande&nbsp;:{" "}
        <a href="mailto:contact@marginshop.app">contact@marginshop.app</a>.
      </p>

      <h2>Transferts hors UE</h2>
      <p>
        Si un sous-traitant traite des données hors UE, des garanties
        appropriées (clauses types, etc.) seront mises en place.
      </p>
    </article>
  );
}
