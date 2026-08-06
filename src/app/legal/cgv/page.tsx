import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Conditions générales de vente des abonnements Margin.",
};

export default function CgvPage() {
  return (
    <article>
      <h1>Conditions générales de vente (CGV)</h1>
      <p className="legal-page__updated">Dernière mise à jour : août 2026</p>

      <h2>Offres</h2>
      <p>
        Margin propose des abonnements SaaS (notamment formules{" "}
        <strong>Commerce</strong> et <strong>Franchise</strong>), facturés
        mensuellement ou annuellement, selon la grille affichée au moment de
        la souscription. Les fonctionnalités et plafonds (boutiques, produits)
        sont ceux décrits sur la page tarifs.
      </p>

      <h2>Commande et paiement</h2>
      <p>
        Le paiement est traité par Stripe. L’abonnement est activé après
        validation du paiement (sauf période d’essai éventuelle annoncée
        explicitement). Les prix s’entendent hors taxes sauf mention contraire.
      </p>

      <h2>Branchement caisse</h2>
      <p>
        Sur <strong>Commerce</strong>, le branchement de la caisse est à la
        charge du client. Sur <strong>Franchise</strong>, le branchement caisse
        par Margin est inclus selon les conditions commerciales en vigueur.
      </p>

      <h2>Renouvellement et résiliation</h2>
      <p>
        L’abonnement se renouvelle automatiquement pour la période choisie,
        sauf résiliation via le portail client / demande à l’équipe Margin
        avant la prochaine échéance. Aucun remboursement au prorata sauf
        disposition légale contraire ou accord écrit.
      </p>

      <h2>Changement de formule</h2>
      <p>
        Un passage de Commerce à Franchise (ou l’inverse) peut être demandé
        auprès de l’équipe Margin ; les conditions tarifaires et techniques
        applicables seront confirmées avant bascule.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Margin fournit un outil d’aide à la gestion de stock. Le client reste
        responsable de ses décisions d’achat, de ses inventaires et du respect
        de la réglementation de son activité. La responsabilité de Margin est
        limitée, dans les limites légales, au montant des sommes payées sur les
        12 derniers mois.
      </p>

      <h2>Droit applicable</h2>
      <p>Droit français. Tribunaux compétents selon les règles en vigueur.</p>
    </article>
  );
}
