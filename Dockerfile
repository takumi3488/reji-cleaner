# Build stage
FROM oven/bun:1.3 as builder
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src /app/src

# Runtime stage
FROM oven/bun:1.3
WORKDIR /app

# Copy built application
COPY --from=builder /app .

# Expose port (adjust as needed)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
