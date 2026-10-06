# API image: packages/validation + backend
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/validation/package.json ./packages/validation/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci
COPY packages/validation ./packages/validation
COPY backend ./backend
RUN npm run build --workspace=@charodey/validation && npm run build --workspace=backend

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/validation/package.json ./packages/validation/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install --omit=dev --workspace=backend --workspace=@charodey/validation --include-workspace-root
COPY --from=build /app/packages/validation/dist ./packages/validation/dist
COPY --from=build /app/backend/dist ./backend/dist
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
