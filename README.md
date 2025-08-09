# reji-cleaner

A Docker Registry cleanup tool that uses Docker Registry API v2 to remove old images while preserving the latest version of each repository.

## Features

- Docker Registry v2 API compatibility
- Basic authentication support
- Automatic preservation of latest tags for each repository
- Dry-run mode for safe verification before deletion
- Selective repository cleanup
- Option to delete untagged manifests
- Color-coded console output for better readability

## Installation

```bash
# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install
```

## Configuration

Configure via `.env` file or environment variables:

```bash
# Registry URL (required)
REGISTRY_URL=http://localhost:5000

# Authentication credentials (if needed)
REGISTRY_USER=username
REGISTRY_PASS=password

# Dry-run mode (default: true)
DRY_RUN=true

# Process specific repositories only (comma-separated)
REPOSITORIES=myapp,myservice

# Also delete untagged manifests (default: false)
DELETE_UNTAGGED=false
```

## Usage

### Basic Usage

```bash
# Run in dry-run mode (default)
bun src/index.ts

# Execute actual deletion
DRY_RUN=false bun src/index.ts

# Clean up specific repositories only
REPOSITORIES=myapp bun src/index.ts
```

### Docker Usage

```bash
# Build Docker image
docker build -t reji-cleaner .

# Run with environment file
docker run --env-file .env reji-cleaner

# Run with specific network
docker run --network host --env-file .env reji-cleaner
```

## Development

### Development Commands

```bash
# Run the application
bun src/index.ts

# Run linter
bun run lint

# Run linter with auto-fix
bun run lint:fix

# Run tests (when test files exist)
bun test
```

### Project Structure

- `src/index.ts` - Main application
- `.env` - Environment configuration (gitignored)
- `Dockerfile` - Docker image definition
- `biome.json` - Code formatter and linter configuration

## Important Notes

- **Deletions are irreversible**: Always verify operation in dry-run mode before executing with `DRY_RUN=false`
- **Latest tag protection**: The latest tag (based on creation timestamp) for each repository is automatically protected
- **Authentication**: Configure appropriate credentials for private registries

## License

MIT