import { z } from "zod";
import { SeqClient } from "../client/seq-client.js";

export const SeqTailEventsSchema = {
  filter: z
    .string()
    .optional()
    .describe("Optional Seq filter expression to apply to the live event stream."),
  count: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Maximum number of events to capture (1-100, default: 10)."),
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(5)
    .describe("Time window in seconds to wait for incoming events (1-30, default: 5)."),
  workspace: z
    .string()
    .optional()
    .describe("Optional workspace identifier.")
};

export async function handleSeqTailEvents(
  client: SeqClient,
  args: z.infer<z.ZodObject<typeof SeqTailEventsSchema>>
) {
  const events = await client.tailEvents({
    filter: args.filter,
    count: args.count,
    timeoutSeconds: args.timeoutSeconds,
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
