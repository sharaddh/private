# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20-slim AS build
WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY warehouse/package.json warehouse/
RUN npm ci

# Copy source and build all workspaces
COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/warehouse/dist ./warehouse/dist

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
