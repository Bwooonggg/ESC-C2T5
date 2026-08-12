# DAS 7 backend — build TypeScript in one stage, ship only what runs in the next.
# No environment values are baked in: the deployment supplies them at run time.
#
# Node 22, not 20: @supabase/supabase-js reaches for a native WebSocket at
# createClient() and throws on Node 20, so a node:20 image cannot start at all.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# The service listens on 0.0.0.0 so Traefik can reach it across the container network.
EXPOSE 4000
CMD ["node", "dist/index.js"]
