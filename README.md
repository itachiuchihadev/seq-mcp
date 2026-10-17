# Seq MCP Server (`@abhishekkumar00019/seq-mcp`)

[![npm version](https://img.shields.io/npm/v/@abhishekkumar00019/seq-mcp.svg)](https://www.npmjs.com/package/@abhishekkumar00019/seq-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server and TypeScript library for **[Datalust Seq](https://datalust.co/seq)** structured logging.

Enable AI assistants (Claude, Cursor, Copilot, ChatGPT, etc.) to query structured events, search logs by date ranges and signal filters, convert natural language filters into strict Seq syntax, execute analytical SQL queries, and monitor live log streams.

---

## 🚀 Quick Start

Run instantly without installation using `npx`:

```bash
npx @abhishekkumar00019/seq-mcp
```

Or install globally:

```bash
npm install -g @abhishekkumar00019/seq-mcp
seq-mcp --help
```

---

## 🛠️ MCP Client Configuration

### Claude Desktop

Add `seq` to your Claude Desktop configuration (`claude_desktop_config.json`):

* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "seq": {
      "command": "npx",
      "args": ["-y", "@abhishekkumar00019/seq-mcp"],
      "env": {
        "SEQ_SERVER_URL": "http://localhost:5341",
        "SEQ_API_KEY": "your-seq-api-key"
      }
    }
  }
}
```

### Cursor IDE

In Cursor Settings → **Features** → **MCP Servers** → **Add New MCP Server**:
* **Name**: `seq`
* **Type**: `command`
* **Command**: `npx -y @abhishekkumar00019/seq-mcp`

Or configure via `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "seq": {
      "command": "npx",
      "args": ["-y", "@abhishekkumar00019/seq-mcp"],
      "env": {
        "SEQ_SERVER_URL": "http://localhost:5341",
        "SEQ_API_KEY": "your-seq-api-key"
      }
    }
  }
}
```

---

## ⚙️ Configuration & Environment Variables

| Variable | CLI Flag | Description | Default |
|---|---|---|---|
| `SEQ_SERVER_URL` | `-u, --url` | Base URL of the Seq server | `http://localhost:5341` |
| `SEQ_API_KEY` | `-k, --api-key` | Seq API Key for authentication | *(empty)* |
| `SEQ_WORKSPACE` | `-w, --workspace` | Default workspace identifier | `default` |
| `SEQ_SECRETS_PATH` | `-s, --secrets` | Path to `secrets.json` for multi-tenant workspace keys | `secrets.json` |
| `SEQ_TIMEOUT_MS` | - | Request timeout in milliseconds | `30000` |
| `SEQ_MCP_LOG_LEVEL` | `-l, --log-level` | Log level (`debug`, `info`, `warn`, `error`, `silent`) | `info` |

### Multi-Tenant Workspaces (`secrets.json`)

For multi-tenant environments with different API keys per workspace, place a `secrets.json` file in your workspace or specify `--secrets /path/to/secrets.json`:

```json
{
  "default": "API_KEY_DEFAULT",
  "production": "API_KEY_PRODUCTION",
  "staging": "API_KEY_STAGING"
}
```

---

## 🧰 Available MCP Tools

### 1. `seq_search`
Search historical events with filters, ISO 8601 date ranges, signals, and pagination.

* **Parameters:**
  * `filter` *(string, optional)*: Seq filter expression (e.g. `@Level = 'Error'`, `Application = 'BillingService' and StatusCode >= 500`). Defaults to `""` or `*` (all events).
  * `count` *(integer, optional, default: 100, max: 1000)*: Maximum number of events to return.
  * `fromDateUtc` *(string, optional)*: Earliest date/time in ISO 8601 format (e.g., `2024-01-01T00:00:00Z`).
  * `toDateUtc` *(string, optional)*: Latest date/time in ISO 8601 format (e.g., `2024-01-31T23:59:59Z`).
  * `signalId` *(string, optional)*: Signal ID to filter events.
  * `afterId` *(string, optional)*: Event ID to search after (exclusive) for pagination.
  * `workspace` *(string, optional)*: Workspace identifier.

* **Example prompts for AI:**
  * *"Show me all Error events from the last 2 hours"*
  * *"Search for payment failure logs in Seq between 2026-10-15T00:00:00Z and 2026-10-16T00:00:00Z"*

---

### 2. `seq_query`
Execute analytical SQL-like queries against Seq log data.

* **Parameters:**
  * `query` *(string, required)*: Seq SQL query (e.g., `select count(*) from stream group by time(5m)`, `select @Timestamp, @Message, @Level from stream where @Level = 'Error' limit 50`).
  * `fromDateUtc` *(string, optional)*: Start time boundary in ISO 8601 format.
  * `toDateUtc` *(string, optional)*: End time boundary in ISO 8601 format.
  * `signalId` *(string, optional)*: Optional signal ID.
  * `timeoutSeconds` *(integer, optional, default: 30)*: Query timeout in seconds.
  * `workspace` *(string, optional)*: Workspace identifier.

* **Example prompts for AI:**
  * *"Run a query in Seq to count errors grouped by HTTP status code"*
  * *"Find the top 10 slowest requests in Seq from the stream"*

---

### 3. `seq_list_signals`
List all saved signals (predefined filters and searches) available in Seq.

* **Parameters:**
  * `sharedOnly` *(boolean, optional, default: true)*: List only shared signals.
  * `workspace` *(string, optional)*: Workspace identifier.

---

### 4. `seq_get_signal`
Get full configuration, column definitions, and filter expressions of a specific signal.

* **Parameters:**
  * `signalId` *(string, required)*: The signal ID (e.g., `signal-123`).
  * `workspace` *(string, optional)*: Workspace identifier.

---

### 5. `seq_convert_filter`
Convert relaxed/fuzzy user search syntax (e.g., free text or shorthand comparisons) into strict Seq filter expressions.

* **Parameters:**
  * `fuzzyFilter` *(string, required)*: The loose or natural search string (e.g., `error`, `status:500`, `user==alice`).
  * `workspace` *(string, optional)*: Workspace identifier.

---

### 6. `seq_tail_events`
Wait for and capture recent or live stream events within a timeout window.

* **Parameters:**
  * `filter` *(string, optional)*: Filter expression applied to incoming events.
  * `count` *(integer, optional, default: 10, max: 100)*: Maximum events to capture.
  * `timeoutSeconds` *(integer, optional, default: 5, max: 30)*: Wait window in seconds.
  * `workspace` *(string, optional)*: Workspace identifier.

---

## 📦 Programmatic Library Usage

You can also use this package as a standalone library in your own Node.js / TypeScript applications:

```typescript
import { SeqClient, createSeqMcpServer } from "@abhishekkumar00019/seq-mcp";

// 1. Using the SeqClient directly
const client = new SeqClient({
  serverUrl: "http://localhost:5341",
  apiKey: "your-api-key"
});

// Search events
const events = await client.searchEvents({
  filter: "@Level = 'Error'",
  count: 50,
  fromDateUtc: "2026-10-01T00:00:00Z"
});

// Run SQL query
const queryResult = await client.executeQuery({
  query: "select count(*) from stream group by time(1m)"
});

// 2. Creating an in-process MCP Server
const { server } = createSeqMcpServer({ client });
```

---

## 🧪 Development & Testing

```bash
# Clone the repository
git clone https://github.com/itachiuchihadev/seq-mcp.git
cd seq-mcp

# Install dependencies
npm install

# Run unit and integration tests
npm test

# Build for distribution
npm run build
```

---

## 📄 License

MIT © [Abhishek Kumar](LICENSE)
