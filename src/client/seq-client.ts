import {
  SeqConfig,
  SeqEvent,
  SeqSignal,
  SeqConvertFilterResult,
  SeqQueryResult,
  SearchEventsParams,
  QueryEventsParams,
  ListSignalsParams,
  GetSignalParams,
  ConvertFilterParams,
  TailEventsParams,
  SeqRootInfo
} from "../types.js";
import {
  SeqError,
  SeqApiError,
  SeqAuthenticationError,
  SeqNotFoundError,
  SeqSyntaxError
} from "./errors.js";
import { logger } from "../utils/logger.js";

export class SeqClient {
  private config: SeqConfig;
  private cachedRoot: SeqRootInfo | null = null;

  constructor(config: SeqConfig) {
    this.config = {
      ...config,
      serverUrl: config.serverUrl.replace(/\/+$/, "")
    };
  }

  /**
   * Determine the API key to use for a specific workspace.
   */
  public getApiKey(workspace?: string): string | undefined {
    const ws = workspace || this.config.workspace || "default";
    return this.config.workspaceApiKeys?.[ws] ?? this.config.apiKey;
  }

  /**
   * Construct headers for Seq HTTP requests.
   */
  private getHeaders(workspace?: string, additionalHeaders?: HeadersInit): Headers {
    const headers = new Headers(additionalHeaders);
    headers.set("Accept", "application/json");

    const apiKey = this.getApiKey(workspace);
    if (apiKey) {
      headers.set("X-Seq-ApiKey", apiKey);
    }

    return headers;
  }

  /**
   * Execute an HTTP request against the Seq API.
   */
  private async request<T>(
    endpointPath: string,
    options: {
      method?: string;
      params?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
      workspace?: string;
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<T> {
    const { method = "GET", params, body, workspace, timeoutMs = this.config.timeoutMs || 30000, signal } = options;

    // Ensure endpoint begins with /
    const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
    const url = new URL(`${this.config.serverUrl}${normalizedPath}`);

    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, String(val));
        }
      }
    }

    const headers = this.getHeaders(workspace);
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    // Combine timeout signal with passed signal
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: combinedSignal
      });

      if (!response.ok) {
        let errorBody: any = null;
        try {
          errorBody = await response.json();
        } catch {
          try {
            errorBody = await response.text();
          } catch {
            // ignore
          }
        }

        const message =
          errorBody?.Error ||
          errorBody?.Message ||
          errorBody?.title ||
          (typeof errorBody === "string" ? errorBody : null) ||
          `Request failed with status ${response.status} (${response.statusText})`;

        if (response.status === 401 || response.status === 403) {
          throw new SeqAuthenticationError(message, errorBody);
        }

        if (response.status === 404) {
          throw new SeqNotFoundError(message, errorBody);
        }

        if (response.status === 400 && typeof message === "string" && message.toLowerCase().includes("syntax error")) {
          throw new SeqSyntaxError(params?.filter ? String(params.filter) : String(params?.q || ""), message);
        }

        throw new SeqApiError(response.status, response.statusText, message, errorBody);
      }

      // Check if response has content
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return (await response.json()) as T;
      }

      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    } catch (err: unknown) {
      if (err instanceof SeqError) {
        throw err;
      }
      if (err instanceof Error) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          throw new SeqError(`Request to Seq timed out after ${timeoutMs}ms (${url.pathname})`);
        }
        throw new SeqError(`Connection to Seq failed: ${err.message}`);
      }
      throw new SeqError(`Unknown error occurred while contacting Seq: ${String(err)}`);
    }
  }

  /**
   * Fetch root info (/api) describing version and API links.
   */
  public async getRootInfo(): Promise<SeqRootInfo> {
    if (!this.cachedRoot) {
      this.cachedRoot = await this.request<SeqRootInfo>("/api");
    }
    return this.cachedRoot;
  }

  /**
   * Validate and parse an ISO date string.
   */
  private validateIsoDate(dateStr: string, paramName: string): string {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      throw new SeqError(`Invalid ${paramName} format: "${dateStr}". Expected ISO 8601 format (e.g., "2024-01-01T00:00:00Z").`);
    }
    return parsed.toISOString();
  }

  /**
   * Normalize search filter expression.
   */
  private normalizeFilter(filter?: string): string {
    if (!filter || filter.trim() === "*") {
      return "";
    }
    return filter.trim();
  }

  /**
   * Search historical events in Seq.
   */
  public async searchEvents(params: SearchEventsParams = {}): Promise<SeqEvent[]> {
    const filter = this.normalizeFilter(params.filter);
    const count = Math.max(1, Math.min(params.count ?? 100, 1000));

    let fromDateUtc: string | undefined;
    let toDateUtc: string | undefined;

    if (params.fromDateUtc) {
      fromDateUtc = this.validateIsoDate(params.fromDateUtc, "fromDateUtc");
    }
    if (params.toDateUtc) {
      toDateUtc = this.validateIsoDate(params.toDateUtc, "toDateUtc");
    }

    const queryParams: Record<string, string | number | boolean | undefined> = {
      filter: filter || undefined,
      count,
      render: true,
      fromDateUtc,
      toDateUtc,
      signal: params.signalId || undefined,
      afterId: params.afterId || undefined,
      shortCircuitAfter: params.shortCircuitAfter || undefined
    };

    logger.debug("Searching Seq events with parameters:", queryParams);

    const events = await this.request<SeqEvent[]>("/api/events", {
      params: queryParams,
      workspace: params.workspace
    });

    return Array.isArray(events) ? events : [];
  }

  /**
   * Execute an analytical SQL query against Seq.
   */
  public async executeQuery(params: QueryEventsParams): Promise<SeqQueryResult> {
    if (!params.query || !params.query.trim()) {
      throw new SeqError("Query string is required for seq_query");
    }

    let rangeStartUtc: string | undefined;
    let rangeEndUtc: string | undefined;

    if (params.fromDateUtc) {
      rangeStartUtc = this.validateIsoDate(params.fromDateUtc, "fromDateUtc");
    }
    if (params.toDateUtc) {
      rangeEndUtc = this.validateIsoDate(params.toDateUtc, "toDateUtc");
    }

    const timeoutMs = (params.timeoutSeconds ?? 30) * 1000;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      q: params.query.trim(),
      signal: params.signalId || undefined,
      rangeStartUtc,
      rangeEndUtc,
      timeoutMS: timeoutMs
    };

    logger.debug("Executing Seq SQL query:", queryParams);

    return await this.request<SeqQueryResult>("/api/data", {
      params: queryParams,
      workspace: params.workspace,
      timeoutMs: timeoutMs + 2000 // allow slight network buffer
    });
  }

  /**
   * List available signals (saved searches and filters).
   */
  public async listSignals(params: ListSignalsParams = {}): Promise<SeqSignal[]> {
    const sharedOnly = params.sharedOnly !== false;
    const queryParams: Record<string, string | boolean | undefined> = {
      shared: sharedOnly ? true : undefined
    };

    logger.debug("Fetching Seq signals list, sharedOnly:", sharedOnly);

    const signals = await this.request<SeqSignal[]>("/api/signals", {
      params: queryParams,
      workspace: params.workspace
    });

    return Array.isArray(signals) ? signals : [];
  }

  /**
   * Retrieve a single signal by its ID.
   */
  public async getSignal(params: GetSignalParams): Promise<SeqSignal> {
    if (!params.signalId) {
      throw new SeqError("Signal ID is required");
    }

    const signalId = params.signalId.trim();
    logger.debug(`Fetching Seq signal ${signalId}`);

    return await this.request<SeqSignal>(`/api/signals/${encodeURIComponent(signalId)}`, {
      workspace: params.workspace
    });
  }

  /**
   * Convert a fuzzy or relaxed search expression into strict Seq filter syntax.
   */
  public async convertFilter(params: ConvertFilterParams): Promise<SeqConvertFilterResult> {
    const fuzzy = params.fuzzyFilter?.trim() ?? "";
    if (!fuzzy) {
      return {
        strictExpression: "",
        matchedAsText: false,
        reasonIfMatchedAsText: null
      };
    }

    logger.debug(`Converting fuzzy filter: "${fuzzy}"`);

    try {
      const result = await this.request<any>("/api/expressions/strict", {
        params: { fuzzy },
        workspace: params.workspace
      });

      return {
        strictExpression: result?.StrictExpression ?? result?.strictExpression ?? fuzzy,
        matchedAsText: Boolean(result?.MatchedAsText ?? result?.matchedAsText ?? false),
        reasonIfMatchedAsText: result?.ReasonIfMatchedAsText ?? result?.reasonIfMatchedAsText ?? null
      };
    } catch (err: unknown) {
      logger.warn(`Failed to call /api/expressions/strict, falling back to original filter:`, err);
      // Fallback gracefully
      return {
        strictExpression: fuzzy,
        matchedAsText: false,
        reasonIfMatchedAsText: null
      };
    }
  }

  /**
   * Wait for and capture events from the live stream within a timeout window.
   */
  public async tailEvents(params: TailEventsParams = {}): Promise<SeqEvent[]> {
    const filter = this.normalizeFilter(params.filter);
    const count = Math.max(1, Math.min(params.count ?? 10, 100));
    const timeoutSeconds = Math.max(1, Math.min(params.timeoutSeconds ?? 5, 30));

    logger.debug(`Tailing events (max: ${count}, timeout: ${timeoutSeconds}s)`);

    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutSeconds * 1000);

    const collected: SeqEvent[] = [];

    try {
      const url = new URL(`${this.config.serverUrl}/api/events/stream`);
      if (filter) url.searchParams.set("filter", filter);
      url.searchParams.set("render", "true");

      const response = await fetch(url.toString(), {
        headers: this.getHeaders(params.workspace),
        signal: abortController.signal
      });

      if (!response.ok || !response.body) {
        throw new SeqApiError(response.status, response.statusText, "Failed to connect to event stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (collected.length < count) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as SeqEvent;
            collected.push(event);
            if (collected.length >= count) {
              abortController.abort();
              break;
            }
          } catch {
            // Ignore non-JSON or partial stream lines
          }
        }
      }
    } catch (err: unknown) {
      // AbortError / TimeoutError is expected when timeout expires
      if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
        logger.debug("Tail stream window elapsed, returning captured events");
      } else {
        logger.warn("Live stream encountering issue, falling back to recent search:", err);
        // Fallback: fetch recent events from /api/events
        try {
          return await this.searchEvents({
            filter,
            count,
            workspace: params.workspace
          });
        } catch {
          return [];
        }
      }
    } finally {
      clearTimeout(timer);
    }

    return collected;
  }
}
