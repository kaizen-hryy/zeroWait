# Build stage
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm ci --omit=dev

# Production stage
FROM node:22-slim
WORKDIR /app

# better-sqlite3 needs these at runtime
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/src/lib/db/schema.sql ./src/lib/db/schema.sql

# SQLite data lives here — mount as a volume
RUN mkdir -p /app/data && chmod 777 /app/data

ENV NODE_ENV=production
ENV PORT=3333
ENV HOST=0.0.0.0
EXPOSE 3333

CMD ["node", "build"]
