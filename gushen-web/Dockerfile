# GuShen Web Frontend Dockerfile
# Multi-stage build with Bun for optimized production image

# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, etc.)
RUN apk add --no-cache python3 make g++

# Install dependencies using Bun (10-20x faster than npm)
# Supports both package-lock.json and bun.lockb
COPY package.json package-lock.json* bun.lockb* ./
RUN bun install

# ============================================
# Stage 2: Builder
# ============================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables
ARG API_URL
ARG WS_URL
ARG REDIS_HOST
ARG REDIS_PORT
ARG REDIS_PASSWORD
ARG NEXT_PUBLIC_LURUS_API_URL=https://api.lurus.cn
ARG NEXT_PUBLIC_TENANT_SLUG=lurus
ENV API_URL=${API_URL}
ENV WS_URL=${WS_URL}
ENV REDIS_HOST=${REDIS_HOST}
ENV REDIS_PORT=${REDIS_PORT}
ENV REDIS_PASSWORD=${REDIS_PASSWORD}
ENV NEXT_PUBLIC_LURUS_API_URL=${NEXT_PUBLIC_LURUS_API_URL}
ENV NEXT_PUBLIC_TENANT_SLUG=${NEXT_PUBLIC_TENANT_SLUG}
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application using Bun
RUN bun run build

# ============================================
# Stage 3: Runner
# ============================================
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built application from builder
# Note: Bun can run Next.js standalone builds directly
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:3000/ || exit 1

# Start the application with Bun runtime (faster than Node.js)
CMD ["bun", "run", "server.js"]
