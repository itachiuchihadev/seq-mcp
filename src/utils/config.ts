import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { SeqConfig } from "../types.js";
import { logger } from "./logger.js";

/**
 * Find and load .env file if it exists.
 */
export function loadEnvFile(explicitPath?: string): void {
  if (explicitPath && fs.existsSync(explicitPath)) {
    dotenv.config({ path: explicitPath });
    logger.debug(`Loaded environment variables from ${explicitPath}`);
    return;
  }

  // Search current directory and up to 3 parents
  let current = process.cwd();
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(current, ".env");
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      logger.debug(`Loaded environment variables from ${candidate}`);
      return;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

/**
 * Load secrets.json mapping workspace names to API keys if available.
 */
export function loadSecretsFile(explicitPath?: string): Record<string, string> {
  const filePath = explicitPath || process.env.SEQ_SECRETS_PATH || process.env.SECRETS_FILE || "secrets.json";
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (typeof parsed === "object" && parsed !== null) {
        logger.debug(`Loaded workspace credentials from ${filePath}`);
        return parsed as Record<string, string>;
      }
    }
  } catch (err) {
    logger.warn(`Failed to parse secrets file at ${filePath}:`, err);
  }
  return {};
}

/**
 * Resolves full Seq configuration combining options, environment, and secrets file.
 */
export function resolveConfig(options?: Partial<SeqConfig>): SeqConfig {
  loadEnvFile();

  const workspaceApiKeys = {
    ...loadSecretsFile(),
    ...(options?.workspaceApiKeys || {})
  };

  const serverUrl =
    options?.serverUrl ||
    process.env.SEQ_SERVER_URL ||
    process.env.SEQ_URL ||
    "http://localhost:5341";

  // Normalize server URL (trim trailing slash)
  const normalizedUrl = serverUrl.replace(/\/+$/, "");

  const defaultWorkspace = options?.workspace || process.env.SEQ_WORKSPACE || "default";

  const apiKey =
    options?.apiKey ||
    process.env.SEQ_API_KEY ||
    workspaceApiKeys[defaultWorkspace] ||
    workspaceApiKeys["default"];

  const timeoutMs = options?.timeoutMs || Number(process.env.SEQ_TIMEOUT_MS) || 30000;

  return {
    serverUrl: normalizedUrl,
    apiKey,
    workspace: defaultWorkspace,
    workspaceApiKeys,
    timeoutMs
  };
}
