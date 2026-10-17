export interface SeqConfig {
  /**
   * The base URL of the Seq server (e.g., "http://localhost:5341").
   */
  serverUrl: string;

  /**
   * API key for authentication with Seq.
   */
  apiKey?: string;

  /**
   * Optional default workspace name or identifier.
   */
  workspace?: string;

  /**
   * Mapping of workspace names to API keys (e.g., from secrets.json).
   */
  workspaceApiKeys?: Record<string, string>;

  /**
   * Default timeout for HTTP requests in milliseconds (default: 30000ms).
   */
  timeoutMs?: number;
}

export interface SeqProperty {
  Name: string;
  Value: unknown;
}

export interface SeqEvent {
  Id: string;
  Timestamp: string;
  MessageTemplate?: string;
  RenderedMessage?: string;
  Level?: string;
  Exception?: string;
  Properties?: SeqProperty[] | Record<string, unknown>;
  Links?: Record<string, string>;
  [key: string]: unknown;
}

export interface SeqSignalFilter {
  Filter: string;
  Description?: string;
}

export interface SeqSignalColumn {
  Name: string;
  Expression?: string;
}

export interface SeqSignal {
  Id: string;
  Title: string;
  Description?: string;
  IsProtected?: boolean;
  IsRestricted?: boolean;
  IsShared?: boolean;
  OwnerId?: string;
  Filters?: SeqSignalFilter[];
  Columns?: SeqSignalColumn[];
  Links?: Record<string, string>;
  [key: string]: unknown;
}

export interface SeqConvertFilterResult {
  strictExpression: string;
  matchedAsText: boolean;
  reasonIfMatchedAsText: string | null;
}

export interface SeqQueryColumn {
  Name: string;
  DataType?: string;
}

export interface SeqQueryResult {
  Columns: SeqQueryColumn[] | string[];
  Rows: unknown[][];
  Statistics?: Record<string, unknown>;
}

export interface SearchEventsParams {
  /**
   * Filter expression (e.g., "@Level = 'Error'"). Pass empty or "*" for all events.
   */
  filter?: string;

  /**
   * Maximum number of events to return (1-1000, default: 100).
   */
  count?: number;

  /**
   * Earliest date/time in ISO 8601 format (e.g., "2024-01-01T00:00:00Z").
   */
  fromDateUtc?: string;

  /**
   * Latest date/time in ISO 8601 format (e.g., "2024-01-31T23:59:59Z").
   */
  toDateUtc?: string;

  /**
   * Optional signal ID to filter events.
   */
  signalId?: string;

  /**
   * Optional event ID to search after (exclusive) for pagination.
   */
  afterId?: string;

  /**
   * Optional short circuit count limit.
   */
  shortCircuitAfter?: number;

  /**
   * Optional workspace identifier.
   */
  workspace?: string;
}

export interface QueryEventsParams {
  /**
   * Seq SQL query (e.g. "select count(*) from stream group by time(5m)").
   */
  query: string;

  /**
   * Optional start date/time in ISO 8601 format.
   */
  fromDateUtc?: string;

  /**
   * Optional end date/time in ISO 8601 format.
   */
  toDateUtc?: string;

  /**
   * Optional signal ID to scope query.
   */
  signalId?: string;

  /**
   * Timeout in seconds for the query (1-300, default: 30).
   */
  timeoutSeconds?: number;

  /**
   * Optional workspace identifier.
   */
  workspace?: string;
}

export interface ListSignalsParams {
  /**
   * Whether to only list shared signals (default: true).
   */
  sharedOnly?: boolean;

  /**
   * Optional workspace identifier.
   */
  workspace?: string;
}

export interface GetSignalParams {
  /**
   * The signal ID (e.g., "signal-42").
   */
  signalId: string;

  /**
   * Optional workspace identifier.
   */
  workspace?: string;
}

export interface ConvertFilterParams {
  /**
   * The fuzzy or relaxed filter expression to convert.
   */
  fuzzyFilter: string;

  /**
   * Optional workspace identifier.
   */
  workspace?: string;
}

export interface TailEventsParams {
  /**
   * Optional filter expression.
   */
  filter?: string;

  /**
   * Maximum events to capture (1-100, default: 10).
   */
  count?: number;

  /**
   * Time window in seconds to wait for events (1-30, default: 5).
   */
  timeoutSeconds?: number;

  /**
   * Optional workspace identifier.
   */
  workspace?: string;
}

export interface SeqRootInfo {
  Product?: string;
  Version?: string;
  InstanceName?: string | null;
  Links?: Record<string, string>;
}
