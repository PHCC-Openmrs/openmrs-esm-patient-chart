import { type OBSERVATION_INTERPRETATION } from '../types';

/**
 * A range result is a lab test whose result is entered as a range such as "100-120". It is stored as a
 * LabSet with exactly two Numeric members: the first holds the lower bound and the second the upper bound.
 * Only concepts listed in the `rangeResultConcepts` config are treated as ranges, so other two-member panels
 * (e.g. blood pressure) are never affected.
 */
export interface RangeResultConcept {
  uuid: string;
  datatype?: { display?: string; hl7Abbreviation?: string };
  setMembers?: Array<RangeResultConcept>;
}

export interface ParsedRangeResult {
  low: number;
  high: number;
}

const isNumericConcept = (concept: RangeResultConcept | undefined) =>
  concept?.datatype?.hl7Abbreviation === 'NM' || concept?.datatype?.display === 'Numeric';

export function isRangeResult(
  concept: RangeResultConcept | undefined,
  rangeResultConcepts: Array<string> | undefined,
): boolean {
  if (!concept || !rangeResultConcepts?.includes(concept.uuid)) {
    return false;
  }
  const members = concept.setMembers ?? [];
  return members.length === 2 && members.every(isNumericConcept);
}

const number = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const rangePattern = new RegExp(String.raw`^\s*${number}\s*(?:[-–—]\s*${number}\s*)?$`);

/**
 * Parses a range typed as "100-120", "100 - 120", "4.5-6" or "100–120" (en dash). A single value such as
 * "100" is read as the range 100 – 100. Returns null when the text is not a range.
 */
export function parseRangeResult(text: unknown): ParsedRangeResult | null {
  if (typeof text === 'number') {
    return Number.isFinite(text) ? { low: text, high: text } : null;
  }
  if (typeof text !== 'string') {
    return null;
  }
  const match = rangePattern.exec(text);
  if (!match) {
    return null;
  }
  const low = Number(match[1]);
  const high = match[2] === undefined ? low : Number(match[2]);
  return { low, high };
}

/**
 * Formats a stored range for display, e.g. "100 – 120 mg/dL". A missing bound is shown as "?".
 */
export function formatRangeResult(low: unknown, high: unknown, units?: string): string {
  const show = (value: unknown) => (value === null || value === undefined || value === '' ? '?' : String(value));
  return `${show(low)} – ${show(high)}${units ? ` ${units}` : ''}`;
}

const interpretationSeverity: Record<string, number> = {
  NORMAL: 1,
  HIGH: 2,
  LOW: 2,
  CRITICALLY_HIGH: 3,
  CRITICALLY_LOW: 3,
  OFF_SCALE_HIGH: 4,
  OFF_SCALE_LOW: 4,
};

/**
 * Returns the more severe of two interpretations, so the flag for a range reflects its worst bound:
 * off-scale beats critical, critical beats high/low, and high/low beats normal.
 */
export function worstInterpretation(
  a: OBSERVATION_INTERPRETATION | undefined,
  b: OBSERVATION_INTERPRETATION | undefined,
): OBSERVATION_INTERPRETATION | undefined {
  const severity = (value: OBSERVATION_INTERPRETATION | undefined) => interpretationSeverity[value ?? ''] ?? 0;
  return severity(b) > severity(a) ? b : a;
}
