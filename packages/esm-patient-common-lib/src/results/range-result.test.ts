import { describe, it, expect } from 'vitest';
import { formatRangeResult, isRangeResult, parseRangeResult, worstInterpretation } from './range-result';

const numeric = (uuid: string) => ({ uuid, datatype: { display: 'Numeric', hl7Abbreviation: 'NM' } });
const rangeConcept = { uuid: 'range', setMembers: [numeric('lower'), numeric('upper')] };

describe('isRangeResult', () => {
  it('is true for a configured concept with two numeric members', () => {
    expect(isRangeResult(rangeConcept, ['range'])).toBe(true);
  });

  it('is false when the concept is not configured', () => {
    expect(isRangeResult(rangeConcept, [])).toBe(false);
    expect(isRangeResult(rangeConcept, undefined)).toBe(false);
  });

  it('is false unless there are exactly two numeric members', () => {
    expect(isRangeResult({ uuid: 'range', setMembers: [numeric('a')] }, ['range'])).toBe(false);
    expect(
      isRangeResult(
        {
          uuid: 'range',
          setMembers: [numeric('a'), { uuid: 'b', datatype: { display: 'Text', hl7Abbreviation: 'ST' } }],
        },
        ['range'],
      ),
    ).toBe(false);
  });
});

describe('parseRangeResult', () => {
  it.each([
    ['100-120', { low: 100, high: 120 }],
    ['100 - 120', { low: 100, high: 120 }],
    ['4.5-6', { low: 4.5, high: 6 }],
    ['100–120', { low: 100, high: 120 }],
    [' 100 ', { low: 100, high: 100 }],
    ['100', { low: 100, high: 100 }],
    ['120-100', { low: 120, high: 100 }],
  ])('parses %s', (text, expected) => {
    expect(parseRangeResult(text)).toEqual(expected);
  });

  it.each(['', 'abc', '100-', '-100', '100-120-130', '100--120'])('rejects %s', (text) => {
    expect(parseRangeResult(text)).toBeNull();
  });
});

describe('formatRangeResult', () => {
  it('formats both bounds with units', () => {
    expect(formatRangeResult(100, 120, 'mg/dL')).toBe('100 – 120 mg/dL');
  });

  it('shows a missing bound as ?', () => {
    expect(formatRangeResult(100, undefined)).toBe('100 – ?');
  });
});

describe('worstInterpretation', () => {
  it('returns the more severe flag', () => {
    expect(worstInterpretation('NORMAL', 'HIGH')).toBe('HIGH');
    expect(worstInterpretation('CRITICALLY_LOW', 'HIGH')).toBe('CRITICALLY_LOW');
    expect(worstInterpretation('OFF_SCALE_HIGH', 'CRITICALLY_HIGH')).toBe('OFF_SCALE_HIGH');
    expect(worstInterpretation(undefined, 'NORMAL')).toBe('NORMAL');
    expect(worstInterpretation('LOW', undefined)).toBe('LOW');
  });
});
