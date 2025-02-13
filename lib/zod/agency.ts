import { z } from "zod";

const CFRReferenceSchema = z.object({
  title: z.number(),
  chapter: z.string().nullable().optional(),
  subchapter: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  part: z.string().nullable().optional(),
  subpart: z.string().nullable().optional(),
  appendix: z.string().nullable().optional(),
});

const BaseAgencySchema = z.object({
  name: z.string(),
  shortName: z.string().nullable(),
  displayName: z.string(),
  sortableName: z.string(),
  slug: z.string(),
  cfrReferences: z.array(CFRReferenceSchema),
});

const AgencySchema = BaseAgencySchema;

const DepartmentSchema = BaseAgencySchema.extend({
  children: z.array(AgencySchema),
});

const ECFRResponseSchema = z.object({
  agencies: z.array(DepartmentSchema),
});

export type CFRReference = z.infer<typeof CFRReferenceSchema>;
export type Agency = z.infer<typeof AgencySchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type ECFRResponse = z.infer<typeof ECFRResponseSchema>;

export const agencySchemas = {
  CFRReference: CFRReferenceSchema,
  Base: BaseAgencySchema,
  Agency: AgencySchema,
  Department: DepartmentSchema,
  ECFRResponse: ECFRResponseSchema,
} as const;
