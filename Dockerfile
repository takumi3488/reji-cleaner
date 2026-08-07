# Build stage
FROM oven/bun:1.3@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src /app/src

# Runtime stage
FROM oven/bun:1.3@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
WORKDIR /app

# Copy built application
COPY --from=builder /app .

# Expose port (adjust as needed)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
