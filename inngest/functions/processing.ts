import { inngest, InngestEvent } from "../client";
import { CFRReference } from "@/lib/zod/agency";
import { ContentVersion, VersionResponseSchema } from "@/lib/zod/data";

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

export const processReference = inngest.createFunction(
  {
    id: "process-reference",
    concurrency: [{
      limit: 5,
      scope: "account",
      key: `event.data.agencyId`,
    }, {
      limit: 1,
      scope: "account",
      key: `event.data.referenceHash`,
    }],
  },
  { event: InngestEvent.ProcessReference },
  async ({ event, logger, step }) => {
    logger.info(`Processing reference ${event.data.reference}`);
    const reference = event.data.reference as CFRReference;
    const date = event.data.date || '2017-01-01'; // Beginning of CFR data
    
    const sections = await step.run('fetch-title-versions', async () => {
      const result = await fetchReferenceSections(reference, date);
      return result.content_versions.filter(v => v.type === 'section'); // Filter out appendices because the xml search doesn't work for them
    });

    logger.info(`Found ${sections.length} sections on ${date} for reference ${JSON.stringify(reference, null, 2)}`);
    await step.run('process-sections', async () => {
      for (const section of sections) {
        if (section.removed) {
          await updateSectionHistory(event.data.parentId, event.data.agencyId, section, '');
          if (event.data.isCron) {
            // We only have embeddings during cron runs
            // TODO: Update stored application state when we've gotten up to date with historical data
            await removeEmbeddings(section);
          }
          continue;
        }
        const content = await fetchSectionContent(date, section);
        logger.info(`Fetched content for section ${section.identifier}`);
        await updateSectionHistory(event.data.parentId, event.data.agencyId, section, content);
        if (event.data.isCron) {
          // We only have embeddings during cron runs
          // TODO: Update stored application state when we've gotten up to date with historical data
          await upsertEmbeddings(event.data.parentId, event.data. agencyId, section, content);
        }
      }
    });
    // TODO: Re-invoke this function with the next date
    return { sections };
  }
);
