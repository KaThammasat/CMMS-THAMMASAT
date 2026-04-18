# ─── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Stage 2: Production ─────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache curl tini

# Non-root user for security
RUN addgroup -S cmms && adduser -S cmms -G cmms
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

# Create log directory
RUN mkdir -p logs && chown -R cmms:cmms /app

USER cmms
EXPOSE 5000

# Use tini as PID 1 (handles signals properly)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1
