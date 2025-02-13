import { z } from "zod";

export const ContentVersionSchema = z.object({
  identifier: z.string(),
  part: z.string().nullable(),
  removed: z.boolean(),
  type: z.string(),
});

export const VersionResponseSchema = z.object({
  content_versions: z.array(ContentVersionSchema),
});

export type ContentVersion = z.infer<typeof ContentVersionSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;
