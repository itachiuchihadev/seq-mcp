import { z } from "zod";
import { SeqClient } from "../client/seq-client.js";

export const SeqConvertFilterSchema = {
  fuzzyFilter: z
    .string()
    .describe(
      "The fuzzy or relaxed filter expression to convert (e.g., 'error', 'timeout', 'StatusCode >= 500'). Converts to strict syntax required by Seq API."
    ),
  workspace: z
    .string()
    .optional()
    .describe("Optional workspace identifier.")
};

export async function handleSeqConvertFilter(
  client: SeqClient,
  args: z.infer<z.ZodObject<typeof SeqConvertFilterSchema>>
) {
  const result = await client.convertFilter({
    fuzzyFilter: args.fuzzyFilter,
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
