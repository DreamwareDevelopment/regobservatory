import { z } from "zod";

export const ContentVersionSchema = z.object({
  date: z.string(),
  amendment_date: z.string(),
  issue_date: z.string(),
  identifier: z.string(),
  name: z.string(),
  part: z.string(),
  substantive: z.boolean(),
  removed: z.boolean(),
  subpart: z.string().nullable(),
  title: z.number(),
  type: z.string()
});

export const MetaSchema = z.object({
  title: z.string(),
  result_count: z.string(),
  issue_date: z.object({
    lte: z.string(),
    gte: z.string()
  }),
  latest_amendment_date: z.string(),
  latest_issue_date: z.string()
});

export const VersionResponseSchema = z.object({
  content_versions: z.array(ContentVersionSchema),
  meta: MetaSchema
});

export type ContentVersion = z.infer<typeof ContentVersionSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;
