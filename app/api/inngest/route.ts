import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { ingest } from "@/inngest/functions/ingest";
import { loadAgencies } from "@/inngest/functions/agencies";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingest, loadAgencies],
  streaming: "allow",
});
