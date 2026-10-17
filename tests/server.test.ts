import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createSeqMcpServer } from "../src/server.js";
import { SeqClient } from "../src/client/seq-client.js";

describe("Seq MCP Server", () => {
  let mockSeqClient: SeqClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSeqClient = new SeqClient({ serverUrl: "http://localhost:5341", apiKey: "test-key" });
  });

  async function setupTestClient() {
    const { server } = createSeqMcpServer({
      client: mockSeqClient
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client(
      {
        name: "test-client",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);

    return { client, server };
  }

  it("lists all available MCP tools", async () => {
    const { client } = await setupTestClient();
    const response = await client.listTools();

    expect(response.tools).toBeDefined();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain("seq_search");
    expect(toolNames).toContain("seq_query");
    expect(toolNames).toContain("seq_list_signals");
    expect(toolNames).toContain("seq_get_signal");
    expect(toolNames).toContain("seq_convert_filter");
    expect(toolNames).toContain("seq_tail_events");
  });

  it("lists available MCP resources", async () => {
    const { client } = await setupTestClient();
    const response = await client.listResources();

    expect(response.resources).toBeDefined();
    const resourceUris = response.resources.map((r) => r.uri);

    expect(resourceUris).toContain("seq://signals");
    expect(resourceUris).toContain("seq://server-info");
  });

  it("invokes seq_search tool successfully", async () => {
    const fakeEvents = [
      {
        Id: "event-1",
        Timestamp: "2024-01-01T12:00:00Z",
        RenderedMessage: "Order processed successfully",
        Level: "Information"
      }
    ];

    vi.spyOn(mockSeqClient, "searchEvents").mockResolvedValue(fakeEvents as any);

    const { client } = await setupTestClient();
    const result = await client.callTool({
      name: "seq_search",
      arguments: {
        filter: "Level = 'Information'",
        count: 10
      }
    });

    expect(mockSeqClient.searchEvents).toHaveBeenCalledWith({
      filter: "Level = 'Information'",
      count: 10,
      fromDateUtc: undefined,
      toDateUtc: undefined,
      signalId: undefined,
      afterId: undefined,
      workspace: undefined
    });

    expect(result.content).toBeDefined();
    const contentText = (result.content as any)[0].text;
    expect(JSON.parse(contentText)).toEqual(fakeEvents);
  });

  it("supports PascalCase alias SeqSearch", async () => {
    const fakeEvents = [{ Id: "event-2" }];
    vi.spyOn(mockSeqClient, "searchEvents").mockResolvedValue(fakeEvents as any);

    const { client } = await setupTestClient();
    const result = await client.callTool({
      name: "SeqSearch",
      arguments: {
        filter: "@Level = 'Error'"
      }
    });

    expect(mockSeqClient.searchEvents).toHaveBeenCalled();
    expect(JSON.parse((result.content as any)[0].text)).toEqual(fakeEvents);
  });

  it("invokes seq_query tool successfully", async () => {
    const fakeQueryResult = {
      Columns: ["Method", "Count"],
      Rows: [["POST", 150]]
    };

    vi.spyOn(mockSeqClient, "executeQuery").mockResolvedValue(fakeQueryResult as any);

    const { client } = await setupTestClient();
    const result = await client.callTool({
      name: "seq_query",
      arguments: {
        query: "select count(*) from stream group by Method"
      }
    });

    expect(mockSeqClient.executeQuery).toHaveBeenCalledWith({
      query: "select count(*) from stream group by Method",
      fromDateUtc: undefined,
      toDateUtc: undefined,
      signalId: undefined,
      timeoutSeconds: 30,
      workspace: undefined
    });

    expect(JSON.parse((result.content as any)[0].text)).toEqual(fakeQueryResult);
  });

  it("invokes seq_list_signals tool successfully", async () => {
    const fakeSignals = [
      {
        Id: "signal-1",
        Title: "Exceptions"
      }
    ];

    vi.spyOn(mockSeqClient, "listSignals").mockResolvedValue(fakeSignals as any);

    const { client } = await setupTestClient();
    const result = await client.callTool({
      name: "seq_list_signals",
      arguments: {
        sharedOnly: true
      }
    });

    expect(mockSeqClient.listSignals).toHaveBeenCalledWith({
      sharedOnly: true,
      workspace: undefined
    });

    expect(JSON.parse((result.content as any)[0].text)).toEqual(fakeSignals);
  });

  it("invokes seq_convert_filter tool successfully", async () => {
    const fakeResult = {
      strictExpression: '"timeout"',
      matchedAsText: true,
      reasonIfMatchedAsText: "Bareword"
    };

    vi.spyOn(mockSeqClient, "convertFilter").mockResolvedValue(fakeResult);

    const { client } = await setupTestClient();
    const result = await client.callTool({
      name: "seq_convert_filter",
      arguments: {
        fuzzyFilter: "timeout"
      }
    });

    expect(mockSeqClient.convertFilter).toHaveBeenCalledWith({
      fuzzyFilter: "timeout",
      workspace: undefined
    });

    expect(JSON.parse((result.content as any)[0].text)).toEqual(fakeResult);
  });

  it("returns error content when tool throws an error", async () => {
    vi.spyOn(mockSeqClient, "searchEvents").mockRejectedValue(new Error("Database connection lost"));

    const { client } = await setupTestClient();
    const result = await client.callTool({
      name: "seq_search",
      arguments: {
        filter: "@Level = 'Error'"
      }
    });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("Database connection lost");
  });
});
