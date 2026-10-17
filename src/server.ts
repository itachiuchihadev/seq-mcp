import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { SeqClient } from "./client/seq-client.js";
import { SeqConfig } from "./types.js";
import { resolveConfig } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import { SeqSearchSchema, handleSeqSearch } from "./tools/search.js";
import { SeqQuerySchema, handleSeqQuery } from "./tools/query.js";
import {
  SeqListSignalsSchema,
  handleSeqListSignals,
  SeqGetSignalSchema,
  handleSeqGetSignal
} from "./tools/signals.js";
import { SeqConvertFilterSchema, handleSeqConvertFilter } from "./tools/convert.js";
import { SeqTailEventsSchema, handleSeqTailEvents } from "./tools/tail.js";

export interface CreateServerOptions {
  name?: string;
  version?: string;
  client?: SeqClient;
  config?: Partial<SeqConfig>;
}

export function createSeqMcpServer(options: CreateServerOptions = {}): {
  server: Server;
  client: SeqClient;
} {
  const client = options.client ?? new SeqClient(resolveConfig(options.config));
  const serverName = options.name ?? "seq-mcp-server";
  const serverVersion = options.version ?? "1.0.0";

  const server = new Server(
    {
      name: serverName,
      version: serverVersion
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  // Register Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "seq_search",
          description:
            "Search historical structured log events in Seq with filters, date ranges (ISO 8601), signal IDs, and pagination. For all events, leave filter empty or use '*'.",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                description:
                  "Seq filter expression (e.g. \"@Level = 'Error'\", \"Application = 'Web' and StatusCode >= 500\"). Leave blank or '*' for all events."
              },
              count: {
                type: "integer",
                minimum: 1,
                maximum: 1000,
                default: 100,
                description: "Maximum number of events to return (1-1000, default: 100)."
              },
              fromDateUtc: {
                type: "string",
                description: "Earliest date/time in ISO 8601 format (e.g., '2024-01-01T00:00:00Z')."
              },
              toDateUtc: {
                type: "string",
                description: "Latest date/time in ISO 8601 format (e.g., '2024-01-31T23:59:59Z')."
              },
              signalId: {
                type: "string",
                description: "Optional signal ID to filter events (use seq_list_signals to list)."
              },
              afterId: {
                type: "string",
                description: "Event ID to search after (exclusive) for pagination."
              },
              workspace: {
                type: "string",
                description: "Optional workspace identifier for multi-tenant scenarios."
              }
            }
          }
        },
        {
          name: "seq_query",
          description:
            "Execute an analytical SQL-like query against Seq log data (e.g., \"select count(*) from stream group by time(5m)\", \"select @Timestamp, @Message, @Level from stream where @Level = 'Error' limit 50\").",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Seq SQL query to execute."
              },
              fromDateUtc: {
                type: "string",
                description: "Optional start time boundary in ISO 8601 format."
              },
              toDateUtc: {
                type: "string",
                description: "Optional end time boundary in ISO 8601 format."
              },
              signalId: {
                type: "string",
                description: "Optional signal ID to scope query."
              },
              timeoutSeconds: {
                type: "integer",
                minimum: 1,
                maximum: 300,
                default: 30,
                description: "Timeout in seconds for the query."
              },
              workspace: {
                type: "string",
                description: "Optional workspace identifier."
              }
            },
            required: ["query"]
          }
        },
        {
          name: "seq_list_signals",
          description:
            "List available signals (saved searches and predefined filters) in Seq. Returns signal IDs, titles, descriptions, and filter expressions.",
          inputSchema: {
            type: "object",
            properties: {
              sharedOnly: {
                type: "boolean",
                default: true,
                description: "Whether to list only shared signals (default: true)."
              },
              workspace: {
                type: "string",
                description: "Optional workspace identifier."
              }
            }
          }
        },
        {
          name: "seq_get_signal",
          description: "Get detailed configuration and filter rules of a specific signal by ID.",
          inputSchema: {
            type: "object",
            properties: {
              signalId: {
                type: "string",
                description: "The ID of the signal to inspect (e.g., 'signal-123')."
              },
              workspace: {
                type: "string",
                description: "Optional workspace identifier."
              }
            },
            required: ["signalId"]
          }
        },
        {
          name: "seq_convert_filter",
          description:
            "Convert a fuzzy or relaxed user search string into strict Seq filter syntax (e.g. converts 'error' or 'user==alice' into strict expressions).",
          inputSchema: {
            type: "object",
            properties: {
              fuzzyFilter: {
                type: "string",
                description: "The relaxed or fuzzy filter expression to convert."
              },
              workspace: {
                type: "string",
                description: "Optional workspace identifier."
              }
            },
            required: ["fuzzyFilter"]
          }
        },
        {
          name: "seq_tail_events",
          description:
            "Wait for and capture recent or live stream events from Seq within a specified timeout window.",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                description: "Optional Seq filter expression to apply to the stream."
              },
              count: {
                type: "integer",
                minimum: 1,
                maximum: 100,
                default: 10,
                description: "Maximum number of events to capture (1-100, default: 10)."
              },
              timeoutSeconds: {
                type: "integer",
                minimum: 1,
                maximum: 30,
                default: 5,
                description: "Time window in seconds to wait for events (1-30, default: 5)."
              },
              workspace: {
                type: "string",
                description: "Optional workspace identifier."
              }
            }
          }
        }
      ]
    };
  });

  // Call Tool Request Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");

    logger.debug(`MCP tool invoked: ${name}`, args);

    try {
      switch (normalizedName) {
        case "seqsearch":
        case "search":
        case "searchevents": {
          const parsed = z.object(SeqSearchSchema).parse(args);
          return await handleSeqSearch(client, parsed);
        }

        case "seqquery":
        case "query":
        case "executequery": {
          const parsed = z.object(SeqQuerySchema).parse(args);
          return await handleSeqQuery(client, parsed);
        }

        case "seqlistsignals":
        case "signallist":
        case "listsignals":
        case "seqsignals": {
          const parsed = z.object(SeqListSignalsSchema).parse(args);
          return await handleSeqListSignals(client, parsed);
        }

        case "seqgetsignal":
        case "getsignal": {
          const parsed = z.object(SeqGetSignalSchema).parse(args);
          return await handleSeqGetSignal(client, parsed);
        }

        case "seqconvertfilter":
        case "convertfilter": {
          const parsed = z.object(SeqConvertFilterSchema).parse(args);
          return await handleSeqConvertFilter(client, parsed);
        }

        case "seqtailevents":
        case "seqwaitforevents":
        case "tailevents":
        case "waitforevents":
        case "seqstream": {
          const parsed = z.object(SeqTailEventsSchema).parse(args);
          return await handleSeqTailEvents(client, parsed);
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
      }
    } catch (err: unknown) {
      if (err instanceof McpError) {
        throw err;
      }
      if (err instanceof z.ZodError) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid arguments for tool ${name}: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        );
      }
      logger.error(`Error executing tool ${name}:`, err);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`
          }
        ]
      };
    }
  });

  // Resources support: exposes seq://signals and seq://server-info
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "seq://signals",
          name: "Seq Saved Signals",
          mimeType: "application/json",
          description: "List of all shared signals (saved searches and filters) configured in Seq."
        },
        {
          uri: "seq://server-info",
          name: "Seq Server Information",
          mimeType: "application/json",
          description: "Metadata about the connected Seq instance including version and available endpoints."
        }
      ]
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === "seq://signals") {
      const signals = await client.listSignals();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(signals, null, 2)
          }
        ]
      };
    }

    if (uri === "seq://server-info") {
      const info = await client.getRootInfo();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(info, null, 2)
          }
        ]
      };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
  });

  return { server, client };
}
