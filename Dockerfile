FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/index.html ./index.html
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server.ts ./server.ts
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/css ./css
COPY --from=build --chown=node:node /app/js ./js
COPY --from=build --chown=node:node /app/content ./content
COPY --from=build --chown=node:node /app/vendor ./vendor
COPY --from=build --chown=node:node /app/ferramentas ./ferramentas
COPY --from=build --chown=node:node /app/metadata.json ./metadata.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

CMD ["npm", "run", "start"]
