import omit from 'lodash/omit';
import { z } from 'zod';

export const VitalsAndBiometricsFormSchema = z
  .object({
    systolicBloodPressure: z.number(),
    diastolicBloodPressure: z.number(),
    respiratoryRate: z.number(),
    oxygenSaturation: z.number(),
    bloodGlucose: z.number(),
    pulse: z.number(),
    temperature: z.number(),
    generalPatientNote: z.string(),
    overallRisk: z.string(),
    weight: z.number(),
    height: z.number(),
    midUpperArmCircumference: z.number(),
    computedBodyMassIndex: z.number(),
  })
  .partial()
  .refine(
    (fields) => {
      // The overall risk and the note only qualify the measurements, so on their own they are not
      // enough to save: such an encounter would never show up in the vitals list.
      const measurements = omit(fields, ['overallRisk', 'generalPatientNote']);
      return Object.values(measurements as Record<string, unknown>).some((value) => value != null && value !== '');
    },
    {
      message: 'Please fill at least one vital sign or biometric measurement',
      path: ['oneFieldRequired'],
    },
  );

export type VitalsBiometricsFormData = z.infer<typeof VitalsAndBiometricsFormSchema>;
