# Checklist technique — intégration caisse → Margin Shop

**Produit** : Margin Shop · https://margin-shop.vercel.app  
**Contact** : partenariats / technique · Calendly https://calendly.com/reegency/30min

## 1. Modèle d’intégration (préféré → alternatif)

| Priorité | Mode | Description |
|----------|------|-------------|
| 1 | **Webhook sortant** | À chaque vente (ou ticket clôturé), POST JSON vers Margin |
| 2 | **Pull API** | Margin interroge périodiquement l’API commandes (clé partenaire) |
| 3 | **Export** | CSV/SFTP en secours (moins live) |

## 2. Endpoint Margin (par commerce)

```
POST https://margin-shop.vercel.app/api/webhooks/pos/{connectionId}
````

Headers recommandés :
````
Content-Type: application/json
x-webhook-secret: <secret fourni à la création de connexion>
````

Alias signé (optionnel) :
````
x-pos-signature: sha256=<hmac>
````

## 3. Payload minimal accepté

````json
{
  "secret": "<même secret ou header>",
  "order_id": "TICKET-12345",
  "sold_at": "2026-08-07T14:32:00+02:00",
  "items": [
    {
      "name": "Baguette tradition",
      "sku": "BAG-001",
      "quantity": 2,
      "unit_price": 1.2
    }
  ]
}
````

| Champ | Obligatoire | Notes |
|-------|-------------|--------|
| `order_id` | **Oui** | Stable (idempotence) |
| `items[].name` | **Oui** | Si pas de SKU |
| `items[].quantity` | **Oui** | > 0 vente ; négatif / event CANCEL si supporté |
| `items[].sku` | Recommandé | Matching catalogue |
| `sold_at` | Recommandé | ISO-8601 |
| `unit_price` | Optionnel | Analytics |

Événements utiles : **SALE**, **CANCEL**, **REFUND** (si dispo).

## 4. Comportement Margin

1. Réception → journal idempotent (`order_id` / event id)
2. Lignes inconnues → **produits découverts** (validation gérant)
3. Lignes connues → **mouvement stock** (recette / article)
4. Seuils → alertes app + WhatsApp

## 5. Ce dont nous avons besoin de votre côté

- [ ] Doc webhook ou API commandes (sandbox)
- [ ] Liste des champs ticket / lignes
- [ ] Auth (secret partagé, OAuth, clé API)
- [ ] Contact technique + délais validation partenaire
- [ ] Contraintes contractuelles (si applicable)

## 6. Preuve pilote

Nous pouvons fournir sous 24 h :
- 1 `connectionId` + URL + secret de test
- 1 commerce démo
- Logs de réception + impact stock

**Sécurité** : HTTPS only · secret par commerce · pas de carte bancaire dans le flux (uniquement ticket / lignes).
