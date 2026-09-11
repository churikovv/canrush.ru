# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for all workspaces (for npm ci layer caching)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/site/package.json apps/site/
COPY apps/parser/package.json apps/parser/

# Install all dependencies
RUN npm ci

# Copy source code and configs
COPY packages/shared/ packages/shared/
COPY apps/site/ apps/site/
COPY apps/parser/ apps/parser/
COPY tsconfig.base.json ./
COPY .eslintrc.cjs eslint.config.mjs ./

# Build shared package first (site depends on it)
RUN npm run build -w @canrush/shared

# Build the site (produces .next/standalone/)
RUN npm run build -w @canrush/site

# ---- Production stage ----
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone server (preserves monorepo structure)
COPY --from=builder /app/.next/standalone ./

# Copy static assets and public files (not included in standalone)
COPY --from=builder /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=builder /app/apps/site/public ./apps/site/public

# Copy migration scripts and SQL (for running migrations inside the container)
COPY --from=builder /app/apps/site/scripts ./apps/site/scripts
COPY --from=builder /app/apps/site/migrations ./apps/site/migrations

# Copy dotenv (needed by migrate.mjs, not included in standalone)
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv

# Create runtime data directory (catalog.json, retailer-icons.json)
RUN mkdir -p /app/data /app/apps/site/public/images/products

EXPOSE 3000

CMD ["node", "apps/site/server.js"]
