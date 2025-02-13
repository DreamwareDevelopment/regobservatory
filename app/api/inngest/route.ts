import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { ingest, ingestCron } from "@/inngest/functions/ingest";
import { loadAgencies } from "@/inngest/functions/agencies";
import { processReference } from "@/inngest/functions/processing";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingest, ingestCron, loadAgencies, processReference],
  streaming: "allow",
});
