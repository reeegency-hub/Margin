# PRODUCT REQUIREMENTS DOCUMENT

# RestaurantOS AI

**Version 1.0 — Document complet (Parties 1 & 2)**
Statut : Prêt pour développement (MVP)
Destiné à : équipe produit / IA de développement (Cursor)

⸻

## Comment utiliser ce document

Ce PRD est écrit pour être donné directement à un assistant de code (Cursor) afin d'amorcer le développement du produit.

Il décrit :
- la vision et la logique produit (pourquoi on construit ça, et comment le produit doit "penser")
- le premier module fonctionnel complet à développer en priorité : **Stock Intelligence**, avec le Dashboard qui l'expose à l'utilisateur

Le scope volontairement retenu pour un premier développement (MVP) est indiqué en fin de document, section 9.

⸻

# PARTIE 1 — VISION & PRODUIT

## 1. Vision

RestaurantOS AI est une plateforme SaaS qui connecte tous les outils utilisés par un restaurant (caisse, stocks, employés, fournisseurs, finances, livraisons, avis clients, etc.) afin de créer un copilote IA capable d'observer l'activité, détecter les problèmes et proposer automatiquement les meilleures décisions.

L'objectif est de réduire drastiquement le temps passé à gérer l'administratif afin que le restaurateur puisse se concentrer sur son métier.

À terme, RestaurantOS AI devient le **Directeur des Opérations Virtuel** du restaurant.

## 2. Mission

Un restaurateur gère aujourd'hui : commandes, cuisine, stocks, employés, fournisseurs, réseaux sociaux, livraisons, réservations, comptabilité, achats, avis Google, imprévus.

La plupart de ces tâches sont répétitives. **Notre IA les automatise.**

## 3. Vision long terme

RestaurantOS AI doit être capable de prendre seul 80 % des décisions opérationnelles quotidiennes. Le restaurateur valide uniquement.

> Aujourd'hui : le restaurateur regarde ses stocks.
> Demain : *"Nous avons détecté qu'il manque 18 kg de pommes de terre. La commande est prête. Souhaitez-vous l'envoyer ?"*

## 4. Problème du marché

Les restaurateurs jonglent avec plusieurs outils dispersés : logiciel de caisse, Excel, WhatsApp, agenda papier, téléphone, fournisseurs, logiciel comptable. Toutes les informations sont dispersées.

**RestaurantOS centralise tout.**

## 5. Philosophie produit — principe directeur unique

Ce principe s'applique à **tout l'écran, tout module confondu** :

Le produit ne doit jamais se contenter d'afficher un chiffre ou un statut. Chaque élément d'interface doit répondre à la question :

**Que doit faire le restaurateur maintenant ?**

| ❌ Passif | ✅ RestaurantOS AI |
|---|---|
| "Stock faible" | "Commandez 12 kg de tomates aujourd'hui chez le fournisseur B. Vous économiserez 84 €." |

Concrètement, toute carte, alerte ou métrique doit si possible contenir : **le constat → la cause (si identifiable) → l'impact → l'action recommandée**. Si aucune action n'est nécessaire, le produit le dit explicitement ("aucune action requise") plutôt que de laisser l'utilisateur interpréter.

## 6. Les 8 piliers du produit

1. **POS Intelligence** — connexion aux caisses, analyse des ventes, synchronisation temps réel
2. **Stock Intelligence** — calcul automatique des stocks, prévisions, commandes, inventaires *(détaillé en Partie 2)*
3. **Employee Intelligence** — RH, planning, performance, formation, présence
4. **Financial Intelligence** — marge, rentabilité, trésorerie, prévisions
5. **Supplier Intelligence** — gestion fournisseurs, comparaison des prix, historique, automatisation
6. **Fraud Intelligence** — détection d'anomalies, analyse comportementale, alertes, rapports
7. **AI Copilot** — le cerveau : comprend toutes les données, explique, conseille, prédit
8. **Automation Engine** — automatisation de toutes les tâches répétitives

## 7. Personas

| Persona | Contexte | Besoin principal |
|---|---|---|
| Restaurant indépendant | Une seule personne gère tout | Gagner du temps |
| Restaurant familial | 5 employés, le patron cuisine | Automatisation |
| Restaurant multi-sites | 20 restaurants | Pilotage global |
| Food truck | Très peu de personnel, peu de temps | Automatisation maximale |

## 8. Modules de l'application

Dashboard · Stocks · Employés (planning, présence, performance) · Fournisseurs (achats, comparaison) · Comptabilité (marges) · IA (assistant, rapports, notifications) · Paramètres

⸻

## 9. Dashboard principal

Quand un restaurateur ouvre RestaurantOS, il doit comprendre l'état de son entreprise en **moins de 30 secondes**.

### 9.1 Liste des cartes du Dashboard

Chiffre d'affaires du jour · Chiffre d'affaires de la semaine · Nombre de commandes · Ticket moyen · Marge estimée · Stocks critiques · Employés présents · Employés absents · Retards · Alertes · Prévisions météo · Prévisions d'affluence · Commandes fournisseurs à valider · Alertes fraude · Avis clients · Trésorerie · Objectifs du mois

### 9.2 Spécification de chaque carte (format constat / cause / impact / action)

**Chiffre d'affaires de la semaine**
Constat : montant + variation vs semaine précédente
Cause : jour ou créneau qui tire la performance vers le bas/haut (comparaison vs moyenne historique du même jour)
Action : suggestion opérationnelle si écart significatif (ex. offre ciblée, ajustement staffing)

**Nombre de commandes**
Constat : volume + comparaison au rythme habituel
Signal à surveiller : taux d'annulation (alerte si > seuil configurable, ex. 4 %)

**Ticket moyen**
Constat : montant + variation
Cause : catégorie de vente en baisse (ex. desserts, boissons)
Action : suggestion commerciale chiffrée (ex. relance suggestion dessert, gain estimé)

**Marge estimée**
Constat : % + écart vs objectif
Cause : identifiée via variation du coût matière (prix fournisseur en hausse)
Action : comparaison fournisseur alternative avec économie chiffrée

**Stocks critiques**
Constat : ingrédient concerné
Action : "Commander aujourd'hui", avec délai de livraison
Impact si inaction : heure/jour de rupture estimée

**Employés présents / absents**
Présents : effectif du jour vs effectif nécessaire pour l'affluence prévue
Absents : nom, motif (prévu/imprévu), impact sur le service, action suggérée (heure sup, ajustement carte)

**Retards**
Personne, durée, récurrence (pattern détecté sur le mois) → déclenche suggestion de point RH si récurrent

**Alertes**
Liste consolidée de toutes les alertes actives du système, **triées par urgence et impact** (sécurité sanitaire > financier > confort)

**Prévisions météo**
Donnée météo + corrélation historique avec la fréquentation → action suggérée (staffing, stock)

**Prévisions d'affluence**
Niveau prévu + facteurs explicatifs (météo, événement local, réservations) → action staffing/stock

**Commandes fournisseurs à valider**
Liste des commandes préparées automatiquement, prêtes à valider en un clic, avec délai de livraison

**Alertes fraude**
Anomalie détectée (ex. annulations de tickets répétées), montant concerné, action suggérée

**Avis clients**
Note moyenne + volume + thème récurrent des avis négatifs → action suggérée

**Trésorerie**
Solde actuel + échéances à venir + solde projeté après échéances → alerte seulement si sous seuil de sécurité

**Objectifs du mois**
% atteint + trajectoire (objectif atteignable ou non au rythme actuel)

⸻

# PARTIE 2 — MODULE STOCK INTELLIGENCE

## 10. Vision du module

Stock Intelligence est le cœur opérationnel du produit : c'est lui qui transforme une caisse enregistreuse en système capable de savoir, à tout instant, ce qu'il reste en cuisine, ce qu'il va manquer, et ce qu'il faut commander.

## 11. Problème actuel

Gestion manuelle (cahier/Excel), inventaire hebdomadaire fastidieux, estimation à l'œil des commandes, ruptures découvertes en plein service, gaspillage non mesuré.

## 12. Boucle de fonctionnement (logique système)

```
VENTE (POS)
   ↓ décrémente automatiquement via fiche recette
STOCK THÉORIQUE (recalculé en continu)
   ↓ recalé par inventaire physique
ÉCART (= gaspillage / démarque / erreur de recette)
   ↓ croisé avec historique + météo + événements
PRÉVISION DE CONSOMMATION
   ↓ seuil critique atteint
DÉCISION (commande proposée)
   ↓ validation (ou envoi auto selon niveau de confiance)
RÉCEPTION & CONTRÔLE
   ↓
MISE À JOUR DU STOCK RÉEL
```

## 13. Fiches recettes

### 13.1 Rôle

Brique fondatrice : sans elle, pas de décrémentation automatique possible. Chaque plat vendu est relié à une recette qui le décompose en ingrédients bruts.

### 13.2 Modèle de données — Fiche recette

| Champ | Type | Description |
|---|---|---|
| `dish_id` | UUID | Identifiant du plat |
| `name` | string | Nom du plat |
| `ingredients[]` | array | Liste d'objets `{ ingredient_id, quantity, unit }` |
| `cost_price` | decimal | Calculé automatiquement depuis le prix fournisseur des ingrédients |
| `sale_price` | decimal | Saisi par le restaurateur |
| `gross_margin` | decimal | Calculé : (sale_price - cost_price) / sale_price |
| `photo_url` | string, optionnel | |
| `variants[]` | array, optionnel | Ex. "sans fromage" |
| `allergens[]` | array | Généré à partir des ingrédients |

### 13.3 Exemple

**Burger Signature** : pain brioché (1 pièce), steak haché 150 g (1 pièce), cheddar (20 g), sauce maison (15 g), salade (10 g), oignons rouges (15 g)
→ Coût matière : 2,34 € · Prix de vente : 12,50 € · Marge brute : 81,3 %

### 13.4 Création assistée par IA

L'IA peut proposer une décomposition automatique à partir du nom du plat, suggérer des quantités standard ajustables, et détecter les incohérences (marge anormalement basse, ingrédient manquant). **Le restaurateur valide toujours la fiche avant activation.**

## 14. Calcul automatique des ingrédients

- **Décrémentation temps réel** : chaque vente déclenche instantanément la mise à jour du stock théorique de chaque ingrédient concerné.
- **Agrégation multi-plats** : un ingrédient utilisé dans plusieurs recettes voit sa consommation totale agrégée automatiquement (ex. tomate utilisée dans 4 recettes → consommation totale journalière calculée).
- **Conversions d'unités** : le système gère nativement la conversion entre unité d'achat (carton, cagette, bidon) et unité de recette (gramme, millilitre) — le restaurateur ne fait jamais ce calcul lui-même.

## 15. Gestion des fournisseurs

### 15.1 Modèle de données — Fournisseur

| Champ | Type |
|---|---|
| `supplier_id` | UUID |
| `name`, `contact` | string |
| `catalog[]` | array de `{ ingredient_id, price, unit, min_order_qty }` |
| `delivery_days[]` | array |
| `avg_delivery_delay` | int (heures) |
| `reliability_score` | decimal (calculé : retards, erreurs, ruptures) |
| `order_history[]` | array |

### 15.2 Comparaison automatique des prix

Quand plusieurs fournisseurs proposent le même ingrédient, le système compare prix/kg, frais de livraison, délai, fiabilité historique, et recommande le plus avantageux (le restaurateur reste libre de choisir autrement).

## 16. Automatisation des commandes

### 16.1 Niveaux de confiance (paramétrable par le restaurateur)

| Niveau | Comportement |
|---|---|
| Assisté | L'IA suggère, commande manuelle |
| Semi-automatique | Commande préparée, validation en un clic |
| Automatique | Envoi automatique, notification + droit d'annulation sous 1h |

### 16.2 Déclencheurs

- stock théorique sous seuil critique par ingrédient (seuil configurable)
- prévision de consommation dépassant le stock disponible avant prochaine livraison possible
- rupture anticipée avant la prochaine fenêtre de livraison

## 17. Prévisions de consommation

Facteurs croisés : historique de ventes (jour/heure/saisonnalité), météo locale, événements locaux, tendances récentes, réservations. Le modèle se réajuste en continu à partir des écarts prévision/réalité, par restaurant.

## 18. Gaspillage alimentaire

- **Mesure** : écart entre stock théorique (via ventes) et stock réel (via inventaire)
- **Dashboard dédié** : coût du gaspillage du mois, top 5 ingrédients gaspillés, évolution, comparaison par plat
- **Recommandations IA** : ajustement des quantités commandées, reformulation de recette
- Utilité réglementaire (loi anti-gaspillage type AGEC) et argument marketing possible

## 19. Alertes intelligentes

Toute alerte doit être **actionnable**. Typologie : stock critique, anomalie de consommation, retard fournisseur, péremption proche, opportunité (baisse de prix). Priorisation par urgence + impact financier pour éviter la fatigue d'alerte.

## 20. Réapprovisionnement automatique

Boucle complète décrite en section 12. À la réception, confirmation des quantités reçues (idéalement scan du bon de livraison) → mise à jour du stock réel → alerte en cas de sous-livraison ou produit manquant.

**Objectif final du module :** le restaurateur ne doit plus jamais découvrir une rupture de stock en plein service ; sa seule interaction devient la validation des décisions déjà préparées.

⸻

# ANNEXE TECHNIQUE — pour amorcer le développement

## A. Entités principales du modèle de données (MVP)

- `Restaurant` (1 restaurant = 1 tenant)
- `Dish` (fiche recette) → lié à `Ingredient[]` via table de jointure `RecipeIngredient(quantity, unit)`
- `Ingredient` (nom, unité de référence, stock théorique courant, seuil critique)
- `Sale` (transaction POS) → contient `SaleItem[]` référençant `Dish`
- `StockMovement` (journal : vente, réception, inventaire, ajustement — permet de reconstituer l'historique et calculer le gaspillage)
- `Supplier` + `SupplierCatalogItem(ingredient_id, price, unit)`
- `Order` (commande fournisseur) → statut : brouillon / à valider / envoyée / reçue
- `InventoryCount` (inventaire physique périodique, pour recalage stock réel)
- `Alert` (type, urgence, entité liée, statut résolu/actif)
- `Employee`, `Shift`, `Attendance` (pour les cartes présence/absence/retard du Dashboard)

## B. Flux critique à implémenter en premier (cœur du MVP)

1. CRUD `Ingredient` + `Dish` avec composition (`RecipeIngredient`)
2. Ingestion des ventes (import ou webhook POS) → génération de `StockMovement` de type "vente" → décrémentation du stock théorique
3. Calcul du seuil critique + génération d'`Alert` de type "stock critique"
4. Écran Dashboard consommant ces données selon le format constat/cause/impact/action défini en Partie 1
5. Écran de validation de commande fournisseur (Order) à partir d'une alerte stock critique

## C. Périmètre volontairement exclu du MVP (à ajouter ensuite)

- prévisions météo/affluence avancées (peuvent démarrer avec une règle simple avant modèle ML)
- Fraud Intelligence
- réapprovisionnement 100 % automatique sans validation
- multi-sites / pilotage global

⸻

## Note finale

Ce document peut être utilisé tel quel comme fichier de contexte (`PROJECT_SPEC.md` ou équivalent) dans Cursor pour guider la génération du schéma de base de données, des endpoints API et des premiers écrans (Dashboard + module Stock Intelligence), en respectant strictement le principe directeur de la section 5.
