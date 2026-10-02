# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for all workspaces
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

# Build shared package first (parser depends on it)
RUN npm run build -w @canrush/shared

# Build the parser (tsc → dist/)
RUN npm run build -w @canrush/parser

# ---- Production stage ----
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules from builder (includes all parser runtime deps)
COPY --from=builder /app/node_modules ./node_modules

# Copy built shared package
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Copy compiled parser
COPY --from=builder /app/apps/parser/dist ./apps/parser/dist
COPY --from=builder /app/apps/parser/package.json ./apps/parser/package.json
COPY --from=builder /app/apps/parser/config ./apps/parser/config

# Copy root package files (needed for workspace resolution)
COPY --from=builder /app/package.json /app/package-lock.json ./

# Create runtime directories
RUN mkdir -p /app/data /app/apps/site/data /app/apps/site/public/images/products /app/apps/site/public/brand/retailers

# Run the scheduler using compiled output (node, not tsx)
CMD ["node", "apps/parser/dist/index.js", "--schedule"]
