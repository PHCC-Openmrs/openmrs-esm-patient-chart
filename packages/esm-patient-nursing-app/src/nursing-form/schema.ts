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
    imInjection: z.string(),
    ivInjection: z.string(),
    oral: z.string(),
    nebulization: z.string(),
  })
  .partial()
  .refine(
    (fields) =>
      Object.values(fields).some((value) => (Array.isArray(value) ? value.length > 0 : value != null && value !== '')),
    {
      message: 'Please fill at least one field',
      path: ['oneFieldRequired'],
    },
  );

export type NursingFormData = z.infer<typeof NursingFormSchema>;
