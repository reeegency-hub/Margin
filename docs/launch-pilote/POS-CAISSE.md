# Caisse → Margin — parcours d’accompagnement

**Pour toi (fondateur)** pendant l’onboard client.  
App : `/kiosks` · Webhook prod : `https://margin-shop.vercel.app`

**Rappel :** Stripe (abo Margin) ≠ caisse POS. Ici = ventes caisse → stock Margin.

---

## 0. Avant de parler technique (2 min)

Demande au commerçant :

1. **Quel logiciel de caisse ?** (Zelty, Cashpad, Tiller/SumUp, L’Addition, Lightspeed, Square, autre, ou « juste une caisse tactile sans cloud »)
2. **Qui a les accès admin ?** (lui, son installateur, le franchiseur)
3. **Les articles ont-ils un code / SKU / PLU** identique sur la caisse et dans sa tête ?

→ Classe le cas :

| Cas | Décision |
|-----|----------|
| A — Caisse cloud listée + accès admin | Branchement webhook (cible pilote) |
| B — Caisse listée mais accès chez l’installateur | Tu crées la connexion Margin · RDV installateur / ticket support caisse |
| C — Caisse inconnue / offline / pas d’API | **Plan B manuel** tout de suite (ne bloque pas l’onboard) |
| D — Il veut « tout brancher demain » sans fichier stock | Stop : d’abord import stock + SKU (sinon tout tombe en « produits découverts ») |

---

## 1. Préparer Margin (toi + client, 10 min)

### 1.1 Catalogue vendable = clé du matching

Margin décrémente le stock **uniquement** si la vente caisse matche un **produit** (`Product`) via **`externalSku`**.

- Un CSV « stock seul » (références rayon) **ne suffit pas** pour la caisse.
- Il faut : **1 produit vendu = 1 SKU** = celui de la caisse (PLU / code article).

**Idéal à l’import :**

```text
Nom;Stock;Unite;Prix;Seuil;Sku
Lait entier 1L;12;pcs;1.20;6;LAIT-1L
```

Le `Sku` doit être **exactement** le code caisse (Margin normalise : majuscules, sans espaces).

Script si besoin (crée Product + StockUnit + lien) :

```bash
npx tsx scripts/import-retail-catalog.ts \
  --restaurant-id <ID> \
  --csv stock-avec-sku.csv
```

### 1.2 Créer la connexion dans Margin

1. Login commerçant → menu **Commerce / Caisse** → `/kiosks`
2. Choisir le vendor (Zelty, Cashpad, … ou Autre)
3. **Créer la connexion**
4. Noter / copier :
   - **URL webhook**  
     - Recommandé :  
       `https://margin-shop.vercel.app/api/v1/webhooks/pos/{provider}?connectionId={id}`  
     - Équivalent :  
       `https://margin-shop.vercel.app/api/webhooks/pos/{connectionId}`
   - **Secret** → header `x-webhook-secret`
5. (Optionnel) coller la **clé API** caisse pour la réconciliation nuit (pull)

Ne partage le secret que par canal privé (pas dans un groupe WhatsApp large).

---

## 2. Où trouver les API / webhooks **sur la caisse**

Tu ne codes pas chez le client : tu **guides** où cliquer, ou tu parles à l’éditeur.

### Zelty (meilleur cas pilote)

| Quoi | Où chercher |
|------|-------------|
| Webhooks / notifications | Back-office Zelty → **Paramètres / Intégrations / API / Webhooks** (libellé selon offre) |
| Clé API marketplace | Compte partenaire / marketplace Zelty → clé Bearer |
| Docs éditeur | Support Zelty ou espace développeur (souvent sur demande) |

**À coller côté Zelty :**
- URL = webhook Margin (ci-dessus, provider `zelty`)
- Secret = celui affiché dans `/kiosks` (header `x-webhook-secret`)
- Événements : **commande créée / encaissée** + **annulée / remboursée** si dispo

**Clé API (pull nuit)** : même écran ou « Clés API » → coller dans Margin `/kiosks` (champ API).  
Base par défaut Margin : `https://api.zelty.fr/2.0` · commandes `/orders`.

### Cashpad

| Quoi | Où |
|------|-----|
| Webhook / API | Back-office Cashpad → Intégrations / API |
| Clé | « Clé API » ou compte partenaire |

Si pas d’écran webhook : **mail support Cashpad** — « URL de notification de ticket + header secret ».

### Tiller / SumUp

| Quoi | Où |
|------|-----|
| Webhooks SumUp | [SumUp Developer](https://developer.sumup.com) / tableau SumUp → Developers → Webhooks |
| Token API | SumUp → Profile / API keys (ou OAuth app) |
| Ancien Tiller | Souvent migré SumUp — demander au commerçant s’il est encore sur Tiller cloud |

Provider Margin : `tiller` (alias URL parfois `sumup`).

### L’Addition

Back-office → **API / Partenaires / Webhooks** (selon contrat).  
Sinon : support L’Addition avec URL Margin + secret.

### Lightspeed (Restaurant / Retail)

| Quoi | Où |
|------|-----|
| API | Lightspeed → Settings → **API Access** / Apps |
| Token + Account ID | Obligatoires pour le pull |
| Webhooks | Selon produit (K-series vs R-series) — souvent via app partenaire |

Attention : Lightspeed a **plusieurs produits** ; note la version exacte.

### Square

| Quoi | Où |
|------|-----|
| Developer | [developer.squareup.com](https://developer.squareup.com) |
| Access token | App → Credentials (sandbox ≠ prod) |
| Location ID | Square Dashboard → Locations |
| Webhooks | Developer → Webhooks → Subscribe (Orders / Payments) → URL Margin |

### Autre caisse / « custom »

1. Demande : *« Est-ce que votre caisse peut envoyer un webhook HTTP quand une vente est faite ? »*
2. Si **oui** → connexion `custom` + leur doc payload · on adapte l’adapter si besoin
3. Si **non** → Plan B manuel (section 5)
4. Si **CSV export journalier** → import manuel / outil interne (pas live)

### Caisse purement locale (pas de cloud)

→ Pas d’API. Plan B immédiat. Ne promets pas le live.

---

## 3. Brancher concrètement (checklist call)

### Étape A — Margin prêt
- [ ] Connexion créée sur `/kiosks`
- [ ] URL + secret copiés
- [ ] Au moins **5 SKU** produits = codes caisse (test)

### Étape B — Caisse configurée
- [ ] Webhook créé chez l’éditeur avec **même** URL + secret
- [ ] Événements vente (+ cancel si possible) activés
- [ ] (Optionnel) clé API collée dans Margin pour le pull nuit

### Étape C — Test en 3 minutes
1. Encaisser **1 article connu** (SKU déjà dans Margin), quantité 1  
2. Ouvrir Margin → stock de cet article **−1**  
3. Si stock ne bouge pas → `/kiosks` : événements / **produits découverts**  
4. Annuler la vente en caisse (si possible) → stock **repart +1**

### Étape D — Clôturer
- [ ] Noter : vendor + date + « live OK » ou « manuel »
- [ ] Si live OK : 2–3 ventes réelles le jour J, tu rechecks le soir
- [ ] Si KO : bascule Plan B **sans dramatiser**

---

## 4. Ce que Margin attend (pour toi / un intégrateur)

### Auth

```http
POST /api/v1/webhooks/pos/zelty?connectionId=XXXX
x-webhook-secret: <secret>
Content-Type: application/json
```

(HMAC possible : `x-pos-signature: sha256=…` — clé = même secret.)

### Vente (forme typique)

```json
{
  "order": {
    "id": "TICKET-8891",
    "created_at": "2026-08-09T14:02:00Z",
    "items": [
      { "id": "LAIT-1L", "name": "Lait entier", "quantity": 1, "price": 1.2 }
    ]
  }
}
```

Le champ utilisé pour matcher = **id / sku de ligne** → `Product.externalSku` (ex. `LAIT-1L`).

### Annulation

```json
{
  "event": "order.cancelled",
  "order": { "id": "TICKET-8891", "status": "cancelled" }
}
```

### Réponses utiles

| HTTP | Sens | Toi tu fais |
|------|------|-------------|
| 200 | OK / doublon / cancel différé | Rien |
| 401 | Secret faux | Recoller le secret des deux côtés |
| 422 | Payload illisible | Envoyer 1 payload exemple au support Margin |
| 400 | Aucune ligne matchée | SKU caisse ≠ SKU Margin → corriger catalogue |

---

## 5. Plan B — pas de webhook (cas fréquent)

Ne bloque **pas** l’onboard. Script client :

1. Fin de service (ou pause) → ouvrir Margin  
2. Ajuster le stock (vérification / Copilote / comptage rayon)  
3. Checker WhatsApp alertes  
4. Si la caisse exporte un CSV ventes → l’envoyer à `reeegency@gmail.com` (import assisté)  
5. Ticket technique : « brancher {marque caisse} pour magasin X » → tu traites hors call

**Critère ok Plan B :** le commerçant sait **où** et **quand** corriger le stock sans toi.

---

## 6. Eventualités (anticipation)

| Situation | Symptôme | Action |
|-----------|----------|--------|
| SKU différent caisse vs Margin | Stock ne bouge pas · « produits découverts » | Aligner `externalSku` = code caisse (majusc.) · valider pending dans `/kiosks` |
| Vente OK mais double décrément | Rare (retries) | Normalement idempotent · si ça arrive : note `order id` + support |
| Annulation avant que la vente n’arrive | Cancel en attente | Margin **DIFFÈRE** puis réessaie · patiente 1–2 min · retest |
| Annulation 2× | 2ᵉ = ignorée | OK |
| Webhook 401 | Secret / URL faux | Recréer secret dans Margin · maj côté caisse |
| Installateur injoignable | Pas d’écran API | Plan B + mail type (ci-dessous) |
| Multi-magasins / 1 compte caisse | Mauvais `connectionId` | 1 connexion Margin **par** commerce |
| Sandbox Square / test Zelty | Ça marche en test, pas en vrai | Vérifier credentials **Production** |
| Articles au poids (code variable) | SKU change à chaque vente | Vendre en `pcs` / code fixe · ou Plan B pour ces rayons |
| Menu resto (recettes) vs retail | 1 plat = plusieurs ingrédients | OK si Product + composition ; retail = Product qty 1 → 1 stock |
| Client confond Stripe et caisse | « J’ai déjà payé Stripe » | Expliquer : Stripe = abo Margin · caisse = ventes magasin |
| Promesse « toutes les caisses en 2 clics » | Frustration | Dire : *on facilite + on branche avec vous · sinon manuel le temps de l’intégration* |

---

## 7. Mails types (copier-coller)

### À l’éditeur / installateur caisse

> Bonjour,  
> Nous connectons le commerce **{NOM}** à Margin Shop (stock).  
> Merci d’activer un webhook HTTP vers :  
> `{URL}`  
> Header : `x-webhook-secret: {SECRET}`  
> Événements : vente encaissée + annulation/remboursement.  
> Si vous avez une clé API lecture commandes, merci de nous la transmettre (canal sécurisé).  
> Cordialement

### Au commerçant (Plan B)

> En attendant le branchement live de la caisse, chaque soir (2 min) :  
> 1) Ouvre Margin → Stock  
> 2) Corrige les 3–5 produits qui ont bougé  
> 3) Tu reçois les alertes sur WhatsApp  
> On te prévient dès que le live est prêt.

---

## 8. Ordre du jour call « caisse » (15 min chrono)

1. Identifier la marque (1 min)  
2. Vérifier 3 SKU alignés (3 min)  
3. Créer connexion `/kiosks` (2 min)  
4. Config webhook caisse **ou** envoyer mail installateur (5 min)  
5. 1 vente test **ou** bascule Plan B (3 min)  
6. Noter le statut sur la fiche magasin (`PARCOURS-CLIENT.md`)

---

## Référence technique (si besoin)

- Vue multi-caisse : `src/lib/pos/docs/overview.md`  
- Zelty détail : `src/lib/pos/docs/zelty.md`  
- Matching SKU : `src/lib/pos/docs/sku-sync.md`
