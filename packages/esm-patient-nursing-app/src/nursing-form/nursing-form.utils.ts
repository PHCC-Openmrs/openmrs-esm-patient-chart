import { type OpenmrsResource } from '@openmrs/esm-framework';
import { type ConfigObject } from '../config-schema';
import { type NursingObs, type ScalarNursingField } from '../common/types';
import { type NursingFormData } from './schema';

/** The scalar (single-obs) fields, paired with the config key holding their concept uuid. */
export const scalarFields: Array<{ field: ScalarNursingField; conceptKey: keyof ConfigObject['concepts'] }> = [
  { field: 'typeOfWound', conceptKey: 'typeOfWoundUuid' },
  { field: 'dressingGeneralNotes', conceptKey: 'dressingGeneralNotesUuid' },
  { field: 'spirometry', conceptKey: 'spirometryUuid' },
  { field: 'monofilament', conceptKey: 'monofilamentUuid' },
  { field: 'imInjection', conceptKey: 'imInjectionUuid' },
  { field: 'ivInjection', conceptKey: 'ivInjectionUuid' },
  { field: 'oral', conceptKey: 'oralUuid' },
  { field: 'nebulization', conceptKey: 'nebulizationUuid' },
];

const numericFields = new Set<ScalarNursingField>(['spirometry', 'monofilament']);

/** Normalises a field value so an untouched field never reads as changed. */
export function normalise(value: unknown): string {
  return value == null || value === '' ? '' : String(value);
}

export function sameSelection(a: Array<string>, b: Array<string>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedB = [...b].sort();
  return [...a].sort().every((uuid, index) => uuid === sortedB[index]);
}

export interface BuildObsArgs {
  data: NursingFormData;
  /** The values the form was seeded with -- empty when creating a new record. */
  initialValues: Record<string, string | number | Array<string>>;
  /** The obs backing each scalar field on the encounter being edited, if any. */
  existingObsByField: Map<ScalarNursingField, NursingObs> | null;
  /** Every ointment obs on the encounter being edited, if any. */
  existingOintmentObs: Array<NursingObs>;
  concepts: ConfigObject['concepts'];
}

export interface ObsForSubmission {
  newObs: Array<OpenmrsResource>;
  toBeVoided: Array<OpenmrsResource>;
}

/**
 * Works out the obs to write and the obs to void for a nursing encounter.
 *
 * Changes are detected by comparing against the values the form was seeded with rather than
 * react-hook-form's `dirtyFields`, which tracks arrays (the Ointment multi-select) per-index
 * and would otherwise miss a selection that was cleared entirely.
 *
 * The ECG attachment is handled by the caller, since writing its obs depends on an upload
 * having succeeded first.
 */
export function buildObsForSubmission({
  data,
  initialValues,
  existingObsByField,
  existingOintmentObs,
  concepts,
}: BuildObsArgs): ObsForSubmission {
  const newObs: Array<OpenmrsResource> = [];
  const toBeVoided: Array<OpenmrsResource> = [];

  for (const { field, conceptKey } of scalarFields) {
    const nextValue = normalise(data[field]);
    if (nextValue === normalise(initialValues[field])) {
      continue;
    }

    const existingObs = existingObsByField?.get(field);
    if (existingObs) {
      toBeVoided.push({ uuid: existingObs.uuid, voided: true } as unknown as OpenmrsResource);
    }

    if (nextValue !== '') {
      newObs.push({
        concept: concepts[conceptKey],
        value: numericFields.has(field) ? Number(nextValue) : nextValue,
      } as unknown as OpenmrsResource);
    }
  }

  const selectedOintments = data.ointments ?? [];
  if (!sameSelection(selectedOintments, (initialValues.ointments as Array<string>) ?? [])) {
    // The multi-select is stored as one coded obs per ointment, so a changed selection means
    // voiding all of the previous ones and writing the new set.
    for (const obs of existingOintmentObs) {
      toBeVoided.push({ uuid: obs.uuid, voided: true } as unknown as OpenmrsResource);
    }
    for (const ointmentUuid of selectedOintments) {
      newObs.push({ concept: concepts.ointmentUuid, value: ointmentUuid } as unknown as OpenmrsResource);
    }
  }

  return { newObs, toBeVoided };
}
