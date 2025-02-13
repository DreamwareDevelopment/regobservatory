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
  title: z.string(),
  type: z.string()
});

export const VersionResponseSchema = z.object({
  content_versions: z.array(ContentVersionSchema),
});

export type ContentVersion = z.infer<typeof ContentVersionSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;
