#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSeqMcpServer } from "./server.js";
import { resolveConfig } from "./utils/config.js";
import { logger, LogLevel } from "./utils/logger.js";
import fs from "node:fs";
import path from "node:path";

function getVersion(): string {
  try {
    const pkgPath = path.resolve(new URL(".", import.meta.url).pathname, "../package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return pkg.version || "1.0.0";
    }
  } catch {
    // fallback
  }
  return "1.0.0";
}

function printHelp(): void {
  process.stderr.write(`Seq MCP Server - Model Context Protocol server for Datalust Seq

Usage:
  npx @abhishekkumar00019/seq-mcp [options]
  seq-mcp [options]

Options:
  -u, --url <url>           URL of your Seq server (default: SEQ_SERVER_URL or http://localhost:5341)
  -k, --api-key <key>       API key for accessing Seq (default: SEQ_API_KEY)
  -w, --workspace <ws>      Default workspace identifier (default: SEQ_WORKSPACE or "default")
  -s, --secrets <path>      Path to secrets.json mapping workspace names to API keys
  -l, --log-level <level>   Log level: debug, info, warn, error, silent (default: info)
  -v, --version             Show version information
  -h, --help                Show this help message

Environment Variables:
  SEQ_SERVER_URL            URL of the Seq server (e.g. http://localhost:5341)
  SEQ_API_KEY               API key with permissions to read events and signals
  SEQ_WORKSPACE             Default workspace name
  SEQ_SECRETS_PATH          Path to secrets.json file for multi-workspace API keys
  SEQ_MCP_LOG_LEVEL         Logging verbosity (debug, info, warn, error, silent)

Examples for Claude Desktop / Cursor (mcpServers):
  {
    "seq": {
      "command": "npx",
      "args": ["-y", "--silent", "@abhishekkumar00019/seq-mcp"],
      "env": {
        "SEQ_SERVER_URL": "http://localhost:5341",
        "SEQ_API_KEY": "your-seq-api-key"
      }
    }
  }
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let serverUrl: string | undefined;
  let apiKey: string | undefined;
  let workspace: string | undefined;
  let secretsPath: string | undefined;
  let logLevel: LogLevel | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h" || arg === "-?") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--version" || arg === "-v") {
      process.stdout.write(`seq-mcp ${getVersion()}\n`);
      process.exit(0);
    }
    if ((arg === "--url" || arg === "-u") && i + 1 < args.length) {
      serverUrl = args[++i];
    } else if ((arg === "--api-key" || arg === "-k") && i + 1 < args.length) {
      apiKey = args[++i];
    } else if ((arg === "--workspace" || arg === "-w") && i + 1 < args.length) {
      workspace = args[++i];
    } else if ((arg === "--secrets" || arg === "-s") && i + 1 < args.length) {
      secretsPath = args[++i];
    } else if ((arg === "--log-level" || arg === "-l") && i + 1 < args.length) {
      logLevel = args[++i] as LogLevel;
    }
  }

  if (logLevel) {
    logger.setLevel(logLevel);
  }

  const config = resolveConfig({
    serverUrl,
    apiKey,
    workspace
  });

  if (secretsPath) {
    process.env.SEQ_SECRETS_PATH = secretsPath;
  }

  logger.info(`Starting Seq MCP server (Seq URL: ${config.serverUrl}, Workspace: ${config.workspace})`);

  const { server, client } = createSeqMcpServer({
    name: "seq-mcp",
    version: getVersion(),
    config
  });

  // Verify connectivity in background without blocking server startup
  client
    .getRootInfo()
    .then((info) => {
      logger.info(`Successfully connected to Seq ${info.Product || ""} (version: ${info.Version || "unknown"})`);
    })
    .catch((err) => {
      logger.warn(`Could not verify Seq connection on startup: ${err.message}. Server is running and will retry upon tool requests.`);
    });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Seq MCP server connected to stdio transport, awaiting requests...");

  const cleanup = async () => {
    logger.info("Shutting down Seq MCP server...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  logger.error("Fatal error starting Seq MCP server:", err);
  process.exit(1);
});
