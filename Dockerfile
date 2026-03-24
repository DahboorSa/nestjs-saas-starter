# Use Node image
FROM node:20-alpine

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

# Start the application
CMD ["node", "dist/main.js"]