#
# Multi-stage build — see docs/audit/PHASE1-ARCHITECTURE.md for the target
# ("single small container plus one managed Postgres instance"). No
# buildpack auto-detection: every step here is explicit.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime -----------------------------------------------------------
# Ships src/, scripts/, and drizzle/ alongside dist/ (not just the compiled
# client+server bundles) because the release step (migrate + seed) and the
# grant-admin CLI run through `tsx` against the TypeScript sources directly
# — see docker-entrypoint.sh and package.json's "release"/"grant-admin"
# scripts.
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
RUN addgroup -S deskbuz && adduser -S deskbuz -G deskbuz

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/deploy ./deploy
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/data ./data
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && chown -R deskbuz:deskbuz /app

USER deskbuz
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
