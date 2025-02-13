import { z } from "zod";

export const ParsedXMLTextSchema = z.object({
  type: z.string(),
  identifier: z.string(),
  text: z.string(),
});

export const ParsedXMLTextArraySchema = z.array(ParsedXMLTextSchema);

export type ParsedXMLText = z.infer<typeof ParsedXMLTextSchema>;
export type ParsedXMLTextArray = z.infer<typeof ParsedXMLTextArraySchema>;