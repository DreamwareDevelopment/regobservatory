import { CFRReference } from "@/lib/zod/agency";
import { EventSchemas, GetEvents, Inngest } from "inngest";

export enum InngestEvent {
  LoadAgencies = "agencies/load",
  Ingest = "ingest/agencies",
  IngestCron = "ingest/cron",
  ProcessReference = "ingest/reference",
}

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "regobservatory",
  schemas: new EventSchemas().fromRecord<{
    [InngestEvent.Ingest]: {
      data: {
        date?: string;
      };
    };
    [InngestEvent.IngestCron]: {
      data: {
        date: string;
      };
    };
    [InngestEvent.ProcessReference]: {
      data: {
        date: string;
        reference: CFRReference;
        referenceHash: string;
        agencyId: string;
        parentId: string | null;
        isCatchup: boolean;
        isFirstCatchup: boolean;
      };
    };
    [InngestEvent.LoadAgencies]: {
      data: never;
    };
  }>(),
});

export type InngestEventData = GetEvents<typeof inngest>
