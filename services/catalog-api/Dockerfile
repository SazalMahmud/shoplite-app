FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force \
 && find node_modules -type f \( -name "*.md" -o -name "*.markdown" -o -name "*.map" -o -name "*.ts" -o -name "CHANGELOG*" -o -name "LICENSE*" \) -delete \
 && find node_modules -type d \( -name "test" -o -name "tests" -o -name "docs" -o -name "example" -o -name "examples" \) -prune -exec rm -rf {} +
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
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "src/server.js"]