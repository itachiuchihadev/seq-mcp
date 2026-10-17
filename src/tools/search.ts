import { z } from "zod";
import { SeqClient } from "../client/seq-client.js";

export const SeqSearchSchema = {
  filter: z
    .string()
    .optional()
    .describe(
      "Seq filter expression (e.g., \"@Level = 'Error'\", \"Application = 'MyService' and StatusCode >= 500\"). Pass empty string or '*' to match all events. For date filtering, prefer fromDateUtc/toDateUtc for better performance."
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe("Maximum number of events to return (1-1000, default: 100)."),
  fromDateUtc: z
    .string()
    .optional()
    .describe("Earliest event date/time in ISO 8601 format (e.g., '2024-01-01T00:00:00Z')."),
  toDateUtc: z
    .string()
    .optional()
    .describe("Latest event date/time in ISO 8601 format (e.g., '2024-01-31T23:59:59Z')."),
  signalId: z
    .string()
    .optional()
    .describe("Optional signal ID to filter events (use seq_list_signals to find available signals)."),
  afterId: z
    .string()
    .optional()
    .describe("Event ID to search after (exclusive) for pagination. Pass the ID of the last event from the previous page."),
  workspace: z
    .string()
    .optional()
    .describe("Optional workspace identifier for multi-tenant or workspace-scoped queries.")
};

export async function handleSeqSearch(client: SeqClient, args: z.infer<z.ZodObject<typeof SeqSearchSchema>>) {
  const events = await client.searchEvents({
    filter: args.filter,
    count: args.count,
    fromDateUtc: args.fromDateUtc,
    toDateUtc: args.toDateUtc,
    signalId: args.signalId,
    afterId: args.afterId,
    workspace: args.workspace
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(events, null, 2)
      }
    ]
  };
}
