import { inngest, InngestEvent } from "../client";
import { parseXMLText } from "@/lib/xml";
import { CFRReference } from "@/lib/zod/agency";
import dayjs from "@/lib/dayjs";
import prisma from "@/lib/prisma";
import { embedTexts } from "@/lib/ai";
import { Logger } from "inngest/middleware/logger";
import { ParsedXMLTextArray } from "@/lib/zod/data";

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
    // TODO: The gov server is timing out on large responses, so we skip this reference. Needs to be fixed upstream.
    logger.error('Gateway timeout');
    return null;
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

async function updateHistory(
  logger: Logger,
  dateString: string,
  agencyId: string,
  newContent: ParsedXMLTextArray,
) {
  const date = dayjs(dateString);
  // Get the previous history entry for the agency
  const previousHistory = await prisma.agencyHistory.findFirst({
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
  let currentHistory = await prisma.agencyHistory.findFirst({
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
    currentHistory = await prisma.agencyHistory.create({
      data: {
        agencyId,
        wordCount: previousHistory?.wordCount ?? 0,
        date: date.hour(12).toDate(),
      },
    });
  }
  // Update the word count for the current history entry
  currentHistory.wordCount = countWords(logger, newContent.map(c => c.text).join(' '));
  await prisma.agencyHistory.update({
    where: { id: currentHistory.id },
    data: { wordCount: currentHistory.wordCount },
  });
  // Then save or delete the agency content
  if (!newContent.length) {
    await prisma.agencyContent.upsert({
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
  return { current: currentHistory.wordCount, previous: previousHistory?.wordCount ?? 0 };
}

async function removeEmbeddings(logger: Logger, agencyId: string) {
  // Remove the embeddings for the agency
  logger.info(`Removing embeddings for agency ${agencyId}`);
  await prisma.agencyEmbedding.deleteMany({
    where: {
      agencyId,
    },
  });
  logger.info(`Removed embeddings for agency ${agencyId}`);
}

async function insertEmbeddings(logger: Logger, agencyId: string, title: number, content: ParsedXMLTextArray) {
  // Insert embeddings for the agency content
  const chunks = content.flatMap(c => c.text.split('\n').map(t => ({ ...c, text: t })));
  const filteredChunks = chunks.filter(t => Boolean(t.text));
  if (!filteredChunks.length) {
    logger.info(`No content to embed for agency ${agencyId}`);
    return;
  }
  logger.info(`Generating ${filteredChunks.length} embeddings for agency ${agencyId}`);
  const { embeddings, values } = await retryWithBackoff(async () => embedTexts(filteredChunks.map(c => c.text)), logger);
  logger.info(`Inserting ${embeddings.length} embeddings for agency ${agencyId}`);
  const promises = [];
  for (let i = 0; i < embeddings.length; i++) {
    const embedding = embeddings[i];
    const { identifier, type, text } = filteredChunks[i];
    const value = values[i];
    if (value !== text) {
      throw new Error(`Value mismatch: ${value} !== ${text}`);
    }
    // Ensure that agencyId, chunk, and embedding are not null
    if (agencyId && identifier && type && text && embedding) {
      const formattedEmbedding = `[${embedding.join(',')}]`;
      promises.push(prisma.$executeRaw`
        INSERT INTO "agency_embeddings" ("id", "agency_id", "title", "identifier", "type", "text", "embedding", "created_at", "updated_at") 
        VALUES (gen_random_uuid(), ${agencyId}, ${title}, ${identifier}, ${type}, ${text}, ${formattedEmbedding}, NOW(), NOW())
      `);
    } else {
      logger.error(`Null value detected: agencyId=${agencyId}, identifier=${identifier}, type=${type}, text=${text}, embedding=${embedding?.slice(0, 10)}`);
    }
  }
  await Promise.all(promises);
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  logger: Logger,
  maxAttempts: number = 20,
  backoffFactor: number = 1000
): Promise<T> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Rate limited') || error.message.includes('fetch failed') || error.message.includes('AI_RetryError'))) {
        attempts++;
        const baseWaitTime = backoffFactor * Math.pow(2, attempts);
        const jitter = Math.random() * baseWaitTime;
        const waitTime = baseWaitTime + jitter;
        logger.warn(`Rate limited, reason: ${error.message}. Retrying in ${(waitTime / 1000).toFixed(2)} seconds...`);
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
      limit: 5,
      scope: "fn",
      key: "event.data.date", // Only 10 references per date can be processed at a time
    }, {
      limit: 1,
      scope: "fn",
      // Only one unique reference can be processed at a time, this is for multiple agencies with the same reference
      key: "event.data.referenceHash",
    }],
    retries: 5,
  },
  { event: InngestEvent.ProcessReference },
  async ({ event, logger, step }) => {
    logger.info(`Processing reference: ${JSON.stringify(event.data.reference, null, 2)}`);
    const reference = event.data.reference;
    const xmlContent = await retryWithBackoff(
      () => fetchReferenceContent(logger, event.data.date, reference),
      logger
    );
    if (!xmlContent) {
      return { date: event.data.date, reference, text: [] };
    }
    // logger.info(`Fetched reference content for ${event.data.reference.title}\n: ${xmlContent}`);
    const text = parseXMLText(xmlContent, logger);
    const { current, previous } = await step.run('process-agency-content', async () => {
      const historicalCounts = await updateHistory(
        logger,
        event.data.date,
        event.data.agencyId,
        text,
      );
      if (!event.data.isCatchup) {
        await removeEmbeddings(logger, event.data.agencyId);
        await insertEmbeddings(logger, event.data.agencyId, reference.title, text);
      }
      return historicalCounts;
    });

    return { date: event.data.date, reference, current, previous };
  }
);
