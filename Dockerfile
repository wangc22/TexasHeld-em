FROM node:20-alpine AS base
RUN npm install -g pnpm

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter server --filter @texas-poker/shared

# Build shared + server
FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/
RUN pnpm --filter @texas-poker/shared build
RUN pnpm --filter server build

# Production image
FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter server --filter @texas-poker/shared --prod
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist

WORKDIR /app/apps/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
