import { type OpenmrsResource } from '@openmrs/esm-framework';

export interface NursingObs extends OpenmrsResource {
  concept: { uuid: string; display: string };
  value: string | number | { uuid: string; display: string };
}

export interface NursingEncounter extends OpenmrsResource {
  encounterDatetime: string;
  obs: Array<NursingObs>;
}

/**
 * A single nursing encounter flattened into the fields the widgets and the form deal in.
 * Every field is optional: a nursing encounter may record only a dressing, only a
 * procedure, or any mix of the three sections.
 */
export interface NursingRecord {
  /** The uuid of the encounter this record was built from. */
  id: string;
  date: string;
  // Dressing
  typeOfWound?: string;
  /** Display names of every ointment recorded on this encounter. */
  ointments: Array<string>;
  dressingGeneralNotes?: string;
  // Other measures
  ecgImage?: string;
  spirometry?: number;
  monofilament?: number;
  // Nursing procedures
  imInjection?: string;
  ivInjection?: string;
  oral?: string;
  nebulization?: string;
}

/** A single-valued form field, i.e. everything except the Ointment multi-select. */
export type ScalarNursingField = Exclude<keyof NursingRecord, 'id' | 'date' | 'ointments'>;

export interface ConceptAnswer {
  uuid: string;
  display: string;
}
