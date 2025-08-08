// Configuration interface
interface Config {
	registryUrl: string;
	username?: string;
	password?: string;
	dryRun: boolean;
	repositories?: string[]; // Process only specific repositories if specified
	deleteUntagged?: boolean; // Whether to also delete untagged manifests
}

// Tag information
interface TagInfo {
	name: string;
	digest: string;
	created?: string;
	size?: number;
}

// Docker Registry API response types
interface DockerManifest {
	config?: {
		digest: string;
	};
	history?: Array<{
		v1Compatibility: string;
	}>;
}

interface DockerConfig {
	created?: string;
}

// Helper for colored output
const colors = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
};

class DockerRegistryClient {
	private config: Config;
	private authHeader?: string;

	constructor(config: Config) {
		this.config = config;
		if (config.username && config.password) {
			const auth = Buffer.from(
				`${config.username}:${config.password}`,
			).toString("base64");
			this.authHeader = `Basic ${auth}`;
		}
	}

	private log(level: "info" | "warn" | "error" | "success", message: string) {
		const levelColors = {
			info: colors.blue,
			warn: colors.yellow,
			error: colors.red,
			success: colors.green,
		};
		const color = levelColors[level];
		const levelText = level.toUpperCase().padEnd(7);
		console.log(`${color}[${levelText}]${colors.reset} ${message}`);
	}

	private getHeaders(additionalHeaders?: HeadersInit): HeadersInit {
		const headers: HeadersInit = {
			Accept:
				"application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json",
			...additionalHeaders,
		};
		if (this.authHeader) {
			// @ts-ignore
			headers.Authorization = this.authHeader;
		}
		return headers;
	}

	async checkAPI(): Promise<boolean> {
		try {
			const response = await fetch(`${this.config.registryUrl}/v2/`, {
				headers: this.getHeaders(),
			});
			return response.ok;
		} catch (error) {
			this.log("error", `Failed to connect to registry: ${error}`);
			return false;
		}
	}

	async getRepositories(): Promise<string[]> {
		if (this.config.repositories && this.config.repositories.length > 0) {
			return this.config.repositories;
		}

		try {
			const response = await fetch(`${this.config.registryUrl}/v2/_catalog`, {
				headers: this.getHeaders(),
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = (await response.json()) as { repositories: string[] };
			return data.repositories || [];
		} catch (error) {
			this.log("error", `Failed to get repositories: ${error}`);
			return [];
		}
	}

	async getTags(repository: string): Promise<string[]> {
		try {
			const response = await fetch(
				`${this.config.registryUrl}/v2/${repository}/tags/list`,
				{
					headers: this.getHeaders(),
				},
			);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = (await response.json()) as { tags: string[] };
			return data.tags || [];
		} catch (error) {
			this.log("warn", `Failed to get tags for ${repository}: ${error}`);
			return [];
		}
	}

	async getManifestDigest(
		repository: string,
		reference: string,
	): Promise<string | null> {
		try {
			const response = await fetch(
				`${this.config.registryUrl}/v2/${repository}/manifests/${reference}`,
				{
					method: "HEAD",
					headers: this.getHeaders(),
				},
			);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const digest = response.headers.get("docker-content-digest");
			return digest;
		} catch (error) {
			this.log(
				"warn",
				`Failed to get digest for ${repository}:${reference}: ${error}`,
			);
			return null;
		}
	}

	async getManifest(
		repository: string,
		reference: string,
	): Promise<DockerManifest | null> {
		try {
			const response = await fetch(
				`${this.config.registryUrl}/v2/${repository}/manifests/${reference}`,
				{
					headers: this.getHeaders(),
				},
			);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			return (await response.json()) as DockerManifest;
		} catch (error) {
			this.log(
				"warn",
				`Failed to get manifest for ${repository}:${reference}: ${error}`,
			);
			return null;
		}
	}

	async getConfig(
		repository: string,
		digest: string,
	): Promise<DockerConfig | null> {
		try {
			const response = await fetch(
				`${this.config.registryUrl}/v2/${repository}/blobs/${digest}`,
				{
					headers: this.getHeaders(),
				},
			);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			return (await response.json()) as DockerConfig;
		} catch (error) {
			this.log(
				"warn",
				`Failed to get config for ${repository}@${digest}: ${error}`,
			);
			return null;
		}
	}

	async getTagCreatedTime(
		repository: string,
		tag: string,
	): Promise<string | null> {
		try {
			const manifest = await this.getManifest(repository, tag);
			if (!manifest) return null;

			// For manifest v2
			if (manifest.config?.digest) {
				const config = await this.getConfig(repository, manifest.config.digest);
				if (config?.created) {
					return config.created;
				}
			}

			// Get from v1 compatibility information
			if (manifest.history?.[0]?.v1Compatibility) {
				const v1Data = JSON.parse(manifest.history[0].v1Compatibility);
				if (v1Data.created) {
					return v1Data.created;
				}
			}

			return null;
		} catch (error) {
			this.log(
				"warn",
				`Failed to get created time for ${repository}:${tag}: ${error}`,
			);
			return null;
		}
	}

	async deleteManifest(repository: string, digest: string): Promise<boolean> {
		if (this.config.dryRun) {
			this.log("warn", `[DRY RUN] Would delete: ${repository}@${digest}`);
			return true;
		}

		try {
			this.log("info", `Deleting manifest: ${repository}@${digest}`);
			const response = await fetch(
				`${this.config.registryUrl}/v2/${repository}/manifests/${digest}`,
				{
					method: "DELETE",
					headers: this.getHeaders(),
				},
			);

			if (response.status === 202) {
				this.log("success", `Successfully deleted: ${repository}@${digest}`);
				return true;
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (error) {
			this.log("error", `Failed to delete ${repository}@${digest}: ${error}`);
			return false;
		}
	}

	async processRepository(
		repository: string,
	): Promise<{ deleted: number; kept: number }> {
		this.log(
			"info",
			`Processing repository: ${colors.cyan}${repository}${colors.reset}`,
		);

		const tags = await this.getTags(repository);
		if (tags.length === 0) {
			this.log("warn", `No tags found in repository: ${repository}`);
			return { deleted: 0, kept: 0 };
		}

		// Collect tag information
		const tagInfoList: TagInfo[] = [];
		const digestToTags = new Map<string, string[]>();

		for (const tag of tags) {
			const digest = await this.getManifestDigest(repository, tag);
			if (!digest) continue;

			const created = await this.getTagCreatedTime(repository, tag);
			tagInfoList.push({ name: tag, digest, created: created || undefined });

			// Group tags by digest
			const existingTags = digestToTags.get(digest) || [];
			existingTags.push(tag);
			digestToTags.set(digest, existingTags);
		}

		// Identify the latest tag
		let latestTag: TagInfo | null = null;
		if (tagInfoList.length > 0) {
			// Sort by creation time (those without time go last)
			tagInfoList.sort((a, b) => {
				if (!a.created && !b.created) return 0;
				if (!a.created) return 1;
				if (!b.created) return -1;
				return b.created.localeCompare(a.created);
			});
			latestTag = tagInfoList[0] || null;
		}

		if (!latestTag) {
			this.log(
				"warn",
				`Could not determine latest tag for repository: ${repository}`,
			);
			return { deleted: 0, kept: 0 };
		}

		this.log(
			"info",
			`Latest tag: ${colors.green}${latestTag.name}${colors.reset} (created: ${latestTag.created || "unknown"})`,
		);
		this.log(
			"info",
			`Latest digest: ${colors.green}${latestTag.digest.substring(0, 12)}...${colors.reset}`,
		);

		// Determine targets for deletion
		const digestsToDelete = new Set<string>();
		const digestsToKeep = new Set<string>();

		for (const [digest, associatedTags] of digestToTags.entries()) {
			if (digest === latestTag.digest) {
				this.log(
					"info",
					`Keeping: ${colors.green}${digest.substring(0, 12)}...${colors.reset} (tags: ${associatedTags.join(", ")})`,
				);
				digestsToKeep.add(digest);
			} else {
				this.log(
					"info",
					`Marking for deletion: ${colors.yellow}${digest.substring(0, 12)}...${colors.reset} (tags: ${associatedTags.join(", ")})`,
				);
				digestsToDelete.add(digest);
			}
		}

		// Execute deletion
		let deleted = 0;
		for (const digest of digestsToDelete) {
			if (await this.deleteManifest(repository, digest)) {
				deleted++;
			}
		}

		return { deleted, kept: digestsToKeep.size };
	}

	async cleanup(): Promise<void> {
		this.log("info", "=".repeat(60));
		this.log("info", "Docker Registry Cleanup Script");
		this.log(
			"info",
			`Registry URL: ${colors.cyan}${this.config.registryUrl}${colors.reset}`,
		);
		this.log(
			"info",
			`Dry run mode: ${this.config.dryRun ? `${colors.yellow}ENABLED` : `${colors.green}DISABLED`}${colors.reset}`,
		);
		this.log("info", "=".repeat(60));

		// Check API connection
		if (!(await this.checkAPI())) {
			this.log("error", "Failed to connect to Docker Registry API");
			process.exit(1);
		}

		// Get repository list
		const repositories = await this.getRepositories();
		if (repositories.length === 0) {
			this.log("warn", "No repositories found");
			return;
		}

		this.log("info", `Found ${repositories.length} repositories`);

		// Statistics
		let totalDeleted = 0;
		let totalKept = 0;

		// Process each repository
		for (const repository of repositories) {
			const result = await this.processRepository(repository);
			totalDeleted += result.deleted;
			totalKept += result.kept;
			this.log("info", "-".repeat(60));
		}

		// Summary
		this.log("info", "=".repeat(60));
		this.log("success", "Cleanup completed!");
		this.log(
			"info",
			`Total manifests deleted: ${colors.red}${totalDeleted}${colors.reset}`,
		);
		this.log(
			"info",
			`Total manifests kept: ${colors.green}${totalKept}${colors.reset}`,
		);

		if (this.config.dryRun) {
			this.log(
				"warn",
				"This was a dry run. Set dryRun=false to actually delete manifests.",
			);
			this.log(
				"warn",
				"Note: Registry garbage collection must be run after deletion to reclaim disk space.",
			);
			this.log(
				"warn",
				"Run: docker exec registry registry garbage-collect /etc/docker/registry/config.yml",
			);
		}
	}
}

// Main execution
async function main() {
	// Load configuration from environment variables
	const config: Config = {
		registryUrl: process.env.REGISTRY_URL || "http://localhost:5000",
		username: process.env.REGISTRY_USER,
		password: process.env.REGISTRY_PASS,
		dryRun: process.env.DRY_RUN !== "false", // Default is true
		repositories: process.env.REPOSITORIES?.split(",").filter((r) => r.trim()),
		deleteUntagged: process.env.DELETE_UNTAGGED === "true",
	};

	const client = new DockerRegistryClient(config);

	try {
		await client.cleanup();
	} catch (error) {
		console.error(
			`${colors.red}[ERROR]${colors.reset} Unexpected error:`,
			error,
		);
		process.exit(1);
	}
}

// Execute
if (require.main === module) {
	main().catch(console.error);
}

export { DockerRegistryClient, type Config };
