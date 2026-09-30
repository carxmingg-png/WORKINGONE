FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server.ts ./
COPY profile_template.ts* ./
COPY keys* ./
COPY account1_69cars.json* ./
COPY bot_blueprint_b64.txt* ./
COPY bot_cars_190* ./
COPY register_completed_intro.json* ./
COPY premium_builds.json* ./

RUN npm install
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/profile_template.ts* ./
COPY --from=builder /app/keys* ./
COPY --from=builder /app/account1_69cars.json* ./
COPY --from=builder /app/bot_blueprint_b64.txt* ./
COPY --from=builder /app/bot_cars_190* ./
COPY --from=builder /app/register_completed_intro.json* ./
COPY --from=builder /app/premium_builds.json* ./

EXPOSE 10000

CMD ["node", "dist/server.cjs"]
