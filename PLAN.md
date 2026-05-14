# Plan d'action — Projet Bourse

App de suivi d'investissements + agent IA d'analyse de marché.
Déployée sur Proxmox via Docker Compose. PostgreSQL. NextAuth v5. 6-20 utilisateurs.

**Repo source de référence** : `../finance_app` (pièces réutilisables documentées ci-dessous)

---

## Légende
- `[ ]` — À faire
- `[x]` — Terminé
- `[~]` — En cours
- `⚠` — Fichier critique, ne pas rater

---

## Sprint 1 — Fondations ✅

### Environnement
- [x] Initialiser le projet Next.js (manuel — répertoire non vide)
- [x] Installer les dépendances (+ `pg`, `@prisma/adapter-pg` pour Prisma 7)
- [x] Créer `.env`
- [x] Créer `.gitignore`

> **Note Prisma 7** : La propriété `url` n'est plus dans `schema.prisma` mais dans `prisma.config.ts`.
> Driver PostgreSQL : `@prisma/adapter-pg` (package `pg`). Voir `lib/db/client.ts`.

### PostgreSQL local (dev)
- [x] Créer `docker-compose.dev.yml`
- [ ] `docker compose -f docker-compose.dev.yml up -d` ← **nécessite Docker Desktop installé**

### Prisma + BDD ⚠
- [x] Créer `prisma/schema.prisma` — provider `postgresql` (Prisma 7 : pas de `url` dans le schema)
  - Tous les modèles créés : NextAuth + métier + assurance + watchlist + AgentSession + PriceAlert
- [ ] `pnpm prisma migrate dev --name init` ← **attend Docker Desktop**
- [x] `pnpm prisma generate` ✅

### Auth ⚠
- [x] Créer `auth.ts` (Credentials + JWT + callbacks role/language)
- [x] Créer `middleware.ts`
- [x] Créer `app/api/auth/[...nextauth]/route.ts`
- [x] Créer `app/(auth)/login/page.tsx`

### Infrastructure lib
- [x] `lib/db/client.ts` (Prisma 7 + `@prisma/adapter-pg`)
- [x] `lib/ai/client.ts` (singleton Anthropic)
- [x] `lib/i18n/translations.ts` (enrichi + nouvelles clés agent/market/watchlist)
- [x] `lib/i18n/context.tsx` (**hydration mismatch corrigé** — pas de useEffect au montage)
- [x] `lib/portfolio/pru-calculator.ts` (+ `computePruFromTransactions()`)
- [x] `lib/market-data/yahoo-finance.ts` + `price-cache.ts` + `frankfurter.ts` + `watchlist-history.ts`
- [x] `lib/market-data/fundamentals.ts` (nouveau — quoteSummary wrapper)
- [x] `app/globals.css` (thème finance clair/sombre + classes .pnl-positive / .pnl-negative)
- [x] `app/layout.tsx` (initialLanguage depuis session serveur)
- [x] `app/page.tsx` (redirect /dashboard)
- [x] `app/dashboard/page.tsx` (placeholder)

---

## Sprint 2 — Design System [~EN COURS]

- [x] `app/globals.css` créé avec palette finance (profit/loss, thème clair/sombre)
- [ ] Invoquer le skill `ui-ux-pro-max` pour affiner le design system
- [ ] Installer shadcn/ui
  ```bash
  pnpm dlx shadcn@latest init
  pnpm dlx shadcn@latest add button card badge input label select textarea \
    dialog dropdown-menu separator scroll-area tabs tooltip progress skeleton
  ```
- [ ] Créer `components/nav-sidebar.tsx`
- [ ] Mettre à jour `app/layout.tsx` avec NavSidebar

---

## Sprint 3 — Fix P&L (bug critique de finance_app) ⚠

> **Problème** : `Position.pru` et `Position.quantity` sont des snapshots statiques.
> `pru-calculator.ts` existe mais n'est jamais appelé.
> **Fix** : calcul depuis les transactions à chaque mutation.

- [ ] Réécrire `lib/db/queries/portfolio-summary.ts`
  - `quantity = SUM(BUY) - SUM(SELL)` depuis les transactions
  - `invested` calculé via `computeNewPru()` sur l'historique
  - `pnl = currentPrice × quantity - invested`
- [ ] Créer `app/api/transactions/route.ts` (GET + POST)
  - POST : crée la transaction + appelle `computeNewPru()` + met à jour `Position.pru` et `Position.quantity`
- [ ] Créer `app/api/transactions/[id]/route.ts` (DELETE)
  - DELETE : supprime la transaction + recalcule PRU sur le reste
- [ ] Adapter `app/api/positions/[id]/route.ts` (PATCH)
  - Si la quantité ou le prix changent → recalcul PRU
- [ ] Créer `components/portfolio/transaction-form.tsx` (achat / vente / dividende)

---

## Sprint 4 — Abstraction IA multi-provider

- [ ] Définir l'interface `AIProvider` dans `lib/ai/providers/index.ts`
  ```typescript
  interface AIProvider {
    name: string
    isAvailable(): Promise<boolean>
    runAgentStream(
      messages: MessageParam[],
      tools: ToolDefinition[],
      systemPrompt: string
    ): AsyncGenerator<AgentEvent>
  }
  ```
- [ ] Implémenter `lib/ai/providers/anthropic.ts`
  - Tool use natif (`@anthropic-ai/sdk`)
  - Modèle configurable (défaut : `claude-opus-4-6`)
- [ ] Implémenter `lib/ai/providers/openai.ts`
  - Function calling OpenAI (`openai` npm)
  - Compatible avec toute API OpenAI-like (Groq, Mistral, etc.)
  - Modèle configurable (défaut : `gpt-4o`)
- [ ] Implémenter `lib/ai/providers/ollama.ts`
  - API REST Ollama (`http://localhost:11434/api/chat`)
  - Détection tool support : liste des modèles connus (llama3.1, mistral-nemo, qwen2.5)
  - Mode dégradé si no tool support : données injectées en contexte
- [ ] Implémenter `getProvider()` + chaîne de fallback dans `lib/ai/providers/index.ts`
- [ ] Créer `app/settings/page.tsx` + `app/api/users/me/ai-config/route.ts`
  - Formulaire : provider (select), modèle (input), clé API, URL Ollama
  - Stocké dans `AppConfig` (table existante)

---

## Sprint 5 — Agent IA avec tool use ⚠

### Outils (lib/ai/tools/)
- [ ] `lib/ai/tools/index.ts` — registry + définitions format Anthropic ET OpenAI
- [ ] `lib/ai/tools/get-stock-price.ts` — `yahoo-finance2.quote()` : prix, variation %, market cap
- [ ] `lib/ai/tools/get-fundamentals.ts` — `yahoo-finance2.quoteSummary()` : PE, EPS, beta, dividende, 52w
- [ ] `lib/ai/tools/get-historical-prices.ts` — `yahoo-finance2.historical()` : OHLCV 1mo/3mo/6mo/1y
- [ ] `lib/ai/tools/search-news.ts` — fetch + parse HTML depuis domaines autorisés (boursorama, zonebourse, lesechos)
- [ ] `lib/ai/tools/get-portfolio-context.ts` — lit le portfolio PostgreSQL de l'utilisateur courant
- [ ] `lib/ai/tools/search-instrument.ts` — `yahoo-finance2.search()` : ticker/ISIN/nom
- [ ] `lib/ai/tools/get-etf-holdings.ts` — `yahoo-finance2.quoteSummary(['topHoldings'])` : composition ETF

### Boucle agent
- [ ] Créer `lib/ai/system-prompt.ts` (expertise investisseur français : PEA, PRU, PFU, turbos)
- [ ] Créer `lib/ai/agent-loop.ts` ⚠
  - Boucle : call provider → stream text → exécuter tool_use → repeat until end_turn
  - Yield : `AgentEvent` (text / tool_start / tool_result / done)
  - Gestion timeout + max iterations (sécurité)
- [ ] Créer `app/api/agent/analyze/route.ts` ⚠ (SSE streaming)
  - `POST` → `ReadableStream` + `Content-Type: text/event-stream`
  - Body : `{ mode: "portfolio" | "instrument" | "market", target?: string }`
  - Sauvegarde la session dans `AgentSession`

### UI Agent
- [ ] Créer `components/agent/tool-call-display.tsx`
  - Mappe les noms d'outils en labels français lisibles
  - Indicateur loading pendant l'exécution
- [ ] Créer `components/agent/recommendation-card.tsx`
  - Verdict BUY / HOLD / SELL avec badge coloré
  - Score de risque 1-10, arguments pro/con
- [ ] Créer `components/agent/agent-chat.tsx`
  - Tabs : Portfolio / Instrument / Marché
  - Input texte pour le mode Instrument (ticker/ISIN)
  - Zone de streaming en temps réel
  - Bouton "Analyser" → POST `/api/agent/analyze` → consomme SSE
- [ ] Créer `app/agent/page.tsx`

---

## Sprint 6 — Pages principales

### Dashboard
- [ ] Créer `app/dashboard/page.tsx`
  - KPIs : valeur totale, P&L total (€ et %), répartition par enveloppe
  - Tableau des positions avec prix temps réel (via `/api/prices`)
  - Section watchlist (instruments surveillés)

### Portfolio
- [ ] Créer `app/portfolio/page.tsx` (liste positions + P&L correct)
- [ ] Créer `app/portfolio/new/page.tsx` (ajouter position + première transaction)
- [ ] Créer `app/portfolio/[id]/page.tsx`
  - Historique des prix (chart)
  - Liste des transactions avec totaux
  - Bouton "Ajouter transaction" → `TransactionForm`
  - Bouton "Analyser avec IA" → redirige vers `/agent?ticker=...`
- [ ] Créer `components/portfolio/position-card.tsx` (P&L correct depuis transactions)
- [ ] Créer `app/api/positions/route.ts` (GET + POST)
- [ ] Créer `app/api/positions/[id]/route.ts` (GET + PATCH + DELETE)

### Marché
- [ ] Créer `app/market/page.tsx`
  - Barre de recherche → `InstrumentSearch`
  - `QuoteCard` : prix, variation, fundamentals synthétiques
  - Bouton "Analyser avec l'agent IA"
- [ ] Créer `components/market/instrument-search.tsx`
- [ ] Créer `components/market/quote-card.tsx`
- [ ] Créer `lib/market-data/fundamentals.ts` (wrapper `quoteSummary`)
- [ ] Créer `lib/market-data/news-scraper.ts` (fetch + extraction HTML)
- [ ] Créer `app/api/market/quote/route.ts`
- [ ] Créer `app/api/market/search/route.ts`
- [ ] Créer `app/api/market/fundamentals/route.ts`
- [ ] Créer `app/api/market/news/route.ts`

### Analytics
- [ ] Créer `app/analytics/page.tsx`
  - Évolution P&L dans le temps (AreaChart recharts)
  - Répartition par secteur (PieChart)
  - Répartition par enveloppe PEA/CTO/AV
- [ ] Créer `components/charts/pnl-timeline.tsx`
- [ ] Créer `components/charts/allocation-pie.tsx`

---

## Sprint 7 — Watchlist, alertes, i18n, admin

### Watchlist + alertes
- [ ] Créer `app/watchlist/page.tsx` (liste + alertes configurées)
- [ ] Créer `app/api/watchlist/route.ts` + `app/api/watchlist/[id]/route.ts`
- [ ] Créer `app/api/alerts/route.ts` (GET + POST + DELETE)
- [ ] Vérification alertes dans `/api/prices` : si prix franchit le seuil → marquer `triggered`

### Fix i18n ⚠ (bug hydration mismatch)
- [ ] Corriger `lib/i18n/context.tsx`
  - Supprimer le `useEffect` qui lit localStorage après hydration
  - Accepter une prop `initialLanguage` pour initialisation côté serveur
- [ ] Corriger `app/layout.tsx`
  - Lire `session.user.language` via `auth()` (server component)
  - Passer `initialLanguage` au `LanguageProvider`
  - Attribut `html lang` dynamique
- [ ] Vérifier `/api/users/me/language` (update DB → fonctionne déjà dans finance_app)

### Admin
- [ ] Créer `app/admin/page.tsx` (liste utilisateurs, créer/supprimer compte)
- [ ] Créer `app/api/users/route.ts` (GET liste + POST créer — admin only)
- [ ] Créer `app/(auth)/register/page.tsx` (accessible uniquement via invitation admin)

---

## Sprint 8 — Docker, déploiement Proxmox

### Fichiers Docker
- [ ] Créer `Dockerfile` (build multi-stage Node 20 alpine)
  ```dockerfile
  FROM node:20-alpine AS deps
  # installer pnpm + dépendances

  FROM node:20-alpine AS builder
  # pnpm build (output: standalone)

  FROM node:20-alpine AS runner
  # copier .next/standalone
  # CMD node server.js
  ```
- [ ] Créer `docker-compose.yml` (prod)
  ```yaml
  services:
    app:
      build: .
      restart: unless-stopped
      depends_on:
        postgres: { condition: service_healthy }
      environment:
        DATABASE_URL, AUTH_SECRET, AUTH_URL, ANTHROPIC_API_KEY
    postgres:
      image: postgres:16-alpine
      restart: unless-stopped
      volumes: [pg_data:/var/lib/postgresql/data]
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U bourse"]
        interval: 5s
        timeout: 5s
        retries: 10
    nginx:
      image: nginx:alpine
      ports: ["80:80", "443:443"]
      volumes: [./nginx/nginx.conf:/etc/nginx/nginx.conf:ro]
  ```
- [ ] Créer `nginx/nginx.conf` (reverse proxy app:3000, headers sécurité, prêt SSL)
- [ ] Créer `.dockerignore`
- [ ] Ajouter `output: "standalone"` dans `next.config.ts`

### Seed & migration prod
- [ ] Créer `prisma/seed.ts` (utilisateur admin de démo : admin@bourse.local / password)
- [ ] Vérifier que `pnpm prisma migrate deploy` tourne correctement dans le conteneur

### Déploiement sur Proxmox
- [ ] Créer la VM Ubuntu 24.04 sur Proxmox (4 vCPU, 8GB RAM, 80GB SSD)
- [ ] Installer Docker + Docker Compose sur la VM
- [ ] Configurer le `.env` de production
- [ ] `docker compose up -d --build`
- [ ] `docker compose exec app npx prisma migrate deploy`
- [ ] `docker compose exec app npx prisma db seed`

---

## Checklist de vérification finale

### Fonctionnel
- [ ] Login / logout fonctionne
- [ ] Admin crée un compte membre → membre peut se connecter
- [ ] Ajouter position + 2 achats + 1 vente partielle → PRU et quantité corrects dans le dashboard
- [ ] Agent instrument : saisir "AAPL" → l'agent appelle `get_stock_price`, `get_fundamentals`, `search_news` → recommandation BUY/HOLD/SELL
- [ ] Agent portfolio → conseils de rééquilibrage basés sur les positions réelles
- [ ] Agent marché → suggestions ETF avec contexte macro
- [ ] Watchlist : ajouter instrument + fixer alerte → alerte se déclenche au bon prix
- [ ] Changer la langue → rafraîchir → langue persiste sans flash

### Infrastructure
- [ ] `docker compose up -d` démarre tout sans erreur
- [ ] PostgreSQL healthy avant que l'app démarre
- [ ] `docker compose exec db pg_dump -U bourse bourse > backup.sql` fonctionne
- [ ] Nginx reverse proxy répond sur le port 80

### Qualité
- [ ] `pnpm build` sans erreurs TypeScript
- [ ] Aucun appel `yahoo-finance2` côté client (uniquement server-side)
- [ ] Aucun accès direct à `Position.pru` / `Position.quantity` pour le P&L

---

## Fichiers à copier de `../finance_app`

| Source | Destination | Modification |
|---|---|---|
| `auth.ts` | `auth.ts` | Ajouter `@auth/prisma-adapter` + callback `role` |
| `middleware.ts` | `middleware.ts` | Aucune |
| `lib/db/client.ts` | `lib/db/client.ts` | Aucune |
| `lib/ai/client.ts` | `lib/ai/client.ts` | Aucune |
| `lib/market-data/yahoo-finance.ts` | idem | Aucune |
| `lib/market-data/price-cache.ts` | idem | Aucune |
| `lib/market-data/frankfurter.ts` | idem | Aucune |
| `lib/market-data/watchlist-history.ts` | idem | Aucune |
| `lib/i18n/translations.ts` | idem | Enrichir si besoin |
| `lib/i18n/context.tsx` | idem | Fix hydration (Sprint 7) |
| `lib/portfolio/pru-calculator.ts` | idem | Intégrer dans transactions (Sprint 3) |
| `prisma/schema.prisma` | base pour adaptation | Changer provider, ajouter modèles |

---

*Dernière mise à jour : 2026-04-29*
