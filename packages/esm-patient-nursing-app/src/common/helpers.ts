/** Appends a unit to a label, e.g. `Spirometry (g)`, skipping the parentheses when there is no unit. */
export function withUnit(label: string, unit: string | null | undefined): string {
  return unit ? `${label} (${unit})` : label;
}
