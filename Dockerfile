# ====================================================================================
# STAGE 1: BUILDER
# Build the TanStack Start application with all dependencies
# ====================================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# Set Node.js memory limit for build
# Note: Requires 6-8GB RAM during build (handled by GitHub Actions)
ENV NODE_OPTIONS="--max-old-space-size=6144"

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Generate Prisma client (outputs to src/generated/prisma)
RUN npx prisma generate

# Build the application (TanStack Start with Nitro outputs to .output/)
RUN node --max-old-space-size=6144 node_modules/vite/bin/vite.js build


# ====================================================================================
# STAGE 2: PRODUCTION
# Create a lean production image
# ====================================================================================
FROM node:22-alpine
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Install tsx for running seed script (needed at runtime)
RUN npm install -g tsx

# Copy the built application from builder stage
COPY --from=builder /app/.output ./.output

# Copy Prisma files (schema, migrations, and config)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy generated Prisma client
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Copy public assets
COPY --from=builder /app/public ./public

# Copy the entrypoint script
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

# Create directory for SQLite database
RUN mkdir -p /app/prisma/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/app/prisma/data/prod.db

EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3000 || exit 1

# Use entrypoint for migrations/seeding, then start the app
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
