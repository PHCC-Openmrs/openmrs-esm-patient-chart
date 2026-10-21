import { describe, expect, it } from 'vitest';
import { NursingFormSchema } from './schema';

function issuePaths(data: Record<string, unknown>) {
  const result = NursingFormSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('NursingFormSchema', () => {
  it('accepts a procedure with both its drug and its quantity', () => {
    expect(NursingFormSchema.safeParse({ oralDrug: 'drug-uuid', oralQty: 2 }).success).toBe(true);
  });

  it('requires a quantity once a drug is chosen', () => {
    expect(issuePaths({ imInjectionDrug: 'drug-uuid' })).toEqual(['imInjectionQty']);
  });

  it('requires a drug once a quantity is entered', () => {
    expect(issuePaths({ ivInjectionQty: 3 })).toEqual(['ivInjectionDrug']);
  });

  it('accepts a quantity of zero together with a drug', () => {
    expect(NursingFormSchema.safeParse({ nebulizationDrug: 'drug-uuid', nebulizationQty: 0 }).success).toBe(true);
  });
});
