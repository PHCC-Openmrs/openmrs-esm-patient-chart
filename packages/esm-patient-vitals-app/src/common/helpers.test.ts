import { assessValue, getLatestVitalsAndBiometrics, interpretBloodPressure, prepareObsForSubmission } from './helpers';
import { vi, describe, it, expect } from 'vitest';
import type { ObsReferenceRanges, PatientVitalsAndBiometrics } from './types';
import type { VitalsAndBiometricsFieldValuesMap } from './data.resource';

const temperatureRange: ObsReferenceRanges = {
  hiAbsolute: 43,
  hiCritical: 40,
  hiNormal: 37.5,
  lowNormal: 36.5,
  lowCritical: 35,
  lowAbsolute: 25,
};

describe('assessValue', () => {
  it('returns "normal" when no range is provided', () => {
    expect(assessValue(37, undefined)).toBe('normal');
  });

  it('returns "normal" when value is undefined', () => {
    expect(assessValue(undefined, temperatureRange)).toBe('normal');
  });

  it('returns "normal" for a value within normal range', () => {
    expect(assessValue(37, temperatureRange)).toBe('normal');
  });

  it('returns "high" for a value above hiNormal but below hiCritical', () => {
    expect(assessValue(38, temperatureRange)).toBe('high');
  });

  it('returns "critically_high" for a value at or above hiCritical', () => {
    expect(assessValue(40, temperatureRange)).toBe('critically_high');
    expect(assessValue(42, temperatureRange)).toBe('critically_high');
  });

  it('returns "low" for a value below lowNormal but above lowCritical', () => {
    expect(assessValue(36, temperatureRange)).toBe('low');
  });

  it('returns "critically_low" for a value at or below lowCritical', () => {
    expect(assessValue(35, temperatureRange)).toBe('critically_low');
    expect(assessValue(30, temperatureRange)).toBe('critically_low');
  });

  it('correctly evaluates a value of 0 against reference ranges', () => {
    expect(assessValue(0, temperatureRange)).toBe('critically_low');
  });
});

describe('interpretBloodPressure', () => {
  const concepts = {
    systolicBloodPressureUuid: 'systolic-uuid',
    diastolicBloodPressureUuid: 'diastolic-uuid',
  };

  const systolicRange: ObsReferenceRanges = {
    hiAbsolute: 250,
    hiCritical: 180,
    hiNormal: 140,
    lowNormal: 90,
    lowCritical: 70,
    lowAbsolute: 0,
  };

  const diastolicRange: ObsReferenceRanges = {
    hiAbsolute: 150,
    hiCritical: 120,
    hiNormal: 90,
    lowNormal: 60,
    lowCritical: 40,
    lowAbsolute: 0,
  };

  const conceptMetadata = [
    { uuid: 'systolic-uuid', ...systolicRange, display: 'Systolic', units: 'mmHg' },
    { uuid: 'diastolic-uuid', ...diastolicRange, display: 'Diastolic', units: 'mmHg' },
  ];

  it('returns "normal" when both values are within range', () => {
    expect(interpretBloodPressure(120, 80, concepts, conceptMetadata)).toBe('normal');
  });

  it('returns "high" when systolic is above hiNormal', () => {
    expect(interpretBloodPressure(150, 80, concepts, conceptMetadata)).toBe('high');
  });

  it('returns "critically_high" when diastolic is at or above hiCritical', () => {
    expect(interpretBloodPressure(120, 120, concepts, conceptMetadata)).toBe('critically_high');
  });

  it('prefers FHIR interpretation over calculated values when provided', () => {
    expect(interpretBloodPressure(120, 80, concepts, conceptMetadata, 'high', 'normal')).toBe('high');
  });

  it('returns "normal" when conceptMetadata is undefined', () => {
    expect(interpretBloodPressure(200, 130, concepts, undefined)).toBe('normal');
  });
});

describe('getLatestVitalsAndBiometrics', () => {
  it('returns undefined when there are no vitals', () => {
    expect(getLatestVitalsAndBiometrics(undefined)).toBeUndefined();
    expect(getLatestVitalsAndBiometrics([])).toBeUndefined();
  });

  it('returns the full row unchanged when the latest encounter has every field', () => {
    const vitals: Array<PatientVitalsAndBiometrics> = [
      { id: 'enc-1', date: '2026-08-30', systolic: 120, diastolic: 80, pulse: 72, weight: 70, height: 170 },
    ];

    expect(getLatestVitalsAndBiometrics(vitals)).toEqual(vitals[0]);
  });

  it('backfills fields missing from the latest encounter with values from older encounters', () => {
    // Simulates a nutrition assessment encounter (only MUAC) recorded after a full vitals encounter.
    const vitals: Array<PatientVitalsAndBiometrics> = [
      { id: 'enc-2', date: '2026-08-31', muac: 21 },
      { id: 'enc-1', date: '2026-08-30', systolic: 120, diastolic: 80, pulse: 72, weight: 70, height: 170 },
    ];

    const result = getLatestVitalsAndBiometrics(vitals);

    // The id/date reflect the most recent encounter (activity freshness)...
    expect(result.id).toBe('enc-2');
    expect(result.date).toBe('2026-08-31');
    // ...but every field is populated instead of only MUAC.
    expect(result.muac).toBe(21);
    expect(result.systolic).toBe(120);
    expect(result.diastolic).toBe(80);
    expect(result.pulse).toBe(72);
    expect(result.weight).toBe(70);
    expect(result.height).toBe(170);
  });

  it('prefers the most recent value for a field over older ones', () => {
    const vitals: Array<PatientVitalsAndBiometrics> = [
      { id: 'enc-3', date: '2026-09-01', muac: 22 },
      { id: 'enc-2', date: '2026-08-31', muac: 21, weight: 71 },
      { id: 'enc-1', date: '2026-08-30', muac: 20, weight: 70 },
    ];

    const result = getLatestVitalsAndBiometrics(vitals);

    expect(result.muac).toBe(22);
    expect(result.weight).toBe(71);
  });

  it('preserves a value of 0 instead of treating it as missing', () => {
    const vitals: Array<PatientVitalsAndBiometrics> = [
      { id: 'enc-2', date: '2026-08-31', muac: 21 },
      { id: 'enc-1', date: '2026-08-30', respiratoryRate: 0 },
    ];

    expect(getLatestVitalsAndBiometrics(vitals).respiratoryRate).toBe(0);
  });
});

describe('prepareObsForSubmission', () => {
  const fieldToConceptMap = {
    temperatureUuid: 'temp-concept-uuid',
    pulseUuid: 'pulse-concept-uuid',
    generalPatientNoteUuid: 'note-concept-uuid',
  };

  const emptyFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map();

  it('creates an obs when value is 0', () => {
    const formData = { temperature: 0 };
    const dirtyFields = { temperature: true };

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([{ concept: 'temp-concept-uuid', value: 0 }]);
  });

  it('does not create an obs when value is undefined', () => {
    const formData = { temperature: undefined };
    const dirtyFields = { temperature: true };

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([]);
  });

  it('does not create an obs when value is an empty string', () => {
    const formData = { generalPatientNote: '' } as any;
    const dirtyFields = { generalPatientNote: true };

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([]);
  });

  it('does not create an obs when field is not dirty', () => {
    const formData = { temperature: 37 };
    const dirtyFields = {};

    const result = prepareObsForSubmission(formData, dirtyFields, 'creating', emptyFieldValuesMap, fieldToConceptMap);

    expect(result.newObs).toEqual([]);
  });

  it('voids old obs and creates replacement when editing to 0', () => {
    const formData = { temperature: 0 };
    const dirtyFields = { temperature: true };
    const initialFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map([
      ['temperature', { value: 37, obs: { uuid: 'old-obs-uuid' } }],
    ]);

    const result = prepareObsForSubmission(formData, dirtyFields, 'editing', initialFieldValuesMap, fieldToConceptMap);

    expect(result.toBeVoided).toEqual([{ uuid: 'old-obs-uuid', voided: true }]);
    expect(result.newObs).toEqual([{ concept: 'temp-concept-uuid', value: 0 }]);
  });

  it('voids old obs without replacement when editing to undefined (clearing a field)', () => {
    const formData = { temperature: undefined };
    const dirtyFields = { temperature: true };
    const initialFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map([
      ['temperature', { value: 37, obs: { uuid: 'old-obs-uuid' } }],
    ]);

    const result = prepareObsForSubmission(formData, dirtyFields, 'editing', initialFieldValuesMap, fieldToConceptMap);

    expect(result.toBeVoided).toEqual([{ uuid: 'old-obs-uuid', voided: true }]);
    expect(result.newObs).toEqual([]);
  });

  it('voids old obs without replacement when editing to empty string', () => {
    const formData = { generalPatientNote: '' } as any;
    const dirtyFields = { generalPatientNote: true };
    const initialFieldValuesMap: VitalsAndBiometricsFieldValuesMap = new Map([
      ['generalPatientNote', { value: 'old note', obs: { uuid: 'old-note-uuid' } }],
    ]);

    const result = prepareObsForSubmission(formData, dirtyFields, 'editing', initialFieldValuesMap, fieldToConceptMap);

    expect(result.toBeVoided).toEqual([{ uuid: 'old-note-uuid', voided: true }]);
    expect(result.newObs).toEqual([]);
  });
});
