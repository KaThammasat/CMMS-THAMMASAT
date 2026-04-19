FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS production
RUN apk add --no-cache curl tini
RUN addgroup -S cmms && adduser -S cmms -G cmms
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
COPY database ./database

RUN mkdir -p logs && chown -R cmms:cmms /app

USER cmms
EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
