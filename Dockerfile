# Build stage
FROM oven/bun:1.4@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598 AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src /app/src

# Runtime stage
FROM oven/bun:1.4@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598
WORKDIR /app

# Copy built application
COPY --from=builder /app .

# Expose port (adjust as needed)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
