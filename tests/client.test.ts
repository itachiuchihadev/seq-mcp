import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SeqClient } from "../src/client/seq-client.js";
import {
  SeqError,
  SeqAuthenticationError,
  SeqNotFoundError,
  SeqSyntaxError
} from "../src/client/errors.js";

describe("SeqClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("normalizes server URL by removing trailing slashes", () => {
    const client = new SeqClient({ serverUrl: "http://localhost:5341///" });
    expect((client as any).config.serverUrl).toBe("http://localhost:5341");
  });

  it("resolves API keys per workspace with fallback", () => {
    const client = new SeqClient({
      serverUrl: "http://localhost:5341",
      apiKey: "default-key",
      workspaceApiKeys: {
        production: "prod-key",
        staging: "staging-key"
      }
    });

    expect(client.getApiKey("production")).toBe("prod-key");
    expect(client.getApiKey("staging")).toBe("staging-key");
    expect(client.getApiKey("unknown")).toBe("default-key");
    expect(client.getApiKey()).toBe("default-key");
  });

  it("searches events with parameters correctly", async () => {
    const mockEvents = [
      {
        Id: "event-1",
        Timestamp: "2024-01-01T12:00:00.000Z",
        Level: "Error",
        RenderedMessage: "Database connection failed"
      }
    ];

    let capturedUrl = "";
    let capturedHeaders: HeadersInit | undefined;

    global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockEvents
      };
    });

    const client = new SeqClient({
      serverUrl: "http://localhost:5341",
      apiKey: "test-api-key"
    });

    const result = await client.searchEvents({
      filter: "@Level = 'Error'",
      count: 25,
      fromDateUtc: "2024-01-01T00:00:00Z",
      toDateUtc: "2024-01-02T00:00:00Z",
      signalId: "signal-1"
    });

    expect(result).toEqual(mockEvents);
    const parsedUrl = new URL(capturedUrl);
    expect(parsedUrl.pathname).toBe("/api/events");
    expect(parsedUrl.searchParams.get("filter")).toBe("@Level = 'Error'");
    expect(parsedUrl.searchParams.get("count")).toBe("25");
    expect(parsedUrl.searchParams.get("signal")).toBe("signal-1");
    expect(parsedUrl.searchParams.get("render")).toBe("true");

    const headers = new Headers(capturedHeaders);
    expect(headers.get("X-Seq-ApiKey")).toBe("test-api-key");
  });

  it("normalizes '*' filter expression to empty string", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => []
      };
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    await client.searchEvents({ filter: "*" });

    const parsedUrl = new URL(capturedUrl);
    expect(parsedUrl.searchParams.has("filter")).toBe(false);
  });

  it("validates ISO dates and throws SeqError for malformed dates", async () => {
    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    await expect(client.searchEvents({ fromDateUtc: "not-a-valid-date" })).rejects.toThrow(
      SeqError
    );
  });

  it("executes SQL queries via /api/data", async () => {
    const mockQueryResult = {
      Columns: [{ Name: "Count", DataType: "Int64" }],
      Rows: [[42]]
    };

    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockQueryResult
      };
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    const result = await client.executeQuery({
      query: "select count(*) from stream group by time(1m)",
      fromDateUtc: "2024-01-01T00:00:00Z",
      toDateUtc: "2024-01-01T01:00:00Z"
    });

    expect(result).toEqual(mockQueryResult);
    const parsedUrl = new URL(capturedUrl);
    expect(parsedUrl.pathname).toBe("/api/data");
    expect(parsedUrl.searchParams.get("q")).toBe("select count(*) from stream group by time(1m)");
  });

  it("lists signals via /api/signals", async () => {
    const mockSignals = [
      {
        Id: "signal-1",
        Title: "All Errors",
        Description: "Filters error-level events"
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockSignals
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    const signals = await client.listSignals();
    expect(signals).toEqual(mockSignals);
  });

  it("retrieves a single signal by ID", async () => {
    const mockSignal = {
      Id: "signal-42",
      Title: "Auth Failures",
      Description: "Failed login attempts"
    };

    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockSignal
      };
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    const signal = await client.getSignal({ signalId: "signal-42" });
    expect(signal).toEqual(mockSignal);
    expect(new URL(capturedUrl).pathname).toBe("/api/signals/signal-42");
  });

  it("converts fuzzy expressions to strict Seq syntax", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        StrictExpression: '"error"',
        MatchedAsText: true,
        ReasonIfMatchedAsText: "Bareword treated as text search"
      })
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    const result = await client.convertFilter({ fuzzyFilter: "error" });

    expect(result).toEqual({
      strictExpression: '"error"',
      matchedAsText: true,
      reasonIfMatchedAsText: "Bareword treated as text search"
    });
  });

  it("handles 401 Unauthorized by throwing SeqAuthenticationError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ Error: "Invalid API key" })
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    await expect(client.searchEvents()).rejects.toThrow(SeqAuthenticationError);
  });

  it("handles 404 Not Found by throwing SeqNotFoundError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ Error: "Signal not found" })
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    await expect(client.getSignal({ signalId: "unknown-id" })).rejects.toThrow(SeqNotFoundError);
  });

  it("identifies syntax errors and throws SeqSyntaxError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ Error: "Syntax error near: '==='" })
    });

    const client = new SeqClient({ serverUrl: "http://localhost:5341" });
    await expect(client.searchEvents({ filter: "@Level === 'Error'" })).rejects.toThrow(
      SeqSyntaxError
    );
  });
});
