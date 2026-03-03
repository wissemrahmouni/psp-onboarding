FROM node:20-bullseye-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npx tsc

FROM node:20-bullseye-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma/

EXPOSE 4000
CMD ["node", "dist/index.js"]
