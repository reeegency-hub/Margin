# Setup Agent — contrat d’implémentation P0

## Invariants

1. Le LLM **propose** ; le serveur **écrit** uniquement après `Zod.parse` + confirmation UI.
2. Pipeline : `draft` → `preview` → `confirmed` → `committed` (TTL 1 h, `draft_id` → `commit_id`).
3. Ambiguïté → **flag**, jamais de guess silencieux (`price_no_currency`, `shift_overlap`, `bad_phone`…).
4. Secrets POS / API : **jamais** dans le chat — action UI `open_pos_wizard` uniquement.
5. **BYOK** : clé Anthropic/OpenAI du tenant, chiffrée, via `callTenantLLM` uniquement. Pas de fallback silencieux sur une clé plateforme (sauf `MARGIN_PLATFORM_LLM=1` explicite).

## Décision produit (`LLMNotConfiguredError`)

**Option A** : le chat libre est bloqué sans clé BYOK, avec CTA « Connecter mon IA ».  
Les imports CSV/PDF déterministes restent disponibles sans LLM.

## Fichiers clés

| Rôle | Chemin |
|---|---|
| Schémas Zod | `src/lib/assistant/schemas.ts` |
| Extraction CSV/TXT + overlaps | `src/lib/assistant/extract.ts` |
| PDF | `src/lib/assistant/pdf.ts` |
| Drafts / audit | `src/lib/assistant/drafts.ts` |
| Commits métier | `src/lib/assistant/commit.ts` |
| Filtrage secrets | `src/lib/assistant/secrets.ts` |
| BYOK validate / crypto / router | `src/lib/llm/*` |
| API credentials | `src/app/api/settings/llm-credentials/` |
| UI Settings BYOK | `src/components/settings/LlmByokForm.tsx` |
| Hub Accueil inline | `src/components/home/HomeSetupAgent.tsx` |
| API chat | `src/app/api/assistant/route.ts` |
| Prisma | `AssistantDraft`, `AssistantCommit`, `LlmProviderCredential` |

## Déploiement DB

Appliquer le schéma (`prisma db push` ou migration) pour `AssistantDraft` / `AssistantCommit` / `LlmProviderCredential` (+ events).
