import { describe, expect, it } from 'vitest';
import { ecgMaxFileSizeBytes } from '../constants';
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

  it('accepts an ECG file of exactly the maximum size', () => {
    const file = new File([new Uint8Array(ecgMaxFileSizeBytes)], 'ecg.pdf', { type: 'application/pdf' });
    expect(NursingFormSchema.safeParse({ ecgFile: file }).success).toBe(true);
  });

  it('rejects an ECG file larger than the maximum size', () => {
    const file = new File([new Uint8Array(ecgMaxFileSizeBytes + 1)], 'ecg.pdf', { type: 'application/pdf' });
    expect(issuePaths({ ecgFile: file })).toEqual(['ecgFile']);
  });
});
