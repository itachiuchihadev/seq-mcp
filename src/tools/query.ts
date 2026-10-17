import { z } from "zod";
import { SeqClient } from "../client/seq-client.js";

export const SeqQuerySchema = {
  query: z
    .string()
    .describe(
      "Seq SQL query to execute (e.g. \"select count(*) from stream group by time(5m)\", \"select @Timestamp, @Message, @Level, Exception from stream where @Level = 'Error' limit 50\")."
    ),
  fromDateUtc: z
    .string()
    .optional()
    .describe("Optional start time boundary in ISO 8601 format (e.g. '2024-01-01T00:00:00Z')."),
  toDateUtc: z
    .string()
    .optional()
    .describe("Optional end time boundary in ISO 8601 format (e.g. '2024-01-31T23:59:59Z')."),
  signalId: z
    .string()
    .optional()
    .describe("Optional signal ID to scope query results."),
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(300)
    .optional()
    .default(30)
    .describe("Timeout in seconds for the query (1-300, default: 30)."),
  workspace: z
    .string()
    .optional()
    .describe("Optional workspace identifier.")
};

export async function handleSeqQuery(client: SeqClient, args: z.infer<z.ZodObject<typeof SeqQuerySchema>>) {
  const result = await client.executeQuery({
    query: args.query,
    fromDateUtc: args.fromDateUtc,
    toDateUtc: args.toDateUtc,
    signalId: args.signalId,
    timeoutSeconds: args.timeoutSeconds,
    workspace: args.workspace
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}
