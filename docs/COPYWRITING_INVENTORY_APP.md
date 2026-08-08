# MarginShop — Inventaire copy FR (hors landing)

**Périmètre :** produit hors `src/app/welcome/page.tsx` et CSS landing-only.  
**Exclus :** logs techniques, fixtures de tests, commentaires.  
**Date :** 2026-08-08  
**Complément landing :** `copywriting-margin-v1.md` (racine Downloads) / brief `docs/COPYWRITING_BRIEF_CLAUDE.md`.

---

## 1. Auth — Login

### `src/components/auth/LoginForm.tsx`
| String | Role |
|---|---|
| `Session expirée. Reconnectez-vous.` | error (`error=session`) |
| `Votre abonnement est en pause. Contactez-nous pour le réactiver.` | error (`error=billing`) |
| `Accès admin refusé.` | error (`error=admin`) |
| `Base temporairement saturée (quota Neon). Réessayez plus tard ou contactez Margin.` | error |
| `Service momentanément indisponible. Réessayez dans quelques minutes.` | error |
| `Email ou mot de passe incorrect.` | error |
| `Paiement reçu` / `Connexion` | title |
| `Entrez le mot de passe choisi à l’inscription pour ouvrir votre commerce.` | lead (post-paiement) |
| `Retour au commerce — email et mot de passe de votre compte.` | lead |
| `Email` / `Mot de passe` | field label |
| `Connexion…` / `Se connecter` | CTA / loading |
| `Connexion démo (local)` | link (dev) |
| `Retour à l’accueil` | link |

### `src/app/login/page.tsx`
| String | Role |
|---|---|
| `Connexion…` | loading |

---

## 2. Auth — Signup + OTP

### `src/components/auth/SignupForm.tsx`
| String | Role |
|---|---|
| `Démarrez avec Margin` | title |
| `{plan} — {bestFor}. Sans changer de caisse · −{n} % le premier mois.` | lead |
| `Parrainage appliqué.` | note |
| `Un code à usage unique confirme votre email avant le paiement.` | helper |
| `Entrez le code reçu, puis on finalise.` | helper |
| `Sans changer de caisse · −{n} % le premier mois.` | lead (fallback) |
| `Nom du commerce` / `Votre email` / `Mot de passe (8 caractères min.)` / `Téléphone` / `Formule` / `Paiement` / `Code à 6 chiffres` | field labels |
| `Épicerie du coin` / `vous@email.fr` | placeholders |
| `Recevoir le code par` / `Email` / `SMS` | segment |
| `Tous les mois` / `Une fois par an (−20 %)` | select |
| `Recevoir les conseils stock Margin (1–2 e-mails / mois). Désinscription en 1 clic.` | checkbox |
| `Code envoyé par SMS — valable 10 min.` / `Code envoyé par email — valable 10 min.` | flash |
| `Nom, email et mot de passe (8+ caractères) requis.` | error |
| `Indiquez votre numéro pour recevoir le SMS.` | error |
| `Envoi…` / `Création…` / `Commencer` / `Créer mon compte` | CTA |
| `Déjà un compte ?` / `Se connecter` | link |

### `src/lib/signup-otp.ts`
| String | Role |
|---|---|
| `Email invalide.` | error |
| `SMS non configuré (Twilio). Utilisez l’email.` | error |
| `Envoi email OTP non configuré (RESEND_API_KEY).` | error |
| `Numéro invalide (ex. +33612345678).` | error |
| `Cet email est déjà utilisé. Connectez-vous plutôt.` | error |
| `Code à 6 chiffres requis.` | error |
| `Demandez d’abord un code de vérification.` | error |
| `Code déjà utilisé. Demandez-en un nouveau.` | error |
| `Code expiré. Demandez-en un nouveau.` | error |
| `Trop d’essais. Demandez un nouveau code.` | error |
| `Le code n'est pas valide. Vérifiez et réessayez.` | error |
| `{code} — code Margin` | email subject |
| `Votre code de vérification Margin : {code}` / `Valable 10 minutes.` / `Ne le partagez pas.` | email body |
| `Margin : votre code est {code} (valable 10 min).` | SMS |

### `src/app/actions.ts` (signup)
| String | Role |
|---|---|
| `Inscription refusée.` / rate-limit OTP | error |
| `Cet email est déjà utilisé. Connectez-vous plutôt.` | error |
| `Choisissez un plan.` / `Période invalide.` | error |

---

## 3. Plans & offre

### `src/lib/plans.ts`
| String | Role |
|---|---|
| `Commerce` / `Franchise` | plan name |
| `1 boutique · jusqu’à 200 produits` | bestFor |
| `1 à 3 boutiques · produits illimités` | bestFor |
| Descriptions Starter/Pro (caisse, WhatsApp, setup) | description |
| `Stock relié à votre caisse` | feature |
| `Alertes WhatsApp avant rupture` | feature |
| `Vérification rayon` | feature |
| `Liste de courses automatique` | feature |
| `Setup caisse non inclus — … ~400 € si accompagnement` | feature (struck) |
| `Tout Commerce` | feature |
| `Setup caisse inclus — jusqu’à 400 € économisés par boutique` | feature |
| `Équipe : planning et pointage` | feature |
| `Accompagnement prioritaire` | feature |
| `Démarrer Commerce` / `Démarrer Franchise` | CTA |

### `src/lib/affiliate.ts`
| String | Role |
|---|---|
| `−20 % le 1er mois + on configure WhatsApp avec vous en 30 min` | LAUNCH_OFFER.hook |
| `−20 % le 1er mois · WhatsApp configuré en 30 min` | LAUNCH_OFFER.short |

### `src/components/pricing/PricingPlans.tsx`
| String | Role |
|---|---|
| `Mensuel` / `Annuel` / `−20 % / an` | toggle |
| `Voir plus` / `Voir moins` | CTA |
| `Branchement caisse — non inclus sur Commerce…` | footnote (si activée) |

---

## 4. Onboarding

### `src/components/onboarding/OnboardingWizard.tsx`
| String | Role |
|---|---|
| `WhatsApp du commerce` / `Votre stock` / `Votre caisse` | step title |
| `WhatsApp` / `Stock` / `Suite` | step short |
| `Pour les alertes rupture — comme un SMS.` | blurb |
| `Photo, PDF, ou passez — la caisse peut suffire.` | blurb |
| `Ensuite on vous guide pour brancher la caisse.` | blurb |
| `Votre équipe` / `Votre caisse` (after-path) | next steps |
| `Votre numéro WhatsApp` | title |
| `Vos produits (optionnel)` | title |
| `Déposez une photo ou un PDF` / `Analyser ma liste` | CTA |
| `C’est bon, {restaurantName}` | title |
| `Entrer dans mon commerce` | CTA final |

### `src/components/onboarding/OnboardingWidget.tsx`
| String | Role |
|---|---|
| `Guide de démarrage` | title |
| `Tout est fait. Beau travail.` | done |
| `Continuer` | CTA |

---

## 5. App shell / nav

### `src/lib/nav.ts` — source de vérité
| Label | Hint |
|---|---|
| `Accueil` | `Vue du jour` |
| `Stock` | `Quantités du commerce` |
| → `Niveaux & produits` | `Stock + fiches` |
| → `Import catalogue` | `Charger des produits` |
| → `Vérification` | `Corriger le rayon` |
| `Courses` | `Listes à passer` |
| `Coûts` | `Factures, hausses, pertes` |
| `Équipe` | `Personnes & planning` |
| → `Membres` | `Pointer le service` |
| → `Planning` | `Voir / retirer` |
| `Commerce` | `Caisse & livraison` |
| → `Caisse` | `Brancher la caisse` |
| → `Livraison` | `Plateformes (optionnel)` |

### Chrome (`AppChrome`, `BottomNav`, `Topbar`)
| String | Role |
|---|---|
| `Passer à Franchise` | upgrade CTA |
| `Aide commerce` | help |
| `Réglages` / `Déconnexion` | account |
| `Mode téléphone` / `Quitter` | force-mobile |
| `Fondateur` / `Marketing` / `Newsletter` | admin nav |
| `Envoyer sur WhatsApp` / `Envoyer la liste` / `Alerter l’équipe` / `Message test` / `Contacter Margin` | WA CTAs |

---

## 6. Accueil / Guide première heure

### Sources
- `src/lib/first-hour.ts` — checklist & parcours
- `src/lib/guide-spotlight-copy.ts` — spotlights
- `src/lib/page-tours.ts` — tours page
- `src/lib/home-focus.ts` — priorités jour/semaine/mois
- `src/components/home/FirstHourGuide.tsx` — UI fullscreen

### FirstHourGuide (UI)
| String | Role |
|---|---|
| `Mise en route commerce` | eyebrow |
| `Configurez Margin une fois.` + `Ensuite, le commerce tourne tout seul.` | H1 |
| `Stock, équipe, courses, coûts, caisse — et le Copilote…` | lead |
| `Alertes WhatsApp quand ça casse` / listes courses / hausses | bullets |
| `Produit à part entière` / `Copilote Margin` | section |
| `À faire maintenant` / `Votre commerce est prêt.` / `Entrer dans le tableau de bord` | CTA / done |

### Checklist labels (first-hour)
`WhatsApp du commerce` · `Première liste de courses` · `Remplir le stock` · `Compter le rayon` · `Ajouter l’équipe` · `Planifier les créneaux` · `Pointer Présent / Absent` · `Importer une facture fournisseur` · `Coût matière des best-sellers` · `Inventaire de la semaine` · `Comparer & négocier (mensuel)` · `Livraison (optionnel)` · `Brancher la caisse`

### Focus hub (exemples `home-focus.ts`)
| String | Role |
|---|---|
| `Hausse fournisseur` / `Voir les hausses` | title / CTA |
| `Caisse à vérifier` / `Ouvrir la caisse` | title / CTA |
| `Stock bas` / `Courses à faire` / `Ouvrir les courses` | title / CTA |
| `Inventaire de la semaine` / `Lancer la vérification` | title / CTA |
| `Rien d’urgent` / `Voir le stock` | empty |

### MobileHome / DashboardView
| String | Role |
|---|---|
| `Une priorité à traiter, puis le pouls du commerce.` | guide |
| `À faire maintenant` / `Rien d’urgent` / `Autres priorités` / `Activité` / `Pouls` | sections |
| `Les ventes apparaîtront ici` | empty |

---

## 7. Stock

### `src/app/(app)/ingredients/page.tsx`
| String | Role |
|---|---|
| `Stock` | title |
| `Quantités du commerce — si ça ne colle pas, vérification.` | guide |
| `Aucun produit` / `N sous seuil` / `N à nettoyer` / `Stock sous contrôle` | hub |
| `Brancher la caisse` / `Ouvrir les courses` / `Vérifier le rayon` | CTA |

### Autres
| File | Exemples |
|---|---|
| `StockSheetPanel` | `Liste enregistrée dans Courses.` / warn WhatsApp manquant |
| `IngredientAddPanel` | `quantité manquante` / `Corriger et créer` |
| `CatalogCleanupPanel` | `Rien à corriger pour le moment` / flashs fusion |
| `lib/catalog/issues.ts` | titres issues (doublons, prix 0, unité…) |
| `lib/stock-engine.ts` | `Rupture déjà atteinte.` / estim. rupture / erreurs WA |
| `lib/channel-labels.ts` | `Sur place` / `À emporter` / `Connectée` / `Déconnectée` |

---

## 8. Vérification

### `src/app/(app)/inventory/page.tsx`
| String | Role |
|---|---|
| `Vérification` / `Vérifiez le rayon, puis validez.` | title / guide |
| `Stock corrigé.` | flash |
| `Vérification en cours` / `N à compter d’abord` / `Pas encore de stock` / `Compter le rayon` | hub |
| `Ouvrir le stock` / `Continuer` / `Commencer` | CTA |

### `inventory/[id]`
| String | Role |
|---|---|
| `Vérifiez le rayon` / `Vérification terminée` | title |
| `Validé` | status |

---

## 9. Courses

### `src/app/(app)/orders/page.tsx`
| String | Role |
|---|---|
| `Courses` | title |
| `Ce qu’il manque / risque sous 2–3 jours — une liste.` | guide |
| `Liste mise à jour.` / `Course marquée faite.` | flash |
| `Rien à racheter` / `N ligne(s) à faire` | hub |
| `Marquer comme fait` / `Actualiser` | CTA |

### Templates WA
| File | String |
|---|---|
| `lib/wa-link.ts` | `{restaurant} — Liste de courses…` / message fournisseur |
| `lib/order-labels.ts` | `À faire` / `Fait` / `Réceptionné` / `Annulé` / `Brouillon` |
| `lib/orders-engine.ts` | `Rien à racheter pour les 2–3 prochains jours.` |

---

## 10. Coûts

### `src/app/(app)/costs/page.tsx`
| String | Role |
|---|---|
| `Factures → hausses → négocier. Pertes après vérification.` | guide |
| `Facture importée.` | flash |
| Tabs `Facture` / `Hausses` / `Matière` / `Pertes` / `Négocier` | nav |
| `Aucune hausse ≥ 5 %` / empties matière & comparatif | empty |
| Pills `Dernière OK` / `À importer` / `Best-sellers` / `Inventaire dû` / `Mensuel` | badge |
| CTAs `Importer` / `Voir les hausses` / `Lancer la vérification` / `Nouvelle facture` | CTA |

---

## 11. Équipe

### `employees/page.tsx`
| String | Role |
|---|---|
| `Qui travaille aujourd’hui ?` / `Pointer Présent ou Absent.` | title / guide |
| `Nom mis à jour.` / `Créneaux du jour créés — vous pouvez pointer.` | flash |
| `Planifier aujourd’hui` / `Ajouter l’équipe` | CTA |
| `Aucun membre d’équipe…` | empty |
| Roles `Caisse` / `Rayon` / `Livreur` | label |

### Planning
| String | Role |
|---|---|
| `Aujourd’hui d’abord, puis la semaine…` | guide |
| `Rien aujourd’hui — ajoutez un créneau ci-dessous.` | empty |
| `Rien de prévu cette semaine.` | empty |

---

## 12. Caisse (`kiosks`)

| String | Role |
|---|---|
| `Caisse` / `Branchez le logiciel — les ventes mettent le stock à jour.` | title / guide |
| Hub `N produits à valider` / `Caisse synchronisée` / `En attente de première vente` / `Caisse à brancher` | title |
| `Adresse à coller dans votre caisse` / `Coller la clé / token API` | field |
| Status `Connectée` / `En attente de première vente` | status |

---

## 13. Livraison

| String | Role |
|---|---|
| `Livraison (optionnel)` / `Uber / Deliveroo et livreurs…` | title / guide |
| `Clés enregistrées.` / `Livreur ajouté.` / `Connexion OK` | flash |
| Hub `N coupures` / `Plateforme hors ligne` / `Livraison optionnelle` / `Plateformes OK` | title |
| `Remettre en ligne` / `Voir la caisse` | CTA |
| `Intégrations & livreurs` / `Clés API et équipe livraison.` | section |

---

## 14. Réglages

### Page
| String | Role |
|---|---|
| `Vos réglages` | title |
| `Chaque onglet a un guide popup — cliquez « Comprendre cet onglet »…` | guide |
| Hub `Paiement à mettre à jour` / `WhatsApp du commerce` / `Réglages OK` | title |
| `Enregistré.` | flash |

### Tabs (`SettingsTabs`)
`Simple` · `Affiliation` · `Connexions` · `Avancé`  
Sections : `Essentiel` / `WhatsApp du commerce` / `Abonnement` / `Facturation` / BYOK / Webhook  
CTA guide : `Comprendre cet onglet` / `C’est compris`

### Affiliation (`AffiliatePanel`)
| String | Role |
|---|---|
| `Parrainez un commerce` | title |
| `Votre code` / `Lien à partager` | label |
| `Copier le lien` / `Copier le message` / `Envoyer sur WhatsApp` | CTA |
| Message partage prérempli (`Je gère mon stock avec Margin Shop…`) | template |
| `Comment ça marche` + bullets Vous/Eux + `LAUNCH_OFFER.hook` | lead |

### BYOK / billing
| String | Role |
|---|---|
| `Non testée` / `Révoquée` / messages enregistrement | status |
| `Facturation (factures / carte / annuler)` | CTA |
| Sans clé : imports CSV/PDF OK ; chat libre = clé Anthropic/OpenAI | helper |

---

## 15. Copilote

### `MarginAssistant.tsx`
| String | Role |
|---|---|
| Welcome (toujours à droite / ⌘J) | welcome |
| Quick chips : Inventaire / Équipe / Stock / Cette page / WhatsApp / Caisse | CTA |
| `IA à connecter` / `IA · à tester` / `IA · invalide` / `IA connectée` | status |
| `Sans clé IA : les imports CSV/PDF restent disponibles…` | alert |
| `Copilote` / `Ouvrir le Copilote` / `Fermer le Copilote` / `Actions rapides` | chrome |
| `C’est noté.` / `Connexion impossible. Réessayez.` | reply / error |

### API `src/app/api/assistant/route.ts` (user-facing)
| String | Role |
|---|---|
| `Non authentifié.` / `Accès refusé.` / `Limite atteinte…` | error |
| Aperçus inventaire / équipe / WhatsApp (sans IA) | reply |
| `Voici le parcours sécurisé pour brancher la caisse :` | reply |
| Cards BYOK / clé refusée | card |
| `C’est prêt. Vérifiez l’aperçu…` | reply |

### `lib/assistant.ts`
Replies contextuelles Stock / Courses / Coûts / Équipe / Vérification / Accueil.

---

## 16. WhatsApp & emails transactionnels

### Templates `lib/whatsapp/templates.ts`
- `Margin — Récap rupture de stock`
- `Margin — Alerte stock`
- `Margin — échec de paiement…`
- `Margin — message de test. Votre numéro est bien relié.`

### Bot `lib/whatsapp-bot.ts`
Menu aide, pointage, inventaire guidé, `Je n'ai pas compris. Réessayez ou tapez « aide ».`

### Stock alerts / dunning / newsletter
| File | Exemples |
|---|---|
| `stock-alert-service.ts` | récap rupture / `Récap envoyé sur WhatsApp.` |
| `stripe/dunning.ts` | `Margin — échec de paiement ({amount})` |
| `newsletter.ts` | `Bienvenue dans les conseils Margin` / `Ouvrir mon commerce` |

---

## 17. Cookie / Newsletter UI

### `CookieBanner.tsx`
`Margin utilise des cookies essentiels…` · `Essentiels seulement` · `Accepter`

### `NewsletterSignupForm.tsx`
`S’inscrire` · `Inscription confirmée — vérifiez votre boîte mail.` · `Conseils stock, 1–2 fois / mois…`

### `newsletter/unsubscribe`
`{email} est désinscrit(e)…` · `Retour à l’accueil`

---

## 18. Légal (titres)

| Page | Title |
|---|---|
| CGU | `Conditions générales d’utilisation` |
| CGV | `Conditions générales de vente` |
| Confidentialité | `Politique de confidentialité` |
| Cookies | `Politique cookies` |
| Mentions | `Mentions légales` |

---

## 19. Admin (brief)

| Surface | Copy clé |
|---|---|
| Fondateur | `Margin · Fondateur` / `Espace fondateur` / `Email gérant` |
| Subnav | `Ops clients` / `Marketing` / `Newsletter` |
| Marketing | `Marketing & acquisition` / KPIs Prospects · Relances · Créateurs |
| Newsletter admin | `Export CSV (actifs)` / `Actif` / `Désinscrit` / `Aucun abonné…` |
| `lib/marketing-playbook.ts` | segments, pipeline, ICP (catalogue admin) |

---

## 20. Erreurs transverses (`actions.ts` & moteurs)

Exemples user-facing : `Fichier manquant.` · `Fichier trop volumineux…` · `Fournisseur requis.` · `Aucune clé OpenAI configurée…` · `Connexion OK · modèle …` · `Aucun plat détecté…` · `Aucun ingrédient reconnu.` · CSV caisse vide · `Ce numéro est déjà utilisé par un autre compte.` · `Message de test envoyé sur WhatsApp.`

---

## Sources de vérité (où éditer en priorité)

| Domaine | Fichier |
|---|---|
| Navigation | `src/lib/nav.ts` |
| Guide 1ʳᵉ heure | `src/lib/first-hour.ts` + `guide-spotlight-copy.ts` + `page-tours.ts` |
| Focus accueil | `src/lib/home-focus.ts` |
| Plans / CTA pricing | `src/lib/plans.ts` |
| Offre −20 % / 30 min | `src/lib/affiliate.ts` |
| Auth microcopy | `LoginForm` / `SignupForm` / `signup-otp.ts` |
| Copilote chrome | `MarginAssistant.tsx` + `api/assistant/route.ts` |
| WhatsApp templates | `lib/whatsapp/templates.ts` |

---

## Hors scope (volontaire)

- Landing `welcome/page.tsx` → déjà couverte par `copywriting-margin-v1.md`
- Logs / tests / commentaires code
