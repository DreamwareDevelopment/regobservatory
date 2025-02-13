import { inngest, InngestEvent } from "../client";
import { CFRReference } from "@/lib/zod/agency";
import { ContentVersion, VersionResponseSchema } from "@/lib/zod/data";
import dayjs from "dayjs";
import { ingest } from "./ingest";
import { APPLICATION_STATE_ID } from "./agencies";
import prisma from "@/lib/prisma";

async function fetchReferenceSections(reference: CFRReference, date: string) {
  const params = new URLSearchParams({
    issue_date: date
  });

  // Add all possible reference filters if they exist
  if (reference.chapter) {
    params.append('chapter', reference.chapter);
  }
  if (reference.subchapter) {
    params.append('subchapter', reference.subchapter);
  }
  if (reference.part) {
    params.append('part', reference.part);
  }
  if (reference.subpart) {
    params.append('subpart', reference.subpart);
  }
  if (reference.section) {
    params.append('section', reference.section);
  }
  if (reference.appendix) {
    params.append('appendix', reference.appendix);
  }

  const response = await fetch(
    `https://www.ecfr.gov/api/versioner/v1/versions/title-${reference.title}.json?${params.toString()}`
  );
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return VersionResponseSchema.parse(data);
}

async function fetchSectionContent(date: string, section: ContentVersion) {
  const [part,] = section.identifier.split('.');
  const params = new URLSearchParams({
    part,
    section: section.identifier,
  });
  const response = await fetch(
    `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${section.title}.xml?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.text();
}

async function updateSectionHistory(parentId: string | null, agencyId: string, section: ContentVersion, newContent: string) {
  // Get the current history for the agency
  // Then get the current stored section if any
  // Then diff and add/remove the diffed word count to/from the history
  // Then append the new history
  // Then store the new content
}

async function removeEmbeddings(section: ContentVersion) {
  // Remove the embeddings for the section and all agencies
}

async function upsertEmbeddings(parentId: string | null, agencyId: string, section: ContentVersion, newContent: string) {
  // Upsert embeddings for the section and agency
}

async function initEmbeddings(parentId: string | null, agencyId: string) {
  // Initialize embeddings for the agency
}

export const processReference = inngest.createFunction(
  {
    id: "process-reference",
    concurrency: [{
      limit: 10,
      scope: "fn",
      key: `event.data.date`, // Only 10 references per date can be processed at a time
    }, {
      limit: 1,
      scope: "fn",
      // Only one unique reference can be processed at a time, this is for multiple agencies with the same reference
      key: `event.data.referenceHash`,
    }],
  },
  { event: InngestEvent.ProcessReference },
  async ({ event, logger, step }) => {
    logger.info(`Processing reference: ${JSON.stringify(event.data.reference, null, 2)}`);
    const reference = event.data.reference as CFRReference;

    const sections = await step.run('fetch-title-versions', async () => {
      const result = await fetchReferenceSections(reference, event.data.date);
      // TODO: Fix appendices not working
      return result.content_versions.filter(v => v.type === 'section'); // Filter out appendices because the xml search doesn't work for them
    });

    logger.info(`Found ${sections.length} sections on ${event.data.date} for reference: ${JSON.stringify(reference, null, 2)}`);
    await step.run('process-sections', async () => {
      for (const section of sections) {
        if (section.removed) {
          await updateSectionHistory(event.data.parentId, event.data.agencyId, section, '');
          if (!event.data.isCatchup && !event.data.isFirstCatchup) {
            // We only have embeddings after the first catchup
            await removeEmbeddings(section);
          }
          continue;
        }
        const content = await fetchSectionContent(event.data.date, section);
        logger.info(`Fetched content for section ${section.identifier}`);
        await updateSectionHistory(event.data.parentId, event.data.agencyId, section, content);
        if (!event.data.isCatchup && !event.data.isFirstCatchup) {
          // We only have embeddings after the first catchup
          await upsertEmbeddings(event.data.parentId, event.data.agencyId, section, content);
        }
      }
      if (event.data.isFirstCatchup) {
        // Initialize embeddings for the agency
        await initEmbeddings(event.data.parentId, event.data.agencyId);
      }
    });
    if (event.data.triggerFollowUp) {
      await step.run('update-application-state', async () => {
        const lastProcessed = dayjs(event.data.date);
        logger.info(`Last processed: ${lastProcessed.format('YYYY-MM-DD HH:mm:ss')}`);
        await prisma.applicationState.update({
          where: { id: APPLICATION_STATE_ID },
          data: {
            nextProcessingDate: lastProcessed.add(1, 'day').format('YYYY-MM-DD'),
            isCaughtUp: !event.data.isCatchup,
          },
        });
      });
    }
    // This is only done on the last reference of the last agency for a given date as it re-runs ingest for all agencies on the next date.
    if (event.data.isCatchup && event.data.triggerFollowUp) {
      await step.invoke(`catchup-continue`, {
        function: ingest,
        data: {
          ...event.data,
          date: dayjs(event.data.date).add(1, 'day').format('YYYY-MM-DD'),
        },
      });
    }
    return { sections };
  }
);
