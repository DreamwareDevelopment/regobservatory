import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { ingest } from "@/inngest/functions/ingest";
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingest],
});
