import { inngest, InngestEvent } from "../client";
import prisma from "@/lib/prisma";
import { agencySchemas } from "@/lib/zod/agency";

export const APPLICATION_STATE_ID = "application-state";

export const loadAgencies = inngest.createFunction(
  {
    id: "load-agencies",
    concurrency: {
      limit: 1,
      scope: "account",
      key: "load-agencies",
    },
    retries: 0,
  },
  { event: InngestEvent.LoadAgencies },
  async ({ logger, step }) => {
    logger.info(`Loading agencies from eCFR API`);
    const agencies = await step.run("fetch-agencies", async () => {
      const response = await fetch(
        "https://www.ecfr.gov/api/admin/v1/agencies.json"
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const parsedData = agencySchemas.ECFRResponse.parse(data);
      const agencies = parsedData.agencies;
      
      logger.info(`Found ${agencies.length} top-level agencies from eCFR API`);
      return agencies;
    });

    await step.run("save-agencies", async () => {
      // First, create/update departments
      for (const dept of agencies) {
        const department = await prisma.agency.upsert({
          where: { slug: dept.slug },
          create: {
            name: dept.name,
            shortName: dept.shortName,
            displayName: dept.displayName,
            sortableName: dept.sortableName,
            slug: dept.slug,
            cfrReferences: dept.cfrReferences,
          },
          update: {
            name: dept.name,
            shortName: dept.shortName,
            displayName: dept.displayName,
            sortableName: dept.sortableName,
            cfrReferences: dept.cfrReferences,
          },
        });

        // Then create/update its child agencies
        for (const agency of dept.children) {
          await prisma.agency.upsert({
            where: { slug: agency.slug },
            create: {
              name: agency.name,
              shortName: agency.shortName,
              displayName: agency.displayName,
              sortableName: agency.sortableName,
              slug: agency.slug,
              cfrReferences: agency.cfrReferences,
              parentId: department.id,
            },
            update: {
              name: agency.name,
              shortName: agency.shortName,
              displayName: agency.displayName,
              sortableName: agency.sortableName,
              cfrReferences: agency.cfrReferences,
              parentId: department.id,
            },
          });
        }
      }
      logger.info("Successfully saved agencies to database");
      await prisma.applicationState.upsert({
        where: { id: APPLICATION_STATE_ID },
        create: {
          id: APPLICATION_STATE_ID,
        },
        update: {
          id: APPLICATION_STATE_ID,
        },
      });
      logger.info("Successfully saved application state to database");
    });

    return { agencies };
  },
);
