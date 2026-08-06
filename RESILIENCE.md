# Résilience Margin Shop — sync caisse (objectif 60+ clients)

**Date** : 2026-08-04  
**Périmètre** : pipeline webhook POS (point de passage unique multi-tenant)  
**Drill DRP** : `backups/drills/drill-report-20260804-151403.md`  
**Load test** : `scripts/load-test-pos-results-1785849272401.json`

---

## 1. Points uniques de défaillance (SPOF)

| Composant | Impact panne | Redondance actuelle | Mitigation prioritaire |
|---|---|---|---|
| **Vercel App / route webhook** | Tous les tenants : plus de sync live | Non (single region deploy) | Multi-région Vercel + ACK async (202) + retry POS |
| **Base de données (SQLite local / Supabase prod)** | Total — stock, auth, journal events | Local : **aucune**. Prod : HA Supabase (selon plan) | Bascule Postgres + PITR ; jamais SQLite en prod multi-tenant |
| **`PosWebhookEvent` + cron `pos-process` (50/min)** | Retries / DLQ gelés ; live sync OK tant que HTTP tient | Cron unique Vercel | Scale cron (parallèle par tenant) ou queue (Inngest) si backlog |
| **Pooler Supabase `connection_limit=1`** | Contention serverless sous pic | Non | Augmenter pool / Prisma Accelerate avant self-serve public |
| **Slack `OPS_SLACK_WEBHOOK_URL`** | Silence Ops (pas d’impact client) | Fallback `console.warn` | Webhook + email digest ; health check `/api/ops/pos-health` |
| **Secret `CRON_SECRET` / webhooks** | Si leak : injection ; si perdu : cron down | Non | Rotation secrets + monitoring 401 cron |

**Verdict** : le vrai SPOF métier est la **DB + chemin sync HTTP**. Le journal DB amortit les retries POS, mais une panne DB = panne globale.

---

## 2. Test de montée en charge (exécuté)

### Scénario
- **60 tenants** × **20 ventes** = **1 200** webhooks
- Concurrence **10** workers
- Mapping SKU strict + `recordSale` transactionnel (SQLite local)

### Résultats mesurés

| Métrique | Valeur |
|---|---|
| Throughput | **136,7 evt/s** |
| Succès | **1 200 / 1 200 (100 %)** |
| Latence p50 | **29 ms** |
| Latence p95 | **241 ms** |
| Latence p99 | **578 ms** |
| Latence max | **1 925 ms** |
| Capacité cron retry | **50 evt/min** → drain théorique burst complet en **24 min** si tout tombe en FAILED |

### Point de saturation actuel
1. **Live path** : sync dans la requête HTTP — OK pour pic weekend ~60 magasins si &lt; ~30 req/s soutenus (marge confortable vs 136/s mesurés en local).
2. **Cron DLQ** : **50/min** séquentiel — **marge insuffisante** si un incident crée un backlog &gt; 500 events (10+ min de retard).
3. **Prod serverless** : `connection_limit=1` + cold starts → p95 probablement plus haut qu’en local ; à re-mesurer sur staging Supabase.

### Scaling proposé (si / quand marge insuffisante)

| Phase | Action |
|---|---|
| **P0 (maintenant)** | ACK **202** après insert `RECEIVED` ; worker cron traite APPLIED (découple latence POS) |
| **P1 (self-serve)** | Paralleliser `processPending` par tenant (N=5–10) ; `maxDuration` 60s sur `pos-process` |
| **P2 (2e verticale)** | File Inngest/Trigger.dev ; throttle par `restaurantId` ; autoscaling workers |

Relancer : `npm run test:load:pos` (`TENANTS` / `EVENTS_PER` / `CONCURRENCY`).

---

## 3. Plan de reprise (DRP) — testé

### Fréquence backups
| Environnement | Fréquence | Outil |
|---|---|---|
| Local SQLite | **Manuelle** (`npm run db:backup`) — **pas de cron** | `scripts/backup-db.sh` |
| Prod Supabase (cible) | Snapshots fournisseur + **PITR** à activer | Console Supabase |

### Drill du 2026-08-04 (réel)

| Étape | Résultat |
|---|---|
| Backup | OK — 464K en **&lt; 1 s** |
| Restore + `PRAGMA integrity_check` | **ok** |
| Tables / restaurants / events | 34 / 1 / 0 |
| Rapport | `backups/drills/drill-report-20260804-151403.md` |

Relancer : `npm run drp:drill`.

### Objectifs stade actuel (60 clients / an)

| | Valeur |
|---|---|
| **RPO** | **≤ 24 h** (backup quotidien) — cible **≤ 1 h** avec PITR Postgres |
| **RTO** | **≤ 4 h** (restore manuel) — cible **≤ 30 min** runbook automatisé |

---

## 4. Observabilité

### Livré
| Élément | Emplacement |
|---|---|
| Snapshot santé 24h | `GET /api/ops/pos-health` (admin ou `CRON_SECRET`) |
| Dashboard Admin | `/admin` — bloc **Santé sync caisse · 24 h** |
| Alertes cron | `pos-process` appelle `notifyPosHealthAlerts` (seuils crit → Slack) |
| Seuils | `POS_HEALTH_THRESHOLDS` dans `src/lib/pos/health.ts` |

### Seuils

| Signal | Warn | Crit |
|---|---|---|
| Taux d’erreur (FAILED+DEAD+SKU_NOT_FOUND) | ≥ 2 % | ≥ 5 % |
| Latence p95 `received→applied` | ≥ 3 s | ≥ 8 s |
| DEAD / dernière heure | — | ≥ 5 |
| Backlog retry | ≥ 100 | ≥ 400 |

---

## 5. Plan de mitigation priorisé

| Priorité | Action | Effort | Effet |
|---|---|---|---|
| **P0** | Activer backups quotidiens + PITR Supabase en prod | S | RPO |
| **P0** | Poser `OPS_SLACK_WEBHOOK_URL` + surveiller `/api/ops/pos-health` | S | Détection |
| **P1** | ACK async 202 + worker (découple POS) | M | Latence / résilience |
| **P1** | Paralleliser cron retry par tenant | M | Backlog |
| **P1** | Rejouer load test sur **staging Postgres** | S | Vérité prod |
| **P2** | Queue managée + multi-région | L | Scale 2e verticale |

---

## Commandes

```bash
npm run test:load:pos          # charge 60×20
npm run drp:drill              # backup + restore testé
curl -s "http://localhost:3020/api/ops/pos-health?secret=$CRON_SECRET"
```
