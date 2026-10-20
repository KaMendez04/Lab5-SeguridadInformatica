# syntax=docker/dockerfile:1
# Imagen de UNA-chat: multi-stage, solo dependencias de produccion, usuario no root.

# ---- Etapa 1: instalar dependencias de produccion ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: evita ejecutar scripts de terceros (y el "prepare" de husky)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- Etapa 2: imagen final minima ----
FROM node:24-alpine
# commit desplegado (lo inyecta el pipeline), expuesto en /healthz
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=$APP_VERSION \
    TRUST_PROXY=1
WORKDIR /app

# parches del SO y se elimina npm/npx/corepack: no se usan en runtime y
# arrastran dependencias propias con CVEs
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js instrumentation.js index.html ./
COPY --chown=node:node libs ./libs
COPY --chown=node:node public ./public

# usuario sin privilegios incluido en la imagen oficial de node
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
