import { inngest, InngestEvent } from "../client";
import prisma from "@/lib/prisma";

export const ingest = inngest.createFunction(
  {
    id: "ingest",
    concurrency: {
      limit: 1,
      scope: "account",
      key: "ingest",
    },
    retries: 1,
  },
  { event: InngestEvent.Ingest },
  async ({ event, logger, step }) => {
    await step.sleep("wait-a-moment", "1s");
    logger.info(`Ingesting from ${event.data.date}`);
    const samples = await prisma.sample.findMany();
    logger.info(`Found ${samples.length} samples`);
    return {
      samples,
    };
  },
);
