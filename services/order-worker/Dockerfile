FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force \
 && find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "*.ts" \) -delete
RUN apk add --no-cache binutils \
 && cp /usr/local/bin/node /tmp/node \
 && strip /tmp/node

FROM alpine:3.20
RUN apk add --no-cache libstdc++ \
 && addgroup -S app && adduser -S app -G app
COPY --from=deps /tmp/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
USER app
EXPOSE 9100
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:9100/healthz || exit 1
CMD ["node", "src/worker.js"]