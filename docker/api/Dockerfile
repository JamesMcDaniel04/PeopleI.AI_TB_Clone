# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci --workspace=@testbox/api

# Copy source code
COPY apps/api ./apps/api

# Build the application
WORKDIR /app/apps/api
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install production dependencies only
RUN npm ci --workspace=@testbox/api --omit=dev

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3001

CMD ["node", "dist/main.js"]
