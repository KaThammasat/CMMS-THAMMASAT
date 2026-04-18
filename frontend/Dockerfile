# ─── Stage 1: Build React App ────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY src ./src
COPY public ./public
RUN npm run build

# ─── Stage 2: Nginx Serve ────────────────────────────────────
FROM nginx:alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
