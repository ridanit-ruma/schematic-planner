# syntax=docker/dockerfile:1
#
# Built from the repository root:
#   docker build -f apps/api/Dockerfile -t schematic-api .

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# Dependencies first, keyed only on the manifests, so a source change does not
# reinstall the world.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY tooling/eslint-config/package.json ./tooling/eslint-config/
COPY tooling/typescript-config/package.json ./tooling/typescript-config/
COPY packages/schema/package.json ./packages/schema/
COPY packages/exporter/package.json ./packages/exporter/
COPY packages/layout/package.json ./packages/layout/
COPY packages/ydoc/package.json ./packages/ydoc/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/www/package.json ./apps/www/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm turbo run build --filter=@schematic/api
# Drop everything only the build needed. The generated Prisma client is already
# compiled into dist, so nothing has to be generated again at runtime.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS runtime
RUN corepack enable && addgroup -S app && adduser -S app -G app
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build --chown=app:app /repo/node_modules ./node_modules
COPY --from=build --chown=app:app /repo/packages ./packages
COPY --from=build --chown=app:app /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=app:app /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=app:app /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build --chown=app:app /repo/apps/api/package.json ./apps/api/package.json

USER app
WORKDIR /repo/apps/api
EXPOSE 3001

# Liveness only. Readiness checks the database, and a container that cannot
# reach the database yet should be given the chance to, not killed.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
