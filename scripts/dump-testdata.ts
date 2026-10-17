#!/usr/bin/env node

import readline from "node:readline";
import { dumpTestData, generateTestEvents } from "../src/data-generator.js";
import { resolveConfig } from "../src/utils/config.js";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function printUsage(): void {
  console.log(`
Usage:
  npx tsx scripts/dump-testdata.ts [options]
  npm run dump-testdata -- [options]

Options:
  -k, --api-key <key>     API key for Seq ingestion (or set SEQ_API_KEY env var)
  -u, --url <url>         Seq server URL (default: http://localhost:5341)
  -n, --count <number>    Number of events to generate (default: 100)
  -d, --days <days>       Days lookback to spread timestamps (default: 3)
  -h, --help              Show this help message

Examples:
  npm run dump-testdata -- --api-key YOUR_SEQ_API_KEY
  npm run dump-testdata -- -k YOUR_KEY -n 250 -d 7
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let apiKey: string | undefined;
  let serverUrl: string | undefined;
  let count = 100;
  let daysLookback = 3;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }
    if ((arg === "-k" || arg === "--api-key") && i + 1 < args.length) {
      apiKey = args[++i];
    } else if ((arg === "-u" || arg === "--url") && i + 1 < args.length) {
      serverUrl = args[++i];
    } else if ((arg === "-n" || arg === "--count") && i + 1 < args.length) {
      count = parseInt(args[++i], 10) || 100;
    } else if ((arg === "-d" || arg === "--days") && i + 1 < args.length) {
      daysLookback = parseInt(args[++i], 10) || 3;
    }
  }

  const resolved = resolveConfig({
    serverUrl,
    apiKey
  });

  let effectiveApiKey = apiKey || resolved.apiKey || process.env.SEQ_API_KEY;

  if (!effectiveApiKey) {
    console.log("No API key found in arguments or SEQ_API_KEY environment variable.");
    const inputKey = await askQuestion("Please enter your Seq API key (or press Enter if anonymous ingestion is allowed): ");
    if (inputKey) {
      effectiveApiKey = inputKey;
    }
  }

  const targetUrl = serverUrl || resolved.serverUrl || "http://localhost:5341";

  console.log(`\n========================================`);
  console.log(`  Dumping Dummy Test Data to Seq`);
  console.log(`========================================`);
  console.log(`Target URL:      ${targetUrl}`);
  console.log(`API Key:         ${effectiveApiKey ? effectiveApiKey.substring(0, 4) + "..." + effectiveApiKey.substring(Math.max(0, effectiveApiKey.length - 3)) : "(None / Anonymous)"}`);
  console.log(`Event Count:     ${count}`);
  console.log(`Lookback Window: ${daysLookback} days`);
  console.log(`----------------------------------------`);

  console.log("Generating diverse structured events...");
  const sampleEvents = generateTestEvents(count, daysLookback);

  // Group summary by level
  const levelCounts: Record<string, number> = {};
  for (const evt of sampleEvents) {
    const lvl = evt["@l"] || "Information";
    levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
  }

  console.log("Event distribution:");
  for (const [lvl, c] of Object.entries(levelCounts)) {
    console.log(`  - ${lvl.padEnd(12)}: ${c} events`);
  }

  console.log(`\nSending events to ${targetUrl}/ingest/clef...`);
  const startTime = Date.now();

  try {
    const result = await dumpTestData({
      serverUrl: targetUrl,
      apiKey: effectiveApiKey,
      count,
      daysLookback
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nSUCCESS: Ingested ${result.ingestedCount} events across ${result.batchesCount} batches in ${elapsed}s!`);
    console.log(`\nYou can now open ${targetUrl} or use seq_search / seq_query in your AI assistant to explore the data.\n`);
  } catch (err: unknown) {
    console.error(`\nFAILED to dump test data:`, err instanceof Error ? err.message : String(err));
    console.error(`\nTip: Ensure Seq is running and that your API key has "Ingest" permission.\n`);
    process.exit(1);
  }
}

main();
