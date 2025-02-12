import { inngest, InngestEvent } from "../client";

export const ingest = inngest.createFunction(
  { id: "ingest-chunk" },
  { event: InngestEvent.Ingest },
  async ({ event, logger, step }) => {
    await step.sleep("wait-a-moment", "1s");
    logger.info(`Ingesting from ${event.data.date}`);
  },
);
