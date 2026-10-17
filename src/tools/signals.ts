import { z } from "zod";
import { SeqClient } from "../client/seq-client.js";

export const SeqListSignalsSchema = {
  sharedOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to list only shared signals (default: true)."),
  workspace: z
    .string()
    .optional()
    .describe("Optional workspace identifier.")
};

export const SeqGetSignalSchema = {
  signalId: z
    .string()
    .describe("The ID of the signal to retrieve (e.g., 'signal-123')."),
  workspace: z
    .string()
    .optional()
    .describe("Optional workspace identifier.")
};

export async function handleSeqListSignals(client: SeqClient, args: z.infer<z.ZodObject<typeof SeqListSignalsSchema>>) {
  const signals = await client.listSignals({
    sharedOnly: args.sharedOnly,
    workspace: args.workspace
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(signals, null, 2)
      }
    ]
  };
}

export async function handleSeqGetSignal(client: SeqClient, args: z.infer<z.ZodObject<typeof SeqGetSignalSchema>>) {
  const signal = await client.getSignal({
    signalId: args.signalId,
    workspace: args.workspace
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(signal, null, 2)
      }
    ]
  };
}
