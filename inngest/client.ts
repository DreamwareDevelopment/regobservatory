import { EventSchemas, GetEvents, Inngest } from "inngest";

export enum InngestEvent {
  LoadAgencies = "agencies/load",
  Ingest = "ingest/fetch",
  IngestCron = "ingest/cron",
  ProcessChunk = "ingest/chunk",
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
    [InngestEvent.ProcessChunk]: {
      data: {
        date?: string;
      };
    };
    [InngestEvent.LoadAgencies]: {
      data: never;
    };
  }>(),
});

export type InngestEventData = GetEvents<typeof inngest>
