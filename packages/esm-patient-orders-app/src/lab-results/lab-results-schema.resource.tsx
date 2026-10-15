import { z } from 'zod';
import { isRangeResult, parseRangeResult } from '@openmrs/esm-patient-common-lib';
import { type LabOrderConcept } from './lab-results.resource';

type SchemaRecord = Record<string, z.ZodType>;

function createSchemaForConcept(labOrderConcept: LabOrderConcept, rangeResultConcepts: Array<string>): SchemaRecord {
  // A range test is entered as one value under its own uuid, so its members get no fields of their own
  if (isRangeResult(labOrderConcept, rangeResultConcepts)) {
    return { [labOrderConcept.uuid]: createRangeSchema(labOrderConcept) };
  }

  const schema = {};
  const conceptSchema = createSchema(labOrderConcept);
  if (conceptSchema) {
    schema[labOrderConcept.uuid] = conceptSchema;
  }

  const setMembersSchema = labOrderConcept?.setMembers
    ? labOrderConcept.setMembers.reduce((acc, member) => {
        return {
          ...acc,
          ...createSchemaForConcept(member, rangeResultConcepts),
        };
      }, {})
    : {};

  return {
    ...schema,
    ...setMembersSchema,
  };
}

function createSchemaForConceptArray(
  labOrderConcepts: Array<LabOrderConcept>,
  rangeResultConcepts: Array<string>,
): SchemaRecord {
  return labOrderConcepts.reduce((acc, concept) => {
    return {
      ...acc,
      ...createSchemaForConcept(concept, rangeResultConcepts), // reuses recursive logic
    };
  }, {});
}

/**
 * Custom hook to generate a Zod schema for lab results form based on multiple lab order concepts.
 * This function is used to generate the schema for the lab results form.
 * @param {Array<string>} labOrderConceptUuid - The List of UUID of the lab order concepts.
 * @param rangeResultConcepts - UUIDs of the concepts whose result is entered as a range.
 * @returns A Zod schema object for the lab results form.
 */
export const createLabResultsFormCompositeSchema = (
  labOrderConcepts: Array<LabOrderConcept>,
  rangeResultConcepts: Array<string> = [],
) => {
  if (!labOrderConcepts) {
    return z.object({});
  }
  const schema = createSchemaForConceptArray(labOrderConcepts, rangeResultConcepts);

  return z.object(schema);
};

/**
 * Determines and returns the appropriate Zod schema for a given lab order concept.
 * @param labOrderConcept - The lab order concept to create a schema for.
 * @returns A Zod schema type based on the concept's data type.
 */
const createSchema = (labOrderConcept: LabOrderConcept): z.ZodType => {
  const {
    hiAbsolute: upperLimit,
    lowAbsolute: lowerLimit,
    datatype: { hl7Abbreviation },
  } = labOrderConcept;

  switch (hl7Abbreviation) {
    case 'ST':
      return z.string().optional();
    case 'NM':
      return createNumericSchema(labOrderConcept, upperLimit, lowerLimit);
    case 'CWE': {
      const answers = labOrderConcept.answers?.map((answer) => answer.uuid) ?? [];
      // The "Choose an option" placeholder has value '', which means no answer was selected
      const emptyToUndefined = (val: unknown) => (val === '' || val === null ? undefined : val);
      return answers.length > 0
        ? z.preprocess(emptyToUndefined, z.enum(answers as [string, ...string[]]).optional())
        : z.preprocess(emptyToUndefined, z.string().optional());
    }
    default:
      return null;
  }
};

/**
 * Creates a Zod schema for a numeric lab order concept, including validation for upper and lower limits.
 * @param labOrderConcept - The lab order concept to create a schema for.
 * @param upperLimit - The upper limit for the numeric value.
 * @param lowerLimit - The lower limit for the numeric value.
 * @returns A Zod schema type with appropriate numeric validations.
 */
const createNumericSchema = (
  labOrderConcept: LabOrderConcept,
  upperLimit: number | null | undefined,
  lowerLimit: number | null | undefined,
): z.ZodType => {
  const { allowDecimal, display } = labOrderConcept;
  const processNumber = (val: unknown) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const parsed = Number(val);
    if (isNaN(parsed)) return undefined;
    return parsed;
  };

  let baseSchema = z
    .preprocess(processNumber, z.number().optional())
    .refine((val) => val === undefined || !isNaN(val), {
      message: `${display} must be a valid number`,
    })
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (!allowDecimal) {
          return Number.isInteger(val);
        }
        return true;
      },
      {
        message: !allowDecimal ? `${display} must be a whole number` : `${display} must be a valid number`,
      },
    );

  // Add range validations
  const hasLowerLimit = lowerLimit !== null && lowerLimit !== undefined;
  const hasUpperLimit = upperLimit !== null && upperLimit !== undefined;

  if (!hasLowerLimit && !hasUpperLimit) {
    return baseSchema;
  }

  if (hasLowerLimit && hasUpperLimit) {
    return baseSchema.refine((val) => val === undefined || (val >= lowerLimit && val <= upperLimit), {
      message: `${display} must be between ${lowerLimit} and ${upperLimit}`,
    });
  }

  if (hasLowerLimit) {
    return baseSchema.refine((val) => val === undefined || val >= lowerLimit, {
      message: `${display} must be greater than or equal to ${lowerLimit}`,
    });
  }

  if (hasUpperLimit) {
    return baseSchema.refine((val) => val === undefined || val <= upperLimit, {
      message: `${display} must be less than or equal to ${upperLimit}`,
    });
  }

  return baseSchema;
};

/**
 * Creates a Zod schema for a range test entered as one value such as "100-120". A single value such as "100"
 * is accepted as the range 100 - 100. Each bound is checked against its own member concept's absolute limits
 * and decimal setting, and the lower value must not be greater than the upper value.
 * @param labOrderConcept - The range test, whose first member is the lower bound and second the upper bound.
 * @returns A Zod schema type that accepts an empty value or a valid range.
 */
export const createRangeSchema = (labOrderConcept: LabOrderConcept): z.ZodType => {
  const { display } = labOrderConcept;
  const [lowerConcept, upperConcept] = labOrderConcept.setMembers;

  const checkBound = (value: number, concept: LabOrderConcept, bound: string): string | null => {
    const { allowDecimal, lowAbsolute, hiAbsolute } = concept;
    if (!allowDecimal && !Number.isInteger(value)) {
      return `${display} ${bound} value must be a whole number`;
    }
    if (lowAbsolute !== null && lowAbsolute !== undefined && value < lowAbsolute) {
      return `${display} ${bound} value must be greater than or equal to ${lowAbsolute}`;
    }
    if (hiAbsolute !== null && hiAbsolute !== undefined && value > hiAbsolute) {
      return `${display} ${bound} value must be less than or equal to ${hiAbsolute}`;
    }
    return null;
  };

  return z
    .preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.unknown())
    .superRefine((val, ctx) => {
      if (val === undefined) {
        return;
      }
      const range = parseRangeResult(val);
      const message = !range
        ? `${display} must be a range such as 100-120`
        : checkBound(range.low, lowerConcept, 'lower') ??
          checkBound(range.high, upperConcept, 'upper') ??
          (range.low > range.high ? `${display} lower value must not be greater than the upper value` : null);
      if (message) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }
    });
};
