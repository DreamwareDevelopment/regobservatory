import { inngest, InngestEvent } from "../client";
import { parseXMLText } from "@/lib/xml";
import { CFRReference } from "@/lib/zod/agency";
import { ParsedXMLTextArray, ParsedXMLTextArraySchema } from "@/lib/zod/data";
import dayjs from "@/lib/dayjs";
import { ingest } from "./ingest";
import { APPLICATION_STATE_ID } from "./agencies";
import prisma from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";
import { embedTexts } from "@/lib/ai";
import { Logger } from "inngest/middleware/logger";

async function fetchReferenceContent(logger: Logger, date: string, reference: CFRReference) {
  const params = new URLSearchParams();
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

  const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${reference.title}.xml?${params.toString()}`;
  // logger.info(url);
  const response = await fetch(url);

  if (response.status === 429) {
    throw new Error('Rate limited');
  }

  if (response.status === 504) {
    throw new Error('Gateway timeout');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.text();
}

function countWords(logger: Logger, content: string) {
  if (typeof content !== 'string') {
    logger.error(`Content is not a string: ${JSON.stringify(content)}`);
    return 0; // Return 0 if content is not a string
  }
  // Use a regular expression to match words with at least 3 alphabetic characters
  const words = content.match(/\b[a-zA-Z]{3,}\b/g);
  return words ? words.length : 0;
}

function diffWordCount(logger: Logger, previousContent: string[], currentContent: string[]) {
  const previousWordCount = previousContent.reduce((acc, content) => acc + countWords(logger, content), 0);
  const currentWordCount = currentContent.reduce((acc, content) => acc + countWords(logger, content), 0);
  return currentWordCount - previousWordCount;
}

async function updateHistory(
  tx: PrismaClient,
  logger: Logger,
  dateString: string,
  agencyId: string,
  newContent: ParsedXMLTextArray,
) {
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
  // Then get the current stored agency content if any
  const storedAgencyContent = await tx.agencyContent.findUnique({
    where: {
      agencyId,
    },
  });
  const storedContent = ParsedXMLTextArraySchema.parse(storedAgencyContent?.content ?? []);
  // Then diff and add/remove the diffed word count to/from the current history entry
  const wordCountDiff = diffWordCount(logger, storedContent.map(c => c.text), newContent.map(c => c.text));
  currentHistory.wordCount += wordCountDiff;
  await tx.agencyHistory.update({
    where: { id: currentHistory.id },
    data: { wordCount: currentHistory.wordCount },
  });
  // Then save or delete the agency content
  if (!newContent.length && storedAgencyContent) {
    await tx.agencyContent.delete({
      where: { agencyId },
    });
  } else {
    await tx.agencyContent.upsert({
      where: { agencyId },
      update: {
        content: newContent,
      },
      create: {
        agencyId,
        content: newContent,
      }
    });
  }
}

async function removeEmbeddings(tx: PrismaClient, logger: Logger, agencyId: string) {
  // Remove the embeddings for the agency
  logger.info(`Removing embeddings for agency ${agencyId}`);
  await tx.agencyEmbedding.deleteMany({
    where: {
      agencyId,
    },
  });
  logger.info(`Removed embeddings for agency ${agencyId}`);
}

async function upsertEmbeddings(logger: Logger, agencyId: string, title: number, content: ParsedXMLTextArray) {
  // Upsert embeddings for the agency content
  const chunks = content.flatMap(c => c.text.split('\n').map(t => ({ ...c, text: t })));
  logger.info(`Generating ${chunks.length} embeddings for agency ${agencyId}`);
  const { embeddings } = await embedTexts(chunks.map(c => c.text));
  logger.info(`Upserting ${embeddings.length} embeddings for agency ${agencyId}`);
  const promises = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    const chunk = chunks[i];
    // Ensure that agencyId, chunk, and embedding are not null
    if (agencyId && chunk && embedding) {
      const formattedEmbedding = `[${embedding.join(',')}]`;
      promises.push(prisma.$executeRaw`
        INSERT INTO "agency_embeddings" ("id", "agencyId", "title", "identifier", "type", "text", "embedding", "createdAt", "updatedAt") 
        VALUES (gen_random_uuid(), ${agencyId}, ${title}, ${chunk.identifier}, ${chunk.type}, ${chunk.text}, ${formattedEmbedding}, NOW(), NOW())
      `);
    } else {
      logger.error(`Null value detected: agencyId=${agencyId}, chunk=${chunk}, embedding=${embedding?.slice(0, 10)}`);
    }
  }
  await Promise.all(promises);
}

async function initEmbeddings(logger: Logger, agencyId: string, title: number) {
  // Initialize embeddings for the agency
  logger.info(`Initializing embeddings for agency ${agencyId}`);
  const content = await prisma.agencyContent.findUnique({
    where: {
      agencyId,
    },
  });
  if (!content) {
    throw new Error(`No content found for agency ${agencyId}`);
  }
  const contentArray = ParsedXMLTextArraySchema.parse(content.content);
  logger.info(`Found agency content for ${agencyId}, initializing embeddings...`);
  await upsertEmbeddings(logger, agencyId, title, contentArray);
  logger.info(`Initialized embeddings for agency ${agencyId}`);
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  logger: Logger,
  maxAttempts: number = 10,
  backoffFactor: number = 2000
): Promise<T> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Rate limited') || error.message.includes('Gateway timeout') || error.message.includes('fetch failed'))) {
        attempts++;
        const baseWaitTime = backoffFactor * Math.pow(2, attempts);
        const jitter = Math.random() * baseWaitTime;
        const waitTime = baseWaitTime + jitter;
        logger.warn(`Rate limited. Retrying in ${(waitTime / 1000).toFixed(2)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retry attempts reached');
}

export const processReference = inngest.createFunction(
  {
    id: "process-reference",
    concurrency: [{
      limit: 10,
      scope: "fn",
      key: "event.data.date", // Only 10 references per date can be processed at a time
    }, {
      limit: 1,
      scope: "fn",
      // Only one unique reference can be processed at a time, this is for multiple agencies with the same reference
      key: "event.data.referenceHash",
    }],
    retries: 0,
  },
  { event: InngestEvent.ProcessReference },
  async ({ event, logger, step }) => {
    logger.info(`Processing reference: ${JSON.stringify(event.data.reference, null, 2)}`);
    const reference = event.data.reference;
    const xmlContent = await retryWithBackoff(
      () => fetchReferenceContent(logger, event.data.date, reference),
      logger
    );
    // logger.info(`Fetched reference content for ${event.data.reference.title}\n: ${xmlContent}`);
    const text = parseXMLText(xmlContent, logger);
    await step.run('process-agency-content', async () => {
      await prisma.$transaction(async (tx) => {
        await updateHistory(
          tx as PrismaClient,
          logger,
          event.data.date,
          event.data.agencyId,
          text,
        );
        if (!text.length && !event.data.isCatchup && !event.data.isFirstCatchup) {
          // We only have embeddings after the first catchup
          await removeEmbeddings(tx as PrismaClient, logger, event.data.agencyId);
        }
      });
      if (!event.data.isCatchup && !event.data.isFirstCatchup) {
        // We only have embeddings after the first catchup
        await upsertEmbeddings(logger, event.data.agencyId, reference.title, text);
      }
      if (event.data.isFirstCatchup) {
        // Initialize embeddings for the agency
        await initEmbeddings(logger, event.data.agencyId, reference.title);
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
    return { date: event.data.date, reference, text };
  }
);
