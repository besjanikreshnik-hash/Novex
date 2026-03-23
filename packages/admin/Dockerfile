# ============================================================
# Stage 1: Development
# ============================================================
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3002
CMD ["npm", "run", "dev"]

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL

RUN npm run build

# ============================================================
# Stage 3: Production
# ============================================================
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER nextjs

EXPOSE 3002
ENV PORT=3002

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
