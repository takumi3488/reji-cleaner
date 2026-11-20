# Build stage
FROM oven/bun:1.4@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src /app/src

# Runtime stage
FROM oven/bun:1.4@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18
WORKDIR /app

# Copy built application
COPY --from=builder /app .

# Expose port (adjust as needed)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]
