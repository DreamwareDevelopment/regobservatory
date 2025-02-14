// import { Agency } from "@prisma/client";
import { inngest, InngestEvent } from "../client";
import { processReference } from "./processing";
import prisma from "@/lib/prisma";
import md5 from "md5";
import { CFRReference } from "@/lib/zod/agency";
import dayjs from "@/lib/dayjs";
import { APPLICATION_STATE_ID } from "./agencies";

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
    const { agencies, applicationState } = await step.run("ingest-agencies", async () => {
      const applicationState = await prisma.applicationState.findFirst();
      if (!applicationState) {
        throw new Error("Application state not found");
      }
      const agencies = await prisma.agency.findMany({
        include: {
          children: true,
        },
        orderBy: {
          name: "asc",
        },
      });
      // // Temporarily sample a single department
      // const agenciesToIngest: Agency[] = [];
      // for (const agency of agencies) {
      //   if (agency.children.length > 0) {
      //     const children = agency.children;
      //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
      //     delete (agency as any).children;
      //     agenciesToIngest.push(agency);
      //     for (const child of children) {
      //       agenciesToIngest.push(child);
      //     }
      //     break;
      //   }
      // }
      return { agencies, applicationState };
    });
    logger.info(`Found ${agencies.length} agencies`);
    /*
    If we have a date, use that. We're either running a cron job or a continuation of catchup.
    If we have a next processing date, it means we've restarted the app during catchup, perhaps after a crash.
    If we don't have a date, we're in the first catchup run and should use the beginning of the CFR data.
    */
    const date = event.data.date || applicationState.nextProcessingDate || '2017-01-01';
    // runUntil is a development field to have reduced record fetching/processing during development
    const isToday = date === (applicationState.runUntil || dayjs().format('YYYY-MM-DD'));
    if (!applicationState.isCaughtUp && isToday) {
      applicationState.isCaughtUp = true;
    }
    logger.info(`Ingesting from ${date}, isCaughtUp: ${applicationState.isCaughtUp}`);

    // Ingest each agency
    const promises = [];
    for (let i = 0; i < agencies.length; i++) {
      const agency = agencies[i];
      // Ingest each reference for the agency
      for (let j = 0; j < agency.cfrReferences.length; j++) {
        const reference = agency.cfrReferences[j] as CFRReference;
        const hash = md5(JSON.stringify(reference));
        promises.push(step.invoke(`process-${agency.id}-${hash}`, {
          function: processReference,
          data: {
            date,
            agencyName: agency.name,
            isCatchup: !applicationState.isCaughtUp,
            reference,
            referenceHash: hash,
            agencyId: agency.id,
            parentId: agency.parentId,
          },
        }).catch(error => {
          logger.error(`Failed to process reference ${hash} for agency ${agency.id}: ${error.message}`);
          return null; // Return null to indicate failure
        }));
      }
    }
    const results = await Promise.all(promises);
    const failedCount = results.filter(result => result === null).length;
    const failureRate = failedCount / promises.length;
    if (failureRate >= 0.1) {
      throw new Error(`More than 10% of the promises failed: ${failedCount} out of ${promises.length}`);
    }
    const lastProcessed = dayjs(date);
    const nextProcessingDate = lastProcessed.add(1, 'day').format('YYYY-MM-DD');
    await step.run('update-application-state', async () => {
      applicationState.nextProcessingDate = nextProcessingDate;
      logger.info(`Last processed: ${lastProcessed.format('YYYY-MM-DD')}`);
      logger.info(`Next processing date: ${nextProcessingDate}`);
      await prisma.applicationState.update({
        where: { id: APPLICATION_STATE_ID },
        data: {
          nextProcessingDate,
          isCaughtUp: applicationState.isCaughtUp,
        },
      });
    });
    if (!applicationState.isCaughtUp) {
      logger.info(`Sending catchup event for ${nextProcessingDate}`);
      await step.sendEvent(`catchup-continue`, {
        name: InngestEvent.Ingest,
        data: {
          date: nextProcessingDate,
        },
      });
    } else {
      logger.info(`Application state is caught up, all done.`);
    }
  },
);

export const ingestCron = inngest.createFunction(
  {
    id: "ingest-cron",
    concurrency: {
      limit: 1,
      scope: "account",
      key: "ingest-cron",
    },
    retries: 1,
  },
  {
    cron: "0 19 * * 1-5", // 7:00 PM EST Monday through Friday
  },
  async ({ logger, step }) => {
    const applicationState = await prisma.applicationState.findFirst();
    if (!applicationState) {
      throw new Error("Application state not found");
    }
    if (!applicationState.isCaughtUp) {
      // Cron only runs with today's date so skip if we're not caught up
      logger.info("Application state is not caught up, skipping cron job");
      return;
    }
    const date = dayjs()
    const dateString = date.format("YYYY-MM-DD");
    if (dateString !== applicationState.nextProcessingDate) {
      // Likely behind schedule, log an error and skip
      logger.error(`Cron job running for ${dateString} but next processing date is ${applicationState.nextProcessingDate}`);
      return;
    }
    logger.info(`Cron job running for ${dateString}`);
    await step.invoke(InngestEvent.IngestCron, {
      function: ingest,
      data: {
        date: dateString,
      },
    });
  }
);
