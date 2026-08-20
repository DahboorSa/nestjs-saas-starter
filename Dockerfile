# Use Node image
FROM node:22-alpine

# Redis, bundled so the free-tier deploy doesn't need a separate Redis service
RUN apk add --no-cache redis

# Create app directory
WORKDIR /app

# Copy dependency files first (better caching)
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the project
COPY . .

# Build the NestJS app
RUN yarn build

# Expose API port
EXPOSE 3000

# Start Redis in the background, then the app
CMD redis-server --daemonize yes && node dist/main.js