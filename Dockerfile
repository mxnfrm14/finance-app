FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Prisma generation can run during installation; its inputs must exist first.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile

# One-shot maintenance image. Database credentials are provided only at runtime.
FROM deps AS migrate
USER node
CMD ["pnpm", "prisma:deploy"]

FROM deps AS builder
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
# Route modules construct a Prisma client while building, without querying it.
# The deployed container receives its real connection string through Compose.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
