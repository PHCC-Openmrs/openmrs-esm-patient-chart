import { z } from 'zod';

export const NursingFormSchema = z
  .object({
    // Dressing
    typeOfWound: z.string(),
    ointments: z.array(z.string()),
    dressingGeneralNotes: z.string(),
    // Other measures
    ecgFile: z.instanceof(File).nullable(),
    spirometry: z.number(),
    monofilament: z.number(),
    // Nursing procedures
    imInjectionDrug: z.string(),
    imInjectionQty: z.number(),
    ivInjectionDrug: z.string(),
    ivInjectionQty: z.number(),
    oralDrug: z.string(),
    oralQty: z.number(),
    nebulizationDrug: z.string(),
    nebulizationQty: z.number(),
  })
  .partial()
  .refine(
    (fields) =>
      Object.values(fields).some((value) => (Array.isArray(value) ? value.length > 0 : value != null && value !== '')),
    {
      message: 'Please fill at least one field',
      path: ['oneFieldRequired'],
    },
  )
  // A procedure's drug and its quantity go together: the report counts and totals them as a pair.
  .superRefine((fields, context) => {
    for (const procedure of ['imInjection', 'ivInjection', 'oral', 'nebulization'] as const) {
      const hasDrug = Boolean(fields[`${procedure}Drug`]);
      const hasQuantity = fields[`${procedure}Qty`] != null;
      if (hasDrug && !hasQuantity) {
        context.addIssue({ code: 'custom', message: 'quantityRequired', path: [`${procedure}Qty`] });
      }
      if (hasQuantity && !hasDrug) {
        context.addIssue({ code: 'custom', message: 'drugRequired', path: [`${procedure}Drug`] });
      }
    }
  });

export type NursingFormData = z.infer<typeof NursingFormSchema>;
