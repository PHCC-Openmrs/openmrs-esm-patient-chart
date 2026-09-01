export {
  createOrUpdateVitalsAndBiometrics,
  deleteEncounter,
  invalidateCachedVitalsAndBiometrics,
  useConceptUnits,
  useEncounterVitalsAndBiometrics,
  useVitalsAndBiometrics,
  useVitalsConceptMetadata,
  withUnit,
  type ConceptMetadata,
} from './data.resource';
export {
  assessValue,
  calculateBodyMassIndex,
  canRecordVitalsAndBiometrics,
  generatePlaceholder,
  getLatestVitalsAndBiometrics,
  getReferenceRangesForConcept,
  interpretBloodPressure,
} from './helpers';
export type { ObservationInterpretation, PatientVitalsAndBiometrics } from './types';
