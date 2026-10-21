/** Appends a unit to a label, e.g. `Spirometry (g)`, skipping the parentheses when there is no unit. */
export function withUnit(label: string, unit: string | null | undefined): string {
  return unit ? `${label} (${unit})` : label;
}

/** The nursing procedures, each recorded as a drug (coded) plus the quantity given. */
export const nursingProcedures = ['imInjection', 'ivInjection', 'oral', 'nebulization'] as const;
export type NursingProcedure = (typeof nursingProcedures)[number];

/** Fields whose obs hold a number rather than text. */
export const numericFields: ReadonlySet<string> = new Set([
  'spirometry',
  'monofilament',
  ...nursingProcedures.map((procedure) => `${procedure}Qty`),
]);

/** Fields whose obs hold a coded answer, which the form edits by concept uuid. */
export const codedFields: ReadonlySet<string> = new Set(nursingProcedures.map((procedure) => `${procedure}Drug`));

/** How a procedure reads in a table: `Hyoscine × 2`, or the older free-text answer when there is no drug. */
export function formatProcedure(drug?: string, quantity?: number, legacyText?: string): string | undefined {
  if (drug) {
    return quantity != null && !Number.isNaN(quantity) ? `${drug} × ${quantity}` : drug;
  }
  return legacyText || undefined;
}
