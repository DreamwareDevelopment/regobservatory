import { Agency } from "@prisma/client";
import { inngest, InngestEvent } from "../client";
import { processReference } from "./processing";
import prisma from "@/lib/prisma";
import md5 from "md5";
import { CFRReference } from "@/lib/zod/agency";

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
    logger.info(`Ingesting from ${event.data.date}`);
    const agencies = await step.run("ingest-agencies", async () => {
      const agenciesToIngest: Agency[] = [];
      const agencies = await prisma.agency.findMany({
        include: {
          children: true,
        },
        orderBy: {
          name: "asc",
        },
      });
      // Temporarily sample a single department
      for (const agency of agencies) {
        if (agency.children.length > 0) {
          const children = agency.children;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (agency as any).children;
          agenciesToIngest.push(agency);
          for (const child of children) {
            agenciesToIngest.push(child);
          }
          break;
        }
      }
      return agenciesToIngest;
    });
    logger.info(`Found ${agencies.length} agencies`);
    for (const agency of agencies) {
      for (const reference of (agency.cfrReferences as CFRReference[]) ?? []) {
        const hash = md5(JSON.stringify(reference));
        await step.invoke(`process-${agency.id}-${hash}`, {
          function: processReference,
          data: {
            date: event.data.date,
            isCron: event.data.isCron,
            reference,
            referenceHash: hash,
            agencyId: agency.id,
            parentId: agency.parentId,
          },
        });
      }
    }
    return {
      agencies,
    };
  },
);

// TODO: Add a cron job that runs every day but checks if the history is up to date before running the ingest
