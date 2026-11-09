# HUB-FITNESS — Express + SPA (Vite) para Cloudflare Containers.
# Build context: raiz do repo (ver workers/hub-fitness-proxy/wrangler.jsonc).

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Público (vai para o bundle do browser) — não é segredo.
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    INTRANET_DB_PATH=/app/data/intranet.sqlite \
    COMEX_DB_PATH=/app/data/comex.sqlite \
    COMEX_DOCS_ROOT=/app/data/comex-docs
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/data/comex-docs \
 && chown -R node:node /app/data
USER node
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.cjs"]
