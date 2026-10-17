import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveConfig } from "../src/utils/config.js";
import fs from "node:fs";

describe("Config resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses default localhost URL if no env or options provided", () => {
    delete process.env.SEQ_SERVER_URL;
    delete process.env.SEQ_URL;
    const config = resolveConfig();
    expect(config.serverUrl).toBe("http://localhost:5341");
    expect(config.workspace).toBe("default");
  });

  it("prioritizes options over environment variables", () => {
    process.env.SEQ_SERVER_URL = "http://env-url:5341";
    process.env.SEQ_API_KEY = "env-key";

    const config = resolveConfig({
      serverUrl: "http://options-url:5341",
      apiKey: "options-key",
      workspace: "production"
    });

    expect(config.serverUrl).toBe("http://options-url:5341");
    expect(config.apiKey).toBe("options-key");
    expect(config.workspace).toBe("production");
  });

  it("strips trailing slashes from serverUrl", () => {
    const config = resolveConfig({
      serverUrl: "http://my-seq-server:5341///"
    });
    expect(config.serverUrl).toBe("http://my-seq-server:5341");
  });

  it("loads secrets from secrets.json mock", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        default: "secret-default-key",
        production: "secret-prod-key"
      })
    );

    const config = resolveConfig({ workspace: "production" });
    expect(config.workspaceApiKeys?.production).toBe("secret-prod-key");
    expect(config.apiKey).toBe("secret-prod-key");
  });
});
