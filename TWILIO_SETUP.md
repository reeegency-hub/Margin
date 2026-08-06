# Twilio WhatsApp — setup Margin (tu colles 3 valeurs, le reste est prêt)

## 1. Créer le compte (2 min)
1. https://console.twilio.com
2. Crée / connecte-toi
3. Active **Messaging → Try it out → Send a WhatsApp message** (sandbox)
4. Sur ton téléphone : envoie le code sandbox au numéro Twilio
5. Copie :
   - Account SID (`AC…`)
   - Auth Token
   - Sandbox From : souvent `whatsapp:+14155238886`

## 2. Fichier local (ne pas committer)
Crée `MarginShop/.env.twilio` :

```
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Puis dis **« twilio prêt »** → l’agent pousse sur Vercel + redeploy.

## 3. Templates Meta (en parallèle, délai heures/jours)
Twilio → Content Template Builder → UTILITY → soumettre :

| Env | Corps |
|---|---|
| STOCK_RECAP | `Margin — Récap rupture\n{{1}} · {{2}} produit(s)\n{{3}}\n→ Une seule liste à traiter.` |
| STOCK_ALERT | `Margin — Alerte stock\n{{1}}\n{{2}}\n→ {{3}}` |
| BILLING_DUNNING | `Margin — échec de paiement ({{1}}). Avant le {{2}} : {{3}}` |
| TEST | `{{1}}` |

Quand APPROVED : ajouter `TWILIO_WA_TEMPLATE_*=HX…` puis `WHATSAPP_REQUIRE_TEMPLATES=1`.

## 4. Callback
Dans Twilio sandbox / sender : status callback  
`https://margin-shop.vercel.app/api/webhooks/twilio/status`

## État actuel Margin
- App OK sans WhatsApp (alertes dans l’app)
- `WHATSAPP_REQUIRE_TEMPLATES` assoupli pour sandbox tant que Meta n’a pas validé
- Stripe = de ton côté


## 1. Créer le compte (2 min)
1. https://console.twilio.com
2. Crée / connecte-toi
3. Active **Messaging → Try it out → Send a WhatsApp message** (sandbox)
4. Sur ton téléphone : envoie le code sandbox au numéro Twilio
5. Copie :
   - Account SID (`AC…`)
   - Auth Token
   - Sandbox From : souvent `whatsapp:+14155238886`

## 2. Fichier local (ne pas committer)
Crée `MarginShop/.env.twilio` :

```
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Puis dis **« twilio prêt »** → l’agent pousse sur Vercel + redeploy.

## 3. Templates Meta (en parallèle, délai heures/jours)
Twilio → Content Template Builder → UTILITY → soumettre :

| Env | Corps |
|---|---|
| STOCK_RECAP | `Margin — Récap rupture\n{{1}} · {{2}} produit(s)\n{{3}}\n→ Une seule liste à traiter.` |
| STOCK_ALERT | `Margin — Alerte stock\n{{1}}\n{{2}}\n→ {{3}}` |
| BILLING_DUNNING | `Margin — échec de paiement ({{1}}). Avant le {{2}} : {{3}}` |
| TEST | `{{1}}` |

Quand APPROVED : ajouter `TWILIO_WA_TEMPLATE_*=HX…` puis `WHATSAPP_REQUIRE_TEMPLATES=1`.

## 4. Callback
Dans Twilio sandbox / sender : status callback  
`https://margin-shop.vercel.app/api/webhooks/twilio/status`

## État actuel Margin
- App OK sans WhatsApp (alertes dans l’app)
- `WHATSAPP_REQUIRE_TEMPLATES` assoupli pour sandbox tant que Meta n’a pas validé
- Stripe = de ton côté


## 1. Créer le compte (2 min)
1. https://console.twilio.com
2. Crée / connecte-toi
3. Active **Messaging → Try it out → Send a WhatsApp message** (sandbox)
4. Sur ton téléphone : envoie le code sandbox au numéro Twilio
5. Copie :
   - Account SID (`AC…`)
   - Auth Token
   - Sandbox From : souvent `whatsapp:+14155238886`

## 2. Fichier local (ne pas committer)
Crée `MarginShop/.env.twilio` :

```
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Puis dis **« twilio prêt »** → l’agent pousse sur Vercel + redeploy.

## 3. Templates Meta (en parallèle, délai heures/jours)
Twilio → Content Template Builder → UTILITY → soumettre :

| Env | Corps |
|---|---|
| STOCK_RECAP | `Margin — Récap rupture\n{{1}} · {{2}} produit(s)\n{{3}}\n→ Une seule liste à traiter.` |
| STOCK_ALERT | `Margin — Alerte stock\n{{1}}\n{{2}}\n→ {{3}}` |
| BILLING_DUNNING | `Margin — échec de paiement ({{1}}). Avant le {{2}} : {{3}}` |
| TEST | `{{1}}` |

Quand APPROVED : ajouter `TWILIO_WA_TEMPLATE_*=HX…` puis `WHATSAPP_REQUIRE_TEMPLATES=1`.

## 4. Callback
Dans Twilio sandbox / sender : status callback  
`https://margin-shop.vercel.app/api/webhooks/twilio/status`

## État actuel Margin
- App OK sans WhatsApp (alertes dans l’app)
- `WHATSAPP_REQUIRE_TEMPLATES` assoupli pour sandbox tant que Meta n’a pas validé
- Stripe = de ton côté


## 1. Créer le compte (2 min)
1. https://console.twilio.com
2. Crée / connecte-toi
3. Active **Messaging → Try it out → Send a WhatsApp message** (sandbox)
4. Sur ton téléphone : envoie le code sandbox au numéro Twilio
5. Copie :
   - Account SID (`AC…`)
   - Auth Token
   - Sandbox From : souvent `whatsapp:+14155238886`

## 2. Fichier local (ne pas committer)
Crée `MarginShop/.env.twilio` :

```
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Puis dis **« twilio prêt »** → l’agent pousse sur Vercel + redeploy.

## 3. Templates Meta (en parallèle, délai heures/jours)
Twilio → Content Template Builder → UTILITY → soumettre :

| Env | Corps |
|---|---|
| STOCK_RECAP | `Margin — Récap rupture\n{{1}} · {{2}} produit(s)\n{{3}}\n→ Une seule liste à traiter.` |
| STOCK_ALERT | `Margin — Alerte stock\n{{1}}\n{{2}}\n→ {{3}}` |
| BILLING_DUNNING | `Margin — échec de paiement ({{1}}). Avant le {{2}} : {{3}}` |
| TEST | `{{1}}` |

Quand APPROVED : ajouter `TWILIO_WA_TEMPLATE_*=HX…` puis `WHATSAPP_REQUIRE_TEMPLATES=1`.

## 4. Callback
Dans Twilio sandbox / sender : status callback  
`https://margin-shop.vercel.app/api/webhooks/twilio/status`

## État actuel Margin
- App OK sans WhatsApp (alertes dans l’app)
- `WHATSAPP_REQUIRE_TEMPLATES` assoupli pour sandbox tant que Meta n’a pas validé
- Stripe = de ton côté
