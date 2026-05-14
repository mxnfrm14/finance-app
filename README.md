# Bourse

Bourse is a Next.js 16 application for investment tracking and AI-assisted market analysis. It uses PostgreSQL with Prisma, NextAuth v5 for authentication, and multiple AI providers for research and analysis.

## Features

- Portfolio tracking with positions, transactions, PRU recalculation, and P&L derived from transaction history.
- Market data lookup powered by Yahoo Finance, including price, fundamentals, news, and instrument search.
- AI assistant with provider fallback support for Anthropic, OpenAI, NVIDIA NIM, and Ollama.
- Watchlists, alerts, broker management, analytics, and an admin area.
- Docker-based deployment for local development and production.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- PostgreSQL 16
- Prisma 7
- NextAuth v5
- Tailwind CSS 4
- yahoo-finance2

## Project Structure

- `app/` - App Router pages and API routes
- `components/` - Reusable UI and feature components
- `lib/` - Database, AI, market data, portfolio, and i18n helpers
- `prisma/` - Prisma schema, migrations, and seed script
- `docker-compose.yml` - Production stack
- `docker-compose.dev.yml` - Local PostgreSQL for development

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 16
- Docker and Docker Compose for local database or full stack deployment

## Environment Variables

Create a `.env` file for local development:

```env
DATABASE_URL="postgresql://bourse:bourse@localhost:5432/bourse"
AUTH_SECRET="your-long-random-secret"
AUTH_URL="http://localhost:3000"

# At least one AI provider is required if you use the agent features
ANTHROPIC_API_KEY="your-api-key"
OPENAI_API_KEY=""
NVIDIA_API_KEY=""
OLLAMA_BASE_URL="http://localhost:11434"
```

For production, point `DATABASE_URL` to the PostgreSQL container or managed database used by your deployment, and set `AUTH_URL` to the public URL of the app.

## Local Development

1. Install dependencies.

```bash
pnpm install
```

2. Start PostgreSQL.

```bash
docker compose -f docker-compose.dev.yml up -d
```

3. Generate Prisma client and apply migrations.

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

4. Start the development server.

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

## Production Deployment

The production stack uses Docker Compose with three services:

- `app` - Next.js runtime
- `postgres` - PostgreSQL 16
- `nginx` - Reverse proxy and TLS termination

Basic flow:

```bash
docker compose up -d
```

If you deploy on a LAN server, set `AUTH_URL` to the server IP or hostname, and make sure the database URL points to the internal Postgres service from the app container.

## Database Commands

Prisma is the layer that sits between the app and PostgreSQL. In this project it does three main jobs:

- it defines the database schema in `prisma/schema.prisma`
- it generates the type-safe client used by the app to talk to the database
- it manages schema changes through migrations

Use these commands depending on what you want to do:

```bash
pnpm prisma:generate   # Rebuild the Prisma client after schema changes or a fresh install
pnpm prisma:migrate    # Create and apply a new migration during local development
pnpm prisma:deploy     # Apply already-created migrations in production or on a server
pnpm prisma:studio     # Open a browser UI to inspect and edit database tables
pnpm prisma:seed       # Insert demo or initial data into the database
```

Practical rule:

- use `prisma:generate` when the schema changed or Prisma client is missing
- use `prisma:migrate` when developing locally and you changed the schema
- use `prisma:deploy` when you only want to apply existing migrations on a deployed database
- use `prisma:studio` when you want to look at data manually
- use `prisma:seed` when you need sample data or a first admin/demo setup

## Quality Checks

```bash
pnpm type-check
pnpm build
```

## Main API Routes

- `POST /api/auth/[...nextauth]`
- `POST /api/auth/register`
- `GET/POST /api/positions`
- `GET/PATCH/DELETE /api/positions/[id]`
- `GET/POST /api/transactions`
- `DELETE /api/transactions/[id]`
- `GET /api/prices`
- `GET /api/market/quote`
- `GET /api/market/search`
- `GET /api/market/fundamentals`
- `GET /api/market/news`
- `POST /api/agent/analyze`
- `GET/POST /api/settings/ai`
- `GET/POST /api/brokers`
- `GET/POST /api/watchlist`
- `DELETE /api/watchlist/[id]`
- `GET/POST /api/alerts`
- `GET/POST /api/users`
- `PATCH /api/users/[id]/password`
- `GET/PATCH /api/users/me`

## Notes

- `yahoo-finance2` is server-side only and should not be imported in client components.
- Do not use `useSession()` in client components; read the session in server components with `auth()` and pass data down as props.
- P&L must be computed from transaction history through `lib/db/queries/portfolio-summary.ts`, not from static position fields.
