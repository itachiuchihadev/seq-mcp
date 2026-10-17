import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTestEvents, dumpTestData } from "../src/data-generator.js";

describe("Data Generator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generates requested number of events", () => {
    const events = generateTestEvents(50, 2);
    expect(events.length).toBe(50);
  });

  it("generates events with required CLEF fields and valid ISO timestamps", () => {
    const events = generateTestEvents(20, 1);
    for (const evt of events) {
      expect(evt["@t"]).toBeDefined();
      expect(new Date(evt["@t"]).toISOString()).toBe(evt["@t"]);
      expect(evt["@mt"]).toBeDefined();
      expect(typeof evt["@mt"]).toBe("string");
    }
  });

  it("includes all standard log levels across the dataset", () => {
    const events = generateTestEvents(200, 3);
    const levels = new Set(events.map((e) => e["@l"]));

    expect(levels.has("Information")).toBe(true);
    expect(levels.has("Warning")).toBe(true);
    expect(levels.has("Error")).toBe(true);
    expect(levels.has("Fatal")).toBe(true);
  });

  it("includes stack traces for error events", () => {
    const events = generateTestEvents(100, 3);
    const errorEvents = events.filter((e) => e["@l"] === "Error" || e["@l"] === "Fatal");

    expect(errorEvents.length).toBeGreaterThan(0);
    const hasException = errorEvents.some((e) => typeof e["@x"] === "string" && e["@x"].length > 0);
    expect(hasException).toBe(true);
  });

  it("dumps events to /ingest/clef endpoint in batches", async () => {
    let callCount = 0;
    let lastBody = "";

    global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      callCount++;
      lastBody = init.body as string;
      return {
        ok: true,
        status: 201,
        headers: new Headers()
      };
    });

    const result = await dumpTestData({
      serverUrl: "http://localhost:5341",
      apiKey: "test-api-key",
      count: 25,
      batchSize: 10
    });

    expect(result.ingestedCount).toBe(25);
    expect(result.batchesCount).toBe(3); // 10 + 10 + 5
    expect(callCount).toBe(3);
    expect(lastBody.split("\n").length).toBe(5);
  });
});
