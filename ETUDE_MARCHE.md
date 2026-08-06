# Margin Shop — Étude de marché commerce de détail & prévisions Années 1–3

**Version** : août 2026 · alignée sur le produit et les tarifs actuels  
**Statut** : MVP fonctionnel (app + caisse + stock + Ops) · pas encore de clients payants à grande échelle

---

## Résumé exécutif

**Margin Shop** est un SaaS multi-tenant pour commerces de proximité (épicerie, alimentation spécialisée, prêt-à-porter, beauté, quincaillerie… tout magasin avec **caisse + stock physique**).

Ce que le produit fait aujourd’hui :

| Module | Rôle |
|---|---|
| **Caisse** | Connexion au logiciel POS (Zelty, Cashpad, Square, etc.) via webhook — ventes → stock |
| **Stock** | Niveaux, seuils, catalogue produits (≤ 200 en Commerce) |
| **Courses** | Liste de réassort unique, « marquer comme fait » → stock remonte |
| **Équipe** | Pointage + planning |
| **WhatsApp** | Alertes stock / listes (Twilio ou ouverture native) |
| **Ops Margin** | Console admin pour créer / configurer un magasin à la place du client |
| **Paiement** | Stripe Checkout (abo mensuel / annuel −20 %) |

**Différence vs l’ancienne étude** : l’interface principale n’est plus « WhatsApp only ». C’est une **app métier** (Première heure, Stock, Caisse, Courses, Équipe) ; WhatsApp reste un **canal d’alerte**, pas le dashboard. Le copilote conversationnel (Keke) est secondaire / optionnel.

### Offre tarifaire (figée)

| Plan | Mensuel HT* | Annuel (−20 %) | Limites | Mise en place caisse |
|---|---|---|---|---|
| **Commerce** | **89 €** | **854 €/an** | 1 boutique · ≤ 200 produits | **Non incluse** (self-serve) |
| **Franchise** | **249 €** | **2 390 €/an** | 1–3 boutiques · produits illimités | **Incluse** (~400 € économisés / magasin) |

\*Prix affichés dans l’app ; TVA selon régime.  
Setup technique ponctuel ~**400 €** : option Commerce / **inclus** Franchise.

**Architecture** : shared database + shared schema, isolation par `restaurantId` (tenant) + RLS Postgres (Supabase).

**Go-to-market** : France d’abord, Suisse / Luxembourg années 2–3. Deux chemins : self-serve commerçant **ou** Ops configure pour lui.

> Les projections ci-dessous sont des **scénarios** (pas de base de conversion réelle encore). À recalibrer dès les premières signatures.

---

## 1. Étude de marché — commerce de détail

### Taille du marché (TAM)

| Pays | Marché | Source |
|---|---|---|
| **France** | ~300 000 points de vente commerce de détail · CA ~660–670 Md€ · ~2 M emplois | INSEE |
| **Suisse** | ~35 000 entreprises de commerce de détail · CA ~100 Md CHF | Swiss Retail Federation / about.swiss |
| **Luxembourg** | ~3 300 commerces de détail | STATEC |

### SAM / SOM

- **SAM** : commerces déjà équipés d’une **caisse numérique** branchable (webhook / export) — condition technique Margin Shop.
- **SOM Années 1–3** : fraction modeste du SAM — preuve de valeur sur **1–2 verticales** et **2–3 caisses** dominantes, pas « tout le retail » dès J1.

### Dynamique favorable

- Fort flux de **créations** de commerces en France (secteur dynamique côté TPE).
- Suisse : retail en croissance réelle modérée — pouvoir d’achat utile pour un ARPA plus élevé.
- Cœur de cible : **TPE &lt; 10 salariés** — trop petites pour un ERP lourd, trop complexes pour le stock « Excel + mémoire ».
- WhatsApp déjà utilisé informellement → canal d’alerte crédible, sans remplacer l’app.

---

## 2. Paysage concurrentiel

Le marché des caisses / retail est mature et fragmenté. Margin Shop ne remplace pas la caisse : **il s’y branche**.

| Acteur | Positionnement | Écart vs Margin |
|---|---|---|
| Fastmag | Suite retail (mode…) | Dashboard complet, pas d’Ops self-serve + webhook léger |
| Wavy | Beauté | Vertical fort, pas transversal proximité |
| RoverCash | Indépendants multi-secteurs | Pas de parcours « Première heure + courses + Ops » |
| Bimedia | Proximité (tabac, presse…) | Ancrage terrain, pas la même promesse stock↔caisse |
| SumUp / Square / Zettle | Encaissement | Peu de profondeur stock / courses / équipe |
| Lightspeed / Tiller | Caisse + stock basique | Seuils réactifs ; pas la couche Ops Margin ni liste courses métier |

### Différenciateurs produit (réels aujourd’hui)

1. **Branchement caisse existante** (pas forcer un changement de caisse).  
2. **Parcours commerçant** : signup / Stripe → onboarding court → Première heure → stock / courses.  
3. **Deux chemins** : self-serve **ou** Ops Margin configure à sa place.  
4. **Franchise** = multi-magasins + mise en place technique incluse (valeur ~400 €).  
5. **Multi-tenant** prêt pour 20–100 entreprises (shared schema + `restaurantId` + RLS).

---

## 3. Modèle économique

### Prix retenus

| Plan | Mensuel | Annuel (−20 %) |
|---|---|---|
| Commerce | **89 €** | **854 €** |
| Franchise | **249 €** | **2 390 €** |

### Hypothèses de mix

| Hypothèse | Valeur |
|---|---|
| Mix clients | **80 % Commerce / 20 % Franchise** |
| **ARPA mensuel** | \(0{,}8 × 89 + 0{,}2 × 249\) = **121 €** |
| Setup 400 € | Rare en Commerce (option) · inclus Franchise (déjà dans le positionnement prix) |
| Churn mensuel | **3 %** Années 1–2 · **2,5 %** Année 3 (prudent, early-stage) |

Comparables marché logiciels caisse / stock TPE : souvent **~29–200+ €/mois** selon profondeur.  
**89 €** = milieu de gamme « stock + sync ».  
**249 €** = premium réseau + service d’intégration.

---

## 4. Prévisions Années 1–3 (base case)

Scénario à traiter comme **point de départ**, pas comme engagement.

| | Année 1 | Année 2 | Année 3 |
|---|---|---|---|
| Zone | France (pilote → scale) | France + Suisse | FR + CH + LU |
| Verticales | 1–2 pilotes (ex. alimentation spécialisée, mode) | 3–4 | Large proximité |
| Clients actifs fin d’année | **60** | **250** | **700** |
| ARPA mensuel | ~121 € | ~125 € | ~130 € |
| **MRR fin d’année** | **~7 300 €** | **~31 000 €** | **~91 000 €** |
| **ARR (run-rate)** | **~87 000 €** | **~375 000 €** | **~1,1 M€** |
| Churn mensuel | 3 % | 3 % | 2,5 % |

### Logique de montée en charge

- **A1** : product-market fit France, fiabilité webhook caisse, onboarding & Ops rodés, 2–3 connecteurs POS prioritaires.  
- **A2** : Suisse + élargissement verticales.  
- **A3** : Luxembourg en complément + acquisition plus mature (partenariats grossistes / intégrateurs caisse).

### Sensibilité ARPA (si le mix Franchise monte)

| Mix Franchise | ARPA | MRR @ 60 clients |
|---|---|---|
| 10 % | 105 € | ~6 300 € |
| **20 % (base)** | **121 €** | **~7 300 €** |
| 30 % | 137 € | ~8 200 € |

---

## 5. Faisabilité & risques

| Sujet | Lecture |
|---|---|
| **Technique** | MVP app + POS webhook + Stripe + multi-tenant en place. RLS à activer sur Postgres/Supabase au go-live. |
| **Commercial** | Passage 0 → 60 clients = hypothèse la plus fragile. Valider avant gros budget ads. |
| **Intégration caisse** | Diversité des POS → concentrer 2–3 vendors par verticale pilote. |
| **Dispersion** | Ne pas viser « tout le détail » en A1 — 1–2 verticales d’abord. |
| **Positionnement WhatsApp** | Ne pas sur-promettre « tout se gère sur WhatsApp » : l’app reste le cockpit ; WA = alertes. |

### Recommandation opérationnelle

1. Verrouiller **2 verticales** + **2–3 caisses**.  
2. Vendre **Commerce 89 €** en self-serve et **Franchise 249 €** en accompagné (Ops).  
3. Mesurer conversion welcome → signup → checkout → onboarding terminé.  
4. Recalculer ARR dès 10 clients payants réels.

---

## 6. Sources (marché)

- INSEE — Focus / Première commerce de détail & créations d’entreprises  
- about.swiss / Swiss Retail Federation — commerce de détail CH  
- STATEC — commerces de détail LU  
- Comparatifs logiciels de caisse 2026 (Tool Advisor, L’Écho Commerces)  
- Statistiques cessions fonds de commerce (TPE) — sources type Altares / BPI  

*Données de marché sourcées ; projections financières = scénarios internes Margin Shop (août 2026).*

---

## Annexe — Alignement produit ↔ étude

| Ancienne étude | Produit / étude actuelle |
|---|---|
| « Piloté depuis WhatsApp, sans dashboard » | App complète + alertes WhatsApp |
| Prix « à définir » / hypo 79 € & 249 € | **89 € Commerce · 249 € Franchise** |
| Copilote IA central | Secondaire ; focus sync caisse → stock → courses |
| Multi-établissements vague | Franchise = 1–3 boutiques, produits illimités, setup inclus |
| — | Multi-tenant shared schema + Ops admin + Stripe |
