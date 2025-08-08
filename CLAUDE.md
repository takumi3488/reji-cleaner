# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

reji-cleaner is a Docker Registry cleanup CLI tool built with Bun and TypeScript. It connects to Docker Registry API v2 to clean up old images while preserving the latest version of each repository.

## Development Commands

### Essential Commands
- `bun src/index.ts` - Run the application
- `bun run lint` - Run Biome linter on src directory  
- `bun run lint:fix` - Run Biome linter with auto-fix
- `bun install` - Install dependencies (use frozen lockfile in production)
- `bun test` - Run tests (when test files are added)

### Docker Commands
- `docker build -t reji-cleaner .` - Build Docker image
- `docker run --env-file .env reji-cleaner` - Run container with environment variables

## Architecture

### Core Structure
The application is a single-file CLI tool (`src/index.ts`) with the following main components:

1. **DockerRegistryClient Class** - Main client handling all registry operations
   - Authentication via Basic Auth
   - API health checks
   - Repository and tag listing
   - Manifest fetching and deletion
   - Colored console output for better UX

2. **Key Interfaces**:
   - `Config` - Application configuration from environment variables
   - `TagInfo` - Docker tag metadata
   - `ManifestInfo` - Docker manifest metadata

3. **Main Flow**:
   - Load configuration from environment
   - Connect to registry and verify API access
   - List repositories (filtered if specified)
   - For each repository: fetch tags, identify latest, delete old manifests
   - Support dry-run mode for safe testing

### Environment Variables
The application uses these environment variables (Bun auto-loads .env):
- `REGISTRY_URL` - Registry endpoint (default: http://localhost:5000)
- `REGISTRY_USER` / `REGISTRY_PASS` - Basic auth credentials
- `DRY_RUN` - Test mode without deletions (default: true)
- `REPOSITORIES` - Comma-separated list of specific repos to clean
- `DELETE_UNTAGGED` - Also delete untagged manifests (default: false)

## Bun-Specific Guidelines

### Use Bun APIs
- Use `Bun.env` for environment variables (already auto-loaded from .env)
- Use `Buffer` for base64 encoding (as shown in auth header creation)
- Use native `fetch` API for HTTP requests (no axios/node-fetch needed)
- Use `console.log` with ANSI color codes for output

### Avoid Node.js patterns
- Don't use `dotenv` - Bun loads .env automatically
- Don't use `node:fs` - prefer `Bun.file` for file operations
- Don't use `ts-node` - use `bun` directly to run TypeScript

## Testing Strategy

When adding tests, use Bun's built-in test framework:
```ts
import { test, expect, mock } from "bun:test";
```

Test files should be named `*.test.ts` and placed alongside source files or in a `tests/` directory.

## Code Style

- TypeScript with strict mode enabled
- Biome for linting and formatting (tab indentation, double quotes)
- Interfaces for type definitions
- Class-based architecture for the main client
- Descriptive logging with color-coded output levels