# CLAUDE.md — Projet Bourse

## Vue d'ensemble
Application web de suivi d'investissements et d'analyse de marché par IA.
Déployée sur Proxmox (VM Ubuntu 24.04) via Docker Compose. 6-20 utilisateurs.

- **Framework** : Next.js 16 App Router, TypeScript strict
- **BDD** : PostgreSQL 16 via Prisma 7 (Docker en prod, local en dev)
- **IA** : Multi-provider (Anthropic / OpenAI / NVIDIA NIM / Ollama local) — `lib/ai/providers/`
- **Market data** : yahoo-finance2 v3 (server-side uniquement)
- **Auth** : NextAuth v5 + `@auth/prisma-adapter` (sessions en DB)
- **Deploy** : Docker Compose (app + postgres + nginx)

## Variables d'environnement

### Développement local (.env)
```env
# PostgreSQL local (Docker)
DATABASE_URL="postgresql://bourse:bourse@localhost:5432/bourse"

# IA — au moins un provider requis
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."                   # optionnel
NVIDIA_API_KEY="nvapi-..."                # optionnel — https://build.nvidia.com
OLLAMA_BASE_URL="http://localhost:11434"  # optionnel, modèles locaux

# Auth
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
```

### Production Proxmox (.env.production / Docker secrets)
```env
DATABASE_URL="postgresql://bourse:<password>@postgres:5432/bourse"
AUTH_SECRET="<secret long et aléatoire>"
AUTH_URL="https://bourse.mondomaine.fr"   # ou http://ip-locale:3000
ANTHROPIC_API_KEY="..."
NVIDIA_API_KEY="..."                      # optionnel
```

## Commandes courantes
```bash
# Développement
pnpm dev                                         # Next.js dev server
docker compose -f docker-compose.dev.yml up -d  # PostgreSQL local

# Base de données
pnpm prisma migrate dev           # appliquer migrations (dev)
pnpm prisma migrate deploy        # appliquer migrations (prod)
pnpm prisma studio                # explorer la BDD visuellement
pnpm prisma db seed               # créer utilisateur admin de démo

# Production (sur la VM Proxmox)
docker compose up -d                                          # démarrer tous les services
docker compose logs -f app                                    # logs Next.js
docker compose exec db psql -U bourse bourse                  # console PostgreSQL
docker compose exec db pg_dump -U bourse bourse > backup.sql  # backup

# TypeScript
pnpm type-check   # vérification des types
pnpm build        # build de production
```

## Architecture Docker Compose (prod)

```
docker-compose.yml
├── app      — Next.js (Node.js 20, port 3000)
├── postgres — PostgreSQL 16 (port 5432, interne uniquement)
└── nginx    — Reverse proxy (ports 80/443, SSL Let's Encrypt)
```

```
Proxmox VM (Ubuntu 24.04 LTS — 4 vCPU, 8GB RAM, 80GB SSD)
└── Docker Compose
    ├── bourse-app:3000   (interne → nginx)
    ├── postgres:5432     (interne uniquement)
    └── nginx:80/443      (exposé)
```

## Architecture IA (multi-provider)

```
lib/ai/
├── providers/
│   ├── index.ts        # getProvider() + chaîne de fallback automatique
│   ├── anthropic.ts    # Anthropic — tool use natif, accepte apiKey en paramètre
│   ├── openai.ts       # OpenAI — function calling (compatible Ollama + NVIDIA NIM)
│   └── ollama.ts       # Ollama REST — mode dégradé si no tool support
├── agent-loop.ts       # Boucle agentic provider-agnostic (AsyncGenerator)
├── tools/
│   ├── index.ts                 # Registry + définitions Anthropic + OpenAI
│   ├── get-stock-price.ts       # yahoo-finance2 quote() + resolveSymbol fallback
│   ├── get-fundamentals.ts      # yahoo-finance2 quoteSummary() + resolveSymbol fallback
│   ├── get-historical-prices.ts # yahoo-finance2 historical() + resolveSymbol fallback
│   ├── search-news.ts           # Yahoo Finance API + SDK fallback
│   ├── get-portfolio-context.ts # lecture PostgreSQL du portfolio user
│   ├── search-instrument.ts     # yahoo-finance2 search() — résolution canonique
│   └── get-etf-holdings.ts      # yahoo-finance2 quoteSummary topHoldings + resolveSymbol
└── client.ts           # Singleton Anthropic (provider Anthropic seulement)
```

**Providers supportés :**

| Provider | Implémentation | Base URL | Config |
|---|---|---|---|
| Anthropic (Claude) | `anthropic.ts` | api.anthropic.com | `ANTHROPIC_API_KEY` / DB `anthropic_api_key` |
| OpenAI | `openai.ts` | api.openai.com | `OPENAI_API_KEY` / DB `openai_api_key` |
| NVIDIA NIM | `openai.ts` (compat) | `https://integrate.api.nvidia.com/v1` | `NVIDIA_API_KEY` / DB `nvidia_api_key` |
| Ollama | `openai.ts` (compat) | `http://localhost:11434/v1` | `OLLAMA_BASE_URL` / DB `ollama_base_url` |

**Fallback automatique** : provider configuré → Anthropic → OpenAI → NVIDIA → Ollama.
**Config en DB** (`AppConfig`) : la clé API peut être stockée via `POST /api/settings/ai` — prioritaire sur les env vars.
**Ollama tool use** : llama3.1, mistral-nemo, qwen2.5 seulement. Sinon mode dégradé.

## Auth — NextAuth v5 + Prisma Adapter
- Sessions stockées en DB PostgreSQL (table `Session`)
- `@auth/prisma-adapter` : auto-gère les tables `User`, `Session`, `Account`, `VerificationToken`
- Credentials provider (email + mot de passe bcrypt)
- Rôles : `admin` (gère les comptes depuis `/admin`) et `member`
- Inscription publique : `/register` (rôle `member` forcé)

```typescript
// Côté serveur : auth() pour obtenir la session
import { auth } from "@/auth"
const session = await auth()

// Côté client : NE PAS utiliser useSession() — pas de SessionProvider
// Pattern correct : server component lit auth(), passe les données en props au client component
export default async function Page() {
  const session = await auth()
  return <ClientComponent userEmail={session?.user?.email ?? ""} />
}
```

**Fichiers Auth :**
- `auth.ts` — config complète NextAuth (bcrypt, Prisma adapter)
- `auth.config.ts` — config légère sans bcrypt (pour l'edge runtime)
- `proxy.ts` — protection des routes (utilise `getToken` de `next-auth/jwt`, compatible edge)

## Résolution des tickers Yahoo Finance

`lib/market-data/yahoo-finance.ts` expose `resolveSymbol(ticker)` :
- Cherche le ticker via `yf.search()` et retourne le symbole canonique
- Ex : `CW8` → `CW8.PA`, `total` → `TTE.PA`, `bnp` → `BNP.PA`

**Tous les outils IA** ont un fallback automatique :
1. Essai avec le ticker fourni
2. Si null/vide/erreur → `resolveSymbol()` → retry avec le ticker canonique
3. Si toujours vide → message d'erreur clair indiquant le format attendu

## Domaine financier — concepts clés
- **PRU** (Prix de Revient Unitaire) : coût moyen pondéré, recalculé via `lib/portfolio/pru-calculator.ts::computeNewPru()`
- **Valeur latente** : `(prixActuel - PRU) × quantité`
- **PEA** : Plan Épargne Actions, plafonné 150k€, exonéré après 5 ans
- **PFU** : flat tax 30% (12,8% IR + 17,2% PS) sur plus-values hors PEA
- **CTO** : Compte-Titres Ordinaire, sans avantage fiscal
- **Assurance Vie** : épargne avec avantages successoraux
- **Turbo/ETP** : levier avec barrière désactivante

## Règle critique — Calcul P&L
**Ne jamais lire `Position.pru` ou `Position.quantity` directement.**
Toujours passer par `lib/db/queries/portfolio-summary.ts` qui recalcule depuis les transactions.

```typescript
// CORRECT :
const { pru, quantity } = await computePruFromTransactions(positionId)
const pnl = (currentPrice - pru) * quantity

// INTERDIT (valeur statique = fausse après transactions multiples) :
const pnl = (currentPrice - position.pru) * position.quantity
```

## Agent — 3 modes

1. **portfolio** : analyse portefeuille complet, recommande rééquilibrage
2. **instrument** (`target: string`) : prix + fondamentaux + news d'un ticker/ISIN
3. **market** : overview marché, ETFs recommandés selon contexte macro

**Règles du system prompt :**
- Tickers sans `.` → appeler `search_instrument` d'abord pour résoudre (ex: `CW8` → `CW8.PA`)
- ETF : fondamentaux (PE, EPS) souvent null — normal, se concentrer sur cours + historique + composition
- Ne jamais formuler BUY/HOLD/SELL avec conviction < 3 sans données minimales

## Streaming SSE
`POST /api/agent/analyze` → `Content-Type: text/event-stream`
```typescript
type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; toolName: string; input: unknown }
  | { type: "tool_result"; toolName: string; result: unknown }
  | { type: "done" }
  | { type: "error"; error: string }   // codes: AUTH_ERROR, RATE_LIMIT, API_ERROR: ...
```

**UI agent** (`components/agent/agent-chat.tsx`) :
- Tant que `content === ""` : affiche une pastille animée unique (texte qui change toutes les 2s + outil courant)
- Dès le premier token texte : la pastille disparaît, la bulle de réponse s'affiche
- Après la réponse : aucune pastille résiduelle
- Erreurs : composant `ErrorMessage` avec titre lisible + lien vers Paramètres si nécessaire

## Cache des prix
`lib/market-data/price-cache.ts` expose deux fonctions :
- `getCachedPrices(isins)` — cache par ISIN pour le portfolio (TTL 15 min)
- `getCachedQuotesByTicker(tickers)` — cache par ticker pour la page Marché (TTL 15 min, stocke le ticker comme clé `isin` dans `PriceCache`)

## Routes API — référence rapide

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/[...nextauth]` | NextAuth (login, logout, session) |
| POST | `/api/auth/register` | Inscription publique (rôle member) |
| GET/POST | `/api/positions` | Liste positions / créer position |
| GET/PATCH/DELETE | `/api/positions/[id]` | Détail / modifier / supprimer |
| GET/POST | `/api/transactions` | Transactions d'une position |
| DELETE | `/api/transactions/[id]` | Supprimer + recalcul PRU |
| GET | `/api/prices` | Batch refresh prix |
| GET | `/api/market/quote` | Prix d'un ticker (`?tickers=AAPL,MC.PA`) |
| GET | `/api/market/search` | Recherche instrument (`?q=apple`) |
| GET | `/api/market/fundamentals` | Fondamentaux (`?ticker=AAPL`) |
| GET | `/api/market/news` | News d'un instrument |
| POST | `/api/agent/analyze` | Agent IA — SSE streaming |
| GET/POST | `/api/settings/ai` | Lire / sauvegarder config IA (provider, model, apiKey) |
| GET/POST | `/api/brokers` | Courtiers de l'utilisateur |
| GET/POST | `/api/watchlist` | Watchlist |
| DELETE | `/api/watchlist/[id]` | Retirer de la watchlist |
| GET/POST | `/api/alerts` | Alertes de prix |
| GET/POST | `/api/users` | Admin : liste / créer utilisateur |
| PATCH | `/api/users/[id]/password` | Admin : reset mot de passe |
| GET/PATCH | `/api/users/me` | Profil courant |

## Structure des dossiers

```
bourse/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx          # inscription publique (rôle member)
│   ├── (app)/
│   │   ├── dashboard/page.tsx         # KPIs, allocation, top movers
│   │   ├── portfolio/
│   │   │   ├── page.tsx               # liste des positions
│   │   │   ├── new/page.tsx           # ajouter une position
│   │   │   └── [id]/page.tsx          # détail + transactions
│   │   ├── agent/page.tsx             # interface agent IA (SSE streaming)
│   │   ├── market/page.tsx            # recherche instrument + prix live
│   │   ├── analytics/page.tsx         # graphiques P&L, allocation
│   │   ├── watchlist/page.tsx         # watchlist + alertes prix
│   │   ├── settings/page.tsx          # config IA provider, profil, courtiers
│   │   └── admin/page.tsx             # gestion utilisateurs (admin only)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── auth/register/route.ts     # inscription publique
│       ├── agent/analyze/route.ts     # SSE streaming agent
│       ├── positions/route.ts
│       ├── positions/[id]/route.ts
│       ├── transactions/route.ts
│       ├── transactions/[id]/route.ts
│       ├── prices/route.ts
│       ├── market/quote/route.ts
│       ├── market/search/route.ts
│       ├── market/fundamentals/route.ts
│       ├── market/news/route.ts
│       ├── settings/ai/route.ts       # GET + POST config IA (provider, model, clé)
│       ├── brokers/route.ts
│       ├── watchlist/route.ts
│       ├── watchlist/[id]/route.ts
│       ├── alerts/route.ts
│       ├── users/route.ts
│       ├── users/[id]/password/route.ts
│       └── users/me/route.ts
├── components/
│   ├── ui/                            # shadcn/ui
│   ├── nav-sidebar.tsx
│   ├── agent/
│   │   └── agent-chat.tsx             # interface SSE + pastille animée
│   ├── portfolio/
│   │   └── add-position-form.tsx
│   ├── market/
│   │   └── market-client.tsx
│   ├── settings/
│   │   └── settings-client.tsx        # config IA + courtiers + langue
│   └── admin/
│       └── admin-client.tsx           # liste users + reset password
├── lib/
│   ├── ai/
│   │   ├── providers/
│   │   │   ├── index.ts               # getProvider() + fallback chain
│   │   │   ├── anthropic.ts           # accepte apiKey en constructeur
│   │   │   ├── openai.ts              # compatible OpenAI + NVIDIA + Ollama
│   │   │   └── ollama.ts
│   │   ├── agent-loop.ts              # buildSystemPrompt() + runAgentStream()
│   │   ├── tools/                     # 7 outils avec fallbacks
│   │   └── client.ts
│   ├── db/
│   │   ├── client.ts
│   │   └── queries/
│   │       └── portfolio-summary.ts   # calcul P&L depuis transactions
│   ├── market-data/
│   │   ├── yahoo-finance.ts           # resolveSymbol() — résolution ticker canonique
│   │   ├── price-cache.ts             # getCachedPrices() + getCachedQuotesByTicker()
│   │   ├── frankfurter.ts
│   │   ├── fundamentals.ts            # getFundamentals() avec resolveSymbol fallback
│   │   └── watchlist-history.ts
│   ├── portfolio/
│   │   └── pru-calculator.ts          # computeNewPru() — TOUJOURS utiliser
│   └── i18n/
│       ├── translations.ts
│       └── context.tsx
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── auth.ts                            # config complète NextAuth
├── auth.config.ts                     # config légère (edge-safe, sans bcrypt)
├── proxy.ts                           # protection routes (getToken, edge-compatible)
├── next.config.ts
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
└── nginx/nginx.conf
```

## Gotchas
- `yahoo-finance2` : server-side uniquement (jamais dans composants React)
- **Tickers Yahoo Finance** : toujours utiliser le symbole canonique avec suffixe exchange (`CW8.PA`, `TTE.PA`). `resolveSymbol()` gère la résolution automatique dans les outils.
- **`proxy.ts`** (pas `middleware.ts`) : Next.js 16 + edge runtime exige `export default function proxy()`. Utilise `getToken` de `next-auth/jwt` (sans bcrypt = compatible edge). `auth.config.ts` est le pendant léger pour l'edge.
- **Pas de `SessionProvider`** : utiliser le pattern server component → props scalaires vers client component. `useSession()` lèvera une erreur sans `SessionProvider`.
- **Config IA en DB** : les clés API stockées dans `AppConfig` via `/api/settings/ai` sont prioritaires sur les variables d'environnement. La clé Anthropic est stockée sous `anthropic_api_key`, NVIDIA sous `nvidia_api_key`.
- Prisma migrations : `migrate dev` en dev, `migrate deploy` en prod (dans le Dockerfile)
- NextAuth v5 + Prisma adapter : le schema Prisma doit inclure les modèles `Account`, `Session`, `VerificationToken`
- Docker : `app` doit attendre que `postgres` soit healthy (`depends_on` avec `condition: service_healthy`)
- `nginx/nginx.conf` : `proxy_buffering off` + `proxy_read_timeout 86400` obligatoires pour le SSE de l'agent
