import type { Metadata } from "next";
import { LEGAL, legalOrPlaceholder } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du service Margin.",
};

export default function MentionsPage() {
  return (
    <article>
      <h1>Mentions légales</h1>
      <p className="legal-page__updated">Dernière mise à jour : août 2026</p>

      <h2>Éditeur</h2>
      <p>
        Le site et le service <strong>{LEGAL.tradeName}</strong> (
        {LEGAL.domain}) sont édités par&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Raison sociale</strong> :{" "}
          {legalOrPlaceholder(LEGAL.companyName, "raison sociale")}
        </li>
        <li>
          <strong>Forme juridique / capital</strong> :{" "}
          {legalOrPlaceholder(LEGAL.legalForm, "forme")}
          {LEGAL.capital ? ` — capital ${LEGAL.capital}` : ""}
        </li>
        <li>
          <strong>Siège social</strong> :{" "}
          {legalOrPlaceholder(LEGAL.address, "adresse")}
        </li>
        <li>
          <strong>SIRET</strong> :{" "}
          {legalOrPlaceholder(LEGAL.siret, "SIRET")}
        </li>
        <li>
          <strong>RCS</strong> : {legalOrPlaceholder(LEGAL.rcs, "RCS")}
        </li>
        <li>
          <strong>Directeur de la publication</strong> :{" "}
          {legalOrPlaceholder(
            LEGAL.publicationDirector,
            "directeur de publication"
          )}
        </li>
        <li>
          <strong>Contact</strong> :{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
        </li>
      </ul>
      <p className="legal-page__note">
        Avant toute facturation en production, renseignez l’identité légale
        dans <code>src/lib/legal.ts</code>.
      </p>

      <h2>Hébergement</h2>
      <p>
        Hébergement applicatif : <strong>{LEGAL.host.name}</strong>
        <br />
        {LEGAL.host.address}
        <br />
        <a href={LEGAL.host.website} rel="noopener noreferrer" target="_blank">
          {LEGAL.host.website}
        </a>
      </p>
      <p>
        Base de données : prestataire cloud Postgres (Neon / Supabase selon
        l’environnement de production).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L’ensemble des contenus (textes, marques, interfaces, code) est protégé.
        Toute reproduction non autorisée est interdite.
      </p>
    </article>
  );
}
