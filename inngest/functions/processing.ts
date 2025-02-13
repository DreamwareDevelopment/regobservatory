import { inngest, InngestEvent } from "../client";
import { parseXMLText } from "@/lib/xml";
import { CFRReference } from "@/lib/zod/agency";
import { ContentVersion, VersionResponseSchema } from "@/lib/zod/data";
import dayjs from "@/lib/dayjs";
import { ingest } from "./ingest";
import { APPLICATION_STATE_ID } from "./agencies";
import prisma from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";
import { embedTexts, generateChunks } from "@/lib/ai";
import { Logger } from "inngest/middleware/logger";

async function fetchReferenceSections(logger: Logger, reference: CFRReference, date: string) {
  const params = new URLSearchParams({
    'issue_date[on]': date
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

  const url = `https://www.ecfr.gov/api/versioner/v1/versions/title-${reference.title}.json?${params.toString()}`;
  logger.info(url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return VersionResponseSchema.parse(data);
}

async function fetchSectionContent(logger: Logger, date: string, section: ContentVersion) {
  const [part,] = section.identifier.split('.');
  const params = new URLSearchParams({
    part,
    section: section.identifier,
  });
  const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${section.title}.xml?${params.toString()}`;
  logger.info(url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.text();
}

function countWords(content: string) {
  return content.split(/\s+/).filter(Boolean).length;
}

function diffWordCount(previousContent: string[], currentContent: string[]) {
  const previousWordCount = previousContent.reduce((acc, content) => acc + countWords(content), 0);
  const currentWordCount = currentContent.reduce((acc, content) => acc + countWords(content), 0);
  return currentWordCount - previousWordCount;
}

async function updateSectionHistory(tx: PrismaClient, logger: Logger, dateString: string, agencyId: string, section: ContentVersion, newContent: string[]) {
  const date = dayjs(dateString);
  // Get the previous history entry for the agency
  const previousHistory = await tx.agencyHistory.findFirst({
    where: {
      agencyId,
      date: {
        lte: date.toDate(),
      },
    },
    orderBy: {
      date: 'desc',
    },
  });
  logger.info(`Previous history: ${previousHistory?.wordCount}`);
  let currentHistory = await tx.agencyHistory.findFirst({
    where: {
      agencyId,
      date: {
        gte: date.toDate(),
      },
    },
    orderBy: {
      date: 'desc',
    },
  });
  if (!currentHistory) {
    // Create a new history entry for the agency
    currentHistory = await tx.agencyHistory.create({
      data: {
        agencyId,
        wordCount: previousHistory?.wordCount ?? 0,
        date: date.hour(12).toDate(),
      },
    });
  }
  // Then get the current stored section if any
  const sectionId = `${section.title}.${section.identifier}`;
  const storedSection = await tx.section.findUnique({
    where: {
      id: sectionId,
    }
  });
  // Then diff and add/remove the diffed word count to/from the current history entry
  const wordCountDiff = diffWordCount(storedSection?.content ?? [], newContent);
  currentHistory.wordCount += wordCountDiff;
  await tx.agencyHistory.update({
    where: { id: currentHistory.id },
    data: { wordCount: currentHistory.wordCount },
  });
  // Then save or delete the section
  if (section.removed) {
    await tx.section.delete({
      where: { id: sectionId },
    });
  } else {
    await tx.section.upsert({
      where: { id: sectionId },
      update: {
        content: newContent,
      },
      create: {
        id: sectionId,
        title: parseInt(section.title),
        part: section.part,
        identifier: section.identifier,
        content: newContent,
        agencies: {
          create: {
            agencyId,
          }
        }
      }
    });
  }
}

async function removeEmbeddings(tx: PrismaClient, logger: Logger, sectionId: string) {
  // Remove the embeddings for the section and all agencies
  logger.info(`Removing embeddings for section ${sectionId}`);
  await tx.sectionEmbedding.deleteMany({
    where: {
      sectionId,
    },
  });
  logger.info(`Removed embeddings for section ${sectionId}`);
}

async function upsertEmbeddings(logger: Logger, sectionId: string, newContent: string[]) {
  // Upsert embeddings for the section
  const chunks = newContent.flatMap(content => generateChunks(content));
  logger.info(`Generating ${chunks.length} embeddings for section ${sectionId}`);
  const { embeddings } = await embedTexts(chunks);
  logger.info(`Upserting ${embeddings.length} embeddings for section ${sectionId}`);
  const promises = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    const chunk = chunks[i];
    promises.push(prisma.$executeRaw`INSERT INTO "section_embeddings" ("sectionId", "text", "embedding") VALUES (${sectionId}, ${chunk}, ${embedding})`);
  }
  await Promise.all(promises);
}

async function initEmbeddings(logger: Logger, agencyId: string) {
  // Initialize embeddings for the agency
  logger.info(`Initializing embeddings for agency ${agencyId}`);
  const sections = await prisma.section.findMany({
    where: {
      agencies: {
        some: { agencyId },
      },
    },
  });
  logger.info(`Found ${sections.length} sections for agency ${agencyId}, initializing embeddings...`);
  const promises = [];
  for (const storedSection of sections) {
    promises.push(upsertEmbeddings(logger, storedSection.id, storedSection.content));
  }
  await Promise.all(promises);
  logger.info(`Initialized embeddings for agency ${agencyId}`);
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
    retries: 0,
  },
  { event: InngestEvent.ProcessReference },
  async ({ event, logger, step }) => {
    logger.info(`Processing reference: ${JSON.stringify(event.data.reference, null, 2)}`);
    const reference = event.data.reference as CFRReference;

    const sections = await step.run('fetch-title-versions', async () => {
      const result = await fetchReferenceSections(logger, reference, event.data.date);
      // TODO: Fix appendices not working
      return result.content_versions.filter(v => v.type === 'section'); // Filter out appendices because the xml search doesn't work for them
    });

    logger.info(`Found ${sections.length} sections on ${event.data.date} for reference: ${JSON.stringify(reference, null, 2)}`);

    // Chunk the sections into arrays of 50
    const chunkSize = 50;
    const sectionChunks = [];
    for (let i = 0; i < sections.length; i += chunkSize) {
      sectionChunks.push(sections.slice(i, i + chunkSize));
    }

    // Process each chunk in a separate step so the serverless function doesn't timeout
    for (const sectionChunk of sectionChunks) {
      await step.run('process-sections', async () => {
        for (const section of sectionChunk) {
          const sectionId = `${section.title}.${section.identifier}`;
          const content = await fetchSectionContent(logger, event.data.date, section);
          const text = parseXMLText(content);
          await prisma.$transaction(async (tx) => {
            if (section.removed) {
              await updateSectionHistory(tx as PrismaClient, logger, event.data.date, event.data.agencyId, section, []);
              if (!event.data.isCatchup && !event.data.isFirstCatchup) {
                // We only have embeddings after the first catchup
                await removeEmbeddings(tx as PrismaClient, logger, sectionId);
              }
              return;
            }
            logger.info(`Fetched content for section ${section.identifier}`);
            await updateSectionHistory(tx as PrismaClient, logger, event.data.date, event.data.agencyId, section, text);
          });
          if (!event.data.isCatchup && !event.data.isFirstCatchup) {
            // We only have embeddings after the first catchup
            await upsertEmbeddings(logger, sectionId, text);
          }
        }
        if (event.data.isFirstCatchup) {
          // Initialize embeddings for the agency
          await initEmbeddings(logger, event.data.agencyId);
        }
      });
    }

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
    return { sections, date: event.data.date };
  }
);
