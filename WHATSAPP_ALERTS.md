# WhatsApp — alertes stock fiables

Canal d’alerte complémentaire à l’app. Objectifs : **zéro bruit**, **coût maîtrisé**, **délivrabilité visible**.

## 1. Déduplication (cycle seuil)

Par produit / tenant :

1. Stock ≤ seuil → crée / met à jour une alerte `STOCK_CRITICAL` ACTIVE
2. Mise en file WhatsApp (`whatsappPendingAt`) **une seule fois** tant que `whatsappSentAt` est null
3. Après envoi → `whatsappSentAt` posé → **aucune nouvelle notif** tant que la condition reste vraie
4. Stock **> seuil** → alerte `RESOLVED` → cycle remis à zéro
5. Nouveau passage sous le seuil → nouvelle alerte possible

## 2. Batching

| Paramètre | Défaut | Env |
|---|---|---|
| Fenêtre de regroupement | **15 min** | `WHATSAPP_BATCH_MINUTES` (5–30) |
| Flush | Cron `/api/cron/stock-alerts` | toutes les 15 min |
| Urgence | stock = 0 (severity 1) | flush **immédiat** (1 message groupé) |

Plusieurs produits sous seuil dans la fenêtre → **un seul** message `stock_recap`.

## 3. Templates WhatsApp Business

Les envois automatisés passent par Twilio **Content API** (`contentSid`) quand un SID est configuré.

| Template | Env | Variables |
|---|---|---|
| Récap rupture | `TWILIO_WA_TEMPLATE_STOCK_RECAP` | 1=magasin, 2=nb, 3=liste |
| Alerte unitaire | `TWILIO_WA_TEMPLATE_STOCK_ALERT` | 1=produit, 2=constat, 3=action |
| Dunning facturation | `TWILIO_WA_TEMPLATE_BILLING_DUNNING` | 1=montant, 2=date grâce, 3=url |
| Test | `TWILIO_WA_TEMPLATE_TEST` | 1=texte |

### Processus de validation d’un nouveau template

1. Twilio Console → Content Template Builder (ou Meta Business Manager)
2. Catégorie **UTILITY** pour stock / facturation (pas MARKETING si évitable)
3. Rédiger le corps avec variables `{{1}}`… alignées sur le tableau ci-dessus
4. Soumettre → statut **APPROVED** (délai Meta : heures à jours)
5. Copier le Content SID `HX…` dans Vercel
6. Tester sandbox → 1 tenant pilote → généraliser
7. Optionnel : `WHATSAPP_REQUIRE_TEMPLATES=1` pour **bloquer** tout envoi auto sans SID

Réponses bot dans la fenêtre session 24 h : freeform autorisé (`session_reply`).

## 4. Coût & plafond

| Paramètre | Défaut | Env |
|---|---|---|
| Limite / tenant / jour | **20** | `WHATSAPP_DAILY_LIMIT_PER_TENANT` |
| Coût estimé / msg | **0,05 €** | `WHATSAPP_COST_CENTS_PER_MSG` (centimes) |

À la limite : message **non envoyé**, ligne `limit_skipped` en journal + alerte Ops (Slack/`console`) — signal de **mauvais calibrage de seuils**, pas coupure silencieuse.

Journal : modèle `WhatsAppOutboundMessage`.

## 5. Délivrabilité

- Chaque envoi Twilio enregistre le `MessageSid`
- `statusCallback` → `POST /api/webhooks/twilio/status`
- Statuts : queued → accepted/sent → **delivered** / **failed** / **undelivered**
- Échec → alerte Ops
- Widget **WhatsApp · 24 h** sur `/admin` (volume, taux délivré, plafonds, top tenant)

Prérequis : `WEBHOOK_BASE_URL` public (même base que le webhook inbound).

## Fichiers

- `src/lib/whatsapp/{config,templates,outbound,batch,metrics}.ts`
- `src/lib/stock-engine.ts` — cycle dédup + file
- `src/app/api/cron/stock-alerts/route.ts` — scan + flush
- `src/app/api/webhooks/twilio/status/route.ts`
